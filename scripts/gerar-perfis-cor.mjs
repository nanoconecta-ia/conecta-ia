// Gera painel/src/perfis-cor.css a partir de painel/src/lib/perfisCorGerador.ts. Uso: node --experimental-strip-types scripts/gerar-perfis-cor.mjs
import { writeFileSync } from "node:fs";
import { cssDosPerfis } from "../painel/src/lib/perfisCorGerador.ts";
writeFileSync(new URL("../painel/src/perfis-cor.css", import.meta.url), cssDosPerfis());
console.log("ok: painel/src/perfis-cor.css");
