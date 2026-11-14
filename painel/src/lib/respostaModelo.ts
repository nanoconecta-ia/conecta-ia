/** Pergunta sobre o modelo/motor do chat? ("qual seu modelo", "que IA é você", "qual agente você usa"). Perguntas sobre outro assunto não casam. */
export function perguntaSobreModelo(texto: string): boolean {
  const t = texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t.length > 80 || t.startsWith("/")) return false;
  return /\b(qual|que|quais)\b.{0,12}\b(seu|sua|teu)\b.{0,12}\b(modelo|motor|ia|agente|llm)\b/.test(t)
    || /\b(qual|que|quais)\b.{0,12}\b(modelo|motor|ia|agente|llm)\b.{0,12}\b(voce|vc)\b/.test(t)
    || /\b(voce|vc)\b.{0,20}\b(e|usa)\b.{0,15}\b(claude|gpt|gemini|chatgpt)\b/.test(t);
}

/** Texto honesto: só o modelo COMPROVADO pelo último retorno; nunca o que o próprio modelo diz de si. */
export function respostaSobreModelo(rotuloConfirmado: string | null): string {
  const base = rotuloConfirmado
    ? `A última resposta confirmada desta conversa veio de ${rotuloConfirmado}.`
    : "Ainda não há resposta confirmada nesta conversa, então não sei dizer qual modelo vai responder.";
  return `${base} Esse dado vem do retorno do servidor, não do que o modelo diz de si. Se um agente externo (Claude, GPT) estiver pareado, ele aparece na faixa do topo do painel, não neste chat.`;
}
