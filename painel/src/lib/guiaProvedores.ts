/**
 * Guia de onde criar e onde colar a chave de cada empresa (tela Integrações de IA).
 * Só dados públicos e estáveis: endereço da página de chaves e da documentação oficial, formato da chave e passos curtos.
 * Nada aqui é segredo. Endereços conferidos na documentação pública de cada empresa em 2026-11-16; se um mudar, a empresa
 * costuma redirecionar, e o lojista sempre pode usar o link da documentação.
 * `logo` fica vazio de propósito: só entra arquivo oficial fornecido pelo dono (kit de marca da empresa), nunca desenho nosso.
 */
export type GuiaProvedor = {
  id: string;
  empresa: string;
  /** Página onde a pessoa cria a chave. */
  onde: string;
  /** Página da documentação oficial (opcional). */
  doc?: string;
  /** Como a chave começa, para a pessoa conferir antes de colar. */
  formato: string;
  passos: string[];
  observacao?: string;
  /** Caminho de um arquivo oficial em public/ (ex.: marcas-empresas/anthropic.svg). Vazio = mostra só o nome. */
  logo?: string;
};

export const GUIAS: Record<string, GuiaProvedor> = {
  claude: {
    id: "claude", empresa: "Anthropic · Claude", onde: "https://platform.claude.com/settings/keys", doc: "https://platform.claude.com/docs/en/get-api-key",
    formato: "começa com sk-ant-",
    passos: ["Entre no Claude Console com a sua conta.", "Abra Settings e depois API keys.", "Toque em Create key e dê um nome à chave.", "Copie a chave na hora: ela só aparece uma vez. Cole no campo abaixo."],
    observacao: "O Console é separado do chat do claude.ai e tem cobrança própria por uso.",
  },
  gemini: {
    id: "gemini", empresa: "Google · Gemini", onde: "https://aistudio.google.com/api-keys",
    formato: "começa com AIza",
    passos: ["Entre no Google AI Studio com a sua conta Google.", "Abra a página API keys.", "Toque em Create API key e escolha ou crie um projeto.", "Copie a chave e cole no campo abaixo."],
  },
  openai: {
    id: "openai", empresa: "OpenAI · GPT", onde: "https://platform.openai.com/api-keys", doc: "https://platform.openai.com/docs/api-reference/introduction",
    formato: "começa com sk-",
    passos: ["Entre na plataforma de API da OpenAI (não é a conta do ChatGPT).", "Abra API keys e confira a organização e o projeto.", "Toque em Create new secret key e dê um nome.", "Copie na hora: a chave completa só aparece uma vez. Cole no campo abaixo."],
    observacao: "A API tem cobrança própria, separada do plano do ChatGPT.",
  },
  compativel_openai: {
    id: "compativel_openai", empresa: "Groq (reserva compatível com OpenAI)", onde: "https://console.groq.com/keys", doc: "https://console.groq.com/docs/quickstart",
    formato: "começa com gsk_",
    passos: ["Entre no console da Groq.", "Abra API Keys e toque em Create API Key.", "Copie a chave na hora: ela só aparece uma vez.", "Cole abaixo, com o endereço https://api.groq.com/openai/v1 e o nome do modelo."],
    observacao: "Para outro provedor compatível, use o endereço e a chave que ele informar na documentação dele.",
  },
  openrouter_free: {
    id: "openrouter_free", empresa: "OpenRouter · modelos gratuitos", onde: "https://openrouter.ai/keys", doc: "https://openrouter.ai/docs",
    formato: "começa com sk-or-v1-",
    passos: ["Entre no OpenRouter com a sua conta.", "Abra a página Keys.", "Toque em Create Key e dê um nome.", "Copie na hora e cole no campo abaixo."],
  },
  firecrawl: {
    id: "firecrawl", empresa: "Firecrawl · busca na web", onde: "https://www.firecrawl.dev/app/api-keys", doc: "https://docs.firecrawl.dev/api-reference/v2-introduction",
    formato: "começa com fc-",
    passos: ["Entre no painel do Firecrawl.", "Abra a página API Keys.", "Copie uma chave existente ou toque em Create API Key.", "Cole no campo abaixo e defina o limite de buscas por mês."],
  },
};
