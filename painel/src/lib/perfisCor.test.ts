import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerTokens, razao } from "./contraste.ts";
import { PERFIS, PADRAO, gerar, cssDosPerfis } from "./perfisCorGerador.ts";
import { lerPerfil, gravarPerfil } from "./perfilCor.ts";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const bloco = (abre: string) => { const i = css.indexOf(abre); assert.ok(i >= 0, abre); return css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i)); };
const BASE_CLARO = lerTokens(bloco(":root {"));
const BASE_ESCURO = lerTokens(bloco('[data-tema="escuro"] {'));
const BASE_NOTURNO = lerTokens(bloco('[data-tema="noturno"] {'));
const sem = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k.replace(/^--/, ""), v]));
const TEXTO: [string, string][] = [
  ["texto", "fundo"], ["texto", "cartao"], ["texto", "realce"], ["suave", "fundo"], ["suave", "cartao"], ["suave", "realce"],
  ["marca-forte", "fundo"], ["marca-forte", "cartao"], ["marca", "fundo"], ["marca", "cartao"], ["marca-texto", "marca"], ["marca-texto", "marca-forte"],
];
const CAMPO: [string, string][] = [["borda-forte", "fundo"], ["borda-forte", "cartao"], ["borda-forte", "realce"]];

test("perfis-cor.css é exatamente o que o gerador produz", () => {
  assert.equal(readFileSync(new URL("../perfis-cor.css", import.meta.url), "utf8"), cssDosPerfis());
});

test("há perfis para cinza, vermelho, branco, pardo, chumbo e verde, e o padrão existe", () => {
  const ids = PERFIS.map((p) => p.id);
  for (const id of ["cinza", "vermelho", "branco", "pardo", "chumbo", "verde"]) assert.ok(ids.includes(id), id);
  assert.ok(ids.includes(PADRAO));
});

for (const p of PERFIS) {
  const g = gerar(p);
  const variantes: [string, Record<string, string>][] = [
    ["claro", { ...sem(BASE_CLARO), ...sem(g.claro), ...sem(g.superficieClara ?? {}) }],
    ["escuro", { ...sem(BASE_ESCURO), ...sem(g.escuro), ...sem(g.superficieEscura ?? {}) }],
    ["noturno", { ...sem(BASE_NOTURNO), ...sem(g.escuro), ...sem(g.superficieEscura ?? {}) }],
  ];
  for (const [tema, t] of variantes) {
    test(`perfil ${p.id} / ${tema}: contraste de texto >= 4,5:1 e borda de campo >= 3:1`, () => {
      for (const [a, b] of TEXTO) { const r = razao(t[a], t[b]); assert.ok(r >= 4.5, `${p.id}/${tema}: --${a} sobre --${b} = ${r.toFixed(2)}`); }
      for (const [a, b] of CAMPO) { const r = razao(t[a], t[b]); assert.ok(r >= 3, `${p.id}/${tema}: --${a} sobre --${b} = ${r.toFixed(2)}`); }
    });
  }
  test(`perfil ${p.id}: cabeçalho e menu (acento claro sobre grafite; texto escuro nos botões) >= 4,5:1`, () => {
    const t = g.topo;
    for (const gr of [g.claro["--grafite"], g.claro["--grafite-2"]]) assert.ok(razao(t["--acento-claro"], gr) >= 4.5, `${p.id}: --acento-claro sobre ${gr} = ${razao(t["--acento-claro"], gr).toFixed(2)}`);
    for (const k of ["--acento-1", "--acento-2"]) assert.ok(razao("#191717", t[k]) >= 4.5, `${p.id}: texto do botão sobre ${k} = ${razao("#191717", t[k]).toFixed(2)}`);
  });
  test(`perfil ${p.id}: define as 5 variáveis da esfera`, () => {
    for (const k of ["--orbe-a", "--orbe-b", "--orbe-m1", "--orbe-m2", "--orbe-m3"]) assert.match(g.orbe[k] ?? "", /^#[0-9A-F]{6}$/i, k);
  });
}

test("perfilCor: lê e grava só ids válidos; lixo cai no padrão", () => {
  const mem = new Map<string, string>();
  const arm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as Pick<Storage, "getItem" | "setItem" | "removeItem">;
  assert.equal(lerPerfil(arm), PADRAO);
  gravarPerfil(arm, "verde"); assert.equal(lerPerfil(arm), "verde");
  mem.set("conecta:cor", "<script>"); assert.equal(lerPerfil(arm), PADRAO);
  gravarPerfil(arm, "chumbo"); assert.equal(mem.get("conecta:cor"), "chumbo");
  gravarPerfil(arm, PADRAO); assert.equal(mem.has("conecta:cor"), false);
});
