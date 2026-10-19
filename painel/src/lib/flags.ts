// Recursos cujo backend (migração + Edge Functions) ainda NÃO está implantado ficam ESCONDIDOS por padrão.
// Ligar só no build de um ambiente que já tenha a migração e as funções: VITE_PAIR_ATIVO=1 npm run build.
// (`import.meta.env` não existe nos testes em Node, por isso o `?.`.)
export const PAIR_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PAIR_ATIVO === "1";

// Telas do Conector IA (chat, Central, Studio, Indicadores, Gateway) usam tabelas agente_* e Edge Functions conector-* que ainda NÃO estão em produção.
// Ficam escondidas até o build de um ambiente que já os tenha: VITE_CONECTOR_ATIVO=1 npm run build.
export const CONECTOR_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CONECTOR_ATIVO === "1";
export const ROTAS_DO_CONECTOR = ["/conector", "/central", "/indicadores", "/studio", "/gateway"];
