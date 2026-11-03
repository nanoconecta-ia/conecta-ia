// Contexto Vivo (painel): publica a seleção do Catálogo no servidor SÓ se o lojista ligar "Compartilhar seleção com o Nano".
// A identidade vem do login (o servidor decide); aqui só vão ids de produto e a versão que este painel viu. Nada de custo, SKU ou dado fiscal.
export type RpcContexto = (args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
export interface EstadoContexto { versao: number }
export interface ResultadoPublicacao { ok: boolean; erro?: string }

export async function publicarSelecao(rpc: RpcContexto, lojaId: string, ids: string[], estado: EstadoContexto, novoEvento: () => string = () => crypto.randomUUID()): Promise<ResultadoPublicacao> {
  const acao = ids.length === 0 ? "selecao.limpa" : ids.length === 1 ? "produto.aberto" : "produto.selecionado";
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await rpc({ p_loja: lojaId, p_evento: novoEvento(), p_acao: acao, p_origem: "conecta-ui", p_ativo: ids.length === 1 ? ids[0] : null, p_selecionados: ids, p_versao_base: estado.versao });
    const r = (data ?? {}) as { ok?: boolean; erro?: string; versao?: number };
    if (error) return { ok: false, erro: "falha_de_rede" };
    if (r.ok) { estado.versao = r.versao ?? estado.versao; return { ok: true }; }
    // conflito ou expiração: o servidor informa a versão atual; tenta de novo com ela (a seleção local é a verdade do lojista)
    if ((r.erro === "versao_conflito" || r.erro === "contexto_expirado") && typeof r.versao === "number") { estado.versao = r.versao; continue; }
    return { ok: false, erro: r.erro ?? "desconhecido" };
  }
  return { ok: false, erro: "versao_conflito" };
}
