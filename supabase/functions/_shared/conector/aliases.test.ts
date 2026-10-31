// Catálogo único (issue #166, B1): toda ferramenta exposta pelo assistente ou pelo gateway Pair aponta para o Tool Registry,
// com permissão compatível; o assistente passa pelo Policy Engine; e toda ferramenta ativa do registro tem handler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALIASES_ASSISTENTE, ALIASES_PAIR, definicaoDoAssistente, politicaDoAssistente } from "./aliases.ts";
import { buscarDefinicao, FERRAMENTAS_CONECTOR } from "./registro.ts";
import { HANDLERS } from "./handlers.ts";
import { executarFerramenta, FERRAMENTAS, FERRAMENTAS_DO_ASSISTENTE } from "../ia/ferramentas.ts";
import { FERRAMENTAS as FERRAMENTAS_PAIR } from "../pair/gateway.ts";

test("assistente: cada ferramenta tem alias para uma definição ATIVA do registro, exposta ao chat, com a mesma permissão", () => {
  const nomes = FERRAMENTAS_DO_ASSISTENTE.map((f) => f.name);
  assert.deepEqual(new Set(nomes), new Set(Object.keys(ALIASES_ASSISTENTE)), "alias faltando ou sobrando");
  for (const nome of nomes) {
    const def = definicaoDoAssistente(nome);
    assert.ok(def, `${nome} -> ${ALIASES_ASSISTENTE[nome]} não existe no registro`);
    assert.equal(def.estado, "ativa", nome);
    assert.equal(def.exposicao.chat, true, nome);
    const esperada = /^(propor_|bling_propor_)/.test(nome) ? "propor" : "leitura";
    assert.equal(def.permissao, esperada, `${nome}: permissão ${def.permissao}`);
    assert.equal(politicaDoAssistente(nome).decisao, "permitida", nome);
  }
});

test("assistente: hoje nada é cortado da lista do LLM (sem regressão), e nome sem alias é negado pelo Policy Engine", async () => {
  assert.equal(FERRAMENTAS.length, FERRAMENTAS_DO_ASSISTENTE.length);
  assert.equal(politicaDoAssistente("apagar_produto").decisao, "negada");
  const r = await executarFerramenta("apagar_produto", {}, {} as never) as { erro: string; decisao: string };
  assert.equal(r.erro, "Ferramenta desconhecida.");
  assert.equal(r.decisao, "negada");
});

test("assistente: o Policy Engine roda ANTES de qualquer acesso a dados", async () => {
  // Contexto sem banco: se a política deixasse passar uma ferramenta desconhecida, isto explodiria ao tocar em c.usuario.
  const r = await executarFerramenta("listar_tudo_do_bling", { x: 1 }, { usuario: null } as never) as { decisao: string };
  assert.equal(r.decisao, "negada");
});

test("gateway Pair: toda ferramenta pública está mapeada; as mapeadas batem em permissão com o registro", () => {
  assert.deepEqual(new Set(FERRAMENTAS_PAIR.map((f) => f.nome)), new Set(Object.keys(ALIASES_PAIR)), "ferramenta nova no Pair precisa de alias");
  for (const f of FERRAMENTAS_PAIR) {
    const id = ALIASES_PAIR[f.nome];
    if (id === null) continue;
    const def = buscarDefinicao(id);
    assert.ok(def, `${f.nome} -> ${id} não existe no registro`);
    assert.equal(def.estado, "ativa", f.nome);
    assert.equal(def.permissao === "leitura", f.somenteLeitura, `${f.nome}: somenteLeitura x permissão ${def.permissao}`);
  }
});

test("gateway Pair: capacidades ainda sem contrato no registro estão travadas nesta lista (entram na C2)", () => {
  const semContrato = Object.entries(ALIASES_PAIR).filter(([, id]) => id === null).map(([n]) => n).sort();
  assert.deepEqual(semContrato, ["conecta.get_part_by_code", "conecta.get_pending_approvals", "conecta.get_task_status", "conecta.get_validated_fields", "conecta.propose_banner", "conecta.propose_bula"]);
});

test("registro: toda ferramenta ativa (exceto execução) tem handler, e todo handler tem contrato", () => {
  const ids = new Set(Object.keys(HANDLERS));
  const semHandler = FERRAMENTAS_CONECTOR.filter((f) => f.estado === "ativa" && f.permissao !== "executar" && !ids.has(f.id)).map((f) => f.id);
  assert.deepEqual(semHandler, []);
  assert.deepEqual([...ids].filter((id) => !buscarDefinicao(id)), []);
});

test("pesquisa técnica na web: leitura, só no chat (fora do MCP), e sem configuração responde erro claro", async () => {
  const def = buscarDefinicao("conecta.web.pesquisar_tecnico")!;
  assert.equal(def.permissao, "leitura");
  assert.deepEqual(def.exposicao, { chat: true, mcp: false });
  const r = await HANDLERS["conecta.web.pesquisar_tecnico"]({ consulta: "bomba d'água HR 2.5" }, { buscaImagem: null } as never) as { erro: string };
  assert.match(r.erro, /não configurada/);
});
