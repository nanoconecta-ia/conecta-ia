/**
 * "Conectar meu Agente": regras puras do assistente de conexão MCP.
 * Não gera credencial (isso é o `conector-chaves`), não instala nada na conta do cliente
 * e não declara compatibilidade que não foi verificada.
 */
export type ClienteMcp = "chatgpt" | "claude" | "outro";
export type PermissaoInicial = "consulta" | "consulta_proposta";

export const CLIENTES: { id: ClienteMcp; nome: string; nota: string }[] = [
  { id: "chatgpt", nome: "ChatGPT", nota: "A conexão MCP personalizada depende do plano/workspace do ChatGPT. O Conecta.IA oferece OAuth e chave Bearer; a conexão nativa na conta ChatGPT ainda é NÃO VERIFICADA." },
  { id: "claude", nome: "Claude", nota: "Conector MCP remoto depende do plano e do método de autenticação aceito. Compatibilidade com este gateway: NÃO VERIFICADA." },
  { id: "outro", nome: "Outro cliente MCP", nota: "Qualquer cliente MCP ou HTTP que consiga enviar o cabeçalho Authorization: Bearer. Não funciona de dentro do navegador (o gateway recusa pedidos com Origin)." },
];

export const PERMISSOES: { id: PermissaoInicial; titulo: string; descricao: string; escopos: string[] }[] = [
  { id: "consulta", titulo: "Somente consulta", descricao: "Consultar catálogo, taxonomia e status. Não altera nada.", escopos: ["leitura"] },
  { id: "consulta_proposta", titulo: "Consulta e propostas", descricao: "Além de consultar, prepara propostas “a confirmar”. Nunca aprova nem executa.", escopos: ["leitura", "propor"] },
];

export interface ResumoConexao { agente: string; acesso: string; escopos: string[]; expiracao: string; escritaBling: "bloqueada" }

export function resumoConexao(cliente: ClienteMcp, permissao: PermissaoInicial, dias: number): ResumoConexao {
  const c = CLIENTES.find((x) => x.id === cliente) ?? CLIENTES[2];
  const p = PERMISSOES.find((x) => x.id === permissao) ?? PERMISSOES[0];
  return { agente: c.nome, acesso: p.titulo, escopos: [...p.escopos], expiracao: `${dias} dias`, escritaBling: "bloqueada" };
}

/** Nome sugerido da chave (a pessoa pode editar). */
export const nomeSugerido = (cliente: ClienteMcp): string => `Agente ${CLIENTES.find((x) => x.id === cliente)?.nome ?? "externo"}`;

/** Passos mostrados após gerar a chave. Nunca inclui o token. */
export function passosDeConexao(cliente: ClienteMcp, enderecoMcp: string): string[] {
  const comuns = [
    `Endereço do servidor: ${enderecoMcp}`,
    "Esta tela gera chave Bearer para clientes HTTP/MCP que a aceitam; OAuth é um fluxo separado com autorização no Conecta.IA, sem colar a chave em mensagens.",
  ];
  if (cliente === "chatgpt") return ["Use o ChatGPT no navegador e verifique se seu workspace permite MCP personalizado.", "Plugins → + → Adicionar servidor MCP personalizado (quando disponível).", "Nome: Conecta.IA — Nano.", ...comuns, "Prefira OAuth: o gateway já anuncia autorização, PKCE e renovação de token, mas a compatibilidade com esta conta ChatGPT NÃO FOI HOMOLOGADA.", "Para consulta/propostas, o recurso conector-mcp requer mcp:leitura e, se autorizado, mcp:propor. Para ler e responder ao chat Nano, o recurso conecta-gateway exige chat:responder. São consentimentos distintos.", "Não copie a chave Bearer gerada aqui para a conversa; só informe no campo secreto do cliente, caso ele realmente suporte esse modo.", "Teste somente consulta antes de liberar propostas. Nenhuma escrita no Bling é autorizada."];
  if (cliente === "claude") return ["Abra as configurações de conectores do Claude (se o seu plano oferecer conector remoto).", "Adicione um conector MCP personalizado.", ...comuns, "Teste lendo a ficha do CI000016. Nada será gravado no Bling."];
  return ["No cliente MCP, configure um servidor HTTP/JSON-RPC.", ...comuns, "Envie o cabeçalho Authorization: Bearer <chave> (a chave vai no cliente, não aqui)."];
}
