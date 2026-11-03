// Provedor gratuito (OpenRouter) no mesmo lugar do Gemini: três modos. O texto de consentimento é do dono da loja: ao escolher manual ou automático
// ele autoriza que o modelo gratuito veja dados do catálogo/Bling JÁ SANEADOS, só em leitura.
export type ModoFree = "desligado" | "manual" | "automatico";
export const MODOS_FREE: { id: ModoFree; titulo: string; descricao: string }[] = [
  { id: "desligado", titulo: "Desligado", descricao: "Não responde, nem aparece na lista de modelos. A chave fica guardada (cifrada) para religar depois." },
  { id: "manual", titulo: "Manual", descricao: "Aparece na lista de modelos do chat, ao lado do Gemini. Só responde quando você o escolher." },
  { id: "automatico", titulo: "Automático", descricao: "Se o modelo escolhido (ex.: Gemini) estiver sobrecarregado, sem limite ou sem resposta, o Nano troca sozinho para o gratuito na mesma pergunta e mostra qual modelo respondeu." },
];
export const AVISO_FREE = "Modelos gratuitos do OpenRouter podem registrar e usar as conversas para melhorar os modelos. Neste modo o gratuito vê só dados de catálogo e do Bling já saneados, apenas em LEITURA: nunca custo, fornecedor, dado fiscal, credenciais nem anexos, e ele não faz propostas nem grava nada.";
export const CONFIRMACAO_FREE = "Você autoriza o modelo gratuito (OpenRouter) a ver dados de catálogo e do Bling já saneados, só em leitura, sem custo, fornecedor, dado fiscal, credenciais ou anexos? Ele pode registrar essas conversas.";

/** Modo atual a partir da linha da chave: sem chave guardada não há modo. */
export function modoDaChave(k: { ativa: boolean; failover?: boolean | null; final_chave?: string | null } | undefined | null): ModoFree | null {
  if (!k || !k.final_chave) return null;
  return !k.ativa ? "desligado" : k.failover ? "automatico" : "manual";
}
/** Ligar (manual/automático) exige a autorização explícita do dono; desligar não. */
export const exigeConfirmacao = (de: ModoFree | null, para: ModoFree): boolean => para !== "desligado" && (de === null || de === "desligado");
