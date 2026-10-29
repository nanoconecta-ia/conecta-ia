// Assistente da página do produto (público, verify_jwt = false). POST { slug, sku, pergunta }.
// Só lê produto PUBLICADO de loja ATIVA e só fatos APROVADOS. Sem confirmação => diz que não tem e leva ao WhatsApp.
// Não menciona provedor de IA. Limites de tamanho na entrada.
import { createClient } from "npm:@supabase/supabase-js@2";
import { intencaoCliente, responderCliente } from "../_shared/intencoes.ts";
import { cabecalhoIpConfigurado, guardarPublico, portaViaRpc, segredoDoLimite } from "../_shared/limite/publico.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // limite de requisições ANTES de qualquer consulta: IP (rajada e sustentado) + teto por loja; corpo pequeno
  const g = await guardarPublico({
    endpoint: "vitrine-assistente", req, segredo: segredoDoLimite(Deno.env), cabecalhoIp: cabecalhoIpConfigurado(Deno.env.get("LIMITE_CABECALHO_IP")),
    lojaDe: (b) => (typeof b?.slug === "string" ? b.slug.slice(0, 80) : null),
    porta: portaViaRpc(sb), aoFalhar: (m) => console.warn("limite-publico", m),
    modo: Deno.env.get("LIMITE_MODO") === "bloquear" ? "bloquear" : "observar",
    aoObservar: (camada, negaria) => { if (negaria) console.info("limite-publico", JSON.stringify({ endpoint: "vitrine-assistente", camada, decisao: "negaria" })); },
  });
  if (!g.ok) return new Response(JSON.stringify(g.corpo), { status: g.status, headers: { ...CORS, "Content-Type": "application/json", ...g.cabecalhos } });
  const c = g.corpo;
  const slug = typeof c?.slug === "string" ? c.slug.slice(0, 80) : "";
  const sku = typeof c?.sku === "string" ? c.sku.slice(0, 80) : "";
  const pergunta = typeof c?.pergunta === "string" ? c.pergunta.slice(0, 300) : "";
  if (!slug || !sku) return json({ erro: "Informe slug e sku." }, 400);
  const { data: loja } = await sb.from("lojas").select("id, nome, whatsapp, ativa").eq("slug", slug).maybeSingle();
  if (!loja || loja.ativa === false) return json({ resposta: "Loja não encontrada." }, 404);
  const { data: p } = await sb.from("produtos").select("id, nome, sku, preco, estoque").eq("loja_id", loja.id).eq("sku", sku).eq("publicado", true).maybeSingle();
  if (!p) return json({ resposta: "Não encontrei este produto no catálogo publicado." }, 404);

  const [enr, cods, apls] = await Promise.all([
    sb.from("produto_enriquecimento").select("campo, valor").eq("produto_id", p.id).eq("status", "aprovado"),
    sb.from("produto_codigos").select("tipo, valor").eq("produto_id", p.id).eq("status", "aprovado"),
    sb.from("produto_aplicacoes").select("modelo, motorizacao, ano_inicial, ano_final").eq("produto_id", p.id).eq("status", "aprovado"),
  ]);
  const marca = (enr.data ?? []).find((r: any) => r.campo === "marca_peca")?.valor;
  const wa = loja.whatsapp ? `https://wa.me/${String(loja.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Tenho interesse em ${p.nome} (cód. ${p.sku}).`)}` : null;
  const resposta = responderCliente(intencaoCliente(pergunta), {
    nome: p.nome, sku: p.sku, preco: p.preco == null ? null : Number(p.preco), estoque: p.estoque == null ? null : Number(p.estoque),
    marca_peca: typeof marca === "string" ? marca : null,
    aplicacoes: (apls.data ?? []).map((a: any) => [a.modelo, a.motorizacao, a.ano_inicial && `${a.ano_inicial}${a.ano_final ? `–${a.ano_final}` : "+"}`].filter(Boolean).join(" ")),
    codigos: (cods.data ?? []).map((k: any) => `${k.tipo}: ${k.valor}`),
  }, wa);
  return json({ resposta });
});
