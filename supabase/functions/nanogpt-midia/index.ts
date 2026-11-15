// Endpoints autenticados para pesquisa, proposta e cópia humana de imagens aprovadas.
// Nenhuma ação de exportação é exposta como ferramenta ao LLM.
import { autenticar, json, CORS } from "../_shared/conector/edge.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { decifrar, cifrar } from "../_shared/cripto.ts";
import { clienteDoAmbiente, renovarAccess } from "../_shared/google_oauth.ts";
import { configSearxngOuNulo } from "../_shared/ia/searxng.ts";
import { escolherProvedorBusca } from "../_shared/ia/provedor_busca.ts";
import { proporImagem } from "../_shared/ia/escrita.ts";
import { baixarImagemOriginal, urlImagemSegura, sha256Hex } from "../_shared/busca_segura/imagem_original.ts";
import { validarImagemAprovada, corpoImagensBling, copiarDrive, decidirReconciliacao, chaveIdempotencia, FERRAMENTA_IMAGENS } from "../_shared/nanogpt_midia.ts";
import { buscarDefinicao } from "../_shared/conector/registro.ts";
import { decidir } from "../_shared/conector/policy.ts";
import { BlingEscritaReal } from "../_shared/conector/porta_bling.ts";
import { blingFetch } from "../_shared/bling_api.ts";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
const get = (n: string) => Deno.env.get(n);
const flagsLigadas = () => get("NANOGPT_MIDIA_EXPORTAR") === "1" && get("BLING_ESCRITA_REAL") === "1";
/** Estados da trava operacional em que o produto não pode receber escrita por aqui (bloqueado ou com proposta em execução). */
const TRAVADO = ["bloqueado", "aprovado_execucao", "em_execucao"];
/** Liberação da escrita por loja e por ferramenta (decisão do dono, com referência e auditoria; revogável). Falha fechada. */
const liberadaNaLoja = async (admin: any, lojaId: string) => {
  const r = await admin.from("agente_escrita_liberada").select("ferramenta").eq("loja_id", lojaId).eq("ferramenta", FERRAMENTA_IMAGENS).is("revogada_em", null).maybeSingle();
  return !r.error && !!r.data;
};
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const raw = await req.text();
  if (raw.length > 8000) return json({ erro: "Pedido muito grande." }, 413);
  let b: any; try { b = JSON.parse(raw); } catch { return json({ erro: "JSON inválido." }, 400); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return json({ erro: "Pedido inválido." }, 400);
  const s = await autenticar(req, b.loja_id); if (s instanceof Response) return s;
  const { admin, lojaId, userId } = s;
  const inicio = Date.now(), requestId = crypto.randomUUID();
  const audit = async (acao: string, depois: unknown) => {
    const r = await admin.from("auditoria").insert({ loja_id: lojaId, user_id: userId, acao: `nanogpt.${acao}`, tabela: "produto_imagens", depois: { request_id: requestId, dados: depois } });
    if (r.error) throw new Error("Falha ao registrar auditoria.");
  };
  try {
    const limit = await admin.rpc("limite_chamada", { p_chave: `nanogpt-midia:${lojaId}:${userId}`, p_max: 15, p_janela_s: 60 });
    if (limit.error || limit.data !== true) return json({ erro: "Limite temporário de chamadas." }, 429);
    const chaveiro = await chaveiroPlataforma(admin, get);
    const { config: searxng } = configSearxngOuNulo(get, lojaId);
    const bi = await admin.from("loja_busca_imagem").select("ativa").eq("loja_id", lojaId).maybeSingle();
    if (b.acao === "status") {
      const [bling, google] = await Promise.all([admin.from("bling_conexoes").select("status").eq("loja_id", lojaId).maybeSingle(), admin.from("google_conexoes").select("status").eq("loja_id", lojaId).maybeSingle()]);
      if (bling.error || google.error || bi.error) throw new Error("Não foi possível verificar as conexões.");
      const liberada = await liberadaNaLoja(admin, lojaId), ativa = buscarDefinicao(FERRAMENTA_IMAGENS)?.estado === "ativa";
      return json({ busca: searxng ? "searxng" : bi.data?.ativa ? "google" : null, bling: bling.data?.status ?? "ausente", drive: google.data?.status ?? "ausente", exportacao: flagsLigadas() && ativa && liberada, exportacao_motivo: !ativa ? "Ferramenta de imagens desligada no registro." : !liberada ? "Falta a liberação desta loja para gravar imagens no Bling." : flagsLigadas() ? null : "Flags do servidor desligadas.", request_id: requestId });
    }
    if (b.acao === "buscar") {
      let buscaImagem = null;
      if (!searxng && chaveiro) {
        const r = await admin.rpc("busca_imagem_ler", { p_loja: lojaId });
        const k = Array.isArray(r.data) ? r.data[0] : r.data;
        if (k?.api_key_cifrada) buscaImagem = { chave: await decifrar(k.api_key_cifrada, chaveiro), cx: k.cx };
      }
      const busca = escolherProvedorBusca({ searxng, buscaImagem });
      if (!busca) return json({ erro: "Nenhum buscador configurado. Configure o SearXNG privado ou informe URL e fonte da imagem.", codigo: "sem_provedor" }, 503);
      if (typeof b.consulta !== "string" || b.consulta.trim().length < 3 || b.consulta.length > 160) return json({ erro: "Informe referência e fabricante (3 a 160 caracteres)." }, 422);
      const candidatas = await busca.imagens(b.consulta, 4);
      await audit("busca", { quantidade: candidatas.length, provedor: busca.id });
      return json({ candidatas, provedor: busca.id, latencia_ms: Date.now() - inicio });
    }
    if (b.acao === "propor") {
      if (typeof b.pagina !== "string" || !urlImagemSegura(b.pagina).ok) return json({ erro: "Informe a página HTTPS de origem." }, 422);
      await audit("proposta_solicitada", { sku: b.sku });
      const proposta = await proporImagem(admin, lojaId, { sku: b.sku, url: b.url, pagina: b.pagina, origem: "Pesquisa revisada pelo lojista" });
      return json(proposta);
    }
    if (!["preparar", "exportar", "reconciliar"].includes(b.acao) || !uuid(b.imagem_id)) return json({ erro: "Ação ou imagem inválida." }, 422);
    if (s.papel !== "lojista") return json({ erro: "Só o responsável da loja pode exportar imagens." }, 403);
    const { data: imagem, error: ei } = await admin.from("produto_imagens").select("*").eq("loja_id", lojaId).eq("id", b.imagem_id).maybeSingle();
    if (ei) throw new Error("Falha na leitura da imagem.");
    if (!imagem) return json({ erro: "Imagem não encontrada nesta loja." }, 404);
    const { data: produto, error: ep } = await admin.from("produtos").select("id,sku,nome,bling_id").eq("loja_id", lojaId).eq("id", imagem.produto_id).single();
    if (ep || !produto || !/^\d+$/.test(String(produto.bling_id))) throw new Error("Produto sem vínculo confirmado com o Bling.");
    // Trava pendente deste produto: nada novo começa antes da reconciliação (leitura do Bling por uma pessoa).
    const lock = `${lojaId}/nanogpt-locks/${produto.id}.txt`;
    const travaArq = await admin.storage.from("agente-anexos").download(lock);
    let pendente: Record<string, unknown> | null = null;
    if (!travaArq.error && travaArq.data) { try { pendente = JSON.parse(await travaArq.data.text()); } catch { pendente = { estado: "ilegivel" }; } }
    if (b.acao === "reconciliar") {
      if (!pendente) return json({ erro: "Não há operação pendente para este produto." }, 404);
      if (pendente.imagem_id !== imagem.id) return json({ erro: "A pendência deste produto é de outra imagem; confira pelo recibo.", recibo: pendente }, 409);
      const prefixo = admin.storage.from("produtos-imagens").getPublicUrl(`${lojaId}/${produto.id}/`).data.publicUrl;
      if (typeof pendente.conecta_url !== "string" || !pendente.conecta_url.startsWith(prefixo)) return json({ erro: "Recibo não corresponde a este produto; conferência manual necessária.", recibo: pendente }, 409);
      if (!chaveiro) throw new Error("Cofre indisponível.");
      const lido = await blingFetch(armazemSupabase(admin), lojaId, `/produtos/${produto.bling_id}`, { chaveCifra: chaveiro });
      if (!lido.ok) return json({ erro: "Bling não respondeu à conferência; a trava continua.", recibo: pendente }, 409);
      const links = ((await lido.json()).data?.midia?.imagens?.externas ?? []).map((x: any) => x.link);
      const conclusao = decidirReconciliacao(pendente, links);
      if (b.confirmar !== true || conclusao.tipo === "aguardar") return json({ recibo: pendente, conclusao, liberada: false });
      if (conclusao.tipo === "gravado" && !imagem.enviada_bling_em) {
        const v = await admin.from("produto_imagens").update({ url: pendente.conecta_url, enviada_bling_em: new Date().toISOString() }).eq("loja_id", lojaId).eq("id", imagem.id).is("enviada_bling_em", null).select("id");
        if (v.error || v.data?.length !== 1) return json({ erro: "Não foi possível registrar o vínculo local; a trava continua.", recibo: pendente }, 409);
      }
      await audit("reconciliacao", { recibo: pendente, conclusao, drive_orfao: conclusao.tipo === "nao_gravado" ? pendente.drive_id ?? null : null });
      const solta = await admin.storage.from("agente-anexos").remove([lock]);
      if (solta.error) return json({ erro: "Conferência registrada, mas a trava não foi removida. Tente de novo.", recibo: pendente }, 409);
      return json({ recibo: { ...pendente, estado: conclusao.tipo === "gravado" ? "confirmado" : "liberado_sem_gravar" }, conclusao, liberada: true });
    }
    if (pendente) return json({ erro: "Há uma operação pendente neste produto. Confira e libere a trava antes de copiar de novo.", recibo: pendente }, 409);
    validarImagemAprovada(imagem);
    let arquivo: Uint8Array | undefined;
    const original = await baixarImagemOriginal(imagem.url, { maxBytes: 5 * 1024 * 1024, capturarBytes: x => { arquivo = x; }, resolver: async host => {
      const r = await Promise.allSettled([Deno.resolveDns(host, "A"), Deno.resolveDns(host, "AAAA")]);
      return r.flatMap(x => x.status === "fulfilled" ? x.value : []);
    } });
    if (!original.ok || !arquivo) throw new Error(original.ok ? "Arquivo indisponível." : original.erro);
    const info = original.imagem;
    if (imagem.enviada_bling_em) return json({ erro: "Esta imagem já foi enviada ao Bling. Confira a auditoria antes de copiar novamente." }, 409);
    if (b.acao === "preparar") return json({ imagem_id: imagem.id, sku: produto.sku, nome: produto.nome, url: imagem.url, ...info, destinos: ["Conecta.IA", "Google Drive", "Bling"] });
    if (b.confirmar !== true || b.sha256 !== info.sha256) return json({ erro: "Revise e confirme a versão exata da imagem. O arquivo pode ter mudado." }, 409);
    if (!flagsLigadas()) return json({ erro: "Exportação real ainda não habilitada neste ambiente." }, 409);
    // Policy Engine ANTES de qualquer cópia: aprovação humana = lojista + imagem aprovada + direitos + hash confirmado nesta chamada.
    const trava = await admin.from("produto_travas").select("estado").eq("loja_id", lojaId).eq("produto_id", produto.id).maybeSingle();
    if (trava.error) throw new Error("Não foi possível ler a trava do produto.");
    const politica = decidir(buscarDefinicao(FERRAMENTA_IMAGENS), { origem: "executor", aprovacaoValida: true, simulado: false, escritaRealLiberada: await liberadaNaLoja(admin, lojaId), produtoTravado: TRAVADO.includes(trava.data?.estado) });
    if (politica.decisao !== "permitida") {
      await audit("exportacao_negada", { imagem_id: imagem.id, sku: produto.sku, politica });
      return json({ erro: `Política do Conecta.IA não permite esta escrita agora (${politica.motivo}).` }, 409);
    }
    if (!chaveiro) throw new Error("Cofre indisponível.");
    const cliente = clienteDoAmbiente(get); if (!cliente) throw new Error("Google não configurado no servidor.");
    const cred = await admin.rpc("google_ler_credenciais", { p_loja_id: lojaId }); const g = cred.data?.[0];
    if (cred.error || !g?.escopos?.includes("https://www.googleapis.com/auth/drive.file")) throw new Error("Reconecte o Google Drive.");
    let token = await decifrar(g.access_token_cifrado, chaveiro);
    if (Date.parse(g.expira_em) < Date.now() + 60_000) {
      const novo = await renovarAccess(cliente, await decifrar(g.refresh_token_cifrado, chaveiro));
      if (!novo) throw new Error("Google recusou a renovação; reconecte.");
      token = novo.access;
      const salvo = await admin.rpc("google_atualizar_access", { p_loja_id: lojaId, p_access: await cifrar(token, chaveiro), p_expira_em: novo.expiraEm.toISOString() });
      if (salvo.error) throw new Error("Não foi possível guardar a renovação do Google.");
    }
    const arm = armazemSupabase(admin), cfg = { chaveCifra: chaveiro };
    const porta = new BlingEscritaReal(arm, lojaId, cfg, true); // flags e política já conferidas acima
    const id = String(produto.bling_id), caminho = `/produtos/${id}`;
    const ler = async () => { const r = await blingFetch(arm, lojaId, caminho, cfg); if (!r.ok) throw new Error("Bling não confirmou leitura do produto."); return (await r.json()).data; };
    const antes = await ler(); if (antes?.codigo !== produto.sku) throw new Error("SKU no Bling mudou; sincronize e revise.");
    const ext = info.mime === "image/jpeg" ? "jpg" : info.mime === "image/png" ? "png" : "webp";
    const path = `${lojaId}/${produto.id}/${info.sha256}.${ext}`;
    const url = admin.storage.from("produtos-imagens").getPublicUrl(path).data.publicUrl;
    const corpo = corpoImagensBling(antes, url);
    const ids = await fetch("https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000), redirect: "error" });
    if (!ids.ok) throw new Error("Drive indisponível antes da gravação.");
    const driveId = (await ids.json()).ids?.[0]; if (!driveId) throw new Error("Drive não reservou o arquivo.");
    // Lock persistente por produto: um erro/timeout NÃO libera nova escrita às cegas.
    const recibo: any = { request_id: requestId, idempotency_key: chaveIdempotencia(imagem.id, info.sha256), ferramenta: FERRAMENTA_IMAGENS, imagem_id: imagem.id, sha256: info.sha256, sku: produto.sku, drive_id: driveId, conecta_url: url, estado: "iniciando" };
    const armazenar = async (upsert: boolean) => { recibo.atualizado_em = new Date().toISOString(); const r = await admin.storage.from("agente-anexos").upload(lock, new Blob([JSON.stringify(recibo)], { type: "text/plain" }), { upsert, contentType: "text/plain" }); if (r.error) throw new Error("Operação bloqueada ou pendente de conferência. Não repita; consulte a auditoria."); };
    await armazenar(false);
    try {
      const revisada = await admin.from("produto_imagens").select("*").eq("loja_id", lojaId).eq("id", imagem.id).single();
      if (revisada.error || revisada.data?.enviada_bling_em || revisada.data?.url !== imagem.url) throw new Error("Outra operação alterou ou exportou esta imagem. Confira a auditoria.");
      validarImagemAprovada(revisada.data);
      await audit("exportacao_aprovada", recibo);
      const copia = await admin.storage.from("produtos-imagens").upload(path, arquivo, { upsert: false, contentType: info.mime });
      if (copia.error && String(copia.error.statusCode) !== "409") throw new Error("Falha ao copiar no Conecta.IA.");
      const conferida = await admin.storage.from("produtos-imagens").download(path);
      if (conferida.error || !conferida.data || await sha256Hex(new Uint8Array(await conferida.data.arrayBuffer())) !== info.sha256) throw new Error("A cópia no Conecta.IA não corresponde ao original.");
      recibo.estado = "conecta_copiado"; await armazenar(true);
      recibo.drive = await copiarDrive(token, driveId, `${produto.sku}-${info.sha256.slice(0,12)}.${ext}`, arquivo, info.mime, info.sha256);
      recibo.estado = "drive_copiado"; await armazenar(true);
      // Revalida a aprovação e a galeria imediatamente antes do PATCH.
      const atualImagem = await admin.from("produto_imagens").select("*").eq("loja_id", lojaId).eq("id", imagem.id).single();
      validarImagemAprovada(atualImagem.data);
      if (atualImagem.data.url !== imagem.url) throw new Error("Imagem mudou durante a cópia; revise.");
      const atual = await ler();
      if (JSON.stringify(atual.midia) !== JSON.stringify(antes.midia) || atual.codigo !== antes.codigo) throw new Error("Galeria mudou durante a cópia; revise antes de enviar ao Bling.");
      recibo.estado = "bling_enviando"; await armazenar(true);
      const escrita = await porta.chamar(FERRAMENTA_IMAGENS, { id, corpo }, recibo.idempotency_key);
      if (escrita.status < 200 || escrita.status >= 300) throw new Error(`Bling respondeu HTTP ${escrita.status}; confira antes de repetir.`);
      const depois = await ler();
      const links = (depois.midia?.imagens?.externas ?? []).map((x: any) => x.link);
      if (!corpo.midia.imagens.imagensURL.every(x => links.includes(x.link))) throw new Error("Bling não confirmou todas as imagens. Conferência necessária.");
      const vinculo = await admin.from("produto_imagens").update({ url, enviada_bling_em: new Date().toISOString() }).eq("loja_id", lojaId).eq("id", imagem.id).eq("url", imagem.url).select("id");
      if (vinculo.error || vinculo.data?.length !== 1) throw new Error("Cópias gravadas, mas o vínculo local exige conferência.");
      recibo.estado = "confirmado"; recibo.latencia_ms = Date.now() - inicio;
      await armazenar(true); await audit("exportacao_confirmada", recibo);
      // A auditoria conserva o recibo confirmado. Falhas mantêm o lock para reconciliação.
      const liberar = await admin.storage.from("agente-anexos").remove([lock]);
      if (liberar.error) throw new Error("Cópias confirmadas; a trava exige liberação manual.");
      return json({ ok: true, recibo });
    } catch (e) {
      recibo.etapa_interrompida = recibo.estado; recibo.estado = "conferencia_necessaria";
      await armazenar(true).catch(() => undefined); await audit("exportacao_pendente", recibo).catch(() => undefined);
      return json({ erro: e instanceof Error ? e.message : "Cópia não confirmada.", recibo }, 409);
    }
  } catch (e) { return json({ erro: e instanceof Error ? e.message : "Operação não concluída.", request_id: requestId }, 422); }
});
