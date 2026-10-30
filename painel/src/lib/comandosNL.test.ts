import { test } from "node:test";
import assert from "node:assert/strict";
import { acharRota, interpretar, textoAjuda, type Item } from "./comandosNL.ts";

const MENU: Item[] = [["/", "Visão geral"], ["/catalogo", "Catálogo"], ["/fila", "Fila de aprovação"], ["/taxonomia", "Taxonomia"], ["/imagens", "Imagens e SEO"], ["/aparencia", "Aparência da loja"], ["/bling", "Bling"]];
const rotas = (c: ReturnType<typeof interpretar>) => c.tipo === "navegar" ? c.passos.map((p) => p[0]) : [];

test("abre uma tela pelo nome ou apelido, com acento ou sem", () => {
  assert.deepEqual(rotas(interpretar("Abre o catálogo", MENU)), ["/catalogo"]);
  assert.deepEqual(rotas(interpretar("me leva para a taxonomia", MENU)), ["/taxonomia"]);
  assert.deepEqual(rotas(interpretar("quero ver as fotos", MENU)), ["/imagens"]);
  assert.deepEqual(rotas(interpretar("mostra o SEO", MENU)), ["/imagens"]);
  assert.deepEqual(rotas(interpretar("vai para as tags de busca", MENU)), ["/taxonomia"]);
});

test("pedidos em sequência abrem as telas na ordem pedida, sem repetir seguidas", () => {
  assert.deepEqual(rotas(interpretar("Abre o catálogo, depois a taxonomia, a fila de aprovação e em seguida imagens", MENU)), ["/catalogo", "/taxonomia", "/fila", "/imagens"]);
  assert.deepEqual(rotas(interpretar("abre catálogo e catálogo e bling", MENU)), ["/catalogo", "/bling"]);
});

test("o apelido mais longo vence e só existe o que está no menu da loja", () => {
  assert.equal(acharRota("fila de aprovacao", MENU)?.[0], "/fila");
  const semBling = MENU.filter((m) => m[0] !== "/bling");
  const c = interpretar("abre o bling", semBling);
  assert.equal(c.tipo, "nenhum", "tela fora do menu não é inventada");
  const parcial = interpretar("abre o catálogo e o backup", semBling);
  assert.ok(parcial.tipo === "navegar" && parcial.passos.length === 1 && parcial.naoEntendido.includes("backup"));
});

test("sem verbo de navegação não navega (pergunta comum segue para o agente)", () => {
  for (const t of ["resumo da loja", "o que está pendente?", "qual o preço do SKU 5112", "catálogo", ""]) assert.equal(interpretar(t, MENU).tipo, "nenhum", t);
});

test("avaliar layout e ajuda são reconhecidos", () => {
  for (const t of ["avalie o layout desta tela", "Avaliar o layout", "revise a tela", "analise o design"]) assert.equal(interpretar(t, MENU).tipo, "avaliar_layout", t);
  for (const t of ["o que você sabe fazer?", "quais são as funcionalidades", "ajuda"]) assert.equal(interpretar(t, MENU).tipo, "ajuda", t);
  assert.match(textoAjuda(MENU), /Catálogo.*Fila de aprovação/); assert.match(textoAjuda(MENU), /sem enviar nada a um provedor de IA/);
});

test("pedido para Nano.IA consultar produtos com ferramentas não vira ajuda local", () => {
  const pedido = "Nano.IA, consulte no Bling os produtos CI000016 e CI000054. Pesquise códigos OEM e imagens reais. Informe quais ferramentas executou e os resultados obtidos.";
  assert.equal(interpretar(pedido, MENU).tipo, "nenhum");
  assert.deepEqual(rotas(interpretar("abre catálogo e bling", MENU)), ["/catalogo", "/bling"]);
});
