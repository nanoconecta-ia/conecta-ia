import { urlPainel } from "../painel_url.ts";

// Configuração pública do projeto autorizado. Não contém credenciais.
export const PROJETO_CONECTA = "https://dsfzhsrudriqkumtlqwj.supabase.co";
export const PAINEL_CONECTA = "https://www.mobisautopecas.com.br/conecta.html";
export function configuracaoPair(get: (n: string) => string | undefined) {
  const producao = get("SUPABASE_URL")?.replace(/\/$/, "") === PROJETO_CONECTA;
  const definido = get("PAIR_AMBIENTE");
  const ambiente = definido === "sintetico" || definido === "real" ? definido : !definido && producao ? "real" : "nao_validado";
  const app = get("APP_URL");
  const configurado = app ? urlPainel(app) : undefined;
  // Em producao, nunca deixar o QR atravessar o redirecionamento GitHub Pages -> dominio Mobis:
  // alguns navegadores removem o fragmento #/parear?c=..., perdendo o codigo de autorizacao.
  const redirecionado = producao && configurado && new URL(configurado).hostname === "nanoconecta-ia.github.io";
  return { appUrl: redirecionado ? PAINEL_CONECTA : (configurado ?? (producao ? PAINEL_CONECTA : undefined)), ambiente } as const;
}
