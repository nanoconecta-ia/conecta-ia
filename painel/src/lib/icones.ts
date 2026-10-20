// Ícones próprios da plataforma: peças e veículos com volume, desenhados em assets/sprite-icones.svg (um <symbol> por ícone).
// Este módulo só decide QUAL ícone usar: puro e testável.

export const PECAS = ["motor", "suspensao", "freios", "filtros", "eletrica", "arrefecimento", "escapamento", "transmissao", "iluminacao", "lubrificantes", "carroceria", "alimentacao", "vela", "todas"] as const;
export type Peca = (typeof PECAS)[number];

export type TipoVeiculo = { chave: string; rotulo: string; simbolo: string };
/** Um tom por tipo (variáveis --v-<chave> nos temas). A ordem é a da vitrine. */
export const TIPOS_VEICULO: TipoVeiculo[] = [
  { chave: "passeio", rotulo: "Passeio", simbolo: "v-passeio" },
  { chave: "suv", rotulo: "Utilitário / SUV", simbolo: "v-suv" },
  { chave: "furgao", rotulo: "Furgão fechado", simbolo: "v-furgao" },
  { chave: "picape", rotulo: "Picape", simbolo: "v-picape" },
  { chave: "caminhao", rotulo: "Caminhão", simbolo: "v-caminhao" },
  { chave: "moto", rotulo: "Moto", simbolo: "v-moto" },
];

/** Categoria de `modelos` no banco → tipo desenhado. `van` e `furgao` são o mesmo desenho; `utilitario` e `suv` também. */
const TIPO_POR_CATEGORIA: Record<string, string> = { passeio: "passeio", suv: "suv", utilitario: "suv", van: "furgao", furgao: "furgao", picape: "picape", caminhao: "caminhao", moto: "moto" };
export function tipoDeVeiculo(categoria: string | null | undefined): TipoVeiculo | null {
  const chave = TIPO_POR_CATEGORIA[(categoria ?? "").toLowerCase()];
  return TIPOS_VEICULO.find((t) => t.chave === chave) ?? null;
}

/** slug de taxonomia (raiz ou filho) → ícone de peça. Subcategoria sem desenho próprio usa o da sua área. */
const POR_SLUG: Record<string, Peca> = {
  motor: "motor", "suspensao-direcao": "suspensao", suspensao: "suspensao", freios: "freios", filtros: "filtros", "eletrica-ignicao": "eletrica", arrefecimento: "arrefecimento", escapamento: "escapamento",
  "embreagem-transmissao": "transmissao", iluminacao: "iluminacao", "lubrificantes-fluidos": "lubrificantes", "carroceria-acabamento": "carroceria", "alimentacao-injecao": "alimentacao",
  "bicos-injetores": "alimentacao", "bombas-combustivel": "alimentacao", "bombas-agua": "arrefecimento", "bomba-oleo": "motor", "embreagens-viscosas": "arrefecimento", radiadores: "arrefecimento", "valvulas-termostaticas": "arrefecimento",
  "paralamas-parachoques": "carroceria", retrovisores: "carroceria", baterias: "eletrica", sensores: "eletrica", velas: "vela", "kits-embreagem": "transmissao", rolamentos: "transmissao", catalisadores: "escapamento", silenciosos: "escapamento",
  "filtro-ar": "filtros", "filtro-cabine": "filtros", "filtro-combustivel": "filtros", "filtro-oleo": "filtros", "cilindros-flexiveis": "freios", discos: "freios", "lonas-tambores": "freios", pastilhas: "freios",
  "farois-lanternas": "iluminacao", lampadas: "iluminacao", "fluidos-freio-arrefecimento": "lubrificantes", "oleos-motor": "lubrificantes", bielas: "motor", "cabecote-valvulas": "motor", "correias-tensores": "motor",
  "juntas-retentores": "motor", "pistoes-aneis": "motor", amortecedores: "suspensao", "barras-estabilizadoras": "suspensao", "buchas-batentes": "suspensao", molas: "suspensao", "pivos-terminais": "suspensao",
};

const POR_PALAVRA: [RegExp, Peca][] = [
  [/motor/, "motor"], [/suspens|amortec/, "suspensao"], [/freio|pastilha|disco/, "freios"], [/filtro/, "filtros"], [/el[eé]tric|igni|bateria/, "eletrica"], [/arrefec|radiador/, "arrefecimento"],
  [/escap|silenc/, "escapamento"], [/embreag|transmiss|c[aâ]mbio/, "transmissao"], [/ilumin|far[oó]l|lanterna/, "iluminacao"], [/lubrif|[oó]leo|fluido/, "lubrificantes"], [/carroc|acabament|para-?choque/, "carroceria"],
  [/aliment|inje[cç]|combust/, "alimentacao"],
];

/** Ícone de uma categoria: pelo slug conhecido; senão por palavra do nome; senão o de "todas". Nunca devolve ícone inexistente. */
export function iconeDaCategoria(slug: string | null | undefined, nome?: string | null): Peca {
  const s = (slug ?? "").toLowerCase();
  if (POR_SLUG[s]) return POR_SLUG[s];
  const n = (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [re, k] of POR_PALAVRA) if (re.test(n)) return k;
  return "todas";
}
