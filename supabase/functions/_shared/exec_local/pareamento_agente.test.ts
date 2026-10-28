// Pareamento REAL do agente pelo Conecta Pair, contra o esquema real (Postgres local com as migrações): iniciar → aprovação do lojista
// (simulada por UPDATE, porque a aprovação exige login no painel) → resgate → renovação do token → tarefas continuam fluindo.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { criarPsql } from "../conector/psql_cliente.testutil.ts";
import { tratarPair } from "../pair/servico.ts";
import { tratarDispositivo } from "./rotas_dispositivo.ts";
import { filaDbSupabase } from "./portas_supabase.ts";
import { argvPowerShell } from "./capacidades.ts";
// @ts-ignore: módulo JS do agente (sem tipos)
import { rodarAgente } from "../../../../scripts/exec-local/agente/agente.mjs";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const LOJA = "f1f1f1f1-0000-4000-8000-000000000001", USER = "f2f2f2f2-0000-4000-8000-000000000002";
const fake = new URL("../../../../scripts/exec-local/pwsh_falso.mjs", import.meta.url).pathname;
const caps = JSON.parse(readFileSync(new URL("../../../../scripts/exec-local/agente/capacidades.windows.json", import.meta.url), "utf8")).capacidades;
const INV = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture,TotalVisibleMemorySize | ConvertTo-Json -Compress";
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ate = async (cond: () => boolean | Promise<boolean>, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await cond()) return true; await dormir(40); } return false; };

after(() => { if (BANCO) db.sql(`delete from public.exec_local_tarefas where loja_id = '${LOJA}'; delete from public.pair_desafios where loja_id = '${LOJA}' or nome_dispositivo like 'Agente Windows%'; delete from public.lojas where id = '${LOJA}'`); });

test("agente pareia pelo Conecta Pair, é aprovado, renova o token e continua executando diagnósticos", { skip }, async () => {
  db.sql(`delete from public.pair_desafios where nome_dispositivo like 'Agente Windows%'`);   // sobra de execução anterior interrompida
  db.sql(`insert into public.lojas (id, nome, slug) values ('${LOJA}','Loja Pareamento','loja-pareamento-el') on conflict do nothing;
          insert into public.usuarios_loja (loja_id, user_id, papel) values ('${LOJA}','${USER}','lojista') on conflict do nothing`);
  const rpc = async (fn: string, args: Record<string, unknown>) => db.rpc(fn, args);
  const srv = createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c;
    const aut = req.headers.authorization ?? null;
    if (req.url === "/pair") {
      const r = await tratarPair({ metodo: req.method!, authorization: aut, corpo: b, ip: "9.9.9.9" }, { rpc: rpc as never, limite: async () => true, appUrl: "https://app.exemplo.com" });
      res.writeHead(r.status, { "content-type": "application/json" }); return res.end(JSON.stringify(r.corpo));
    }
    const r = await tratarDispositivo({ metodo: req.method!, caminho: req.url!, authorization: aut, corpo: b, ip: "9.9.9.9" }, { rpc: (async (fn: string, a: Record<string, unknown>) => { const x = await db.rpc(fn, a); if (x.error) throw new Error(x.error.message); return x.data; }) as never });
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(r.corpo === undefined ? "" : JSON.stringify(r.corpo));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  const log: Record<string, unknown>[] = []; let parar = false;
  const agente = rodarAgente({ gateway: base, pairUrl: `${base}/pair`, parear: true, binario: process.execPath, argsAntes: [fake], capacidades: caps,
    log: (e: Record<string, unknown>) => log.push(e), parar: () => parar, intervaloMs: 40, intervaloPareamentoMs: 60, renovarCadaMs: 400 });
  try {
    // 1) o pedido de pareamento chega ao Pair (pendente) com a lista de capacidades; o link/código aparecem para o lojista
    assert.ok(await ate(() => Number(db.sql(`select count(*) from public.pair_desafios where nome_dispositivo like 'Agente Windows%' and estado = 'pendente'`)) === 1), "desafio pendente");
    assert.ok(await ate(() => log.some((e) => e.evento === "aguardando_aprovacao_do_lojista")), "o agente mostra o link e o código de verificação ao lojista");
    const ev = log.find((e) => e.evento === "aguardando_aprovacao_do_lojista")!; assert.ok(/^[A-Za-z0-9-]{4,12}$/.test(String(ev.codigo_de_verificacao)) && String(ev.url).startsWith("https://app.exemplo.com"));
    assert.equal(db.sql(`select cardinality(capacidades_solicitadas) from public.pair_desafios where estado='pendente' and nome_dispositivo like 'Agente Windows%'`), String(caps.length));
    // 2) sem aprovação NÃO há dispositivo nem sessão
    assert.equal(db.sql(`select count(*) from public.pair_dispositivos where loja_id='${LOJA}'`), "0");
    // 3) o lojista aprova (simulado) com escopo mínimo
    db.sql(`update public.pair_desafios set estado='aprovado', loja_id='${LOJA}', aprovado_por='${USER}', aprovado_em=now(), escopos_aprovados='{tarefas:ler}', capacidades_aprovadas=capacidades_solicitadas, duracao_aprovada_min=60 where estado='pendente' and nome_dispositivo like 'Agente Windows%'`);
    assert.ok(await ate(() => db.sql(`select count(*) from public.pair_dispositivos where loja_id='${LOJA}' and tipo='agente_desktop'`) === "1"), "dispositivo criado no resgate");
    const disp = db.sql(`select id from public.pair_dispositivos where loja_id='${LOJA}' and tipo='agente_desktop'`);
    // 4) uma tarefa real da fila é executada pelo agente pareado
    const fila = filaDbSupabase(db as never);
    const t1 = await fila.enfileirar({ loja_id: LOJA, dispositivo_id: disp, capacidade: "windows.sistema.inventario", argv: argvPowerShell(INV), timeout_ms: 5000 });
    assert.ok(await ate(async () => (await fila.estado(LOJA, t1))?.estado === "CONCLUIDA"), "tarefa 1 concluída");
    // 5) o token foi renovado (rotação) e o agente continua autorizado
    assert.ok(await ate(() => db.sql(`select count(*) from public.pair_sessoes where dispositivo_id='${disp}' and rotacionado_em is not null`) === "1"), "token rotacionado");
    assert.ok(await ate(() => log.some((e) => e.evento === "sessao_renovada")), "agente registra a renovação");
    const t2 = await fila.enfileirar({ loja_id: LOJA, dispositivo_id: disp, capacidade: "windows.sistema.inventario", argv: argvPowerShell(INV), timeout_ms: 5000 });
    assert.ok(await ate(async () => (await fila.estado(LOJA, t2))?.estado === "CONCLUIDA"), "tarefa 2 concluída depois da renovação");
    // 6) nenhum token completo nos logs do agente
    const tokenHash = db.sql(`select token_hash from public.pair_sessoes where dispositivo_id='${disp}'`); assert.match(tokenHash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(log).match(/[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}/));
    // 7) revogar o dispositivo (painel) faz o agente encerrar sozinho
    db.sql(`update public.pair_dispositivos set revogado_em = now() where id = '${disp}'`);
    const fim = await Promise.race([agente, dormir(8000).then(() => ({ motivo: "nao_encerrou" }))]);
    assert.ok(["revogado", "sessao_expirada"].includes((fim as { motivo: string }).motivo), JSON.stringify(fim));
  } finally { parar = true; srv.closeAllConnections(); srv.close(); }
});

test("pareamento recusado ou expirado: o agente encerra com o motivo e nada é criado", { skip }, async () => {
  const rpc = async (fn: string, args: Record<string, unknown>) => db.rpc(fn, args);
  const srv = createServer(async (req, res) => {
    let b = ""; for await (const c of req) b += c;
    const r = await tratarPair({ metodo: req.method!, authorization: null, corpo: b, ip: "9.9.9.8" }, { rpc: rpc as never, limite: async () => true, appUrl: "https://app.exemplo.com" });
    res.writeHead(r.status, { "content-type": "application/json" }); res.end(JSON.stringify(r.corpo));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  db.sql(`delete from public.pair_desafios where nome_dispositivo like 'Agente Windows%'`);
  const antes = db.sql(`select count(*) from public.pair_dispositivos`);
  const p = rodarAgente({ gateway: base, pairUrl: base, parear: true, capacidades: caps, log: () => {}, intervaloPareamentoMs: 50 });
  assert.ok(await ate(() => Number(db.sql(`select count(*) from public.pair_desafios where estado='pendente' and nome_dispositivo like 'Agente Windows%'`)) >= 1));
  db.sql(`update public.pair_desafios set estado='recusado' where estado='pendente' and nome_dispositivo like 'Agente Windows%'`);
  const fim = await p; srv.closeAllConnections(); srv.close();
  assert.equal((fim as { motivo: string }).motivo, "pareamento_recusado"); assert.equal(db.sql(`select count(*) from public.pair_dispositivos`), antes);
});
