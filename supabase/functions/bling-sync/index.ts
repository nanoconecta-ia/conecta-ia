// Varredura do espelho (somente leitura do Bling). Dois modos de entrada:
//  - cron: POST com cabeçalho x-cron-segredo => todas as lojas conectadas;
//  - manual: POST { loja_id } com o login de quem administra a loja ("Sincronizar agora"), no máx. 6 por hora.
// verify_jwt = false (autenticação própria). Responde só contagens; nunca token, custo ou fornecedor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import { blingFetch } from "../_shared/bling_api.ts";
import { type Chaveiro } from "../_shared/cripto.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { sincronizar, type Existente, type PortasSync } from "../_shared/bling_sync.ts";

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
function portasDaLoja(admin: any, lojaId: string, chaveCifra: Chaveiro): PortasSync {
  const arm = armazemSupabase(admin);
  const cfg = { chaveCifra };
  return {
    async listarPagina(pagina, limite) {
      try {
        const r = await blingFetch(arm, lojaId, `/produtos?pagina=${pagina}&limite=${limite}&criterio=2&tipo=T`, cfg);
        if (!r.ok) return { erro: `Bling respondeu ${r.status} ao listar produtos` };
        const j = await r.json().catch(() => null);
        return { itens: Array.isArray(j?.data) ? j.data : [] };
      } catch (e) { return { erro: e instanceof Error ? e.message : "falha ao listar produtos" }; }
    },
    async detalhe(id) {
      try {
        const r = await blingFetch(arm, lojaId, `/produtos/${id}`, cfg);
        if (!r.ok) return null;
        return (await r.json().catch(() => null))?.data ?? null;
      } catch { return null; }
    },
    async existentes() {
      const out: Existente[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await admin.from("produtos").select("bling_id, sku, nome, preco, estoque, situacao, sincronizado_em").eq("loja_id", lojaId).range(de, de + 999);
        if (error) throw new Error("falha ao ler o espelho");
        out.push(...((data ?? []) as Existente[]));
        if ((data ?? []).length < 1000) break;
      }
      return out;
    },
    async gravar(linhas) {
      // Nunca liga "publicado". Produto inativo no Bling é despublicado; os demais mantêm o estado de publicação.
      const inativos = linhas.filter((l) => l.situacao !== "A").map((l) => ({ ...l, publicado: false }));
      const ativos = linhas.filter((l) => l.situacao === "A");
      for (const grupo of [ativos, inativos]) {
        if (!grupo.length) continue;
        const { error } = await admin.from("produtos").upsert(grupo, { onConflict: "loja_id,bling_id" });
        if (error) throw new Error("falha ao gravar o espelho");
      }
    },
    async marcarAusentes(ids) {
      for (let i = 0; i < ids.length; i += 200) {
        await admin.from("produtos").update({ situacao: "ausente", publicado: false }).eq("loja_id", lojaId).in("bling_id", ids.slice(i, i + 200));
      }
    },
    async registrarErro(mensagem, detalhe) {
      await admin.from("sync_erros").insert({ loja_id: lojaId, mensagem: mensagem.slice(0, 300), detalhe: detalhe ?? null });
    },
    espera: (ms) => new Promise((r) => setTimeout(r, ms)),
    agora: () => Date.now(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
  if (!chaveCifra) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);
  const corpo = await req.json().catch(() => ({}));
  let lojas: string[] = [];

  const enviado = req.headers.get("x-cron-segredo");
  if (enviado) {
    const { data: esperado } = await admin.rpc("bling_cron_segredo");
    if (typeof esperado !== "string" || !esperado || !igual(enviado, esperado)) return json({ erro: "Não autorizado." }, 401);
    const { data } = await admin.from("bling_conexoes").select("loja_id").eq("status", "conectada");
    lojas = (data ?? []).map((l: { loja_id: string }) => l.loja_id);
  } else {
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
    });
    const { data: u } = await usuario.auth.getUser();
    if (!u.user) return json({ erro: "Não autenticado." }, 401);
    const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
    const { data: adm } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
    if (adm !== true) return json({ erro: "Só o responsável da loja pode sincronizar." }, 403);
    const { data: dentro } = await admin.rpc("limite_chamada", { p_chave: `bling-sync:${lojaId}`, p_max: 6, p_janela_s: 3600 });
    if (dentro !== true) return json({ erro: "Sincronização já pedida várias vezes. Aguarde um pouco." }, 429);
    lojas = [lojaId];
  }

  const resultado: Record<string, unknown>[] = [];
  for (const lojaId of lojas) {
    try {
      const r = await sincronizar(lojaId, portasDaLoja(admin, lojaId, chaveCifra));
      if (r.completo) await admin.from("bling_conexoes").update({ ultimo_sync_ok_em: new Date().toISOString(), ultimo_erro: null }).eq("loja_id", lojaId);
      else if (r.erro) await admin.from("bling_conexoes").update({ ultimo_erro: r.erro.slice(0, 300) }).eq("loja_id", lojaId);
      resultado.push({ paginas: r.paginas, vistos: r.vistos, gravados: r.gravados, detalhes: r.detalhes, ausentes: r.ausentes, completo: r.completo, erro: r.erro ? true : undefined });
    } catch {
      resultado.push({ completo: false, erro: true });
    }
  }
  return json({ lojas: lojas.length, resultado });
});
