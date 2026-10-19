// Tela "Conectar meu agente": caminhos, pré-ajustes de custo e regras. Texto puro, sem segredo; o modelo continua sendo gravado em Integrações de IA.
export type Caminho = "conector" | "integrado";
export interface PreAjuste { id: "qualidade" | "economico"; rotulo: string; descricao: string; modelo: string }

// Sugestões (não obrigatórias): o lojista cola o nome do modelo em Integrações de IA. Nomes conferidos nos IDs vigentes da Anthropic e do Google AI Studio.
export const PRE_AJUSTES: PreAjuste[] = [
  { id: "qualidade", rotulo: "Qualidade", descricao: "Melhor resposta para enriquecer e conferir peças. Custa mais por uso.", modelo: "claude-sonnet-5-5" },
  { id: "economico", rotulo: "Econômico", descricao: "Custo baixo para consultas e rascunhos em volume. Revise mais de perto.", modelo: "claude-haiku-5-5" },
];

export const REGRAS_DO_AGENTE: string[] = [
  "Só lê o Bling; não grava nem altera produto no ERP.",
  "Nunca apaga nota fiscal nem o cadastro sincronizado do Bling.",
  "Tudo que sugere (código, aplicação, imagem, bula) vem com fonte e vai para a sua aprovação.",
  "Nada vai para o site sem você aprovar e marcar como visível.",
  "Você pode parar o cadastro automático por produto ou por lote no Catálogo.",
];

/** Passos para ligar um chat premium próprio. O QR/código nasce no dispositivo/chat e só vale depois que o lojista aprova. */
export const PASSOS_CONECTOR: string[] = [
  "No seu chat (conta própria), adicione um conector personalizado apontando para o endereço do gateway abaixo.",
  "O chat abre o pedido de acesso e mostra um QR ou código de verificação.",
  "Aqui no celular, abra o QR, confira o código e escolha o que o agente pode fazer e por quanto tempo.",
  "Pronto: pergunte no chat por SKU, EAN ou código da montadora. Você pode encerrar o acesso em Dispositivos a qualquer hora.",
];

export function enderecoValido(url: string): boolean { return /^https:\/\/[a-z0-9.-]+\/functions\/v1\/conecta-gateway$/.test(url); }
