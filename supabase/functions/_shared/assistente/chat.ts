// Fluxo persistente isolado do modo legado. Dependências injetadas para testes sem credenciais.
import { chaveiroPlataforma } from "../plataforma.ts";
import { decifrar } from "../cripto.ts";
import { conversar, IaErro, type Mensagem } from "../ia/claude.ts";
import type { AdaptadorStream } from "../ia/adaptadores_stream.ts";
import { modeloDaChave, validarProvedor, type ProvedorChat } from "./provedores.ts";
import { avisoTroca, FERRAMENTAS_FREE, PROVEDOR_FREE, podeTrocarParaFree, SISTEMA_FREE, URL_FREE } from "./free_automatico.ts";
import { configFallbackFree, tentarFallbackFree } from "./fallback_free.ts";
import { CONSULTAR_PRODUTO, consultarProduto } from "./bling_consultar.ts";
import { gerarFichaSemLLM } from "./ficha_sem_llm.ts";
import { executarFerramenta, FERRAMENTAS, SISTEMA } from "../ia/ferramentas.ts";
import { configSearxngOuNulo } from "../ia/searxng.ts";
import { dadosSupabase } from "../conector/dados.ts";
import { despachar } from "../conector/despacho.ts";
import { textoDoContexto, type RespostaContexto } from "../contexto/ler.ts";
import { BlingLeituraReal } from "../conector/porta_bling.ts";
import { armazemSupabase } from "../bling_armazem.ts";
import { conteudoComAnexos, REGRAS_ANEXO, resumoParaRegistro, validarAnexos, type AnexoValido } from "./anexos.ts";

/** Ferramentas de PROPOSTA do Bling liberadas neste fluxo (nenhuma grava no Bling; o lojista aprova a versão exata na Central de Inteligência). */
export const FERRAMENTAS_PROPOSTA_BLING = ["bling_categorias", "bling_propor_categoria", "bling_propor_trocar_categoria", "bling_propor_reativar_produto", "bling_propor_ajuste_produto"] as const;
/** Pesquisa somente leitura; passa pelo mesmo Policy Engine e pelo limite do chat por loja/usuario. */
export const FERRAMENTAS_PESQUISA = ["buscar_imagem_web", "buscar_dados_tecnicos_web"] as const;
export interface ChatContexto {
 usuario: any; admin: any; loja: { id: string; nome: string }; userId: string; get(n: string): string | undefined; fetch?: typeof fetch;
 /** B2b (#166): texto da resposta assim que existir (streaming). Opcional: sem ele o turno é idêntico ao de antes. */
 aoTexto?(delta: string): void;
 /** Adaptador com streaming do provedor. Só é usado com `aoTexto` e sem anexos (os adaptadores de streaming recusam anexo). */
 adaptadorStream?(provedor: "claude" | "gemini" | "compativel_openai"): AdaptadorStream | undefined;
}
const resultado = (corpo: unknown, status = 200) => ({ corpo, status });
const uuid = (x: unknown) => typeof x === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
export async function atenderChat(c: Record<string, any>, ctx: ChatContexto) {
 const { usuario, admin, loja, userId } = ctx;
 const { data: flags, error: flagsError } = await usuario.from("recursos_efetivos").select("codigo, ativo").eq("loja_id", loja.id);
 if (flagsError || !Array.isArray(flags)) return resultado({ erro: "Não foi possível verificar os recursos do chat." }, 503);
 if (c.antes != null && (typeof c.antes !== "string" || !/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(c.antes) || !Number.isFinite(Date.parse(c.antes)) || !uuid(c.antes_id))) return resultado({ erro: "Cursor inválido." }, 400);
 const ativo = (codigo: string) => flags.some((r: any) => r.codigo === codigo && r.ativo === true);
 if (c.acao === "chat_config") {
  const { data: config, error } = await usuario.from("lojas").select("chat_retencao_dias").eq("id", loja.id).single();
  return error ? resultado({ erro: "Preparação do histórico ainda não instalada." }, 503) : resultado({ streaming: true, persistente: ativo("chat_persistente"), bling: ativo("chat_consulta_bling"), leitura_administrativa: ativo("chat_leitura_administrativa"), retencao_dias: config.chat_retencao_dias, fallback_free_disponivel: configFallbackFree(ctx.get, loja.id) !== null, versao: "chat_operacional_v1" });
 }
 // Excluir e configurar continuam disponíveis quando o recurso é desligado.
 if (c.acao === "chat_excluir" && uuid(c.conversa_id)) {
  const { data, error } = await usuario.rpc("chat_excluir", { p_conversa: c.conversa_id });
  return error ? resultado({ erro: "Não foi possível excluir; aguarde qualquer turno em execução." }, 409) : resultado({ excluida: data === true });
 }
 if (c.acao === "chat_retencao") {
  if (!Number.isInteger(c.dias) || c.dias < 7 || c.dias > 730) return resultado({ erro: "Informe de 7 a 730 dias." }, 400);
  const { data, error } = await usuario.rpc("chat_definir_retencao", { p_loja: loja.id, p_dias: c.dias });
  return error || data !== true ? resultado({ erro: "Alteração não permitida." }, 403) : resultado({ ok: true });
 }
 if (c.acao === "chat_admin" && uuid(c.conversa_id)) {
  const { data, error } = await usuario.rpc("chat_ler_como_administrador", { p_loja: loja.id, p_conversa: c.conversa_id, p_motivo: c.motivo, p_antes: c.antes ?? null, p_antes_id: c.antes_id ?? null });
  return error ? resultado({ erro: "Leitura administrativa não permitida." }, 403) : resultado({ mensagens: data });
 }
 if (c.acao === "chat_comprovantes" && uuid(c.conversa_id)) {
  const { data: propria, error: pe } = await usuario.from("conversas").select("id").eq("loja_id", loja.id).eq("user_id", userId).eq("id", c.conversa_id).maybeSingle();
  if (pe || !propria) return resultado({ erro: "Conversa não encontrada." }, 404);
  const { data, error } = await usuario.from("auditoria").select("acao, depois, quando").eq("loja_id", loja.id).eq("user_id", userId).eq("depois->>conversa_id", c.conversa_id).order("quando", { ascending: false }).limit(100);
  return error ? resultado({ erro: "Não foi possível verificar a auditoria." }, 503) : resultado({ registros: data });
 }
 if (c.acao === "chat_listar") {
  let q = usuario.from("conversas").select("id, titulo, atualizada_em").eq("loja_id", loja.id).eq("user_id", userId).order("atualizada_em", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (c.antes) q = q.or(`atualizada_em.lt.${c.antes},and(atualizada_em.eq.${c.antes},id.lt.${c.antes_id})`);
  const { data, error } = await q;
  return error ? resultado({ erro: "Não foi possível ler o histórico." }, 503) : resultado({ conversas: data });
 }
 if (c.acao === "chat_mensagens" && uuid(c.conversa_id)) {
  let q = usuario.from("mensagens").select("id, papel, conteudo, metadados, criada_em").eq("loja_id", loja.id).eq("user_id", userId).eq("conversa_id", c.conversa_id).order("criada_em", { ascending: false }).order("id", { ascending: false }).limit(100);
  if (c.antes) q = q.or(`criada_em.lt.${c.antes},and(criada_em.eq.${c.antes},id.lt.${c.antes_id})`);
  const { data, error } = await q;
  return error ? resultado({ erro: "Não foi possível ler as mensagens." }, 503) : resultado({ mensagens: (data ?? []).reverse() });
 }
 if (c.acao === "chat_contexto_vivo") {
  // Pergunta estruturada "quais produtos estão selecionados / qual é o produto ativo": resposta DIRETA do banco, sem provedor de IA (funciona com o Gemini no limite).
  // Passa pelo despachante único (Policy Engine + auditoria); lê só a sessão desta pessoa nesta loja. Não persiste mensagem, não grava nada.
  if (c.anexos != null || c.conversa_id != null || c.provedor != null) return resultado({ erro: "Consulta de contexto não aceita anexos." }, 400);
  const conector = { origem: "chat" as const, lojaId: loja.id, userId, dados: dadosSupabase(admin, loja.id), rpc: (fn: string, args: Record<string, unknown>) => admin.rpc(fn, args), admin, conversaId: null, agente: { nome: "Nano.ia (sem IA)", provedor: "nenhum", modelo: "deterministico" } };
  const r = await despachar("conecta.contexto.produto_ativo", {}, conector as any);
  const ctxVivo = r.resultado as RespostaContexto | undefined;
  // "contexto_indisponivel" é um resultado normal (nada compartilhado ou expirado), não uma falha: o despachante o marca como erro, mas a resposta correta é o texto de orientação.
  if (!ctxVivo || (!r.ok && ctxVivo.disponivel !== false)) return resultado({ erro: "Não foi possível ler o contexto agora." }, 503);
  return resultado({ resposta: textoDoContexto(ctxVivo), ia: false, contexto: ctxVivo.disponivel ? { versao: ctxVivo.versao, ativo: ctxVivo.produto_ativo?.sku ?? null, selecionados: ctxVivo.selecionados.map((p) => p.sku) } : { disponivel: false }, auditoria_falhou: r.auditoria_falhou === true ? true : undefined });
 }
 if (c.acao === "chat_ficha_produto") {
  // Consulta autenticada e auditada que independe de qualquer chave/provedor LLM.
  // NÃO persiste como mensagem de conversa nem cria/propoe produto.
  if (!ativo("chat_consulta_bling")) return resultado({ erro: "Consulta Bling indisponível nesta loja." }, 403);
  if (typeof c.codigo !== "string" || !/^[A-Za-z0-9_.\\/-]{1,60}$/.test(c.codigo) || c.codigo.startsWith(".") ||
      c.anexos != null || c.conversa_id != null || c.provedor != null) return resultado({ erro: "Informe um único SKU ou código de fabricante (até 60 caracteres), sem anexos." }, 400);
  const chamadas: Record<string, unknown>[] = [], evidencias: Record<string, unknown>[] = [];
  try {
   const chaveCifra = await chaveiroPlataforma(admin, ctx.get);
   if (!chaveCifra) return resultado({ erro: "Credencial do conector não disponível para consulta." }, 503);
   const simulado = ctx.get("CHAT_AMBIENTE") === "sintetico";
   const prova = await consultarProduto({ codigo: c.codigo, incluir_excluidos: true },
     { usuario, admin, lojaId: loja.id, userId, cfg: { chaveCifra, fetch: ctx.fetch }, simulado, chamadas, evidencias, ficha: true });
   const ficha = gerarFichaSemLLM(prova);
   return resultado({ ...ficha, evidencias, chamadas, simulado, ia: false, ferramentas: [CONSULTAR_PRODUTO.name] });
  } catch {
   return resultado({ erro: "A ficha não foi concluída. Verifique conexão, autorização ou auditoria do Bling; nenhum cadastro foi criado." }, 503);
  }
 }
 if (c.acao === "chat_corrigir_produto") {
  // Proposta de correção de CADASTRO sem LLM: independe de chave/cota de provedor. NÃO grava no Bling: cria a proposta versionada que só a pessoa aprova na fila.
  if (!ativo("chat_consulta_bling")) return resultado({ erro: "Consulta Bling indisponível nesta loja." }, 403);
  const campos = c.campos, fonte = typeof c.fonte === "string" ? c.fonte.trim() : "";
  if (typeof c.sku !== "string" || !/^[A-Za-z0-9_.\\/-]{1,60}$/.test(c.sku) || c.sku.startsWith(".") || !campos || typeof campos !== "object" || Array.isArray(campos) ||
      !Object.keys(campos).length || Object.keys(campos).length > 8 || c.anexos != null || c.conversa_id != null || c.provedor != null)
    return resultado({ erro: "Informe o SKU e de 1 a 8 campos de cadastro, sem anexos." }, 400);
  if (fonte.length < 5 || fonte.length > 500) return resultado({ erro: "Informe a fonte (URL ou documento) dos valores; sem fonte não proponho." }, 400);
  try {
   const { data: limitado, error: le } = await admin.rpc("limite_chamada", { p_chave: `corrigir:${loja.id}:${userId}`, p_max: 20, p_janela_s: 60 });
   if (le || limitado !== true) return resultado({ erro: "Limite temporário de correções. Aguarde um minuto." }, 429);
   const chaveCifra = await chaveiroPlataforma(admin, ctx.get);
   if (!chaveCifra) return resultado({ erro: "Credencial do conector não disponível." }, 503);
   const bling = new BlingLeituraReal(armazemSupabase(admin), loja.id, { chaveCifra, fetch: ctx.fetch });
   const conector = { origem: "chat" as const, lojaId: loja.id, userId, dados: dadosSupabase(admin, loja.id), rpc: (fn: string, args: Record<string, unknown>) => admin.rpc(fn, args), admin, bling, conversaId: null, agente: { nome: "Nano.ia (sem IA)", provedor: "nenhum", modelo: "deterministico" } };
   const out = await executarFerramenta("bling_propor_ajuste_produto", { sku: c.sku, campos, fonte }, { usuario, admin, lojaId: loja.id, plugins: [], credencial: async () => null, fetch: ctx.fetch, conector, buscaImagem: null, searxng: null }) as Record<string, any>;
   if (out?.erro) return resultado({ erro: String(out.erro), detalhes: out.detalhes, ia: false }, 422);
   return resultado({ ia: false, modo: "correcao_sem_llm", proposta: { id: out.proposta_id, titulo: out.titulo, versao: out.versao, hash: out.hash, risco: out.risco },
    resposta: `Proposta criada: ${out.titulo ?? "atualização de cadastro"}. Revise o antes/depois e aprove na fila; nada foi gravado no Bling.` });
  } catch {
   return resultado({ erro: "A proposta não foi criada. Verifique conexão, autorização ou o produto no Bling; nada foi alterado." }, 503);
  }
 }
 if (c.acao !== "chat_perguntar") return resultado({ erro: "Ação inválida." }, 400);
 if (!ativo("chat_persistente")) return resultado({ erro: "Histórico desligado nesta loja." }, 409);
 let provedor;
 try { provedor = validarProvedor(c.provedor); } catch { return resultado({ erro: "Provedor inválido." }, 400); }
 if (!provedor || c.consentimento_ia !== true) return resultado({ erro: "Escolha o provedor e autorize o envio desta conversa." }, 400);
 if (typeof c.texto !== "string" || !c.texto.trim() || c.texto.length > 1000 || typeof c.idempotency_key !== "string" || c.idempotency_key.length < 8 || c.idempotency_key.length > 120 || c.conversa_id != null && !uuid(c.conversa_id)) return resultado({ erro: "Turno inválido." }, 400);
 // Anexos validados no servidor antes de abrir o turno; o conteúdo nunca é gravado (só nome/tipo/bytes/sha256).
 let anexos: AnexoValido[] = [];
 if (c.anexos != null) {
  if (provedor === PROVEDOR_FREE) return resultado({ erro: "O modelo gratuito não recebe anexos. Escolha outro provedor para enviar arquivos." }, 400);
  const va = await validarAnexos(c.anexos, provedor);
  if (!va.ok) return resultado({ erro: va.erro }, 400);
  anexos = va.anexos;
 }
 // Idempotência consultada antes da configuração mensal: resposta já paga continua recuperável.
 const { data: turno, error: inicioErro } = await admin.rpc("chat_iniciar", { p_loja: loja.id, p_user: userId, p_conversa: c.conversa_id ?? null, p_texto: c.texto, p_idem: c.idempotency_key, p_provedor: provedor });
 if (inicioErro) return resultado({ erro: "Não foi possível iniciar o turno.", codigo: "turno_recusado" }, inicioErro.code === "P0002" ? 404 : 409);
 if (turno?.estado === "concluido") return resultado({ resposta: turno.resposta, conversa_id: turno.conversa_id, ...turno.metadados, reutilizada: true });
 if (turno?.estado !== "novo") return resultado({ erro: turno?.estado === "interrompido" ? "O turno foi interrompido; não repetimos a chamada ao provedor. Inicie uma nova pergunta." : "Turno em execução. Aguarde e tente recuperar a mesma pergunta.", codigo: turno?.estado ?? "turno_recusado", conversa_id: turno?.conversa_id }, 409);
 const chamadas: Record<string, unknown>[] = []; const evidencias: Record<string, unknown>[] = [];
 const tentativas: { ferramenta: string; ok: boolean; motivo?: string }[] = []; // toda tentativa de ferramenta, inclusive as que falharam (sem dado do usuário nem segredo)
 let tokens = 0; let respostaId: string | undefined; let modelo: string | undefined;
 let iniciouChamadaProvedor = false; let transmitiuTextoPrincipal = false;
 const simulado = ctx.get("CHAT_AMBIENTE") === "sintetico";
 let resposta = "Não consegui concluir esta pergunta."; let status = 200;
 const meta: Record<string, unknown> = { ia: true, provedor, simulado, ambiente: simulado ? "sintetico" : ctx.get("CHAT_AMBIENTE") === "real" ? "real" : "nao_validado", chamadas, evidencias, desfecho: "falhou" };
 const rodar = async (prov: ProvedorChat) => {
  const { data: rows, error } = await admin.rpc("ia_chave_ativa", { p_loja: loja.id, p_provedor: prov });
  const k = rows?.[0];
  if (error || !k || k.provedor !== prov || !modeloDaChave(k)) throw new IaErro(503, "Provedor não configurado ou indisponível.");
  if (k.limite != null && k.tokens_mes >= k.limite) throw new IaErro(429, "Limite mensal do provedor atingido.");
  const chaveiro = await chaveiroPlataforma(admin, ctx.get);
  if (!chaveiro) throw new IaErro(503, "Provedor indisponível no servidor.");
  // JWT/RLS + dono explícito. Histórico do navegador é ignorado integralmente.
  const { data: historico, error: he } = await usuario.from("mensagens").select("id, papel, conteudo, criada_em").eq("loja_id", loja.id).eq("user_id", userId).eq("conversa_id", turno.conversa_id).order("criada_em", { ascending: false }).order("id", { ascending: false }).limit(21);
  if (he) throw new IaErro(503, "Histórico indisponível.");
  const mensagens: Mensagem[] = [];
  for (const m of (historico ?? []).reverse()) {
   const msg: Mensagem = { role: m.papel === "usuario" ? "user" : "assistant", content: m.conteudo.slice(0, 2000) };
   if (!mensagens.length && msg.role !== "user") continue;
   if (mensagens.at(-1)?.role === msg.role) mensagens.pop();
   mensagens.push(msg);
  }
  // A pergunta recém-gravada deve ser a última; UUID não define ordem temporal em empates.
  if (mensagens.at(-1)?.content !== c.texto) throw new IaErro(503, "Histórico inconsistente; nenhuma chamada realizada.");
  if (anexos.length) { mensagens[mensagens.length - 1] = { role: "user", content: conteudoComAnexos(c.texto, anexos) }; meta.anexos = resumoParaRegistro(anexos); }
  modelo = modeloDaChave(k);
  meta.host_provedor = prov === PROVEDOR_FREE ? "openrouter.ai" : prov === "compativel_openai" ? new URL(k.base_url).hostname : prov === "claude" ? "api.anthropic.com" : "generativelanguage.googleapis.com";
  if (prov === PROVEDOR_FREE) meta.provedor_efetivo = "openrouter-free";
  const tipoLlm = (prov === PROVEDOR_FREE ? "compativel_openai" : prov) as "claude" | "gemini" | "compativel_openai";
  const propostas: Record<string, unknown>[] = [];
  const { config: searxng, erro: erroSearxng } = configSearxngOuNulo(ctx.get, loja.id); if (erroSearxng) console.warn("SearXNG desligado nesta loja:", erroSearxng); // Ambiente privado + allowlist por loja; nunca vem do usuario.
  iniciouChamadaProvedor = true;
  const r = await conversar({ provedor: tipoLlm, baseUrl: prov === PROVEDOR_FREE ? URL_FREE : k.base_url ?? undefined, chave: await decifrar(k.cifrada, chaveiro), modelo, mensagens,
   sistema: `${SISTEMA}${prov === PROVEDOR_FREE ? SISTEMA_FREE : ""}\nLoja: ${loja.nome}. A ferramenta buscar_imagem_web e a pesquisa tecnica devolvem somente links candidatos com pagina de origem, se houver provedor configurado. Elas nao provam identidade, aplicacao nem direito de uso; nao publique nem invente imagens. Neste fluxo existem bling_consultar_produto (leitura) e as ferramentas de PROPOSTA bling_categorias, bling_propor_categoria, bling_propor_trocar_categoria, bling_propor_reativar_produto e bling_propor_ajuste_produto: nenhuma grava no Bling, o lojista aprova a versão exata depois na Central de Inteligência. Cite origem (API ou espelho) e data; não confunda dado simulado com real. Valores ausentes permanecem desconhecidos.\nREGRAS DA BUSCA: a ferramenta devolve os campos candidatos (com origem, situação e achado_por), fontes e conclusao. Relate TODOS os candidatos, inclusive excluídos e inativos, sem fundi-los. Se lista_parcial for true, diga que a lista é parcial e quantos foram omitidos (total_candidatos). conclusao.ausencia_nos_filtros_pesquisados=true significa APENAS zero resultados nos filtros descritos em conclusao.escopo (SKU, nome, GTIN se válido), nunca prova de inexistência no ERP: cite o escopo e o que não foi coberto (descrição, marca/fabricante, código do fornecedor). Ausência no espelho nunca prova ausência no ERP. Nunca recomende nem prepare criar cadastro de PRODUTO com base em ausência (proposta de categoria é outro fluxo). Se a ferramenta falhar ou vier "NÃO CONCLUÍDA", diga que a consulta não foi concluída e não afirme resultado. Respostas curtas: termine sempre a frase.${anexos.length ? `\n${REGRAS_ANEXO}` : ""}`,
   maxPassos: 5, maxTokens: 1536, aoTexto: ctx.aoTexto ? (delta: string) => { if (delta) transmitiuTextoPrincipal = true; ctx.aoTexto?.(delta); } : undefined, adaptadorStream: ctx.aoTexto && !anexos.length ? ctx.adaptadorStream?.(tipoLlm) : undefined, ferramentas: prov === PROVEDOR_FREE ? (ativo("chat_consulta_bling") ? [CONSULTAR_PRODUTO] : []) : ativo("chat_consulta_bling") ? [CONSULTAR_PRODUTO, ...FERRAMENTAS.filter(f => (FERRAMENTAS_PROPOSTA_BLING as readonly string[]).includes(f.name) || (FERRAMENTAS_PESQUISA as readonly string[]).includes(f.name))] : [], fetch: ctx.fetch,
   onPasso: p => { tokens += p.tokens; respostaId = p.respostaId; modelo = p.modelo ?? modelo; },
   executar: async (nome, entrada) => {
    const t0 = Date.now();
    try {
     if (!ativo("chat_consulta_bling") || (prov === PROVEDOR_FREE && !FERRAMENTAS_FREE.includes(nome)) || (nome !== CONSULTAR_PRODUTO.name && !(FERRAMENTAS_PROPOSTA_BLING as readonly string[]).includes(nome) && !(FERRAMENTAS_PESQUISA as readonly string[]).includes(nome))) throw new Error("Ferramenta não permitida.");
     if (nome !== CONSULTAR_PRODUTO.name) {
      // O chat persistente grava em `conversas`; as propostas do motor ligam a `agente_conversas`. Sem vínculo (conversaId null): a proposta nasce igual, só não aponta para esta conversa.
      const bling = new BlingLeituraReal(armazemSupabase(admin), loja.id, { chaveCifra: chaveiro, fetch: ctx.fetch });
      const conector = { origem: "chat" as const, lojaId: loja.id, userId, dados: dadosSupabase(admin, loja.id), rpc: (fn: string, args: Record<string, unknown>) => admin.rpc(fn, args), admin, bling, conversaId: null, agente: { nome: "Nano.ia", provedor: prov, modelo } };
      let buscaImagem: { chave: string; cx: string } | null = null;
      if ((FERRAMENTAS_PESQUISA as readonly string[]).includes(nome) && !searxng) {
       const { data: biRows, error: biError } = await admin.rpc("busca_imagem_ler", { p_loja: loja.id });
       if (biError) throw new Error("Não foi possível consultar configuração da busca.");
       const bi = (biRows as { api_key_cifrada: string; cx: string }[] | null)?.[0];
       if (bi) buscaImagem = { chave: await decifrar(bi.api_key_cifrada, chaveiro), cx: bi.cx };
      }
      const out = await executarFerramenta(nome, entrada, { usuario, admin, lojaId: loja.id, plugins: [], credencial: async () => null, fetch: ctx.fetch, conector, buscaImagem, searxng }) as Record<string, any>;
      tentativas.push({ ferramenta: nome, ok: !out?.erro });
      if (out?.proposta_id) { propostas.push({ id: out.proposta_id, titulo: out.titulo, versao: out.versao, hash: out.hash, risco: out.risco }); meta.propostas = propostas; }
      return out;
     }
     const saida = await consultarProduto(entrada, { usuario, admin, lojaId: loja.id, userId, conversaId: turno.conversa_id, cfg: { chaveCifra: chaveiro, fetch: ctx.fetch }, simulado, chamadas, evidencias });
     tentativas.push({ ferramenta: nome, ok: true });
     return saida;
    } catch (e) {
     const motivo = (e instanceof Error ? e.message : "falha").slice(0, 120);
     tentativas.push({ ferramenta: String(nome).slice(0, 60), ok: false, motivo });
     // Falha também é auditada (sem a entrada do usuário, sem corpo de resposta, sem credencial). Se a auditoria falhar, a falha original segue para o modelo.
     try { await admin.from("auditoria").insert({ loja_id: loja.id, user_id: userId, acao: "chat.bling_consulta_falha", tabela: "produtos", depois: { conversa_id: turno.conversa_id, ferramenta: String(nome).slice(0, 60), motivo, ms: Date.now() - t0 } }); } catch { /* sem efeito: não mascara o erro da ferramenta */ }
     throw e;
    }
   },
  });
  resposta = r.texto || "O provedor não retornou texto.";
  // `ferramentas` = só as CONCLUÍDAS; as solicitadas e as tentativas ficam à parte. Ferramenta disponível ou solicitada não é chamada concluída.
  Object.assign(meta, { desfecho: "ok", passos: r.passos, ferramentas: r.ferramentasConcluidas, ferramentas_solicitadas: r.ferramentasUsadas, tentativas, completa: r.completa });
  if (r.ferramentasUsadas.length > 0 && r.ferramentasConcluidas.length === 0) resposta += "\n\n⚠ Aviso do sistema: nenhuma consulta ao Bling foi concluída neste turno. Qualquer afirmação acima sobre o ERP (inclusive \"não encontrado\") NÃO foi verificada.";
  if (!r.completa) {
   meta.desfecho = r.parada === "bloqueado" ? "bloqueado" : r.parada === "limite_tamanho" ? "truncado" : "incompleto";
   resposta += r.parada === "bloqueado" ? "\n\n⚠ Resposta bloqueada pelo provedor: não foi concluída." : "\n\n⚠ Resposta INCOMPLETA (o limite de tamanho foi atingido ou os passos acabaram). Não trate isto como cadastro nem tarefa concluída: peça de novo em partes menores.";
  }
 };
 try {
  const { data: limitado, error: le } = await admin.rpc("limite_chamada", { p_chave: `chat-ia:${loja.id}:${userId}`, p_max: 20, p_janela_s: 60 });
  if (le || limitado !== true) throw new IaErro(429, "Limite temporário de perguntas.");
  await rodar(provedor);
 } catch (e) {
  let erroFinal: unknown = e; let respondidoPeloGratuito = false;
  // Modo AUTOMÁTICO do gratuito: o provedor escolhido (ex.: Gemini) falhou por sobrecarga/limite/tempo e NADA foi mostrado, proposto ou gravado:
  // refaz o turno com o gratuito, SÓ LEITURA e dados saneados, e diz claramente quem respondeu.
  let automatico = false;
  if (provedor !== PROVEDOR_FREE) { try { const { data } = await admin.rpc("ia_free_automatico", { p_loja: loja.id }); automatico = data === true; } catch { automatico = false; } }
  if (podeTrocarParaFree({ provedor, erro: e, iniciouChamadaProvedor, automatico, anexos: anexos.length, textoTransmitido: transmitiuTextoPrincipal, propostasCriadas: (meta.propostas as unknown[] | undefined)?.length ?? 0 })) {
   const statusOriginal = (e as IaErro).status;
   try {
    tokens = 0; respostaId = undefined; chamadas.length = 0; evidencias.length = 0; tentativas.length = 0;
    await rodar(PROVEDOR_FREE);
    resposta = `${avisoTroca(provedor, statusOriginal)}\n\n${resposta}`;
    Object.assign(meta, { provedor: PROVEDOR_FREE, desfecho: meta.desfecho === "ok" ? "contingencia_automatica" : meta.desfecho, provedor_efetivo: "openrouter-free", host_provedor: "openrouter.ai", troca_de: provedor, troca_motivo: statusOriginal, modo_free: "automatico" });
    ctx.aoTexto?.(resposta);
    respondidoPeloGratuito = true;
   } catch (e2) { erroFinal = e2; }
  }
  if (!respondidoPeloGratuito) {
  // Contingência segura: SÓ depois de tentativa real Gemini, sem streaming parcial,
  // sem ferramentas/anexos e com consentimento explícito. Texto atual isolado,
  // sem histórico da loja ou sistema/comandos/identidade do cliente.
  const livre = iniciouChamadaProvedor ? await tentarFallbackFree({
    texto: c.texto, provedor, consentimento: c.consentimento_fallback_free === true,
    anexos: anexos.length, tentativasFerramenta: tentativas.length,
    textoTransmitido: transmitiuTextoPrincipal, erro: erroFinal, lojaId: loja.id, get: ctx.get, fetch: ctx.fetch,
  }) : null;
  if (livre) {
    status = 200; resposta = `Modo gratuito de contingência (glossário público, sem consulta ao Bling):\n\n${livre.texto}`;
    tokens += livre.tokens; modelo = livre.modelo ?? "openrouter/free";
    Object.assign(meta, { desfecho: "contingencia_publica", provedor_efetivo: livre.origem, host_provedor: "openrouter.ai",
      ferramentas: [], ferramentas_solicitadas: [], tentativas, completa: true, origem: "glossario_publico" });
    ctx.aoTexto?.(resposta);
  } else {
    status = erroFinal instanceof IaErro && [400,401,409,429,502,503,504].includes(erroFinal.status) ? erroFinal.status : 502;
    resposta = erroFinal instanceof IaErro ? erroFinal.message : "Não consegui concluir esta pergunta.";
    meta.codigo = "turno_falhou"; meta.tentativas = tentativas;
  }
  }
 }
 Object.assign(meta, { tokens, modelo, resposta_id: respostaId, http_status: status });
 const { error: fimErro } = await admin.rpc("chat_responder", { p_loja: loja.id, p_user: userId, p_pergunta: turno.pergunta_id, p_token: turno.turno_token, p_resposta: resposta, p_meta: meta });
 if (fimErro) return resultado({ erro: "Não foi possível confirmar o registro do turno. Recupere a mesma pergunta antes de tentar outra.", codigo: "registro_nao_confirmado", conversa_id: turno.conversa_id }, 503);
 return resultado({ resposta, conversa_id: turno.conversa_id, ...meta }, status);
}
