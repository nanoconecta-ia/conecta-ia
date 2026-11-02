// Regra PURA contra marca inventada (ordem do dono, 02/11/2026): o agente nunca troca marca nacional por importada nem chuta nome "fantasioso".
// O QUE PROVA: a marca proposta (a) não é termo genérico ou de origem (IMPORTADO, NACIONAL, GENÉRICO…); (b) tem EVIDÊNCIA: URL externa, ou o texto do
// próprio cadastro/nota onde ela aparece literalmente (evidência "declarada", NÃO verificada), ou, só quando quem pede é uma PESSOA, um documento descrito.
// O QUE NÃO PROVA: que a marca existe no mundo real nem que o fabricante é o correto. Quem aprova na fila é a pessoa; a evidência fica registrada na proposta.
export interface FonteMarca { url?: string; documento?: string }
export interface ContextoMarca {
  /** Textos do próprio cadastro/nota onde a marca pode estar declarada (nome, descrições, descrição do item da nota). */
  textosDoCadastro: (string | null | undefined)[];
  /** true quando o pedido é de uma PESSOA (formulário), que assume a responsabilidade pela fonte descrita. */
  porPessoa?: boolean;
}
export type TipoEvidenciaMarca = "url_externa" | "declarada_no_cadastro" | "documento_da_pessoa";
export type ResultadoMarca = { ok: true; marca: string; evidencia: TipoEvidenciaMarca; verificada: boolean; aviso?: string } | { ok: false; erro: string };

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Termos que descrevem origem, qualidade ou ausência, não fabricante. */
const GENERICAS = new Set(["importado", "importada", "nacional", "generico", "generica", "diversos", "diversas", "outros", "outras", "sem marca", "s marca", "sem", "na", "n a", "marca", "original", "similar", "paralelo", "paralela", "compativel", "replica", "china", "brasil", "oem", "premium", "linha", "primeira linha", "universal"]);
const BOILERPLATE = /^(pedido do lojista|cadastro do (pr[oó]prio )?bling)/i;

export function marcaGenerica(marca: string | null | undefined): boolean {
  if (marca == null || !marca.trim()) return true;
  return GENERICAS.has(sem(marca.replace(/^\s*marca\s*:\s*/i, "")));
}

export function validarMarca(marca: unknown, fontes: FonteMarca[] | undefined, ctx: ContextoMarca): ResultadoMarca {
  if (typeof marca !== "string") return { ok: false, erro: "Marca inválida." };
  const m = marca.replace(/^\s*marca\s*:\s*/i, "").trim();
  if (m.length < 2 || m.length > 80) return { ok: false, erro: "A marca deve ter de 2 a 80 caracteres." };
  if (/[<>{}\[\]\\]/.test(m)) return { ok: false, erro: "A marca só aceita texto simples." };
  if (marcaGenerica(m)) return { ok: false, erro: `"${m}" não identifica o fabricante (é origem, qualidade ou termo genérico). Informe o fabricante real com fonte; sem fonte, deixe "a confirmar".` };
  const lista = Array.isArray(fontes) ? fontes : [];
  if (lista.some((f) => typeof f?.url === "string" && /^https:\/\/[^\s/]+\.[^\s/]+/i.test(f.url) && f.url.length <= 500))
    return { ok: true, marca: m, evidencia: "url_externa", verificada: false, aviso: "Fonte externa citada: a pessoa confere a página antes de aprovar." };
  const alvo = sem(m);
  const achada = ctx.textosDoCadastro.some((t) => typeof t === "string" && new RegExp(`(^| )${alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(sem(t)));
  if (achada) return { ok: true, marca: m, evidencia: "declarada_no_cadastro", verificada: false, aviso: "Marca declarada no próprio cadastro ou nota do fornecedor; não há verificação independente." };
  if (ctx.porPessoa && lista.some((f) => typeof f?.documento === "string" && f.documento.trim().length >= 10 && !BOILERPLATE.test(f.documento.trim())))
    return { ok: true, marca: m, evidencia: "documento_da_pessoa", verificada: false, aviso: "Fonte descrita pela pessoa: confira antes de aprovar." };
  return { ok: false, erro: `Sem evidência para a marca "${m}": cite a URL do fabricante ou use a marca que está escrita no cadastro/nota. Não chuto marca.` };
}

/** Marca ATUAL do Bling x marca PROPOSTA (PR #242, teste de aceite 4). Mesma marca com outra grafia (caixa, acento, pontuação, prefixo "MARCA:") não é conflito. */
export function conflitoDeMarca(atual: string | null | undefined, proposta: string): { conflito: boolean; atual: string | null; proposta: string } {
  const a = (atual ?? "").replace(/^\s*marca\s*:\s*/i, "").trim();
  const p = proposta.replace(/^\s*marca\s*:\s*/i, "").trim();
  if (!a) return { conflito: false, atual: null, proposta: p };
  return { conflito: sem(a) !== sem(p), atual: a, proposta: p };
}
