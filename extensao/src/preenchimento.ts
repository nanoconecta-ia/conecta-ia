// Fase 3 (issue #166): plano de preenchimento na tela do ERP com valores JÁ APROVADOS na Fila do Conecta.IA. Puro: testável no Node.
// Regras: só tela reconhecida; só campo do mapa marcado como editável pelo Nano; nunca campo sensível/mascarado; nunca SKU,
// preço ou estoque; valor diferente do atual exige OK explícito ("substituir"); o salvar é SEMPRE do lojista.
import { chaveDe } from "./leitura.ts";
import type { Reconhecimento } from "./reconhecer.ts";

export interface ValorAprovado { id: string; campo: string; valor: string; fonte: string | null; aprovado_em: string | null }
export interface ItemPreenchimento {
  canonico: string; descricao: string; aprovadoId: string; fonte: string | null; aprovadoEm: string | null;
  atual: string; novo: string;
  acao: "preencher" | "substituir" | "igual" | "bloqueado";
  motivo?: string;
  alvo: { rotulo: string; id?: string; nome?: string };
}

/** Campo aprovado no Conecta.IA -> campo canônico do mapa da tela. ncm_sugerido (fiscal) nunca entra. */
export const APROVADO_PARA_CANONICO: Record<string, string> = {
  marca_peca: "marca", descricao_curta: "descricaoCurta", descricao_longa: "descricaoComplementar", peso_kg: "pesoLiquido", categoria_sugerida: "categoria", ean: "gtin",
};

export function planejarPreenchimento(r: Reconhecimento, aprovados: readonly ValorAprovado[]): ItemPreenchimento[] {
  if (r.estado !== "reconhecida") return [];
  const itens: ItemPreenchimento[] = [];
  for (const a of aprovados) {
    const canonico = APROVADO_PARA_CANONICO[a.campo];
    if (!canonico || itens.some((i) => i.canonico === canonico)) continue;
    const casado = r.casados.find((c) => c.mapa.canonico === canonico);
    const base = { canonico, aprovadoId: a.id, fonte: a.fonte, aprovadoEm: a.aprovado_em, novo: a.valor.trim() };
    if (!casado) { itens.push({ ...base, descricao: canonico, atual: "", acao: "bloqueado", motivo: "Campo não encontrado nesta tela.", alvo: { rotulo: "" } }); continue; }
    const alvo = { rotulo: casado.lido.rotulo, ...(casado.lido.id ? { id: casado.lido.id } : {}), ...(casado.lido.nome ? { nome: casado.lido.nome } : {}) };
    const comum = { ...base, descricao: casado.mapa.descricao, atual: casado.lido.valor.trim(), alvo };
    if (!casado.mapa.editavelPeloNano || casado.lido.mascarado) { itens.push({ ...comum, acao: "bloqueado", motivo: "O Nano não preenche este campo." }); continue; }
    if (!base.novo) { itens.push({ ...comum, acao: "bloqueado", motivo: "Valor aprovado vazio." }); continue; }
    if (casado.lido.tipo === "editavel" || casado.lido.tipo === "checkbox" || casado.lido.tipo === "radio") { itens.push({ ...comum, acao: "bloqueado", motivo: "Tipo de campo não suportado: preencha à mão." }); continue; }
    const igual = chaveDe(comum.atual) === chaveDe(base.novo) && comum.atual.replace(",", ".") === base.novo.replace(",", ".") || comum.atual === base.novo;
    itens.push({ ...comum, acao: igual ? "igual" : comum.atual ? "substituir" : "preencher" });
  }
  return itens;
}

/** Conferência depois de preencher: o valor que ficou na tela é o aprovado (ignora espaços nas pontas). */
export const conferido = (lido: string, esperado: string) => lido.trim() === esperado.trim();
