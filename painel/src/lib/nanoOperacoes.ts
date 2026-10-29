export type OperacaoNano =
  | "catalogo.consultar"
  | "bling.consultar"
  | "fornecedor.consultar"
  | "produto.preparar_rascunho"
  | "produto.propor_reativacao"
  | "produto.propor_ajuste"
  | "bling.gravar";

export type ContextoOperacional = {
  lojaId: string;
  lojaAutorizada: string;
  usuarioAutenticado: boolean;
  aprovacaoId?: string;
  versaoAprovada?: string;
  versaoSolicitada?: string;
  escritaBlingHabilitada: boolean;
  fornecedorAutorizado?: boolean;
};

export type DecisaoOperacional = { permitido: boolean; motivo: string };

export function autorizarOperacao(
  operacao: OperacaoNano,
  contexto: ContextoOperacional,
): DecisaoOperacional {
  if (!contexto.usuarioAutenticado || !contexto.lojaId || contexto.lojaId !== contexto.lojaAutorizada)
    return { permitido: false, motivo: "Sessão ou escopo da loja inválido." };
  if (operacao === "fornecedor.consultar" && !contexto.fornecedorAutorizado)
    return { permitido: false, motivo: "Acesso ao fornecedor requer autorização específica." };
  if (operacao !== "bling.gravar")
    return { permitido: true, motivo: "Permitido somente no escopo da loja; propostas não executam escrita." };
  if (!contexto.escritaBlingHabilitada)
    return { permitido: false, motivo: "Escrita no Bling desabilitada." };
  if (!contexto.aprovacaoId || !contexto.versaoAprovada ||
      contexto.versaoAprovada !== contexto.versaoSolicitada)
    return { permitido: false, motivo: "Aprovação humana válida e versão exata obrigatórias." };
  return { permitido: true, motivo: "Elegível à execução após validação de auditoria e idempotência." };
}

export type ProdutoCandidato = {
  id?: string;
  sku?: string | null;
  gtin?: string | null;
  blingId?: string | null;
  excluido?: boolean;
};
const normalizar = (v?: string | null) => (v ?? "").trim().toUpperCase();
export function verificarDuplicidade(
  candidato: ProdutoCandidato,
  existentes: ProdutoCandidato[],
): { duplicado: boolean; encontrados: ProdutoCandidato[]; coberturaCompleta: boolean } {
  const sku = normalizar(candidato.sku);
  const gtin = normalizar(candidato.gtin);
  const blingId = normalizar(candidato.blingId);
  const encontrados = existentes.filter(p =>
    (blingId && normalizar(p.blingId) === blingId) ||
    (sku && normalizar(p.sku) === sku) ||
    (gtin && normalizar(p.gtin) === gtin));
  return { duplicado: encontrados.length > 0, encontrados, coberturaCompleta: false };
}

export function prepararPropostaCadastro(
  candidato: ProdutoCandidato,
  existentes: ProdutoCandidato[],
) {
  const checagem = verificarDuplicidade(candidato, existentes);
  return {
    status: "revisao_humana_obrigatoria" as const,
    gravadoNoBling: false,
    verificacao: checagem,
    aviso: checagem.duplicado
      ? "Possível cadastro existente ou excluído: revisar antes de qualquer reativação."
      : "Nenhuma correspondência na amostra. Consultar catálogo completo e excluídos do Bling antes de cadastrar.",
    candidato,
  };
}

export function dadosPermitidosProvedorGratuito(dados: Record<string, unknown>) {
  const proibidos = /custo|fornecedor|fiscal|ncm|cfop|cnpj|cpf|token|senha|secret|chave|preco_compra|valor_compra|margem|tribut/i;
  return Object.fromEntries(Object.entries(dados).filter(([campo]) => !proibidos.test(campo)));
}
