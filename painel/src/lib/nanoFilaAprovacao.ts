/**
 * Adapter de homologaÃ§Ã£o para a fila REAL de aprovaÃ§Ãµes.
 * Executar SOMENTE no backend com sessÃ£o autenticada; nÃ£o expor ao browser.
 * NÃ£o executa a proposta e nÃ£o altera o Bling.
 */
export type FilaRpc = {
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
export type PropostaCadastro = {
  lojaId: string;
  usuarioId: string;
  produtoId: string;
  chaveIdempotencia: string;
  camposAntes: Record<string, unknown>;
  camposDepois: Record<string, unknown>;
  fonte: string;
  grupoId?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function enviarPropostaCadastroParaFila(
  clienteServidor: FilaRpc,
  proposta: PropostaCadastro,
) {
  for (const valor of [proposta.lojaId, proposta.usuarioId, proposta.produtoId])
    if (!uuid.test(valor)) throw new Error("Identificador UUID invÃ¡lido");
  if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(proposta.chaveIdempotencia))
    throw new Error("Chave de idempotÃªncia invÃ¡lida");
  if (!proposta.fonte.trim()) throw new Error("Fonte tÃ©cnica obrigatÃ³ria");
  if (!Object.keys(proposta.camposDepois).length) throw new Error("Proposta vazia");
  const { data, error } = await clienteServidor.rpc("aprovacao_propor", {
    p_loja: proposta.lojaId,
    p_tipo: "produto_atualizacao",
    p_ferramenta: "nanoia.propor_ajuste_produto",
    p_agente: "Nano.IA",
    p_sessao: null,
    p_dispositivo: null,
    p_usuario: proposta.usuarioId,
    p_alvos: [{ tabela: "produtos", id: proposta.produtoId }],
    p_antes: proposta.camposAntes,
    p_depois: { ...proposta.camposDepois, fonte: proposta.fonte },
    p_riscos: ["Validar aplicaÃ§Ã£o, fabricante, dados fiscais e duplicidade antes de executar"],
    p_risco: "MEDIUM",
    p_idempotency_key: proposta.chaveIdempotencia,
    p_ttl_min: 60,
    p_grupo: proposta.grupoId ?? null,
  });
  if (error) throw new Error("Falha ao registrar proposta: " + error.message);
  return data;
}

