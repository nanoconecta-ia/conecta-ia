// Backup do cadastro do Bling dentro do Conecta. LEITURA do Bling; nunca escreve nele.
// Entradas (POST):
//  - cron: cabeçalho x-cron-segredo => backup "diario" de todas as lojas conectadas;
//  - { acao: "executar", loja_id }: login de quem administra a loja ("Fazer backup agora"), no máx. 4 por hora;
//  - { acao: "csv", loja_id, snapshot_id? }: baixa o CSV no formato do Bling a partir do que JÁ está guardado (funciona com o Bling fora do ar).
// verify_jwt = false (autenticação própria, como a bling-sync). O snapshot tem custo e fornecedor: só o administrador da loja recebe o CSV.
// ATENÇÃO (deploy): o bundler do Supabase tem um bug com imports relativos em deploys repetidos; o deploy real usa versão autocontida.
import { createClient } from "npm:@supabase/supabase-js@2";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import { blingFetch } from "../_shared/bling_api.ts";
import { type Chaveiro } from "../_shared/cripto.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { COLUNAS_BLING, csvBling, executarBackup, linhaBling, type PortasBackup } from "../_shared/bling_snapshot.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-cron-segredo",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// deno-lint-ignore no-explicit-any
function portas(admin: any, lojaId: string, chaveCifra: Chaveiro, usuarioId: string | null): PortasBackup {
  const arm = armazemSupabase(admin);
  const cfg = { chaveCifra };
  // deno-lint-ignore no-explicit-any
  const ler = async (caminho: string): Promise<any | null> => {
    try {
      const r = await blingFetch(arm, lojaId, caminho, cfg);
      return r.ok ? await r.json().catch(() => null) : { __status: r.status };
    } catch { return null; }
  };
  // deno-lint-ignore no-explicit-any
  const rpc = async (nome: string, args: Record<string, unknown>): Promise<any> => {
    const { data, error } = await admin.rpc(nome, args);
    if (error) throw new Error(`falha em ${nome}`);
    return data;
  };
  return {
    async listarProdutos(situacao, pagina, limite) {
      const j = await ler(`/produtos?pagina=${pagina}&limite=${limite}&criterio=${situacao === "ativos" ? 2 : 3}&tipo=T`);
      if (!j || j.__status) return { erro: `Bling respondeu ${j?.__status ?? "sem resposta"} ao listar produtos` };
      return { itens: Array.isArray(j.data) ? j.data : [] };
    },
    async detalhe(id) { const j = await ler(`/produtos/${id}`); return j && !j.__status ? j.data ?? null : null; },
    // Caminho conferido: false (documentação do Bling não pôde ser aberta): conferir antes de confiar em produção.
    async vinculos(id) { const j = await ler(`/produtos/fornecedores?idProduto=${id}&limite=100`); return j && !j.__status && Array.isArray(j.data) ? j.data : null; },
    async categorias(pagina, limite) {
      const j = await ler(`/categorias/produtos?pagina=${pagina}&limite=${limite}`);
      if (!j || j.__status) return { erro: `Bling respondeu ${j?.__status ?? "sem resposta"} ao listar categorias` };
      return { itens: Array.isArray(j.data) ? j.data : [] };
    },
    async contato(id) { const j = await ler(`/contatos/${id}`); return j && !j.__status ? j.data ?? null : null; },
    iniciar: (origem) => rpc("bling_snapshot_iniciar", { p_loja: lojaId, p_origem: origem, p_user: usuarioId }),
    async gravar(snapshotId, lote) {
      await rpc("bling_snapshot_gravar", { p_snapshot: snapshotId, p_produtos: lote.produtos, p_categorias: lote.categorias, p_contatos: lote.contatos });
    },
    async concluir(snapshotId, status, erro) { await rpc("bling_snapshot_concluir", { p_snapshot: snapshotId, p_status: status, p_erro: erro ?? null }); },
    async podar() { await rpc("bling_snapshot_podar", { p_loja: lojaId, p_manter: 30 }); },
    espera: (ms) => new Promise((r) => setTimeout(r, ms)),
    agora: () => Date.now(),
  };
}

// deno-lint-ignore no-explicit-any
async function csvDoSnapshot(admin: any, lojaId: string, snapshotId: string | null): Promise<{ csv: string; snapshot_id: string } | null> {
  let id = snapshotId;
  if (!id) {
    const { data } = await admin.from("bling_snapshots").select("id").eq("loja_id", lojaId).in("status", ["completo", "parcial"]).order("criado_em", { ascending: false }).limit(1);
    id = data?.[0]?.id ?? null;
  } else {
    const { data } = await admin.from("bling_snapshots").select("id").eq("id", id).eq("loja_id", lojaId).maybeSingle();
    if (!data) return null;
  }
  if (!id) return null;
  const produtos: { json_produto: unknown; json_vinculos: unknown[] }[] = [];
  for (let de = 0; ; de += 500) {
    const { data, error } = await admin.from("bling_snapshot_produtos").select("json_produto, json_vinculos").eq("snapshot_id", id).order("bling_id").range(de, de + 499);
    if (error) throw new Error("falha ao ler o backup");
    produtos.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  const { data: cats } = await admin.from("bling_snapshot_categorias").select("bling_id, nome").eq("snapshot_id", id);
  const { data: cons } = await admin.from("bling_snapshot_contatos").select("bling_id, nome").eq("snapshot_id", id);
  const ctx = {
    categorias: new Map<string, string>((cats ?? []).map((c: { bling_id: string; nome: string }) => [c.bling_id, c.nome])),
    fornecedores: new Map<string, string>((cons ?? []).map((c: { bling_id: string; nome: string }) => [c.bling_id, c.nome])),
  };
  // deno-lint-ignore no-explicit-any
  return { csv: csvBling(produtos.map((p) => linhaBling(p.json_produto as any, p.json_vinculos as any[], ctx))), snapshot_id: id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const corpo = await req.json().catch(() => ({}));

  const enviado = req.headers.get("x-cron-segredo");
  if (enviado) {
    const { data: esperado } = await admin.rpc("bling_cron_segredo");
    if (typeof esperado !== "string" || !esperado || !igual(enviado, esperado)) return json({ erro: "Não autorizado." }, 401);
    const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
    if (!chaveCifra) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);
    const { data } = await admin.from("bling_conexoes").select("loja_id").eq("status", "conectada");
    const resultado = [];
    for (const l of (data ?? []) as { loja_id: string }[]) {
      const r = await executarBackup("diario", portas(admin, l.loja_id, chaveCifra, null));
      resultado.push({ status: r.status, produtos: r.produtos, categorias: r.categorias, contatos: r.contatos });
    }
    return json({ lojas: resultado.length, resultado });
  }

  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);
  const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
  const { data: adm } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
  if (adm !== true) return json({ erro: "Só o responsável da loja acessa o backup." }, 403);

  if (corpo?.acao === "csv") {
    try {
      const r = await csvDoSnapshot(admin, lojaId, typeof corpo?.snapshot_id === "string" ? corpo.snapshot_id : null);
      if (!r) return json({ erro: "Ainda não há backup desta loja." }, 404);
      await admin.from("auditoria").insert({ loja_id: lojaId, user_id: u.user.id, acao: "bling.backup.csv", tabela: "bling_snapshots", depois: { snapshot_id: r.snapshot_id, colunas: COLUNAS_BLING.length } });
      return new Response(r.csv, { status: 200, headers: { ...CORS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bling-produtos-${r.snapshot_id.slice(0, 8)}.csv"`, "Cache-Control": "no-store" } });
    } catch { return json({ erro: "Não foi possível gerar o CSV agora." }, 500); }
  }
  if (corpo?.acao === "executar") {
    const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
    if (!chaveCifra) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);
    const { data: dentro } = await admin.rpc("limite_chamada", { p_chave: `bling-backup:${lojaId}`, p_max: 4, p_janela_s: 3600 });
    if (dentro !== true) return json({ erro: "Backup já pedido várias vezes. Aguarde um pouco." }, 429);
    const r = await executarBackup("manual", portas(admin, lojaId, chaveCifra, u.user.id));
    return json({ snapshot_id: r.snapshotId, status: r.status, produtos: r.produtos, categorias: r.categorias, contatos: r.contatos, erro: r.erro });
  }
  return json({ erro: "Ação inválida." }, 400);
});
