// Endereço do painel Conecta.IA a partir de APP_URL. Configuração pública, sem credenciais.
// APP_URL pode ser a raiz do site ("https://www.loja.com.br") ou já o arquivo do painel (".../conecta.html").
// Sem isso, links de retorno (QR de pareamento, volta do Bling, autorização de agente) caíam na vitrine.

export const ARQUIVO_PAINEL = "conecta.html";

/** Devolve `<origem>/<caminho>/conecta.html` (ou o .html já informado). Nunca com query nem fragmento. */
export function urlPainel(appUrl: string): string {
  const u = new URL(appUrl);
  if (u.username || u.password || u.search || u.hash) throw new Error("APP_URL não pode ter credenciais, query nem fragmento");
  const caminho = /\.html?$/i.test(u.pathname) ? u.pathname : `${u.pathname.replace(/\/+$/, "")}/${ARQUIVO_PAINEL}`;
  return `${u.origin}${caminho}`;
}
