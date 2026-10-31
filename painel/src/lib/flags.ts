// Recursos cujo backend (migração + Edge Functions) ainda NÃO está implantado ficam ESCONDIDOS por padrão.
// Ligar só no build de um ambiente que já tenha a migração e as funções: VITE_PAIR_ATIVO=1 npm run build.
// (`import.meta.env` não existe nos testes em Node, por isso o `?.`.)
export const PAIR_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PAIR_ATIVO === "1";

// Telas do Nano.ia (chat, Central, Studio, Indicadores, Gateway) usam tabelas agente_* e Edge Functions conector-* que ainda NÃO estão em produção.
// Ficam escondidas até o build de um ambiente que já os tenha: VITE_CONECTOR_ATIVO=1 npm run build.
export const CONECTOR_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CONECTOR_ATIVO === "1";
export const ROTAS_DO_CONECTOR = ["/conector", "/central", "/indicadores", "/studio", "/gateway"];

// Backup do cadastro do Bling (tabelas bling_snapshot_* e função bling-backup) ainda NÃO estão em produção.
// Fica escondido até o build de um ambiente que já os tenha: VITE_BACKUP_ATIVO=1 npm run build.
export const BACKUP_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BACKUP_ATIVO === "1";

// Banners de oferta (tabela loja_banners e função banners_da_vitrine) ainda NÃO estão em produção.
// Fica escondido até o build de um ambiente que já os tenha: VITE_BANNERS_ATIVO=1 npm run build.
export const BANNERS_ATIVO: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BANNERS_ATIVO === "1";

// Central de Inteligência (/central, alias /agentes): além de propor e simular, tem a ação `executar`, que grava de verdade
// via conector-aprovacoes. Decisão do proprietário (issue #166, 31/10/2026): fica OCULTA até aceite específico, mesmo com
// VITE_CONECTOR_ATIVO=1. Ligar só com autorização explícita: VITE_CENTRAL_ATIVA=1 npm run build.
export const CENTRAL_ATIVA: boolean = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CENTRAL_ATIVA === "1";
export const ROTAS_DA_CENTRAL = ["/central", "/agentes"];
