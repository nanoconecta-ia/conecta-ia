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
  leitura("bling.produtos.listar", "/produtos"),
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
