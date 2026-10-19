// Capacidade 6 — Auditor. Determinístico. Verifica evidências, conflitos, riscos e permissões ANTES de o item ir para o lojista.
// Um bloqueio vira conflito do tipo "auditoria" (revisão humana); o auditor nunca aprova nem corrige sozinho.
import type { CadastroEnriquecido } from "./enriquecedor.ts";
import type { ResultadoCompatibilidade } from "./compatibilidade.ts";
import type { Evidencia } from "../pipeline/comparacao.ts";
import type { Identificacao } from "./identificador.ts";

const PROIBIDOS = ["custo", "preco_custo", "preco_compra", "fornecedor", "ncm", "cest", "cst", "cfop", "icms", "pis", "cofins", "ipi", "xml_fiscal"];
const PESO_ORIGEM: Record<string, number> = { oficial: 1, bling: 0.7, cadastro: 0.7, fornecedor: 0.5, inferida: 0.2 };

export interface Auditoria { aprovado_para_revisao: boolean; bloqueios: { regra: string; detalhe: string }[]; avisos: string[]; qualidade_evidencias: number; cobertura: number }

function atributos(o: unknown, caminho = ""): { caminho: string; a: any }[] {
  const saida: { caminho: string; a: any }[] = [];
  if (Array.isArray(o)) o.forEach((x, i) => saida.push(...atributos(x, `${caminho}[${i}]`)));
  else if (o && typeof o === "object") {
    const r = o as Record<string, unknown>;
    if ("situacao" in r && "fonte" in r && "valor" in r) saida.push({ caminho, a: r });
    else for (const [k, v] of Object.entries(r)) saida.push(...atributos(v, caminho ? `${caminho}.${k}` : k));
  }
  return saida;
}
function chavesProibidas(o: unknown, caminho = ""): string[] {
  if (Array.isArray(o)) return o.flatMap((x, i) => chavesProibidas(x, `${caminho}[${i}]`));
  if (o && typeof o === "object") return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (PROIBIDOS.includes(k.toLowerCase()) ? [`${caminho}.${k}`] : []).concat(chavesProibidas(v, `${caminho}.${k}`)));
  return [];
}

export function auditar(ident: Identificacao, cadastro: CadastroEnriquecido, compat: ResultadoCompatibilidade, evidencias: Evidencia[], o: { orcamentoEstourado?: boolean; tarefasExecutadas?: { capacidade: string; permissao: "leitura" | "propor" | "executar" }[] } = {}): Auditoria {
  const bloqueios: Auditoria["bloqueios"] = [];
  const avisos: string[] = [];
  const attrs = atributos({ ...cadastro, seo: undefined });
  for (const { caminho, a } of attrs) {
    if (!a.fonte || !a.consultado_em || !a.confianca || a.situacao !== "a_confirmar") bloqueios.push({ regra: "atributo sem procedência", detalhe: `${caminho}: falta fonte, data, confiança ou situação` });
  }
  for (const p of chavesProibidas(cadastro)) bloqueios.push({ regra: "campo proibido", detalhe: `${p}: dado fiscal, de custo ou de fornecedor não pode estar no cadastro enriquecido` });
  const naoConfiaveis = new Set(evidencias.filter((e) => e.nao_confiavel).map((e) => e.fonte));
  for (const a of cadastro.aplicacoes) if (naoConfiaveis.has(a.fonte) && a.confianca !== "baixa") bloqueios.push({ regra: "fonte não confiável", detalhe: `aplicação de ${a.fonte} com confiança acima de "baixa"` });
  if (naoConfiaveis.size) avisos.push(`${naoConfiaveis.size} fonte(s) com conteúdo suspeito (instruções ao agente) foram usadas só como dado, com confiança baixa`);
  if (ident.classe_peca.classe !== "a_confirmar" && !ident.classe_peca.evidencia) bloqueios.push({ regra: "classe sem evidência", detalhe: `classe '${ident.classe_peca.classe}' sem evidência da sua classe` });
  for (const ap of compat.aplicacoes) if (ap.situacao === "confirmada" && !evidencias.some((e) => e.tipo_fonte === "oficial" && !e.nao_confiavel)) bloqueios.push({ regra: "compatibilidade sem fonte oficial", detalhe: `${ap.modelo}/${ap.motor ?? "?"} marcada como confirmada sem fonte oficial` });
  if (ident.duplicidades.length) avisos.push(`possível duplicidade com ${ident.duplicidades.map((d) => d.sku).join(", ")}: não cadastrar em duplicata`);
  if (o.orcamentoEstourado) avisos.push("orçamento da loja esgotado: pesquisas adiadas, cadastro com menos evidências");
  for (const t of o.tarefasExecutadas ?? []) if (t.permissao === "executar") bloqueios.push({ regra: "permissão", detalhe: `tarefa '${t.capacidade}' tentou executar antes da aprovação humana` });
  const pesos = attrs.map(({ a }) => (a.confianca === "baixa" ? 0.5 : 1) * (PESO_ORIGEM[a.origem] ?? 0.2));
  const esperados = ["nome_comercial", "marca", "gtin", "nao_se_aplica", "descricao_tecnica"].filter((k) => (cadastro as any)[k]).length + (cadastro.codigos_oem.length ? 1 : 0) + (cadastro.aplicacoes.length ? 1 : 0) + (cadastro.medidas.peso_kg ? 1 : 0);
  return { aprovado_para_revisao: bloqueios.length === 0, bloqueios, avisos, qualidade_evidencias: pesos.length ? Number((pesos.reduce((t, x) => t + x, 0) / pesos.length).toFixed(3)) : 0, cobertura: Number((esperados / 8).toFixed(3)) };
}
