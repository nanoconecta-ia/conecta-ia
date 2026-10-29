// Mapeamento Conecta.IA -> campos de produto do Bling (somente o que o Nano.ia pode ALTERAR) e conferência pós-escrita.
// Nada fiscal, de preço, custo, fornecedor, estoque ou SKU entra aqui. `conferido: false` = ainda não confirmado na
// documentação oficial do Bling (developer.bling.com.br); a escrita real continua desligada até essa conferência.
import { CAMPOS_BLING_PROIBIDOS } from "./registro.ts";

export interface MapaCampo {
  conecta: string;                 // nome do campo no Conecta.IA (espelho/enriquecimento)
  caminho: readonly string[];      // caminho no corpo do Bling
  tipo: "texto" | "numero_positivo" | "gtin" | "id_numerico" | "reativar";
  conferido: boolean;
  observacao?: string;
}

export const MAPA_CAMPOS: readonly MapaCampo[] = [
  { conecta: "nome", caminho: ["nome"], tipo: "texto", conferido: false },
  { conecta: "marca", caminho: ["marca"], tipo: "texto", conferido: false },
  { conecta: "gtin", caminho: ["gtin"], tipo: "gtin", conferido: false, observacao: "8, 12, 13 ou 14 dígitos" },
  { conecta: "descricao_curta", caminho: ["descricaoCurta"], tipo: "texto", conferido: false },
  { conecta: "descricao_complementar", caminho: ["descricaoComplementar"], tipo: "texto", conferido: false },
  { conecta: "peso_kg", caminho: ["pesoBruto"], tipo: "numero_positivo", conferido: false, observacao: "o espelho lê pesoBruto antes de pesoLiquido; confirmar com o lojista qual gravar" },
  { conecta: "largura_cm", caminho: ["dimensoes", "largura"], tipo: "numero_positivo", conferido: false },
  { conecta: "altura_cm", caminho: ["dimensoes", "altura"], tipo: "numero_positivo", conferido: false },
  { conecta: "profundidade_cm", caminho: ["dimensoes", "profundidade"], tipo: "numero_positivo", conferido: false },
  { conecta: "categoria_bling_id", caminho: ["categoria", "id"], tipo: "id_numerico", conferido: false, observacao: "categoria precisa existir no Bling (bling_categorias)" },
  // Só REATIVAR: o único valor aceito é "A". Inativar/excluir pelo agente continua impossível. O esquema do PATCH lista situacao A|I;
  // se o Bling aceita reativar um produto EXCLUÍDO (E) por esse PATCH ainda não foi confirmado: a leitura de confirmação decide.
  { conecta: "situacao", caminho: ["situacao"], tipo: "reativar", conferido: false, observacao: "só 'A'; reativar produto excluído a confirmar no Bling real" },
];

/**
 * Campos que cada operação de ESCRITA no Bling pode enviar AGORA. Lista fechada: a liberação de um campo é decisão do dono, por escrito.
 * Decisão do dono (2026-10-29, escolha registrada no chat): categoria, REATIVAR (situação "A") e os dados de cadastro do produto
 * (nome, marca, GTIN, descrições, peso e medidas). Preço, custo, estoque, fornecedor, SKU e fiscal NUNCA. Operação ausente = nenhum campo liberado.
 * Isto NÃO liga a escrita: a ferramenta segue `ativa:false` e a porta real só lê.
 */
export const CAMPOS_ESCRITA_LIBERADOS: Readonly<Record<string, readonly string[]>> = {
  "bling.produtos.alterar": ["categoria_bling_id", "situacao", "nome", "marca", "gtin", "descricao_curta", "descricao_complementar", "peso_kg", "largura_cm", "altura_cm", "profundidade_cm"],
};

/** Campos pedidos (`depois` e `campos` declarados) que a operação NÃO tem liberados. Vazio = pode seguir. */
export function camposNaoLiberados(
  operacao: string, depois: Record<string, unknown> | null | undefined, campos: readonly string[] = [],
  liberados: Readonly<Record<string, readonly string[]>> = CAMPOS_ESCRITA_LIBERADOS,
): string[] {
  const ok = new Set(liberados[operacao] ?? []);
  const pedidos = new Set([...Object.keys(depois ?? {}), ...campos]);
  return [...pedidos].filter((c) => !ok.has(c)).sort();
}

const POR_CONECTA = new Map(MAPA_CAMPOS.map((m) => [m.conecta, m]));
const PROIBIDOS = new Set<string>(CAMPOS_BLING_PROIBIDOS);

/** Procura chave proibida em qualquer nível (defesa em profundidade: o corpo montado e o recebido pelo mock passam por aqui). */
export function chaveProibida(o: unknown, caminho = ""): string | null {
  if (!o || typeof o !== "object") return null;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (PROIBIDOS.has(k)) return caminho + k;
    const r = chaveProibida(v, `${caminho}${k}.`);
    if (r) return r;
  }
  return null;
}

function valida(m: MapaCampo, v: unknown): string | null {
  switch (m.tipo) {
    case "texto": return typeof v === "string" && v.trim() !== "" ? null : "texto vazio ou inválido";
    case "numero_positivo": return typeof v === "number" && Number.isFinite(v) && v > 0 ? null : "número deve ser maior que zero";
    case "gtin": return typeof v === "string" && /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(v) ? null : "GTIN deve ter 8, 12, 13 ou 14 dígitos";
    case "id_numerico": return typeof v === "string" && /^\d{1,20}$/.test(v) ? null : "id de categoria deve ser numérico";
    case "reativar": return v === "A" ? null : "situação só pode ir para \"A\" (reativar); inativar ou excluir não é permitido ao agente";
  }
}

export interface CorpoMontado { corpo: Record<string, unknown>; erros: string[] }

/** Converte `depois` (nomes do Conecta.IA) no corpo do Bling. Campo sem relação no Bling NÃO é enviado: fica só no Conecta.IA. */
export function montarCorpoProduto(depois: Record<string, unknown>): CorpoMontado {
  const corpo: Record<string, unknown> = {};
  const erros: string[] = [];
  for (const [k, v] of Object.entries(depois)) {
    if (PROIBIDOS.has(k)) { erros.push(`${k}: campo proibido (fiscal, preço, custo, fornecedor, estoque ou SKU nunca são alterados)`); continue; }
    const m = POR_CONECTA.get(k);
    if (!m) { erros.push(`${k}: sem campo equivalente no Bling; permanece só no Conecta.IA`); continue; }
    const e = valida(m, v);
    if (e) { erros.push(`${k}: ${e}`); continue; }
    let alvo: Record<string, unknown> = corpo;
    m.caminho.slice(0, -1).forEach((p) => { alvo = (alvo[p] ??= {}) as Record<string, unknown>; });
    alvo[m.caminho[m.caminho.length - 1]] = m.tipo === "id_numerico" ? Number(v) : v;
  }
  if (Object.keys(corpo).length === 0 && erros.length === 0) erros.push("nada para enviar");
  const proibida = chaveProibida(corpo);
  if (proibida) erros.push(`${proibida}: campo proibido no corpo`);
  return { corpo, erros };
}

const folhas = (o: unknown, caminho: string[] = []): { caminho: string[]; valor: unknown }[] =>
  o && typeof o === "object" && !Array.isArray(o)
    ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => folhas(v, [...caminho, k]))
    : [{ caminho, valor: o }];

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? v : v);

/** Compara o que foi enviado com o que o Bling devolveu na leitura de confirmação. Lista as divergências (vazio = confirmado). */
export function divergencias(enviado: unknown, lido: unknown): string[] {
  const out: string[] = [];
  for (const f of folhas(enviado)) {
    let atual: unknown = lido;
    for (const p of f.caminho) atual = atual && typeof atual === "object" ? (atual as Record<string, unknown>)[p] : undefined;
    // id numérico vs texto (o Bling devolve número)
    if (String(norm(atual)) !== String(norm(f.valor))) out.push(`${f.caminho.join(".")}: enviado ${JSON.stringify(f.valor)}, Bling devolveu ${JSON.stringify(atual ?? null)}`);
  }
  return out;
}

const vazio = (v: unknown) => v === null || v === undefined || v === "" || v === 0;

/** Os valores ANTERIORES (nomes do Conecta.IA) ainda estão no Bling? Vazio = vazio. Prova positiva de "não gravou" na reconciliação. */
export function antesIntacto(antes: Record<string, unknown>, lidoNoBling: unknown): boolean {
  const chaves = Object.keys(antes ?? {});
  if (chaves.length === 0) return false;
  return chaves.every((k) => {
    const m = POR_CONECTA.get(k);
    if (!m) return false;
    const atual = m.caminho.reduce((a: any, p) => (a && typeof a === "object" ? a[p] : undefined), lidoNoBling as any);
    const esperado = antes[k];
    return vazio(atual) && vazio(esperado) ? true : String(norm(atual)) === String(norm(esperado));
  });
}
