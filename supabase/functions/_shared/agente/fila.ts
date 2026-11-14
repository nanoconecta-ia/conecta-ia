// Planejador da fila de enriquecimento. Função PURA: não lê nem grava nada.
// Decide, a partir do espelho do Bling, quais produtos entram na fila, quais não têm receita e quais não têm tipo.
// Nunca inventa dado: só olha o que já está no cadastro e o que as receitas exigem.
import { classificarSlug } from "./extrair.ts";

export interface ProdutoMin {
  id: string; nome: string | null; sku?: string | null; preco?: number | null; categoria?: string | null;
  marca?: string | null; gtin?: string | null; descricao?: string | null;
}
export interface ReceitaMin { codigo: string; campos_exigidos: string[] }

export interface PlanoFila {
  enfileirar: Array<{ produto_id: string; nome: string; tipo: string; receita: string }>;
  jaNaFila: number;
  semReceita: Array<{ produto_id: string; nome: string; tipo: string }>;
  semTipo: Array<{ produto_id: string; nome: string }>;
}

// abertas = conjunto de "produto_id|tipo" com tarefa na_fila ou reivindicada (evita duplicar).
export function planejarFila(
  produtos: ProdutoMin[], receitasPorSlug: Map<string, ReceitaMin>, abertas: Set<string>,
): PlanoFila {
  const plano: PlanoFila = { enfileirar: [], jaNaFila: 0, semReceita: [], semTipo: [] };
  for (const p of produtos) {
    const nome = p.nome ?? "";
    const tipo = classificarSlug(nome);
    if (!tipo) { plano.semTipo.push({ produto_id: p.id, nome }); continue; }
    const receita = receitasPorSlug.get(tipo);
    if (!receita) { plano.semReceita.push({ produto_id: p.id, nome, tipo }); continue; }
    if (abertas.has(`${p.id}|${tipo}`)) { plano.jaNaFila++; continue; }
    plano.enfileirar.push({ produto_id: p.id, nome, tipo, receita: receita.codigo });
  }
  return plano;
}

export type FalhaCadastro =
  | "sem_gtin" | "sem_descricao" | "sem_categoria" | "sem_marca" | "preco_zerado" | "nome_provisorio";

// Relatório de qualidade do cadastro vindo do Bling. SÓ LÊ e aponta; corrigir no Bling exige aprovação por campo.
export function diagnosticoCadastro(p: ProdutoMin): FalhaCadastro[] {
  const f: FalhaCadastro[] = [];
  if (!p.gtin?.trim()) f.push("sem_gtin");
  if (!p.descricao?.trim()) f.push("sem_descricao");
  if (!p.categoria?.trim()) f.push("sem_categoria");
  if (!p.marca?.trim()) f.push("sem_marca");
  if (p.preco == null || p.preco <= 0) f.push("preco_zerado");
  // "- confirmar medida/código..." indica cadastro provisório digitado como lembrete
  if (/\bCONFIRMAR\b/i.test((p.nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, ""))) f.push("nome_provisorio");
  return f;
}
