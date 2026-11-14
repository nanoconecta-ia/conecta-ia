// Exemplo FIXO para a tela de demonstração do cadastro (SKU 099SHP190H). Sem banco, sem Bling, sem preço/custo/estoque.
// Cada dado traz o estado e a origem; o que não tem fonte técnica fica "a_confirmar" ou "ausente". Nada aqui é gravado.

export type EstadoDado = "confirmado" | "a_confirmar" | "ausente" | "nao_consultado" | "divergente";

export const ROTULO_ESTADO: Readonly<Record<EstadoDado, string>> = {
  confirmado: "confirmado", a_confirmar: "a confirmar", ausente: "ausente", nao_consultado: "não consultado", divergente: "divergente",
};

export type NoTaxonomia = { nivel: string; nome: string; estado: EstadoDado };
export type Codigo = { marca: string; codigo: string; tipo: "fabricante" | "oem" | "similar"; estado: EstadoDado; fonte: string };
export type Aplicacao = { veiculo: string; tipoVeiculo: "picape" | "suv"; motor: string; anos: string; estado: EstadoDado; fonte: string };

export const EXEMPLO = {
  sku: "099SHP190H",
  nome: "Correia dentada do eixo balanceador",
  marca: { valor: "Dayco", estado: "confirmado" as EstadoDado, fonte: "Bling" },
  gtin: { valor: "7898410233179", estado: "confirmado" as EstadoDado, fonte: "Bling" },
  dentes: { valor: "99", estado: "a_confirmar" as EstadoDado, fonte: "anúncios de lojas (código do fabricante indica 099)" },
  // Os níveis sem fonte técnica ficam "a confirmar": a posição vem do nome do cadastro, não de catálogo do fabricante.
  taxonomia: [
    { nivel: "Sistema", nome: "Motor", estado: "a_confirmar" },
    { nivel: "Conjunto", nome: "Distribuição / sincronismo", estado: "a_confirmar" },
    { nivel: "Subconjunto", nome: "Eixo balanceador", estado: "a_confirmar" },
    { nivel: "Componente", nome: "Correia dentada · 99 dentes", estado: "a_confirmar" },
  ] as NoTaxonomia[],
  codigos: [
    { marca: "Dayco", codigo: "099SHP190H", tipo: "fabricante", estado: "confirmado", fonte: "Bling" },
    { marca: "Mitsubishi", codigo: "MD300473", tipo: "oem", estado: "a_confirmar", fonte: "fórum 4x4 Brasil; tabela de kit Febi" },
    { marca: "Mitsubishi", codigo: "MD310484", tipo: "oem", estado: "a_confirmar", fonte: "fórum 4x4 Brasil" },
    { marca: "Goodyear", codigo: "99H8P190 HNBR", tipo: "similar", estado: "a_confirmar", fonte: "fórum 4x4 Brasil" },
    { marca: "Gates · Contitech", codigo: "—", tipo: "similar", estado: "nao_consultado", fonte: "nenhum equivalente encontrado" },
  ] as Codigo[],
  aplicacoes: [
    { veiculo: "L200 · HR · Bongo K2500 · H100", tipoVeiculo: "picape", motor: "2.5 8v diesel", anos: "fontes divergem (1993–1998 × até 2012)", estado: "divergente", fonte: "anúncios de lojas" },
    { veiculo: "Pajero · Galloper", tipoVeiculo: "suv", motor: "2.5 diesel", anos: "fontes divergem", estado: "divergente", fonte: "anúncios de lojas" },
  ] as Aplicacao[],
  // Fotos: a ferramenta de imagens ainda não existe. Os espaços ficam vazios até haver imagem aprovada.
  fotos: { principal: null as string | null, miniaturas: 4 },
  antesDepois: { campo: "Descrição (código no título)", antes: "099SPH190H", depois: "099SHP190H" },
} as const;

/** Resume quantos dados estão em cada estado, para o selo geral do cartão. */
export function resumoEstados(): Record<EstadoDado, number> {
  const r: Record<EstadoDado, number> = { confirmado: 0, a_confirmar: 0, ausente: 0, nao_consultado: 0, divergente: 0 };
  const lista: EstadoDado[] = [
    EXEMPLO.marca.estado, EXEMPLO.gtin.estado, EXEMPLO.dentes.estado,
    ...EXEMPLO.taxonomia.map((n) => n.estado), ...EXEMPLO.codigos.map((c) => c.estado), ...EXEMPLO.aplicacoes.map((a) => a.estado),
    EXEMPLO.fotos.principal ? "confirmado" : "ausente",
  ];
  for (const e of lista) r[e] += 1;
  return r;
}
