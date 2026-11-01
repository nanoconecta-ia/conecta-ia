// Texto e agrupamento dos bloqueios do validador de fidelidade visual para a tela. Só apresentação: a decisão é do validador (fidelidadeVisual.ts).
import type { Bloqueio } from "./fidelidadeVisual.ts";

export type Grupo = "imagem" | "dados" | "provas" | "permissao";
const T: Record<string, [Grupo, string]> = {
  loja_diferente: ["permissao", "A imagem ou o produto é de outra loja."],
  sku_diferente: ["dados", "O banner é de outro SKU."],
  ativo_diferente: ["imagem", "A foto do banner não é o arquivo original informado."],
  sha_original_ausente: ["imagem", "O original da foto não está preservado (falta o SHA-256)."],
  sha_divergente: ["imagem", "A foto usada não é o original preservado."],
  escala_invalida: ["imagem", "Escala da foto inválida."],
  escala_nao_uniforme: ["imagem", "A foto da peça foi esticada: só é permitido redimensionar de forma proporcional."],
  espelhamento: ["imagem", "A foto da peça não pode ser espelhada."],
  inclinacao: ["imagem", "A foto da peça não pode ser inclinada."],
  rotacao_nao_permitida: ["imagem", "A foto da peça não pode ser girada."],
  perspectiva: ["imagem", "Correção de perspectiva da peça não é permitida."],
  mascara: ["imagem", "Máscara sobre a peça não é permitida."],
  edicao_generativa: ["imagem", "Edição ou reparo da peça com IA é proibido."],
  crop_proibido: ["imagem", "A foto da peça foi recortada: mostre a peça inteira e adapte o fundo."],
  geometria_invalida: ["imagem", "Tamanho ou posição da foto inválidos."],
  peca_fora_da_area_segura: ["imagem", "A peça não cabe inteira na área segura: reduza o tamanho."],
  camada_produto_invalida: ["imagem", "O banner precisa ter uma única camada de peça."],
  camada_produto_desbloqueada: ["imagem", "A camada da peça precisa estar protegida."],
  camada_produto_inconsistente: ["imagem", "A camada da peça não corresponde à foto com a escala declarada."],
  camada_invalida: ["imagem", "Uma camada tem tamanho inválido."],
  camada_sobre_a_peca: ["imagem", "Texto, logotipo ou selo está cobrindo a peça."],
  dado_inventado: ["dados", "O texto usa um dado que não existe no cadastro do produto."],
  dado_nao_confirmado: ["dados", "O texto usa um dado ainda não confirmado."],
  texto_diverge_do_dado: ["dados", "O texto não é o valor confirmado do cadastro."],
  preco_sem_origem: ["dados", "Há um preço no banner sem origem confirmada."],
  garantia_sem_origem: ["dados", "Há garantia no banner sem origem confirmada."],
  tecnico_sem_origem: ["dados", "Há dado técnico (dentes, medida) sem origem confirmada."],
  sintetica_como_real: ["provas", "Imagem gerada ou ilustrativa não pode ser apresentada como foto real."],
  identidade_sem_evidencia: ["provas", "Falta o código do fabricante ou OEM com evidência."],
  identidade_nao_aprovada: ["provas", "A identidade da peça ainda não foi aprovada por uma pessoa."],
  direitos_nao_confirmados: ["provas", "Os direitos de uso da imagem não estão confirmados."],
  checagem_humana_pendente: ["provas", "Faltam as três checagens humanas."],
  agente_nao_autoriza: ["permissao", "Autorizar, exportar e publicar são de uma pessoa, não do agente."],
  agente_nao_define_status: ["permissao", "O agente não pode marcar como aprovado ou publicado."],
  destino_ausente: ["permissao", "Escolha o destino."],
  url_destino_invalida: ["permissao", "A URL de destino não pode ser de Drive ou de terceiros."],
  sem_aprovacao: ["provas", "Não há versão aprovada."],
  aprovacao_invalidada: ["provas", "O banner mudou depois da aprovação: aprove de novo."],
  status_invalido: ["permissao", "O documento ainda não está aprovado para o destino."],
};
export const rotuloBloqueio = (codigo: string) => T[codigo]?.[1] ?? codigo;
export function agruparBloqueios(bloqueios: readonly Bloqueio[]): Record<Grupo, Bloqueio[]> {
  const g: Record<Grupo, Bloqueio[]> = { imagem: [], dados: [], provas: [], permissao: [] };
  for (const b of bloqueios) g[T[b.codigo]?.[0] ?? "provas"].push(b);
  return g;
}
