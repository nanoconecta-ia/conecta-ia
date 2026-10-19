// Interpreta a pergunta de um cliente em linguagem natural ("qual é o motor para o caminhão HR 2011?") e decide o que FALTA perguntar.
// Puro e determinístico: não chama rede nem IA. O vocabulário (modelos, versões, famílias de peça) vem do BANCO como dado:
// nenhuma montadora, modelo ou peça está escrita aqui, então nada é inventado e o que não está cadastrado não é reconhecido.

export interface VocabModelo { montadora: string; modelo: string; categoria?: string | null; versoes?: string[]; apelidos?: string[] }
export interface VocabPeca { slug: string; nome: string; sinonimos?: string[] }
export interface Vocabulario { modelos: VocabModelo[]; pecas: VocabPeca[] }

export type Faltante = "modelo" | "montadora" | "ano" | "versao_ou_motor" | "peca";
export interface Interpretacao {
  texto: string;
  intencao: "achar_peca" | "descobrir_peca" | "indefinida";
  veiculo: { montadora?: string; modelo?: string; ano?: number; candidatos_modelo: VocabModelo[] };
  pecas: VocabPeca[];
  falta: Faltante[];
  perguntas: string[];
  avisos: string[];
  /** Termos da consulta que não foram reconhecidos no cadastro: nunca adivinhados. */
  nao_reconhecido: string[];
}

export const normalizar = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const contem = (texto: string, termo: string): boolean => {
  const t = normalizar(termo);
  return t.length > 0 && new RegExp(`(^| )${t.replace(/ /g, " +")}( |$)`).test(texto);
};

/** Palavras comuns do idioma que indicam o TIPO de veículo. Só geram aviso: o modelo é decidido pelo cadastro, nunca por estas palavras. */
const TIPOS: Record<string, string[]> = {
  caminhao: ["caminhao", "caminhoneta"], picape: ["picape", "pickup", "pick up"], van: ["van"], furgao: ["furgao"], suv: ["suv"], utilitario: ["utilitario"],
};
const PARA_CATEGORIA: Record<string, string> = { caminhao: "caminhao", picape: "picape", van: "van", furgao: "furgao", suv: "suv", utilitario: "utilitario" };

const INTENCAO_DESCOBRIR = /^(qual|quais|que|me diz|me diga|me fala|descobrir)/;

export function interpretarConsulta(entrada: string, voc: Vocabulario, anoAtual = new Date().getFullYear()): Interpretacao {
  const bruto = (entrada ?? "").slice(0, 300);
  const t = normalizar(bruto);
  const r: Interpretacao = { texto: bruto, intencao: "indefinida", veiculo: { candidatos_modelo: [] }, pecas: [], falta: [], perguntas: [], avisos: [], nao_reconhecido: [] };
  if (!t) { r.falta.push("modelo", "peca"); r.perguntas.push("Qual é o veículo e qual peça você procura?"); return r; }

  // ano: só 4 dígitos plausíveis; "2011" vale, "20112" não
  const anos = [...new Set((t.match(/(^| )(19[5-9]\d|20\d\d)(?= |$)/g) ?? []).map((a) => Number(a.trim())).filter((a) => a <= anoAtual + 1))];
  if (anos.length === 1) r.veiculo.ano = anos[0];
  if (anos.length > 1) r.avisos.push(`Vários anos na pergunta (${anos.join(", ")}): confirme qual é o do veículo.`);

  // modelo: casa por nome ou apelido cadastrado, em fronteira de palavra
  const ach = voc.modelos.filter((m) => [m.modelo, ...(m.apelidos ?? [])].some((n) => contem(t, n)));
  const unicos = new Map(ach.map((m) => [`${m.montadora}|${m.modelo}`, m]));
  r.veiculo.candidatos_modelo = [...unicos.values()];
  const montadoraCitada = voc.modelos.map((m) => m.montadora).filter((x, i, a) => a.indexOf(x) === i).find((m) => contem(t, m));
  let cand = r.veiculo.candidatos_modelo;
  if (montadoraCitada && cand.length > 1) cand = cand.filter((m) => m.montadora === montadoraCitada);
  if (cand.length === 1) { r.veiculo.modelo = cand[0].modelo; r.veiculo.montadora = cand[0].montadora; }
  else if (cand.length > 1) r.falta.push("montadora");
  else r.falta.push("modelo");

  // tipo dito pelo cliente x categoria cadastrada: avisa, não corrige em silêncio
  const tipoDito = Object.entries(TIPOS).find(([, ps]) => ps.some((p) => contem(t, p)))?.[0];
  const unico = cand.length === 1 ? cand[0] : null;
  if (tipoDito && unico?.categoria && PARA_CATEGORIA[tipoDito] !== unico.categoria) r.avisos.push(`O cadastro classifica ${unico.modelo} como ${unico.categoria}; a busca segue pelo modelo, não pelo tipo "${tipoDito}".`);

  // peça: sinônimo/nome em fronteira de palavra; termo genérico que casa várias famílias vira pergunta
  const palavras = new Set(t.split(" ").filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !PALAVRAS_DE_LIGACAO.has(w)));
  const veic = normalizar(cand.flatMap((m) => [m.modelo, m.montadora, ...(m.apelidos ?? [])]).join(" ")).split(" ");
  const nomes = (p: VocabPeca) => [p.nome, ...(p.sinonimos ?? [])];
  const exatas = voc.pecas.filter((p) => nomes(p).some((n) => normalizar(n).split(" ").length > 1 && contem(t, n)));
  const parciais = voc.pecas.filter((p) => nomes(p).some((n) => normalizar(n).split(" ").some((w) => palavras.has(w) && !veic.includes(w))));
  r.pecas = exatas.length ? exatas : parciais;
  if (!r.pecas.length) r.falta.push("peca");

  if (unico && (unico.versoes?.length ?? 0) > 1) r.falta.push("versao_ou_motor");
  if (!r.veiculo.ano && (cand.length >= 1)) r.falta.push("ano");

  r.intencao = INTENCAO_DESCOBRIR.test(t) ? "descobrir_peca" : (r.pecas.length ? "achar_peca" : "indefinida");

  // perguntas objetivas, uma por lacuna, na ordem em que destravam a busca
  if (r.falta.includes("modelo")) r.perguntas.push("Qual é o modelo do veículo?");
  if (r.falta.includes("montadora")) r.perguntas.push(`Há mais de um cadastro com esse nome (${cand.map((m) => `${m.montadora} ${m.modelo}`).join(", ")}). Qual é a montadora?`);
  if (r.falta.includes("ano")) r.perguntas.push("Qual é o ano do veículo? O ano de fabricação pode diferir do ano-modelo; confira no documento.");
  if (r.falta.includes("versao_ou_motor")) r.perguntas.push(`Qual é a versão ou o motor? Cadastradas: ${unico!.versoes!.slice(0, 8).join("; ")}.`);
  if (r.falta.includes("peca")) r.perguntas.push(`Qual peça você quer encontrar?${voc.pecas.length ? " Exemplos: " + voc.pecas.slice(0, 6).map((p) => p.nome).join(", ") + "." : ""}`);
  else if (r.pecas.length > 1) r.perguntas.push(`Qual destas peças você procura: ${r.pecas.slice(0, 8).map((p) => p.nome).join("; ")}?`);

  const resto = t.split(" ").filter((w) => w.length > 2 && !/^\d+$/.test(w));
  const conhecidos = normalizar([...(unico ? [unico.modelo, unico.montadora, ...(unico.apelidos ?? [])] : []), ...r.pecas.flatMap((p) => [p.nome, ...(p.sinonimos ?? [])])].join(" ")).split(" ");
  r.nao_reconhecido = resto.filter((w) => !conhecidos.includes(w) && !PALAVRAS_DE_LIGACAO.has(w)).slice(0, 6);
  return r;
}

const PALAVRAS_DE_LIGACAO = new Set(["qual", "quais", "que", "para", "pra", "tem", "tenho", "preciso", "quero", "uma", "uns", "umas", "como", "onde", "comprar", "acho", "achar", "procuro", "meu", "minha", "dos", "das", "com", "sem", "ano", "modelo", "peca", "pecas", "caminhao", "caminhoneta", "picape", "pickup", "van", "furgao", "suv", "utilitario"]);
