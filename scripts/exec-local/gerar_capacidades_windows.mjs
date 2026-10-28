// Gera agente/capacidades.windows.json a partir de capacidades.ts: o agente (JS puro, sem TypeScript) leva só a lista
// permitida do que ele aceita executar. Só executor windows, camada consulta e estado ativa.
import { writeFileSync } from "node:fs";
import { CAPACIDADES_LOCAIS } from "../../supabase/functions/_shared/exec_local/capacidades.ts";
const lista = CAPACIDADES_LOCAIS.filter((c) => c.executor === "windows" && c.camada === "consulta" && c.estado === "ativa")
  .map((c) => ({ id: c.id, modelo: c.modelo, timeoutMs: c.timeoutMs, parametros: Object.fromEntries(Object.entries(c.parametros).map(([k, re]) => [k, re.source])) }));
const destino = new URL("./agente/capacidades.windows.json", import.meta.url);
writeFileSync(destino, JSON.stringify({ gerado_de: "supabase/functions/_shared/exec_local/capacidades.ts", capacidades: lista }, null, 2) + "\n");
console.log(`${lista.length} capacidades permitidas:`, lista.map((c) => c.id).join(", "));
