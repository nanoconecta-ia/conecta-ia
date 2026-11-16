/**
 * Seletor visual do Nano, sempre local (sem editar imagem ou estoque).
 * O servidor continua sendo a autoridade para aprovação e direitos de uso.
 */
export const MAX_FOTOS_SELECAO = 8;

export function alterarSelecao(
  atual: string[], imagemId: string, idsDisponiveis: string[], limite = MAX_FOTOS_SELECAO,
): { selecionadas: string[]; erro: string | null } {
  if (!idsDisponiveis.includes(imagemId)) {
    return { selecionadas: atual, erro: "Esta imagem não pertence à galeria atual." };
  }
  if (atual.includes(imagemId)) {
    return { selecionadas: atual.filter((id) => id !== imagemId), erro: null };
  }
  if (atual.length >= limite) {
    return { selecionadas: atual, erro: `O máximo é de ${limite} imagens selecionadas.` };
  }
  return { selecionadas: [...atual, imagemId], erro: null };
}

export function selecaoAtual(atual: string[], idsDisponiveis: string[]): string[] {
  const disponiveis = new Set(idsDisponiveis);
  return [...new Set(atual)].filter((id) => disponiveis.has(id)).slice(0, MAX_FOTOS_SELECAO);
}

export interface EscolhaPrincipal {
  id: string; tipo: "real" | "gerada_ia" | "ilustrativa";
  aprovada: boolean; direitos: boolean; publicavel: boolean;
}
export function avaliarPreviaPrincipal(
  imagem: EscolhaPrincipal | null,
): { ok: boolean; mensagem: string } {
  if (!imagem) return { ok: false, mensagem: "Escolha uma foto para a prévia principal." };
  if (imagem.tipo !== "real") return { ok: false, mensagem: "Imagem ilustrativa ou gerada por IA não deve ser a foto principal do produto." };
  if (!imagem.aprovada) return { ok: false, mensagem: "Imagem ainda não aprovada pelo responsável." };
  if (!imagem.direitos) return { ok: false, mensagem: "Direitos de uso não confirmados." };
  if (!imagem.publicavel) return { ok: false, mensagem: "Esta foto ainda não está apta para publicação." };
  return { ok: true, mensagem: "Elegível para solicitar a escolha como principal; esta prévia não altera o banco." };
}
