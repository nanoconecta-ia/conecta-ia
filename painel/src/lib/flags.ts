// Recursos cujo backend (migração + Edge Functions) ainda NÃO está implantado ficam ESCONDIDOS por padrão.
// Ligar só no build de um ambiente que já tenha a migração e as funções: VITE_PAIR_ATIVO=1 npm run build.
// (`import.meta.env` não existe nos testes em Node, por isso o `?.`.)
export const PAIR_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PAIR_ATIVO === "1";
