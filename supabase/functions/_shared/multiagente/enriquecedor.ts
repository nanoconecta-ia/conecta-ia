// Capacidade 5 — Enriquecedor. Determinística: monta o cadastro SÓ com o que tem fonte (nome padronizado, descrição, SEO, medidas do Bling).
// Redação por modelo de linguagem é opcional e fica fora desta etapa; imagens passam pelo pipeline próprio de direitos.
import { montarCadastro, type Cadastro, type EntradaBling } from "../pipeline/cadastro.ts";
import type { Evidencia } from "../pipeline/comparacao.ts";
import type { Extracao } from "../pipeline/extracao.ts";
import type { Classificacao } from "./taxonomista.ts";

export type CadastroEnriquecido = Cadastro & { categoria_proposta: (Classificacao & { situacao: "a_confirmar" }) | null };
export function enriquecer(sku: string, entrada: { nome: string; marca?: string; bling?: EntradaBling }, ext: Extracao, evidencias: Evidencia[], agora: string, classificacao: Classificacao | null): CadastroEnriquecido {
  const c = montarCadastro(sku, { ...(entrada.bling ?? {}), nome: entrada.bling?.nome ?? entrada.nome, marca: entrada.marca }, ext, evidencias, agora);
  if (!classificacao) c.pendencias.push("sem categoria na árvore fechada");
  return { ...c, categoria_proposta: classificacao ? { ...classificacao, situacao: "a_confirmar" } : null };
}
