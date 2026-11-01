// Ícones gráficos dos nós da taxonomia no mapa: reusa o sprite que a loja e a página Taxonomia já utilizam.
// Dados vêm do mapa publicado pelo Catálogo (consulta real ao espelho); jamais inferir aplicação, OEM ou SKU pelo ícone.
import { iconeDaCategoria, type Peca } from "./icones.ts";

const ALIASES: readonly [RegExp, Peca][] = [
  [/bomba.{0,8}agua|radiador|arrefecimento|termostat|viscos|intercooler/, "arrefecimento"],
  [/filtro/, "filtros"],
  [/embreagem|plato|transmissao|caixa.{0,8}marchas|rolamento/, "transmissao"],
  [/alternador|partida|eletric|sensor|vela.{0,8}aquecimento/, "eletrica"],
  [/pistao|anel.{0,8}segmento|camisa|biela|virabrequim|bronzina|cabecote|comando|tucho|valvula.{0,8}motor|correia|tensor|turbin|junta|retentor|bloco.{0,8}motor/, "motor"],
  [/combustivel|injetor|injecao|bico/, "alimentacao"],
  [/suspensao|amortecedor|pivo|terminal|mola/, "suspensao"],
  [/freio|pastilha|disco.{0,8}freio/, "freios"],
];

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Apenas os nós `tx:` ou o agrupador taxonomia recebem desenhos de peças. */
export function iconeNoMapa(id: string, rotulo: string): Peca | null {
  if (id === "taxonomia") return "todas";
  if (!id.startsWith("tx:")) return null;
  const nome = normalizar(rotulo);
  const achado = ALIASES.find(([re]) => re.test(nome));
  return achado?.[1] ?? iconeDaCategoria("", rotulo);
}
