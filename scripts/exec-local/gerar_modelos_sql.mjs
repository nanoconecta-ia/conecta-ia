// Gera o SQL da tabela exec_local_modelos (regex POSIX/ARE por capacidade) a partir de capacidades.windows.json.
// Fonte única: capacidades.ts → capacidades.windows.json → este SQL. O teste de deriva confere que a migração está igual.
import { readFileSync } from "node:fs";
const esc = (s) => s.replace(/[^A-Za-z0-9_]/g, "\\$&");
export function padraoARE(c) {
  const partes = c.modelo.split(/(\{\{[a-z_]+\}\})/);
  const re = partes.map((p) => { const m = /^\{\{([a-z_]+)\}\}$/.exec(p); return m ? `(?:${c.parametros[m[1]].replace(/^\^/, "").replace(/\$$/, "")})` : esc(p); }).join("");
  return `^${re}$`;
}
export function sqlModelos(caps) {
  return "insert into public.exec_local_modelos (capacidade, padrao) values\n" +
    caps.map((c) => `  ('${c.id}', $pad$${padraoARE(c)}$pad$)`).join(",\n") + ";";
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  const caps = JSON.parse(readFileSync(new URL("./agente/capacidades.windows.json", import.meta.url), "utf8")).capacidades;
  console.log(sqlModelos(caps));
}
