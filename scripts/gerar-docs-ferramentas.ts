// Gera docs/conector-ia/ferramentas.md a partir do REGISTRO (fonte única de verdade): o documento nunca diverge do código.
// Uso: node --experimental-strip-types scripts/gerar-docs-ferramentas.ts
import { writeFileSync } from "node:fs";
import { FERRAMENTAS_CONECTOR, CAMPOS_BLING_PERMITIDOS, CAMPOS_BLING_PROIBIDOS } from "../supabase/functions/_shared/conector/registro.ts";
import { MAPA_CAMPOS } from "../supabase/functions/_shared/conector/bling_campos.ts";
import type { JsonSchema } from "../supabase/functions/_shared/conector/tipos.ts";

const campos = (s: JsonSchema) => {
  const p = Object.entries(s.properties ?? {});
  return p.length ? p.map(([k, v]) => `\`${k}${s.required?.includes(k) ? "*" : ""}:${v.type ?? "objeto"}\``).join(" ") : "—";
};
const sim = (b: boolean) => (b ? "sim" : "não");
const grupos = ["conecta", "bling", "engenharia", "desenvolvimento"] as const;
let md = `# Contratos de ferramentas do Nano.ia

> **Gerado** por \`scripts/gerar-docs-ferramentas.ts\` a partir de \`supabase/functions/_shared/conector/registro.ts\`. Não edite: altere o registro e gere de novo.

Legenda — **estado**: \`ativa\` = handler implementado e testado; \`planejada\` = só contrato (aparece neste catálogo, nunca para o LLM); \`desligada\` = implementada mas travada por política (escrita no Bling).
**permissão**: \`leitura\`, \`propor\` (cria proposta, nunca altera nada), \`simular\`, \`executar\` (**só o executor**, após aprovação humana; nunca exposta a chat nem a cliente externo). \`*\` = campo obrigatório.
Ninguém aprova por ferramenta: a aprovação é ato de pessoa autenticada (\`conector-aprovacoes\`).

Resumo: ${FERRAMENTAS_CONECTOR.length} ferramentas — ${FERRAMENTAS_CONECTOR.filter((f) => f.estado === "ativa").length} ativas, ${FERRAMENTAS_CONECTOR.filter((f) => f.estado === "planejada").length} planejadas, ${FERRAMENTAS_CONECTOR.filter((f) => f.estado === "desligada").length} desligadas.
`;
for (const g of grupos) {
  const lista = FERRAMENTAS_CONECTOR.filter((f) => f.grupo === g);
  if (!lista.length) continue;
  md += `\n## Grupo: ${g}\n\n| Id | Estado | Permissão | Risco | Aprovação | Chat | MCP | Simulação | Idempotência | Entrada |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const f of lista) md += `| \`${f.id}\` | ${f.estado} | ${f.permissao} | ${f.risco} | ${sim(f.exigeAprovacao)} | ${sim(f.exposicao.chat)} | ${sim(f.exposicao.mcp)} | ${sim(f.simulacao)} | ${f.idempotencia} | ${campos(f.entrada)} |\n`;
  md += `\n`;
  for (const f of lista) md += `- **\`${f.id}\`** — ${f.descricao}\n  - *Verificação:* ${f.verificacao}\n  - *Recuperação:* ${f.recuperacao}\n`;
}
md += `
## Campos do produto no Bling

Pode ser **alterado** pelo Nano.ia (somente após aprovação e com a escrita liberada): ${(CAMPOS_BLING_PERMITIDOS as readonly string[]).map((c) => `\`${c}\``).join(", ")}.
**Nunca** é lido para o LLM nem alterado: ${(CAMPOS_BLING_PROIBIDOS as readonly string[]).map((c) => `\`${c}\``).join(", ")}.

| Campo Conecta.IA | Caminho no Bling | Tipo | Conferido na documentação oficial |
|---|---|---|---|
${MAPA_CAMPOS.map((m) => `| \`${m.conecta}\` | \`${m.caminho.join(".")}\` | ${m.tipo} | ${m.conferido ? "sim" : "**não**"}${m.observacao ? ` — ${m.observacao}` : ""} |`).join("\n")}

Campo sem equivalente no Bling (aplicação veicular, genealogia, equivalências, códigos cruzados) **não é enviado**: fica só no Conecta.IA, ligado ao identificador do produto no ERP.
`;
writeFileSync(new URL("../docs/conector-ia/ferramentas.md", import.meta.url), md);
console.log("ok: docs/conector-ia/ferramentas.md");
