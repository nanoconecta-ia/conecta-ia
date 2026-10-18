// Conecta Pair no navegador: chamadas à função `pair`, geração de segredos e rótulos. Nada aqui é segredo do servidor.
import { SUPABASE_URL } from "../config.ts";

export const URL_PAIR = `${SUPABASE_URL}/functions/v1/pair`;
export const URL_GATEWAY = `${SUPABASE_URL}/functions/v1/conecta-gateway`;

// Mesma lista de supabase/functions/_shared/pair/escopos.ts e de private.pair_escopos_validos() (pair.test.ts confere).
export const ESCOPOS = [
  "produtos:ler", "enriquecimento:propor", "banners:propor", "categorias:propor", "paginas:propor",
  "catalogo:propor", "campanhas:propor", "aprovacoes:ler", "tarefas:ler",
] as const;
export const ROTULOS_ESCOPO: Record<string, string> = {
  "produtos:ler": "Ver produtos da loja (nome, SKU, preço, estoque)",
  "enriquecimento:propor": "Sugerir dados técnicos (vão para a Fila de aprovação)",
  "banners:propor": "Sugerir banners (nada é publicado sem sua aprovação)",
  "categorias:propor": "Sugerir novas categorias",
  "paginas:propor": "Sugerir alterações de páginas",
  "catalogo:propor": "Sugerir a publicação do catálogo",
  "campanhas:propor": "Sugerir campanhas e orçamentos",
  "aprovacoes:ler": "Ver quais aprovações estão pendentes",
  "tarefas:ler": "Ver o andamento das tarefas que ele pediu",
};
export const TIPOS_DISPOSITIVO: [string, string][] = [
  ["navegador", "Navegador"], ["computador", "Computador"], ["smartphone", "Smartphone"], ["agente_externo", "Agente externo (IA / MCP)"], ["agente_desktop", "Agente desktop"],
];
export const ROTULOS_TIPO_APROVACAO: Record<string, string> = {
  produto_atualizacao: "Atualização de produto", categoria_criacao: "Criação de categoria", banner_publicacao: "Publicação de banner",
  pagina_alteracao: "Alteração de página", catalogo_publicacao: "Publicação de catálogo", operacao_lote: "Operação em lote",
  campanha_alteracao: "Alteração de campanha", orcamento_alteracao: "Alteração de orçamento",
};
export const MOTIVOS: Record<string, string> = {
  desafio_invalido: "Este QR não existe.", desafio_ja_usado: "Este QR já foi usado ou recusado. Gere outro no dispositivo.", expirado: "Este QR expirou (vale 2 minutos). Gere outro no dispositivo.",
  verificacao_incorreta: "O código não confere. Digite o código que aparece na TELA do dispositivo.", escopo_alem_do_solicitado: "Permissão maior que a solicitada.",
  duracao_invalida: "Duração inválida.", capacidade_alem_da_solicitada: "Capacidade maior que a solicitada.",
  reconfirmacao_necessaria: "Por segurança, confirme sua senha novamente.", proposta_alterada: "A proposta mudou enquanto você olhava. Revise a nova versão.",
  estado_substituida: "Uma versão mais nova desta proposta substituiu esta.", estado_aprovada: "Já aprovada.", estado_recusada: "Já recusada.", estado_executada: "Já executada.",
};

const enc = new TextEncoder();
export function aleatorioB64u(bytes = 32): string {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256Hex(t: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(t))), (x) => x.toString(16).padStart(2, "0")).join("");
}

export interface RespostaPair { status: number; corpo: Record<string, unknown> }
/** POST na função pública `pair`. O token (quando houver) vai SÓ no cabeçalho Authorization. */
export async function chamarPair(corpo: Record<string, unknown>, token?: string): Promise<RespostaPair> {
  try {
    const r = await fetch(URL_PAIR, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) });
    return { status: r.status, corpo: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch { return { status: 0, corpo: { erro: "Sem conexão. Verifique a internet e tente de novo." } }; }
}

export const segundosAte = (iso: string, agora = Date.now()) => Math.max(0, Math.round((Date.parse(iso) - agora) / 1000));
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
