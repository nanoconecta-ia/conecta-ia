/**
 * Projeção de SOMENTE LEITURA da RPC verificar_cruzados_do_sku para o porteiro.
 * Usa vínculos persistidos no grafo: não cria SKU, não supõe relação por OEM igual,
 * nem mistura peças do interior do conjunto com o produto comercial inteiro.
 * O backend deve aplicar a ACL da loja antes de chamar a RPC existente.
 */
type Cruzado = {
  codigo?: unknown;
  classe?: unknown;
  tipo?: unknown;
  status?: unknown;
  restricoes?: unknown;
  evidencia?: unknown;
};
type PecaDoSku = {
  codigo?: unknown;
  classe?: unknown;
  relacao_com_o_sku?: unknown;
  status_da_ligacao?: unknown;
  cruzados_diretos?: unknown;
};
type ResultadoRpc = { sku?: unknown; pecas?: unknown; erro?: unknown; aviso?: unknown };
const texto = (s: unknown) => typeof s === "string" ? s.trim() : "";
const valido = (s: unknown) => texto(s).length > 0;
export type EstadoCruzamento = "referencia_pesquisa" | "relacao_aprovada_no_grafo" | "a_confirmar";
const equivalencias = new Set(["equivalente_validado", "substituicao_engenharia", "substituto_homologado"]);

export function projetarCruzamentosDoSku(
  dado: unknown, incluirAConfirmar = false,
) {
  if (!dado || typeof dado !== "object") return { erro: "Resposta técnica inválida." };
  const base = dado as ResultadoRpc;
  if (valido(base.erro)) return { erro: texto(base.erro) };
  if (!valido(base.sku) || !Array.isArray(base.pecas)) return { erro: "Resposta técnica incompleta: SKU ou peças ausentes." };
  const pecas = (base.pecas as PecaDoSku[])
    .filter(p => p && typeof p === "object" && valido(p.codigo))
    .filter(p => incluirAConfirmar || p.status_da_ligacao === "aprovado")
    .map(p => {
      const itens = Array.isArray(p.cruzados_diretos) ? p.cruzados_diretos as Cruzado[] : [];
      const cruzados = itens
        .filter(x => x && typeof x === "object" && valido(x.codigo))
        .filter(x => incluirAConfirmar || x.status === "aprovado")
        .map(x => ({
          codigo: texto(x.codigo), classe_declarada: texto(x.classe),
          relacao: texto(x.tipo), status: texto(x.status),
          restricoes: texto(x.restricoes) || null,
          evidencia_resumida: texto(x.evidencia) || null,
          interpretacao: x.status !== "aprovado" ? "a_confirmar" as EstadoCruzamento
            : equivalencias.has(texto(x.tipo)) ? "relacao_aprovada_no_grafo" as EstadoCruzamento
            : "referencia_pesquisa" as EstadoCruzamento,
          aviso: x.status === "aprovado" && equivalencias.has(texto(x.tipo))
            ? "Relação registrada como aprovada; confirmar o escopo físico e a versão antes de anunciar intercambialidade."
            : "Referência cruzada para pesquisa, não prova substituição ou intercambialidade.",
        }));
      return {
        codigo_referencia: texto(p.codigo),
        classe_declarada: texto(p.classe),
        relacao_com_sku: texto(p.relacao_com_o_sku),
        status_ligacao: texto(p.status_da_ligacao),
        // O código OEM do componente só pode identificar o SKU inteiro se o
        // próprio vínculo for explicitamente e_esta_peca, após homologação.
        vinculo_representa_produto_inteiro: p.relacao_com_o_sku === "e_esta_peca"
          && p.status_da_ligacao === "aprovado",
        cruzamentos_diretos: cruzados,
      };
    });
  return {
    sku: texto(base.sku), pecas,
    resumo: {
      referencias_visiveis: pecas.length,
      cruzamentos_diretos: pecas.reduce((n, p) => n + p.cruzamentos_diretos.length, 0),
      modo: incluirAConfirmar ? "candidatos_e_aprovados" : "apenas_vinculos_aprovados",
    },
    aviso: "Leitura de ligações DIRETAS existentes. OEM original, código do fabricante e SKU interno são identidades diferentes. Não há inferência A→C por A→B→C; sem evidência de versão e de conjunto, não anunciar equivalência.",
  };
}
