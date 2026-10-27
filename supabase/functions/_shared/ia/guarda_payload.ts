// Barreira de dados confidenciais no PAYLOAD enviado a provedores de IA (e a plugins de terceiros).
// Roda depois que o corpo da requisição foi montado e ANTES do fetch: não depende do prompt nem da boa vontade da ferramenta.
//  - Chaves de custo, fornecedor, fiscal, dados pessoais e credenciais são REMOVIDAS dos blocos de conversa (mensagens, resultados de
//    ferramenta, entradas de ferramenta), inclusive dentro de JSON serializado em texto.
//  - Padrões de segredo (JWT, chaves de API, Bearer) são trocados por "[segredo removido]" em qualquer texto.
//  - Anexo de texto (CSV etc.) com coluna de custo/fiscal/fornecedor BLOQUEIA o envio (a decisão de remover a coluna é do lojista).
// O relatório devolve só NOMES de chave e contagens, nunca valores. Texto livre digitado pelo lojista não é filtrável de forma confiável.
import { IaErro } from "./tipos.ts";

export interface RelatorioGuarda { chavesRemovidas: Record<string, number>; segredosSubstituidos: number }

/** Partes do corpo que descrevem o contrato (ferramentas, instruções): não são dado de conversa, então nomes de campo ali ficam. */
const PARTES_DE_CONTRATO = new Set(["tools", "system", "systeminstruction", "tool_config", "toolconfig", "generationconfig", "tool_choice"]);
const CHAVES_DE_BINARIO = new Set(["data", "dados"]);
const PROFUNDIDADE_MAX = 40;
const TEXTO_JSON_MAX = 1_000_000;
const TEXTO_VARREDURA_MAX = 200_000;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Chave (já normalizada) que nunca vai a um provedor de IA. Casa a chave inteira; "fornecedores_oem" (referência técnica) NÃO casa. */
const CHAVE_PROIBIDA: RegExp[] = [
  /^(preco|valor)?(de)?(custo|cost|compra)(s|medio|unitario|reposicao|liquido|total|produto)?$/, /^margem(s|lucro|bruta|liquida)?$/, /^markup$/, /^lucro(s|bruto|liquido)?$/,
  /^(id|cod|codigo|nome|contato|cnpj|cpf)?(fornecedor|supplier)(es|s)?(id)?$/,
  /^(ncm|cest|cst|csosn|cfop|iss|issqn|tributacao|tributos?|impostos?|origemfiscal|dadosfiscais|fiscal)$/,
  /^(icms|ipi|pis|cofins)(st|aliquota|valor|base|cst|origem)?$/, /^aliquota[a-z]*$/,
  /^(cpf|cnpj)$/,
  /^(senha|password|passwd|token|secret|apikey|authorization|servicerole|clientsecret|privatekey|chavecifrada)$/, /^(access|refresh|id)token[a-z]*$/, /^[a-z]*(token|segredo)cifrado$/,
];
const chaveProibida = (k: string) => { const n = norm(k); return n.length > 0 && CHAVE_PROIBIDA.some((r) => r.test(n)); };

const SEGREDOS: RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JWT
  /\bsk-[A-Za-z0-9_-]{20,}/g, /\bAIza[0-9A-Za-z_-]{30,}/g, /\bcia_mcp_[A-Za-z0-9_-]{16,}/g, /\bsb_secret_[A-Za-z0-9_-]{16,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g,
];

/** Coluna de planilha (cabeçalho já normalizado) que bloqueia o envio do anexo de texto. */
const COLUNA_PROIBIDA = /^(preco ?(de )?)?(custo|compra)|fornecedor|supplier|^ncm$|^cest$|^cfop$|^cst$|csosn|^icms|^ipi$|^pis$|^cofins|margem|markup|^cpf$|^cnpj$/;
const normColuna = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/["']/g, "").replace(/[_-]+/g, " ").trim();

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function limparTexto(s: string, rel: RelatorioGuarda, prof: number): string {
  if (s.length > TEXTO_VARREDURA_MAX || s.startsWith("data:")) return s; // binário/base64: não varre
  const t = s.trimStart();
  if ((t.startsWith("{") || t.startsWith("[")) && s.length <= TEXTO_JSON_MAX) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === "object") return JSON.stringify(limparValor(parsed, rel, prof + 1, true));
    } catch { /* não é JSON: segue como texto */ }
  }
  let out = s;
  for (const re of SEGREDOS) out = out.replace(re, () => { rel.segredosSubstituidos++; return "[segredo removido]"; });
  return out;
}

function limparValor(v: unknown, rel: RelatorioGuarda, prof: number, removerChaves: boolean): unknown {
  if (prof > PROFUNDIDADE_MAX) return "[removido: profundidade]";
  if (typeof v === "string") return limparTexto(v, rel, prof);
  if (Array.isArray(v)) return v.map((x) => limparValor(x, rel, prof + 1, removerChaves));
  if (!ehObjeto(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (removerChaves && chaveProibida(k)) { rel.chavesRemovidas[k] = (rel.chavesRemovidas[k] ?? 0) + 1; continue; }
    out[k] = CHAVES_DE_BINARIO.has(k.toLowerCase()) && typeof val === "string" ? val : limparValor(val, rel, prof + 1, removerChaves);
  }
  return out;
}

/** Anexo de texto: `[ARQUIVO ANEXADO "nome" — …]` + cabeçalho na primeira linha de dados. Devolve o nome da coluna proibida, se houver. */
export function colunaProibidaEm(texto: string): string | null {
  const i = texto.indexOf("[ARQUIVO ANEXADO");
  if (i < 0) return null;
  const linhas = texto.slice(i).split(/\r?\n/).slice(1).filter((l) => l.trim());
  const cab = linhas[0];
  if (!cab || cab.startsWith("[FIM DO ARQUIVO")) return null;
  for (const col of cab.split(/[;,\t|]/)) { const n = normColuna(col); if (n && COLUNA_PROIBIDA.test(n)) return col.trim().replace(/["']/g, "").slice(0, 40); }
  return null;
}

function vigiarAnexos(v: unknown, prof = 0): void {
  if (prof > PROFUNDIDADE_MAX) return;
  if (typeof v === "string") {
    if (v.length <= TEXTO_VARREDURA_MAX) {
      const col = colunaProibidaEm(v);
      if (col) throw new IaErro(422, `O arquivo anexado tem a coluna "${col}" (custo, fornecedor ou dado fiscal), que não pode ser enviada à IA. Remova a coluna e anexe de novo.`);
    }
    return;
  }
  if (Array.isArray(v)) { for (const x of v) vigiarAnexos(x, prof + 1); return; }
  if (ehObjeto(v)) for (const x of Object.values(v)) vigiarAnexos(x, prof + 1);
}

/** Devolve uma CÓPIA do corpo sem dados confidenciais; o original não é alterado. Lança IaErro(422) se um anexo de texto tiver coluna proibida. */
export function protegerCorpo<T>(corpo: T): { corpo: T; relatorio: RelatorioGuarda } {
  const rel: RelatorioGuarda = { chavesRemovidas: {}, segredosSubstituidos: 0 };
  if (!ehObjeto(corpo)) return { corpo: limparValor(corpo, rel, 0, true) as T, relatorio: rel };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(corpo)) {
    const contrato = PARTES_DE_CONTRATO.has(k.toLowerCase());
    if (!contrato) vigiarAnexos(v);
    out[k] = limparValor(v, rel, 0, !contrato);
  }
  return { corpo: out as T, relatorio: rel };
}

export const houveFiltragem = (r: RelatorioGuarda) => r.segredosSubstituidos > 0 || Object.keys(r.chavesRemovidas).length > 0;
