// Detecta a pergunta ESTRUTURADA sobre o contexto vivo ("quais produtos estão selecionados", "qual é o produto ativo/aberto") para responder direto do banco,
// sem provedor de IA. Conservador de propósito: só frases claras; qualquer outra vai para o fluxo normal. Não inventa nem extrai SKU.
const limpa = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[?!.,;:]+/g, " ").replace(/\s+/g, " ").trim();
const PADROES: RegExp[] = [
  /^(?:quais?|quantos?)(?: sao)?(?: os| as)? produtos?(?: que)?(?: estao| estou| foram| esta)? (?:selecionad[oa]s?|marcad[oa]s?|abert[oa]s?)(?: agora| no momento| no catalogo)?$/,
  /^(?:qual|que)(?: e| eh)?(?: o)? produto(?: que)?(?: esta| estou)? (?:ativo|aberto|selecionado|em foco)(?: agora| no momento)?$/,
  /^(?:o que|que produtos?) (?:eu )?(?:selecionei|abri|marquei)(?: agora| no momento)?$/,
  /^(?:mostre|mostra|liste|lista|ver|veja)(?: me| pra mim)?(?: os| as)? produtos? (?:selecionad[oa]s?|abert[oa]s?|ativos?)$/,
  /^(?:qual|quais)(?: e| sao)?(?: o| os| a| as)? (?:contexto|selecao)(?: atual| vivo| compartilhad[oa])?$/,
];
export function perguntaDeContexto(texto: string): boolean {
  if (typeof texto !== "string" || texto.length > 120 || /\n/.test(texto) || texto.trim().startsWith("/")) return false;
  const t = limpa(texto);
  return PADROES.some((p) => p.test(t));
}
