// Descoberta (tools/list) das capacidades locais no MESMO formato do Gateway MCP. Puro; o gateway ainda NÃO chama isto
// (ligar exige mudar gateway.ts, que está em produção: fica para um PR próprio com diff e rollback).
import { CAPACIDADES_LOCAIS, type Camada } from "./capacidades.ts";

/** Escopo de sessão -> camadas visíveis. aprovacao é visível (o agente pode PEDIR) mas só executa com consentimento; escrita nunca. */
const VISIVEL: Record<string, readonly Camada[]> = { consulta: ["consulta", "aprovacao"], proposta: ["proposta"] };

export function ferramentasLocaisMcp(escopos: readonly string[]) {
  const camadas = new Set(escopos.flatMap((e) => VISIVEL[e] ?? []));
  return CAPACIDADES_LOCAIS.filter((c) => c.estado === "ativa" && camadas.has(c.camada)).map((c) => ({
    name: c.id.replaceAll(".", "__"), title: c.id,
    description: `${c.descricao} [executor ${c.executor}; risco ${c.risco}; camada ${c.camada}${c.camada === "aprovacao" ? "; exige aprovação humana por operação" : ""}]`,
    inputSchema: { type: "object", additionalProperties: false, required: Object.keys(c.parametros),
      properties: Object.fromEntries(Object.entries(c.parametros).map(([k, re]) => [k, { type: "string", pattern: re.source }])) },
    annotations: { readOnlyHint: c.camada === "consulta", destructiveHint: false },
  }));
}
