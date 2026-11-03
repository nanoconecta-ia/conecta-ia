/**
 * Contrato puro do Contexto Vivo. Sem efeitos colaterais, rede ou acesso ao ERP.
 * O backend deve preencher e validar a identidade da sessão autenticada.
 */
export type OrigemContexto = "bling-ui" | "conecta-ui" | "nano";
export type AcaoContexto =
  | "produto.selecionado"
  | "produto.aberto"
  | "produto.fechado"
  | "produto.edicao_iniciada"
  | "produto.salvo"
  | "selecao.limpa";

export interface EventoContexto {
  eventoId: string;
  sessaoId: string;
  lojaId: string;
  usuarioId: string;
  origem: OrigemContexto;
  acao: AcaoContexto;
  produtoAtivoId: string | null;
  produtosSelecionados: string[];
  campo?: string;
  versao: number;
  ocorridoEm: string;
}

export interface ContextoAtual {
  sessaoId: string;
  lojaId: string;
  usuarioId: string;
  produtoAtivoId: string | null;
  produtosSelecionados: string[];
  versao: number;
  atualizadoEm: string;
}

/**
 * Redutor de estado local para pré-visualização/testes.
 * NÃO substitui autenticação, autorização, deduplicação persistida,
 * validação de pertencimento dos produtos ou CAS no backend.
 */
export function aplicarEventoLocal(
  atual: ContextoAtual,
  evento: EventoContexto,
): ContextoAtual {
  if (
    evento.sessaoId !== atual.sessaoId ||
    evento.lojaId !== atual.lojaId ||
    evento.usuarioId !== atual.usuarioId
  ) {
    throw new Error("contexto_sessao_invalida");
  }
  if (!Number.isSafeInteger(evento.versao) || evento.versao !== atual.versao + 1) {
    throw new Error("contexto_versao_invalida");
  }
  if (evento.produtosSelecionados.length > 100) {
    throw new Error("contexto_selecao_excessiva");
  }
  if (new Set(evento.produtosSelecionados).size !== evento.produtosSelecionados.length) {
    throw new Error("contexto_selecao_duplicada");
  }
  if (evento.acao === "produto.aberto" && !evento.produtoAtivoId) {
    throw new Error("contexto_produto_ativo_ausente");
  }
  return {
    ...atual,
    produtoAtivoId: evento.acao === "selecao.limpa" ? null : evento.produtoAtivoId,
    produtosSelecionados: evento.acao === "selecao.limpa"
      ? []
      : [...evento.produtosSelecionados],
    versao: evento.versao,
    atualizadoEm: evento.ocorridoEm,
  };
}
