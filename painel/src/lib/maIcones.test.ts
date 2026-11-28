import test from "node:test";
import assert from "node:assert/strict";
import { RAIZES } from "../../../supabase/functions/_shared/nano_lifecycle/matriz_mestra.ts";
import { PECAS } from "./icones.ts";
import {
  ICONES_MA, INVENTARIO_OBRIGATORIO_MA, PALETA_MA, VERSAO_BIBLIOTECA_MA,
  iconeDaRaiz, iconeMA, iconeMAParaAtivo, iconeMAParaPeca, resolverIconeNoMA, validarBibliotecaMA,
} from "./maIcones.ts";

test("biblioteca MA cobre 1,00 do inventário obrigatório sem colisões", () => {
  const r = validarBibliotecaMA();
  assert.deepEqual(r.erros, []);
  assert.equal(r.cobertura, 1);
  assert.equal(r.cobertos, INVENTARIO_OBRIGATORIO_MA.length);
  assert.equal(VERSAO_BIBLIOTECA_MA, "1.0.0");
  assert.equal(PALETA_MA.grafite, "#1F2327");
  assert.equal(PALETA_MA.vermelho, "#E2181A");
});

test("todas as 12 raízes e todas as peças possuem ícone MA distinto", () => {
  const idsRaiz = RAIZES.map(iconeDaRaiz);
  assert.equal(new Set(idsRaiz).size, 12);
  for (const id of idsRaiz) assert.ok(iconeMA(id), `faltando ${id}`);
  for (const p of PECAS) assert.ok(iconeMA(iconeMAParaPeca(p)), `faltando peça ${p}`);
  assert.equal(iconeMAParaPeca("desconhecida"), "sistema.todas");
});

test("vínculo semântico respeita tipo de nó e falha fechado sem inventar", () => {
  assert.deepEqual(resolverIconeNoMA({ id: "cabecote", tipo: "componente", rotulo: "Cabeçote", chave: "componente.cabecote" }), {
    no_id: "cabecote", tipo: "componente", rotulo: "Cabeçote", icon_id: "componente.cabecote", estado: "especifico",
  });
  // Chave de outro tipo não pode ser usada para motor
  const errado = resolverIconeNoMA({ id: "d4cb", tipo: "motor", rotulo: "D4CB", chave: "veiculo.caminhao" });
  assert.equal(errado.icon_id, "tipo.motor");
  assert.equal(errado.estado, "tipo");
  // Nó sem ID cai para texto
  const vazio = resolverIconeNoMA({ id: "", tipo: "motor", rotulo: "Sem ID" });
  assert.equal(vazio.icon_id, null);
  assert.equal(vazio.estado, "texto");
});

test("mapeamento do atlas histórico cobre chaves conhecidas e retorna null para desconhecida", () => {
  assert.equal(iconeMAParaAtivo("inicio"), "modulo.inicio");
  assert.equal(iconeMAParaAtivo("nano"), "modulo.nano");
  assert.equal(iconeMAParaAtivo("motor"), "sistema.motor");
  assert.equal(iconeMAParaAtivo("nao-existe"), null);
});

test("validador rejeita colisão, ausência e geometria insegura", () => {
  const dup = validarBibliotecaMA([...ICONES_MA, ICONES_MA[0]]);
  assert.ok(dup.erros.some((e) => e.startsWith("colisao:")));
  const falta = validarBibliotecaMA(ICONES_MA.slice(1));
  assert.ok(falta.erros.some((e) => e.startsWith("ausente:")));
  assert.ok(falta.cobertura < 1);
  const inseguro = validarBibliotecaMA([{ ...ICONES_MA[0], d: "M0 0 <script>" }], [ICONES_MA[0].id]);
  assert.ok(inseguro.erros.some((e) => e.startsWith("geometria_insegura:")));
});
