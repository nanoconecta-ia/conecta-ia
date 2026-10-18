// Ações HUMANAS do painel (aprovar, revisar, travar, simular, reconciliar, chaves MCP, conversas, anexos). Puras sobre `rpc`.
// A Edge Function só autentica o usuário (JWT), confere que ele é membro da loja e chama estas funções com o userId VERIFICADO.
// Chave MCP e agente nunca chegam aqui: aprovar é ato de pessoa autenticada.
import { reconciliar, simularProposta, executarProposta, type ItemExecucao, type Rpc } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import type { PortaBling } from "./porta_bling.ts";
import { gerarToken, sha256Hex } from "./cripto.ts";
import { montarCorpoProduto } from "./bling_campos.ts";
import type { ClienteDados } from "./dados.ts";

export interface Humano { userId: string; lojaId: string }
export interface DepsAcoes { rpc: Rpc; dados: ClienteDados; /** leitura real do Bling (nunca escreve) */ blingLeitura?: PortaBling }
export interface Resposta { status: number; corpo: Record<string, unknown> }

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const erro = (status: number, mensagem: string, codigo?: string): Resposta => ({ status, corpo: { erro: mensagem, ...(codigo ? { codigo } : {}) } });
const ok = (corpo: Record<string, unknown> = {}): Resposta => ({ status: 200, corpo: { ok: true, ...corpo } });

const TRADUCOES: [RegExp, number, string][] = [
  [/versao_ou_hash_divergente/, 409, "A proposta mudou desde que você a abriu. Abra a versão atual e aprove de novo."],
  [/proposta_nao_pendente/, 409, "Esta proposta já foi decidida, expirou ou foi substituída."],
  [/proposta_expirada/, 409, "A proposta expirou. Peça uma nova ao Conector IA."],
  [/sem_permissao/, 403, "Você não tem permissão para esta ação nesta loja."],
  [/confirmacao_explicita_obrigatoria/, 422, "Risco alto: confirme explicitamente para aprovar."],
  [/nada_aprovavel/, 422, "Nenhum item pode ser aprovado: produtos travados ou fora do escopo."],
  [/proposta_nao_encontrada|conversa_nao_encontrada|item_nao_encontrado/, 404, "Não encontrado nesta loja."],
  [/escrita_real_nao_liberada/, 403, "A escrita no Bling está desligada para esta loja. Nada foi enviado."],
  [/reconciliar_antes/, 409, "Há uma operação com resultado desconhecido. Reconcilie antes de repetir."],
  [/aprovacao_invalida|aprovacao_expirada|sem_aprovacao/, 409, "A aprovação não vale mais para esta proposta."],
  [/produto_travado|produto_em_execucao/, 409, "Produto travado ou em execução."],
  [/caminho_invalido/, 422, "Caminho de anexo inválido."],
  [/limite_de_chaves_ativas/, 422, "Limite de chaves ativas atingido. Revogue uma chave antes de criar outra."],
  [/expiracao_invalida/, 422, "Informe uma expiração entre 1 minuto e 365 dias."],
];
const traduz = (msg: string): Resposta => { for (const [re, st, texto] of TRADUCOES) if (re.test(msg)) return erro(st, texto, (msg.match(re) ?? [])[0]); return erro(500, "Não foi possível concluir a ação."); };

async function rpcOu(d: DepsAcoes, fn: string, args: Record<string, unknown>) {
  const { data, error } = await d.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
const uuid = (v: unknown) => typeof v === "string" && UUID.test(v);
const uuids = (v: unknown) => Array.isArray(v) && v.length > 0 && v.length <= 500 && v.every(uuid);

/** Carrega o item que pertence a uma proposta/operação da loja (para reconciliar). */
async function itemDaOperacao(d: DepsAcoes, lojaId: string, operacaoId: string): Promise<{ item: ItemExecucao; operacao: string } | null> {
  const op = (await d.dados.from("agente_operacoes").select("item_id, estado").eq("loja_id", lojaId).eq("id", operacaoId).maybeSingle()).data;
  if (!op) return null;
  const it = (await d.dados.from("agente_proposta_itens").select("id, produto_id, operacao, alvo, campos, antes, depois, idempotency_key").eq("loja_id", lojaId).eq("id", op.item_id).maybeSingle()).data;
  if (!it) return null;
  return { item: { item_id: it.id, produto_id: it.produto_id, operacao: it.operacao, alvo: it.alvo, campos: it.campos, antes: it.antes, depois: it.depois, idempotency_key: it.idempotency_key }, operacao: op.estado };
}

export async function acaoAprovacoes(c: Record<string, any>, h: Humano, d: DepsAcoes): Promise<Resposta> {
  try {
    switch (c.acao) {
      case "decidir": {
        if (!uuid(c.proposta_id) || !Number.isInteger(c.versao) || !/^[0-9a-f]{64}$/.test(String(c.hash)) || !["aprovada", "rejeitada"].includes(c.decisao)) return erro(400, "Informe proposta_id, versao, hash e decisao (aprovada ou rejeitada).");
        if (c.itens !== undefined && !uuids(c.itens)) return erro(400, "itens deve ser uma lista de ids.");
        const r = await rpcOu(d, "agente_proposta_decidir", { p_loja: h.lojaId, p_proposta: c.proposta_id, p_versao: c.versao, p_hash: c.hash, p_user: h.userId, p_decisao: c.decisao, p_itens: c.itens ?? null, p_confirmacao_explicita: c.confirmacao_explicita === true });
        return r?.ok === false ? erro(409, "A proposta expirou. Peça uma nova ao Conector IA.", "proposta_expirada") : ok(r ?? {});
      }
      case "revisar": {
        if (!uuid(c.proposta_id)) return erro(400, "Informe proposta_id.");
        return ok({ proposta_id: await rpcOu(d, "agente_proposta_revisar", { p_loja: h.lojaId, p_proposta: c.proposta_id, p_user: h.userId }) });
      }
      case "travar": case "destravar": {
        if (!uuids(c.produtos)) return erro(400, "Informe a lista de produtos (até 500).");
        const n = await rpcOu(d, c.acao === "travar" ? "produto_travar" : "produto_destravar", { p_loja: h.lojaId, p_produtos: c.produtos, p_user: h.userId, p_motivo: String(c.motivo ?? "").slice(0, 200) });
        return ok({ produtos_afetados: n });
      }
      case "executar_simulado": {
        if (!uuid(c.proposta_id)) return erro(400, "Informe proposta_id.");
        const mock = new BlingMock();
        const itens = (await rpcOu(d, "agente_proposta_validar", { p_loja: h.lojaId, p_proposta: c.proposta_id })) as ItemExecucao[];
        const semeadoDe: string[] = [];
        for (const it of itens) if (it.operacao === "bling.produtos.alterar" && it.alvo) {
          // Ensaio fiel: parte do produto REAL lido agora (só leitura). Sem leitura disponível, parte do "antes" da proposta e diz isso.
          const lido = d.blingLeitura ? await d.blingLeitura.ler("bling.produtos.confirmar", { id: it.alvo }).catch(() => null) : null;
          const base = lido?.status === 200 ? (lido.corpo as any)?.data : null;
          if (base) { mock.semear(it.alvo, base); semeadoDe.push(`${it.alvo}: leitura real do Bling`); }
          else { mock.semear(it.alvo, montarCorpoProduto(it.antes ?? {}).corpo); semeadoDe.push(`${it.alvo}: valores 'antes' da proposta (leitura real indisponível)`); }
        }
        const rel = await simularProposta({ rpc: d.rpc, bling: mock, lojaId: h.lojaId, propostaId: c.proposta_id, userId: h.userId });
        return ok({ relatorio: rel, semeado_de: semeadoDe, aviso: "Ensaio: nada foi enviado ao Bling e nenhum estado mudou." });
      }
      case "executar": {
        // Executa o que foi APROVADO. Escrita no Bling continua barrada (banco: sem liberação; registro: ferramenta desligada).
        if (!uuid(c.proposta_id)) return erro(400, "Informe proposta_id.");
        if (!d.blingLeitura) return erro(503, "Leitura do Bling indisponível para confirmar a execução.");
        const rel = await executarProposta({ rpc: d.rpc, bling: d.blingLeitura, lojaId: h.lojaId, propostaId: c.proposta_id });
        if (rel.erro) return traduz(rel.erro);
        return ok({ relatorio: rel });
      }
      case "reconciliar": {
        if (!uuid(c.operacao_id)) return erro(400, "Informe operacao_id.");
        if (!d.blingLeitura) return erro(503, "Leitura do Bling indisponível para reconciliar.");
        const alvo = await itemDaOperacao(d, h.lojaId, c.operacao_id);
        if (!alvo) return erro(404, "Operação não encontrada nesta loja.");
        const r = await reconciliar({ rpc: d.rpc, bling: d.blingLeitura, lojaId: h.lojaId, operacaoId: c.operacao_id, userId: h.userId, item: alvo.item });
        return ok({ resultado: r, aviso: r === "indeterminado" ? "O Bling não deu prova de que gravou nem de que não gravou. Confira no Bling e reconcilie manualmente." : undefined });
      }
      default: return erro(400, "Ação desconhecida.");
    }
  } catch (e) { return traduz((e as Error).message); }
}

export async function acaoChaves(c: Record<string, any>, h: Humano, d: DepsAcoes): Promise<Resposta> {
  try {
    if (c.acao === "criar") {
      const nome = String(c.nome ?? "").trim();
      if (nome.length < 2 || nome.length > 80) return erro(400, "Dê um nome à chave (2 a 80 caracteres).");
      const escopos = Array.isArray(c.escopos) ? c.escopos : [];
      if (escopos.length === 0 || !escopos.every((x: unknown) => x === "leitura" || x === "propor" || x === "simular")) return erro(400, "Escopos válidos: leitura, propor e simular. Aprovar e executar não existem para clientes externos.");
      const exp = new Date(String(c.expira_em));
      if (Number.isNaN(exp.getTime())) return erro(400, "Informe a expiração (data ISO).");
      const { token, prefixo } = gerarToken();
      const id = await rpcOu(d, "mcp_chave_criar", { p_loja: h.lojaId, p_user: h.userId, p_nome: nome, p_cliente: String(c.cliente ?? "").slice(0, 60) || null, p_hash: await sha256Hex(token), p_prefixo: prefixo, p_escopos: escopos, p_expira_em: exp.toISOString() });
      return ok({ id, token, prefixo, aviso: "Copie o token agora: ele não será mostrado de novo." });
    }
    if (c.acao === "revogar") {
      if (!uuid(c.id)) return erro(400, "Informe o id da chave.");
      const r = await rpcOu(d, "mcp_chave_revogar", { p_loja: h.lojaId, p_chave: c.id, p_user: h.userId });
      return r ? ok() : erro(404, "Chave não encontrada ou já revogada.");
    }
    return erro(400, "Ação desconhecida.");
  } catch (e) { return traduz((e as Error).message); }
}

export const MIMES_ANEXO: Record<string, "imagem" | "documento"> = { "image/png": "imagem", "image/jpeg": "imagem", "image/webp": "imagem", "application/pdf": "documento", "text/plain": "documento", "text/csv": "documento" };
export const MAX_ANEXO = 20 * 1024 * 1024;
export const nomeSeguro = (n: string) => n.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/\.{2,}/g, ".").replace(/^[._]+|[._]+$/g, "").slice(-100) || "arquivo";

export interface DepsConversas extends DepsAcoes {
  /** Emite URL assinada de upload/download no bucket privado (service_role). */
  assinarUpload?(path: string): Promise<{ path: string; token: string } | null>;
  assinarDownload?(path: string, segundos: number): Promise<string | null>;
}

export async function acaoConversas(c: Record<string, any>, h: Humano, d: DepsConversas): Promise<Resposta> {
  try {
    switch (c.acao) {
      case "criar": {
        const id = await rpcOu(d, "agente_conversa_criar", { p_loja: h.lojaId, p_user: h.userId, p_titulo: String(c.titulo ?? "Nova conversa"), p_provedor: null, p_modelo: null });
        return ok({ id });
      }
      case "excluir": {
        if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
        return (await rpcOu(d, "agente_conversa_excluir", { p_loja: h.lojaId, p_conversa: c.conversa_id, p_user: h.userId })) ? ok() : erro(404, "Conversa não encontrada.");
      }
      case "renomear": {
        if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
        return (await rpcOu(d, "agente_conversa_renomear", { p_loja: h.lojaId, p_conversa: c.conversa_id, p_user: h.userId, p_titulo: c.titulo ?? null, p_projeto: c.projeto ?? null })) ? ok() : erro(404, "Conversa não encontrada.");
      }
      case "preparar_anexo": {
        if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
        const tipo = MIMES_ANEXO[String(c.mime)];
        if (!tipo) return erro(422, "Tipo de arquivo não permitido (imagens PNG/JPEG/WebP, PDF, TXT ou CSV).");
        if (!Number.isInteger(c.bytes) || c.bytes <= 0 || c.bytes > MAX_ANEXO) return erro(422, "Arquivo vazio ou maior que 20 MB.");
        const dono = (await d.dados.from("agente_conversas").select("id").eq("id", c.conversa_id).eq("loja_id", h.lojaId).eq("user_id", h.userId).maybeSingle()).data;
        if (!dono) return erro(404, "Conversa não encontrada.");
        const path = `${h.lojaId}/${h.userId}/${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(String(c.nome ?? "arquivo"))}`;
        const up = await d.assinarUpload?.(path);
        return up ? ok({ ...up, tipo }) : erro(503, "Armazenamento de anexos indisponível.");
      }
      case "registrar_anexo": {
        if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
        const tipo = MIMES_ANEXO[String(c.mime)];
        if (!tipo || !/^[0-9a-f]{64}$/.test(String(c.sha256)) || !Number.isInteger(c.bytes) || c.bytes <= 0 || c.bytes > MAX_ANEXO) return erro(422, "Anexo inválido.");
        const id = await rpcOu(d, "agente_anexo_registrar", { p_loja: h.lojaId, p_conversa: c.conversa_id, p_user: h.userId, p_tipo: tipo, p_nome: String(c.nome ?? "arquivo").slice(0, 200), p_mime: c.mime, p_bytes: c.bytes, p_sha256: c.sha256, p_path: String(c.path ?? "") });
        return ok({ id });
      }
      case "baixar_anexo": {
        if (!uuid(c.anexo_id)) return erro(400, "Informe anexo_id.");
        const a = (await d.dados.from("agente_anexos").select("storage_path, conversa_id").eq("loja_id", h.lojaId).eq("id", c.anexo_id).maybeSingle()).data;
        const dono = a && (await d.dados.from("agente_conversas").select("id").eq("id", a.conversa_id).eq("loja_id", h.lojaId).eq("user_id", h.userId).maybeSingle()).data;
        if (!a || !dono) return erro(404, "Anexo não encontrado.");
        const url = await d.assinarDownload?.(a.storage_path, 300);
        return url ? ok({ url, expira_em_segundos: 300 }) : erro(503, "Armazenamento de anexos indisponível.");
      }
      default: return erro(400, "Ação desconhecida.");
    }
  } catch (e) { return traduz((e as Error).message); }
}
