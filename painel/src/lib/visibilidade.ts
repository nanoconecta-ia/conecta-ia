// Tela do Catálogo: botão Mostrar/Ocultar produto no site. Quem decide o que falta é o banco (publicar_produto); aqui só traduzimos a resposta.
const ROTULOS: Record<string, string> = {
  nome: "nome", sku: "SKU", preco: "preço", categoria: "categoria aprovada", imagem_principal: "imagem principal aprovada",
  marca_peca: "marca da peça aprovada", codigo_fabricante: "código do fabricante aprovado", bula_tecnica: "bula técnica aprovada",
};
export interface RespostaVisibilidade { ok?: boolean; faltando?: string[] }

/** Texto para o lojista depois de pedir para mostrar ou ocultar. */
export function mensagemVisibilidade(r: RespostaVisibilidade | null | undefined, publicar: boolean): { ok: boolean; texto: string } {
  if (!r) return { ok: false, texto: "Não foi possível atualizar o produto." };
  if (r.ok) return { ok: true, texto: publicar ? "Produto visível no site." : "Produto oculto do site." };
  const f = (r.faltando ?? []).map((c) => ROTULOS[c] ?? c);
  return { ok: false, texto: f.length ? `Produto incompleto, não pode aparecer no site. Falta: ${f.join(", ")}.` : "O produto não pode ser mostrado agora." };
}

/** Itens do menu: o que depende de backend ainda não publicado fica escondido por flag (ver flags.ts). */
export function montarMenu(itens: [string, string][], pair: [string, string][], opcoes: { pairAtivo: boolean; conectorAtivo: boolean }, dependemDoConector: string[]): [string, string][] {
  const base = opcoes.conectorAtivo ? itens : itens.filter(([c]) => !dependemDoConector.includes(c));
  return opcoes.pairAtivo ? [...base.slice(0, 1), ...pair, ...base.slice(1)] : base;
}

/** Rotas que exigem aceite específico (ver CENTRAL_ATIVA em flags.ts) saem do menu e da paleta enquanto a flag estiver desligada. */
export function semRotasSemAceite(itens: [string, string][], aceite: boolean, rotas: readonly string[]): [string, string][] {
  return aceite ? itens : itens.filter(([c]) => !rotas.includes(c));
}

/** A rota não abre (cai na visão geral): backend ainda não publicado ou tela que exige aceite específico. */
export function rotaBloqueada(caminho: string, opcoes: { conectorAtivo: boolean; centralAtiva: boolean }, dependemDoConector: readonly string[], daCentral: readonly string[]): boolean {
  const semConector = !opcoes.conectorAtivo && (dependemDoConector.includes(caminho) || /^\/indicadores\//.test(caminho) || caminho === "/agentes");
  return semConector || (!opcoes.centralAtiva && daCentral.includes(caminho));
}
