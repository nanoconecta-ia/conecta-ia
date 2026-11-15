// Catálogo FECHADO de ferramentas do Bling para os agentes (Tool Registry). O que não está aqui não existe.
// Toda ferramenta passa pelo Policy Engine antes de executar; escrita (MEDIUM+) exige aprovação humana,
// idempotency_key e fica desligada (ativa: false) até teste com mock, auditoria e conferência na documentação.
// conferido: false = caminho/corpo ainda NÃO conferidos em developer.bling.com.br (regra zero alucinação).
export type Risco = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Ferramenta {
  nome: string;
  metodo: "GET" | "POST" | "PUT" | "PATCH";
  caminho: string;           // relativo a /Api/v3; {id} = parâmetro
  risco: Risco;
  ativa: boolean;
  exigeAprovacao: boolean;
  exigeIdempotencyKey: boolean;
  retry: "leitura" | "nenhum"; // escrita nunca repete às cegas
  timeoutMs: number;
  conferido: boolean;
}

const leitura = (nome: string, caminho: string, conferido = false): Ferramenta => ({
  nome, metodo: "GET", caminho, risco: "LOW", ativa: true, exigeAprovacao: false,
  exigeIdempotencyKey: false, retry: "leitura", timeoutMs: 20_000, conferido,
});
const escrita = (nome: string, metodo: "POST" | "PUT" | "PATCH", caminho: string, risco: Risco): Ferramenta => ({
  nome, metodo, caminho, risco, ativa: false, exigeAprovacao: true,
  exigeIdempotencyKey: true, retry: "nenhum", timeoutMs: 30_000, conferido: false,
});

export const FERRAMENTAS: readonly Ferramenta[] = [
  // GET /produtos (somente leitura). Conferido no OpenAPI OFICIAL em 2026-10-25, verificação independente do dono (PowerShell no computador mobis, HTTP 200 em
  // https://developer.bling.com.br/referencia; script reference-7ix34KV4.js -> https://developer.bling.com.br/build/assets/openapi-DA9aa7wN.json, info.version 3.0):
  // criterio (inteiro 1..5: 1 últimos, 2 ativos, 3 inativos, 4 excluídos, 5 todos), nome (string), codigos[] (array de SKU), gtins[] (array de GTIN/EAN).
  // Proveniência: leitura feita pelo dono/ChatGPT; este ambiente de desenvolvimento NÃO acessa developer.bling.com.br. Também confirmado por chamadas reais do conector Bling (2026-10-25).
  // O OpenAPI lista PATCH /produtos/{idProduto}; isso NÃO habilita escrita (as ferramentas de escrita continuam desligadas e conferido=false).
  leitura("bling.produtos.listar", "/produtos", true),
  // Conferido em 2026-10-18 no OpenAPI oficial developer.bling.com.br/referencia (GET /produtos/{idProduto}).
  leitura("bling.produtos.obter", "/produtos/{id}", true),
  leitura("bling.categorias.listar", "/categorias/produtos"),
  leitura("bling.estoque.saldos", "/estoques/saldos"),
  leitura("bling.contatos.listar", "/contatos"),
  leitura("bling.pedidos_venda.listar", "/pedidos/vendas"),
  leitura("bling.nfe.listar", "/nfe"),
  leitura("bling.nfe.obter", "/nfe/{id}"),
  leitura("bling.empresa.dados", "/empresas/me/dados-basicos"),

  escrita("bling.produtos.criar", "POST", "/produtos", "MEDIUM"),
  escrita("bling.produtos.alterar", "PATCH", "/produtos/{id}", "MEDIUM"),
  escrita("bling.produtos.alterar_preco", "PATCH", "/produtos/{id}", "MEDIUM"), // só preço de venda, só como item de proposta aprovada; desligada como todas as escritas
  // Só midia.imagens.imagensURL (galeria por URL), só imagem aprovada com direitos confirmados, só por pessoa (nunca pelo modelo). Usada por nanogpt-midia.
  // Contrato citado em docs/NANOGPT-IMAGENS-REAIS.md (leitura do OpenAPI feita fora deste ambiente): conferido=false, desligada como todas as escritas.
  escrita("bling.produtos.imagens_adicionar", "PATCH", "/produtos/{id}", "MEDIUM"),
  // Troca SÓ a situação (ativar/inativar), sem regravar nem revalidar o cadastro inteiro (diferente de PATCH /produtos/{id}).
  // Evidência: página de homologação do Bling (developer.bling.com.br/homologacao) cita PATCH /produtos/{id}/situacoes com a situação no body;
  // SDK não oficial confirma a rota. NÃO conferido no OpenAPI oficial (valores aceitos e se revalida campos fiscais): conferido=false, desligada.
  escrita("bling.produtos.alterar_situacao", "PATCH", "/produtos/{id}/situacoes", "MEDIUM"),
  escrita("bling.categorias.criar", "POST", "/categorias/produtos", "MEDIUM"),
  escrita("bling.contatos.criar", "POST", "/contatos", "MEDIUM"),
  escrita("bling.contatos.alterar", "PUT", "/contatos/{id}", "MEDIUM"),
  escrita("bling.estoque.lancar", "POST", "/estoques", "HIGH"),
  escrita("bling.pedidos_venda.criar", "POST", "/pedidos/vendas", "HIGH"),
];

export function buscarFerramenta(nome: string): Ferramenta | undefined {
  return FERRAMENTAS.find((f) => f.nome === nome);
}

/** Executável agora? Escrita só com ferramenta ativa E aprovação humana registrada. */
export function podeExecutar(f: Ferramenta, aprovacaoId: string | null): { ok: boolean; motivo?: string } {
  if (!f.ativa) return { ok: false, motivo: "ferramenta desligada" };
  if (f.exigeAprovacao && !aprovacaoId) return { ok: false, motivo: "requer aprovação humana" };
  return { ok: true };
}

export type SituacaoProduto = "A" | "I";
/** Monta o pedido de troca de situação. Só A (ativo) e I (inativo); excluir não existe aqui. Não executa nada. */
export function montarAlterarSituacao(idProduto: number, situacao: string): { caminho: string; corpo: { situacao: SituacaoProduto } } {
  if (!Number.isSafeInteger(idProduto) || idProduto <= 0) throw new Error("id de produto inválido");
  if (situacao !== "A" && situacao !== "I") throw new Error("situação inválida: use A (ativo) ou I (inativo)");
  return { caminho: `/produtos/${idProduto}/situacoes`, corpo: { situacao } };
}
