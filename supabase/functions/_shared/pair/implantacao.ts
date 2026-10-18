// Configuração pública do projeto autorizado. Não contém credenciais.
export const PROJETO_CONECTA = "https://dsfzhsrudriqkumtlqwj.supabase.co";
export const PAINEL_CONECTA = "https://nanoconecta-ia.github.io/conecta-ia/";
export function configuracaoPair(get: (n: string) => string | undefined) {
  const producao = get("SUPABASE_URL")?.replace(/\/$/, "") === PROJETO_CONECTA;
  const definido = get("PAIR_AMBIENTE");
  const ambiente = definido === "sintetico" || definido === "real" ? definido : !definido && producao ? "real" : "nao_validado";
  return { appUrl: get("APP_URL") || (producao ? PAINEL_CONECTA : undefined), ambiente } as const;
}
