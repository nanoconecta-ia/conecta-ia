// Validador DETERMINÍSTICO de texto técnico/SEO que o agente propõe (título, descrição, tags). Função pura.
// O texto que vai ao site não pode afirmar aplicação, código ou originalidade que ainda não foi APROVADO por uma pessoa para aquele produto.
//
// O que isto PROVA: toda frase de compatibilidade cita só veículos e anos já aprovados; todo código parecido com OEM/fabricante é um código aprovado (ou o SKU);
// ninguém diz "original", "genuína", "homologada" ou "certificada" sem prova; sem aplicação aprovada, nenhuma frase de compatibilidade passa.
// O que isto NÃO PROVA: que a redação é boa nem que o texto não diz algo errado de outro jeito (a heurística lê padrões de frase, não entende qualquer texto).
// A pessoa que aprova o texto continua sendo a trava final.

export interface AplicacaoAprovada { marca: string; modelo: string; motor?: string | null; ano_inicial: number | null; ano_final: number | null }
export interface BaseSeo { aplicacoesAprovadas: AplicacaoAprovada[]; codigosAprovados: string[]; sku: string; genuinaProvada?: boolean }
export interface Bloqueio { codigo: string; mensagem: string }
export interface ResultadoSeo { ok: boolean; bloqueios: Bloqueio[] }

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cod = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Frases que afirmam compatibilidade: o trecho seguinte, até o fim da frase, é a lista de veículos. */
const FRASE_COMPAT = /(compat[ií]vel(?:\s+com)?|serve\s+(?:em|no|na|nos|nas|para)|indicad[ao]s?\s+para|aplica[cç][aã]o(?:\s+em)?\s*:?|para\s+os\s+ve[ií]culos|usad[ao]\s+(?:em|no|na))\s+((?:[^.;\n!?]|\.(?=\d))+)/gi; // o ponto de "2.5" não termina a frase
/** Trecho que é só faixa de anos ("de 2013 a 2017", "a partir de 2013", "entre 2013 e 2017", "2013-2017"): sem nome de veículo. */
const soAno = (s: string) => /\d/.test(s) && s.replace(/\b(de|a|ate|partir|entre|e|em|diante|atual|ano|anos|desde|do|ao|ate)\b/g, "").replace(/[\d\s\-–.]/g, "") === "";
const ORIGINALIDADE = /\b(original|originais|genu[ií]n[ao]s?|homologad[ao]s?|certificad[ao]s?)\b/i;
/** Códigos que parecem OEM/fabricante: 5+ caracteres, com dígito, sem ser só um ano ou um número curto. */
const PARECE_CODIGO = /\b(?=[A-Z0-9][A-Z0-9.\-]{4,}\b)(?=[A-Z0-9.\-]*\d)[A-Z0-9][A-Z0-9.\-]{4,}\b/g;

export function validarTextoSeo(texto: string, base: BaseSeo): ResultadoSeo {
  const b: Bloqueio[] = []; const no = (c: string, m: string) => b.push({ codigo: c, mensagem: m });
  const t = texto ?? "";
  const modelos = base.aplicacoesAprovadas.map((x) => sem(x.modelo).trim()).filter(Boolean);
  const motores = base.aplicacoesAprovadas.map((x) => sem(x.motor ?? "").trim()).filter(Boolean);
  // O motor também se reconhece pelo código dele (parte com letras e números, ex.: d4cb), em qualquer ordem. Palavras genéricas ("diesel", "2.5") não contam.
  const codigosDeMotor = [...new Set(motores.flatMap((m) => m.split(/[^a-z0-9]+/)).filter((w) => w.length >= 3 && /\d/.test(w) && /[a-z]/.test(w)))];
  const anos = base.aplicacoesAprovadas.flatMap((x) => (x.ano_inicial != null ? [[x.ano_inicial, x.ano_final ?? x.ano_inicial] as const] : []));

  for (const m of t.matchAll(FRASE_COMPAT)) {
    if (base.aplicacoesAprovadas.length === 0) { no("seo_compatibilidade_sem_aplicacao_aprovada", "O texto afirma compatibilidade, mas o produto não tem nenhuma aplicação aprovada."); break; }
    for (const item of m[2].split(/\s*[,\/&]\s*|\se\s|\sou\s/i).map((x) => x.trim()).filter(Boolean)) {
      const s = sem(item);
      const anosDoItem = [...s.matchAll(/\b(19[5-9]\d|20\d\d)\b/g)].map((x) => Number(x[1]));
      const temModelo = modelos.some((mod) => s.includes(mod));
      const temMotor = motores.some((mot) => s.includes(mot)) || codigosDeMotor.some((c) => new RegExp(`(^|[^a-z0-9])${c}([^a-z0-9]|$)`).test(s));
      if (!temModelo && !temMotor && !soAno(s)) { no("seo_veiculo_nao_aprovado", `O texto cita "${item.slice(0, 60)}", que não está entre as aplicações aprovadas.`); continue; }
      for (const ano of anosDoItem) if (!anos.some(([i, f]) => ano >= i && ano <= f)) no("seo_ano_fora_do_aprovado", `O ano ${ano} está fora das faixas aprovadas.`);
    }
  }
  // Nomes de modelo e de motor aprovados (inteiros e por palavra) também não são "códigos de peça": K2500, D4CB.
  const nomes = [...modelos, ...motores].flatMap((x) => [x, ...x.split(/\s+/)]).filter((x) => x.length >= 3).map(cod);
  const aprovados = new Set([...base.codigosAprovados, base.sku, ...nomes].map(cod));
  for (const m of t.toUpperCase().matchAll(PARECE_CODIGO)) {
    const c = cod(m[0]);
    if (/^\d{4}([-–.]\d{2,4})?$/.test(m[0]) || /^EURO\d$/.test(c) || /^\d+[.,]\d+[A-Z]*$/.test(m[0]) || aprovados.has(c)) continue; // ano, faixa de anos, Euro 5, cilindrada
    no("seo_codigo_nao_aprovado", `O código ${m[0]} não é um código aprovado deste produto.`);
  }
  if (ORIGINALIDADE.test(t) && !base.genuinaProvada) no("seo_afirma_originalidade_sem_prova", "O texto afirma que a peça é original, genuína, homologada ou certificada, sem prova aprovada.");
  const vistos = new Set<string>();
  const unicos = b.filter((x) => { const k = `${x.codigo}|${x.mensagem}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  return { ok: unicos.length === 0, bloqueios: unicos };
}
