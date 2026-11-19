// Apresentação pública do Conecta.IA para clientes MCP, HTTP e chats sem ferramentas.
// Apenas metadados. Nunca incluir token de loja, service_role ou credenciais do Bling.
export const MCP_PUBLICO = "https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/conector-mcp";

export function arquivosDeDescoberta(enderecoDaPagina: string) {
  // Suporta GitHub Pages em /conecta-ia/ e páginas com rota por hash.
  const base = new URL("./", enderecoDaPagina);
  return {
    manifesto: new URL("agentes/capacidades.json", base).href,
    openapi: new URL("agentes/openapi.json", base).href,
    mcp: MCP_PUBLICO,
  };
}

export function textoParaApresentar(enderecoDaPagina: string) {
  const { manifesto, openapi, mcp } = arquivosDeDescoberta(enderecoDaPagina);
  return [
    "Conheça o Conecta.IA, aplicativo de catálogo e operações comerciais da Mobis Autopeças.",
    "Manifesto público de capacidades: " + manifesto,
    "Descrição OpenAPI (JSON-RPC via HTTP): " + openapi,
    "Servidor MCP remoto: " + mcp,
    "Para descobrir as ferramentas reais, use tools/list APÓS autenticação.",
    "Acesso exige autorização do proprietário e escopos por loja (consulta e, se permitido, proposta).",
    "Propostas não aprovam nem executam alterações: nunca modificar Bling, estoque, dados fiscais ou publicar automaticamente.",
    "A2A ainda não possui servidor compatível implantado; o manifesto acima NÃO é um Agent Card A2A.",
    "Se este chat não oferece MCP, HTTP, API nem navegador, reconheça o aplicativo apenas como contexto e NÃO alegue acesso ou operações realizadas.",
    "Nunca solicite chaves, tokens ou senhas no texto da conversa."
  ].join("\n");
}
