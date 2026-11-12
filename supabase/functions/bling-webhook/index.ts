// Webhook do Bling -> espelho (SOMENTE LEITURA do Bling). Desenho: docs/conector-ia/DESENHO_WEBHOOK_BLING.md.
// Dois modos (verify_jwt = false; autenticação própria em cada um):
//  - Bling: POST com o evento e o cabeçalho X-Bling-Signature-256 (HMAC com o client_secret do app da loja).
//    Valida, enfileira (idempotente por eventId) e responde 2xx NA HORA (o Bling exige < 5 s); depois processa a fila.
//  - cron: POST com x-cron-segredo => processa a fila (rede de segurança) e preenche o bling_company_id das lojas.
// Nunca devolve token, segredo, custo ou fornecedor. Resposta uniforme para conta desconhecida.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import { blingFetch } from "../_shared/bling_api.ts";
import { decifrar, type Chaveiro } from "../_shared/cripto.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import type { Existente, LinhaProduto } from "../_shared/bling_sync.ts";
import {
  aplicarEvento, assinaturaValida, disjuntorAberto, eventoParaFila, lerEvento, MAX_TENTATIVAS, proximaTentativaEm, TAMANHO_MAX_CORPO,
  type EventoPendente, type PortasWebhook, type Resultado,
} from "../_shared/bling_webhook.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const COLUNAS = "bling_id, sku, nome, preco, estoque, situacao, sincronizado_em, categoria_bling_id, marca, gtin, gtin_tributario, descricao_curta, descricao_complementar, peso_kg, largura_cm, altura_cm, profundidade_cm, unidade, condicao, formato, pai_bling_id, volumes";
const ESPERA_ENTRE_CHAMADAS_MS = 1000; // o limite do Bling é 3 req/s por conta, dividido com a varredura e o chat
const ORCAMENTO_MS = 40_000;

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// deno-lint-ignore no-explicit-any
function portasDaLoja(admin: any, lojaId: string, chaveCifra: Chaveiro): PortasWebhook {
  const arm = armazemSupabase(admin);
  const cfg = { chaveCifra };
  return {
    async detalhe(id) {
      try {
        const r = await blingFetch(arm, lojaId, `/produtos/${id}`, cfg);
        if (r.status === 404) return null;
        if (!r.ok) return "erro";
        return (await r.json().catch(() => null))?.data ?? "erro";
      } catch { return "erro"; }
    },
    async existente(blingId) {
      const { data } = await admin.from("produtos").select(COLUNAS).eq("loja_id", lojaId).eq("bling_id", blingId).maybeSingle();
      return (data ?? undefined) as Existente | undefined;
    },
    async gravar(linha: LinhaProduto) {
      // Nunca liga "publicado". Produto que não está ativo no Bling é despublicado.
      const l = linha.situacao === "A" ? linha : { ...linha, publicado: false };
      const { error } = await admin.from("produtos").upsert(l, { onConflict: "loja_id,bling_id" });
      if (error) throw new Error("falha ao gravar o espelho");
    },
    async marcarExcluido(blingId, agoraISO) {
      const { error } = await admin.from("produtos").update({ situacao: "E", publicado: false, sincronizado_em: agoraISO }).eq("loja_id", lojaId).eq("bling_id", blingId);
      if (error) throw new Error("falha ao marcar o produto como excluído");
    },
    agora: () => Date.now(),
  };
}

// deno-lint-ignore no-explicit-any
async function concluir(admin: any, ev: EventoPendente, r: Resultado, agora: number) {
  if (r.status === "erro") {
    await admin.rpc("bling_evento_concluir", { p_id: ev.id, p_status: "erro", p_motivo: r.motivo, p_proxima: r.definitivo ? null : proximaTentativaEm(ev.tentativas, agora) });
  } else {
    await admin.rpc("bling_evento_concluir", { p_id: ev.id, p_status: r.status, p_motivo: r.motivo });
  }
}

/** Processa a fila: uma busca por produto, no máximo 1 chamada por segundo, com disjuntor e orçamento de tempo. */
// deno-lint-ignore no-explicit-any
async function processarFila(admin: any, chaveCifra: Chaveiro): Promise<{ lidos: number; aplicados: number; ignorados: number; erros: number; pausado: boolean }> {
  const t0 = Date.now();
  const res = { lidos: 0, aplicados: 0, ignorados: 0, erros: 0, pausado: false };
  const { data } = await admin.rpc("bling_eventos_reservar", { p_limite: 20 });
  const eventos = (Array.isArray(data) ? data : []) as (EventoPendente & { loja_id: string })[];
  res.lidos = eventos.length;
  const porLoja = new Map<string, (EventoPendente & { loja_id: string })[]>();
  for (const e of eventos) (porLoja.get(e.loja_id) ?? porLoja.set(e.loja_id, []).get(e.loja_id)!).push(e);
  let falhasSeguidas = 0;
  for (const [lojaId, lista] of porLoja) {
    const portas = portasDaLoja(admin, lojaId, chaveCifra);
    const porProduto = new Map<string, EventoPendente[]>();
    for (const e of lista) (porProduto.get(e.bling_id) ?? porProduto.set(e.bling_id, []).get(e.bling_id)!).push(e);
    for (const grupo of porProduto.values()) {
      // Disjuntor/orçamento: o que sobrar fica "processando" e volta à fila sozinho em 5 min, sem gastar tentativas.
      if (disjuntorAberto(falhasSeguidas) || Date.now() - t0 > ORCAMENTO_MS) { res.pausado = true; break; }
      // Do mais recente para o mais antigo: o primeiro resultado serve a todos do mesmo produto.
      const ordenado = [...grupo].sort((a, b) => Date.parse(b.versao_origem ?? "") - Date.parse(a.versao_origem ?? ""));
      let primeiro: Resultado;
      try { primeiro = await aplicarEvento(lojaId, ordenado[0], portas); }
      catch { primeiro = { status: "erro", motivo: "falha ao aplicar no espelho", definitivo: ordenado[0].tentativas + 1 >= MAX_TENTATIVAS }; }
      await concluir(admin, ordenado[0], primeiro, Date.now());
      if (primeiro.status === "aplicado") res.aplicados++; else if (primeiro.status === "ignorado") res.ignorados++; else res.erros++;
      for (const outro of ordenado.slice(1)) {
        const r: Resultado = primeiro.status === "erro" ? primeiro : { status: "ignorado", motivo: "coberto por evento mais recente do mesmo produto" };
        await concluir(admin, outro, r, Date.now());
        if (r.status === "ignorado") res.ignorados++; else res.erros++;
      }
      falhasSeguidas = primeiro.status === "erro" ? falhasSeguidas + 1 : 0;
      await new Promise((r) => setTimeout(r, ESPERA_ENTRE_CHAMADAS_MS));
    }
  }
  return res;
}

/** Lojas conectadas sem bling_company_id: lê os dados básicos da empresa (GET, só leitura) e grava o vínculo.
 *  ATENÇÃO: o nome do campo do id da empresa em /empresas/me/dados-basicos NÃO foi conferido no OpenAPI; só aceita `data.id` no formato esperado. */
// deno-lint-ignore no-explicit-any
async function preencherCompanyIds(admin: any, chaveCifra: Chaveiro): Promise<number> {
  const { data } = await admin.from("bling_conexoes").select("loja_id").eq("status", "conectada").is("bling_company_id", null).limit(5);
  const arm = armazemSupabase(admin);
  let n = 0;
  for (const l of (data ?? []) as { loja_id: string }[]) {
    try {
      const r = await blingFetch(arm, l.loja_id, "/empresas/me/dados-basicos", { chaveCifra });
      if (!r.ok) continue;
      const id = (await r.json().catch(() => null))?.data?.id;
      if (typeof id === "string" && /^[A-Za-z0-9]{8,64}$/.test(id)) {
        const { data: ok } = await admin.rpc("bling_registrar_company", { p_loja: l.loja_id, p_company: id });
        if (ok === true) n++;
      }
    } catch { /* tenta de novo no próximo ciclo */ }
    await new Promise((r) => setTimeout(r, ESPERA_ENTRE_CHAMADAS_MS));
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
  if (!chaveCifra) return json({ erro: "Conexão com o Bling ainda não configurada no servidor." }, 503);

  // ---- modo cron ----
  const cron = req.headers.get("x-cron-segredo");
  if (cron) {
    const { data: esperado } = await admin.rpc("bling_cron_segredo");
    if (typeof esperado !== "string" || !esperado || !igual(cron, esperado)) return json({ erro: "Não autorizado." }, 401);
    const vinculos = await preencherCompanyIds(admin, chaveCifra);
    return json({ ok: true, vinculos, ...(await processarFila(admin, chaveCifra)) });
  }

  // ---- modo Bling ----
  const tam = Number(req.headers.get("content-length") ?? "0");
  if (tam > TAMANHO_MAX_CORPO) return json({ erro: "Corpo grande demais." }, 413);
  const corpo = await req.text();
  const lido = lerEvento(corpo);
  if (!lido.ok) return json({ ok: true }); // evento que não tratamos: 2xx para o Bling não reenviar
  const { data: lojaId } = await admin.rpc("loja_por_bling_company", { p_company: lido.evento.companyId });
  if (typeof lojaId !== "string") return json({ ok: true }); // conta desconhecida: resposta uniforme, nada revelado
  const { data: appRows } = await admin.rpc("bling_ler_app", { p_loja_id: lojaId });
  const app = Array.isArray(appRows) ? appRows[0] : appRows;
  let segredo = "";
  try { segredo = app?.client_secret_cifrado ? await decifrar(app.client_secret_cifrado, chaveCifra) : ""; } catch { segredo = ""; }
  if (!(await assinaturaValida(corpo, req.headers.get("x-bling-signature-256"), segredo))) return json({ erro: "Assinatura inválida." }, 401);
  const linha = eventoParaFila(lido.evento);
  if (linha) {
    await admin.rpc("bling_evento_enfileirar", {
      p_loja: lojaId, p_tipo: linha.tipo, p_bling_id: linha.bling_id, p_versao: linha.versao_origem, p_chave: linha.chave_idempotencia, p_payload: linha.payload,
    });
    // Responde já; o processamento continua em segundo plano (a fila e o cron cobrem qualquer falha).
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(processarFila(admin, chaveCifra).catch(() => undefined));
  }
  return json({ ok: true });
});
