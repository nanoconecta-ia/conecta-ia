// Conjunto de ícones próprios da plataforma (peças e tipos de veículo), desenhados em grade 48×48.
// Cada ícone tem `f` (preenchimento suave) e `s` (traço). O mapeamento taxonomia → ícone é puro e testável.

export type Desenho = { f?: string; s: string };

const rodas = "M13 36a4 4 0 108 0 4 4 0 10-8 0M31 36a4 4 0 108 0 4 4 0 10-8 0";

export const ICONES: Record<string, Desenho> = {
  // ---- raízes da taxonomia de autopeças
  motor: { f: "M10 20h4v-4h6v-4h10v4h6v4h4v12h-4v4H14v-4h-4z", s: "M10 20h4v-4h6v-4h10v4h6v4h4v12h-4v4H14v-4h-4zM20 20v12M28 20v12M6 26h4M24 12V8M21 8h6" },
  suspensao: { f: "M20 34h8v6h-8z", s: "M18 8h12M24 8v6M17 16l14 3-14 3 14 3-14 3 14 3M24 34v6M19 40h10" },
  freios: { f: "M24 8a16 16 0 100 32 16 16 0 000-32z", s: "M24 8a16 16 0 100 32 16 16 0 000-32zM24 19a5 5 0 100 10 5 5 0 000-10zM24 12v3M24 33v3M12 24h3M33 24h3M36 10a16 16 0 014 7l-6 3" },
  filtros: { f: "M14 12h20v6l-3 4v14a3 3 0 01-3 3H20a3 3 0 01-3-3V22l-3-4z", s: "M14 12h20v6l-3 4v14a3 3 0 01-3 3H20a3 3 0 01-3-3V22l-3-4zM20 26h8M20 30h8M20 34h8M18 8h12" },
  eletrica: { f: "M26 6L12 26h10l-2 16 16-22H26z", s: "M26 6L12 26h10l-2 16 16-22H26z" },
  arrefecimento: { f: "M8 14h32v20H8z", s: "M8 14h32v20H8zM15 14v20M22 14v20M29 14v20M36 14v20M8 19H4M44 19h-4M8 29H4M44 29h-4" },
  escapamento: { f: "M20 22h14v14H20z", s: "M4 32h12c3 0 4-10 8-10M20 22h14v14H20zM34 29h10M24 22v14M29 22v14" },
  transmissao: { f: "M24 14a10 10 0 100 20 10 10 0 000-20z", s: "M24 14a10 10 0 100 20 10 10 0 000-20zM24 21a3 3 0 100 6 3 3 0 000-6zM24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4" },
  iluminacao: { f: "M8 24c0-8 7-14 16-14v28c-9 0-16-6-16-14z", s: "M8 24c0-8 7-14 16-14v28c-9 0-16-6-16-14zM30 16h12M30 24h14M30 32h12M15 24h5" },
  lubrificantes: { f: "M24 6c8 10 12 15 12 22a12 12 0 01-24 0c0-7 4-12 12-22z", s: "M24 6c8 10 12 15 12 22a12 12 0 01-24 0c0-7 4-12 12-22zM18 30a6 6 0 004 5" },
  carroceria: { f: "M6 30l4-10c1-2 3-4 6-4h14c3 0 5 2 7 5l5 4c2 1 2 2 2 5H6z", s: `M6 30l4-10c1-2 3-4 6-4h14c3 0 5 2 7 5l5 4c2 1 2 2 2 5H6zM15 20h8v7h-12zM27 20h4l4 5h-8${rodas}` },
  alimentacao: { f: "M18 8h12v8l-3 4v14l-3 6-3-6V20l-3-4z", s: "M18 8h12v8l-3 4v14l-3 6-3-6V20l-3-4zM12 40l4-4M24 44v-4M36 40l-4-4" },
  // ---- subcategorias
  bomba: { f: "M12 16h24v20H12z", s: "M12 16h24v20H12zM24 26a5 5 0 100 .1M6 22h6M36 30h6M18 12h12v4H18z" },
  ventoinha: { f: "M24 24c0-8 3-12 7-12s5 6-1 10zM24 24c8 0 12 3 12 7s-6 5-10-1zM24 24c0 8-3 12-7 12s-5-6 1-10zM24 24c-8 0-12-3-12-7s6-5 10 1z", s: "M24 24c0-8 3-12 7-12s5 6-1 10zM24 24c8 0 12 3 12 7s-6 5-10-1zM24 24c0 8-3 12-7 12s-5-6 1-10zM24 24c-8 0-12-3-12-7s6-5 10 1zM24 22v4" },
  termostato: { f: "M14 18h20v12H14z", s: "M14 18h20v12H14zM24 18v-8M20 10h8M24 30v8M19 38h10M18 24h12" },
  espelho: { f: "M10 12h22c4 0 6 4 6 8v8c0 4-2 8-6 8H10z", s: "M10 12h22c4 0 6 4 6 8v8c0 4-2 8-6 8H10zM10 12v24M42 24h-4" },
  bateria: { f: "M6 16h36v22H6z", s: "M6 16h36v22H6zM12 12h6v4h-6zM30 12h6v4h-6zM13 27h8M33 23v8M29 27h8" },
  sensor: { f: "M16 16h16v12H16z", s: "M16 16h16v12H16zM20 28v8h8v-8M24 36v6M20 16v-6M28 16v-6M20 22h8" },
  vela: { f: "M19 20h10v14H19z", s: "M19 20h10v14H19zM21 8h6v12h-6zM24 34v8M20 42h8M19 26h10" },
  rolamento: { f: "M24 8a16 16 0 100 32 16 16 0 000-32z", s: "M24 8a16 16 0 100 32 16 16 0 000-32zM24 16a8 8 0 100 16 8 8 0 000-16zM24 12v0M24 36v0M12 24v0M36 24v0M20 24h8" },
  catalisador: { f: "M12 16h24c4 0 6 4 6 8s-2 8-6 8H12c-4 0-6-4-6-8s2-8 6-8z", s: "M12 16h24c4 0 6 4 6 8s-2 8-6 8H12c-4 0-6-4-6-8s2-8 6-8zM6 24H2M42 24h4M18 16v16M24 16v16M30 16v16" },
  cilindro: { f: "M10 20h28v8H10z", s: "M10 20h28v8H10zM6 24h4M38 24h6M18 20v-6M30 20v-6M16 14h4M28 14h4" },
  tambor: { f: "M24 8a16 16 0 100 32 16 16 0 000-32z", s: "M24 8a16 16 0 100 32 16 16 0 000-32zM24 14a10 10 0 100 20 10 10 0 000-20zM16 26c2 4 6 6 10 5M24 22v4" },
  pastilha: { f: "M8 18c4-4 28-4 32 0v12c-4 4-28 4-32 0z", s: "M8 18c4-4 28-4 32 0v12c-4 4-28 4-32 0zM14 22v4M20 22v4M26 22v4M32 22v4" },
  lampada: { f: "M24 6a11 11 0 00-6 20v6h12v-6a11 11 0 00-6-20z", s: "M24 6a11 11 0 00-6 20v6h12v-6a11 11 0 00-6-20zM19 36h10M21 40h6M24 14v8" },
  biela: { f: "M20 8a4 4 0 118 0 4 4 0 01-8 0zM17 36a7 7 0 1114 0 7 7 0 01-14 0z", s: "M20 8a4 4 0 118 0 4 4 0 01-8 0zM17 36a7 7 0 1114 0 7 7 0 01-14 0zM22 12l-3 17M26 12l3 17M24 34v0" },
  valvula: { f: "M14 10h20v6H14z", s: "M14 10h20v6H14zM24 16v24M17 40h14M18 30h12" },
  correia: { f: "M14 14a6 6 0 000 12h20a6 6 0 000-12z", s: "M14 14a6 6 0 000 12h20a6 6 0 000-12zM14 22a6 6 0 000 12h20a6 6 0 000-12z" },
  junta: { f: "M8 12h32v24H8z", s: "M8 12h32v24H8zM14 18a2 2 0 100 .1M24 18a2 2 0 100 .1M34 18a2 2 0 100 .1M14 30a2 2 0 100 .1M24 30a2 2 0 100 .1M34 30a2 2 0 100 .1M18 24h12" },
  pistao: { f: "M14 12h20v22H14z", s: "M14 12h20v22H14zM14 18h20M14 22h20M24 34v8M20 42h8" },
  barra: { f: "M8 22h32v4H8z", s: "M8 24h32M8 18v12M40 18v12M24 24v12M20 36h8" },
  bucha: { f: "M24 12a12 12 0 100 24 12 12 0 000-24z", s: "M24 12a12 12 0 100 24 12 12 0 000-24zM24 19a5 5 0 100 10 5 5 0 000-10zM24 8v4M24 36v4" },
  mola: { f: "M14 8h20v4H14zM14 36h20v4H14z", s: "M14 8h20v4H14zM14 36h20v4H14zM16 14l16 3-16 4 16 3-16 4 16 3" },
  pivo: { f: "M20 8h8v10h-8z", s: "M20 8h8v10h-8zM24 18v8M24 26a6 6 0 100 12 6 6 0 000-12zM24 32v0" },
  oleo: { f: "M14 20h20l4 4v14H10V24z", s: "M14 20h20l4 4v14H10V24zM20 20v-6h8v6M38 24l6-4M24 30c3 3 3 5 0 7-3-2-3-4 0-7z" },
  // ---- tipos de veículo (silhuetas laterais estilizadas)
  carro: { f: "M5 31l3-9c1-3 3-5 7-5h14c3 0 5 1 7 4l4 3c3 1 4 2 4 5v2H5z", s: `M5 31l3-9c1-3 3-5 7-5h14c3 0 5 1 7 4l4 3c3 1 4 2 4 5v2H5zM14 18l-3 7h13v-7zM27 18v7h10l-5-7${rodas}` },
  utilitario: { f: "M4 32V16c0-2 1-3 3-3h22c2 0 4 1 5 3l5 6c2 1 3 2 3 5v5H4z", s: `M4 32V16c0-2 1-3 3-3h22c2 0 4 1 5 3l5 6c2 1 3 2 3 5v5H4zM33 17l4 6h-8v-6zM8 17h18v6H8${rodas}` },
  caminhonete: { f: "M4 32v-8c0-2 1-3 3-3h18l4-7c1-2 3-3 5-3h6c3 0 4 2 4 4v17z", s: `M4 32v-8c0-2 1-3 3-3h18l4-7c1-2 3-3 5-3h6c3 0 4 2 4 4v17zM29 14l-3 7h12v-7zM25 21v11${rodas}` },
  furgao: { f: "M4 32V14c0-2 1-3 3-3h24v21z", s: `M4 32V14c0-2 1-3 3-3h24v21zM31 17h6c2 0 3 1 4 3l3 6c1 1 1 2 1 4v2H31zM35 20l3 5h-7v-5M8 15h18v8H8${rodas}` },
  caminhao: { f: "M4 12h24v20H4zM28 18h9l5 6v8H28z", s: `M4 12h24v20H4zM28 18h9l5 6v8H28zM33 21l3 4h-6v-4M10 36a4 4 0 108 0 4 4 0 10-8 0M30 36a4 4 0 108 0 4 4 0 10-8 0` },
  moto: { f: "M20 18h10l4 8H18z", s: "M8 36a6 6 0 1012 0 6 6 0 10-12 0M30 36a6 6 0 1012 0 6 6 0 10-12 0M14 36l6-14h10l6 14M20 22l-3-6h-5M30 22l-2-8h5" },
  // ---- gerais
  peca: { f: "M12 12h24v24H12z", s: "M12 12h24v24H12zM18 18h12v12H18zM24 6v6M24 36v6M6 24h6M36 24h6" },
};

/** slug de taxonomia (raiz ou filho) → chave de ícone. */
const POR_SLUG: Record<string, string> = {
  motor: "motor", suspensao: "suspensao", "suspensao-direcao": "suspensao", freios: "freios", filtros: "filtros", "eletrica-ignicao": "eletrica", arrefecimento: "arrefecimento",
  escapamento: "escapamento", "embreagem-transmissao": "transmissao", iluminacao: "iluminacao", "lubrificantes-fluidos": "lubrificantes", "carroceria-acabamento": "carroceria", "alimentacao-injecao": "alimentacao",
  "bicos-injetores": "alimentacao", "bombas-combustivel": "bomba", "bombas-agua": "bomba", "bomba-oleo": "bomba", "embreagens-viscosas": "ventoinha", radiadores: "arrefecimento", "valvulas-termostaticas": "termostato",
  "paralamas-parachoques": "carroceria", retrovisores: "espelho", baterias: "bateria", sensores: "sensor", velas: "vela", "kits-embreagem": "transmissao", rolamentos: "rolamento", catalisadores: "catalisador", silenciosos: "escapamento",
  "filtro-ar": "filtros", "filtro-cabine": "filtros", "filtro-combustivel": "filtros", "filtro-oleo": "filtros", "cilindros-flexiveis": "cilindro", discos: "freios", "lonas-tambores": "tambor", pastilhas: "pastilha",
  "farois-lanternas": "iluminacao", lampadas: "lampada", "fluidos-freio-arrefecimento": "lubrificantes", "oleos-motor": "oleo", bielas: "biela", "cabecote-valvulas": "valvula", "correias-tensores": "correia",
  "juntas-retentores": "junta", "pistoes-aneis": "pistao", amortecedores: "suspensao", "barras-estabilizadoras": "barra", "buchas-batentes": "bucha", molas: "mola", "pivos-terminais": "pivo",
};

const POR_PALAVRA: [RegExp, string][] = [
  [/motor/, "motor"], [/suspens|amortec/, "suspensao"], [/freio|pastilha|disco/, "freios"], [/filtro/, "filtros"], [/el[eé]tric|igni/, "eletrica"], [/arrefec|radiador/, "arrefecimento"],
  [/escap|silenc/, "escapamento"], [/embreag|transmiss|c[aâ]mbio/, "transmissao"], [/ilumin|far[oó]l|lanterna/, "iluminacao"], [/lubrif|[oó]leo|fluido/, "lubrificantes"], [/carroc|acabament|para-?choque/, "carroceria"],
  [/aliment|inje[cç]/, "alimentacao"], [/acess/, "peca"],
];

/** Ícone de uma categoria: pelo slug conhecido; senão por palavra do nome; senão peça genérica. Nunca devolve chave inexistente. */
export function iconeDaCategoria(slug: string | null | undefined, nome?: string | null): string {
  const s = (slug ?? "").toLowerCase();
  if (POR_SLUG[s]) return POR_SLUG[s];
  const n = (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [re, k] of POR_PALAVRA) if (re.test(n)) return k;
  return "peca";
}

export const TIPOS_VEICULO: { chave: string; rotulo: string }[] = [
  { chave: "carro", rotulo: "Passeio" }, { chave: "utilitario", rotulo: "Utilitário" }, { chave: "furgao", rotulo: "Furgão fechado" },
  { chave: "caminhonete", rotulo: "Caminhonete" }, { chave: "caminhao", rotulo: "Caminhão" }, { chave: "moto", rotulo: "Moto" },
];
