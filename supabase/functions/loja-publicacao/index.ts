// Fases da loja: teste ou producao. Usa campo existente lojas.ambiente; sem novas tabelas.
// Revalida direitos de lojista, pre-requisitos e confirmacao no servidor.
import { createClient } from "npm:@supabase/supabase-js@2";
import { diagnosticarLancamento, prontoParaOnline, type DadosDeLancamento, type ModoLoja } from "../_shared/loja/publicacao.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const authorization = req.headers.get("Authorization") ?? "";
  if (!/^Bearer \S+$/.test(authorization)) return json({ erro: "Autenticação necessária." }, 401);
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > 3000) return json({ erro: "Requisição inválida." }, 400);
  let corpo: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ erro: "Dados inválidos." }, 400);
    corpo = parsed as Record<string, unknown>;
  } catch { return json({ erro: "JSON inválido." }, 400); }
  const lojaId = typeof corpo.loja_id === "string" && UUID.test(corpo.loja_id) ? corpo.loja_id : "";
  if (!lojaId || (corpo.acao !== "consultar" && corpo.acao !== "mudar"))
    return json({ erro: "Parâmetros inválidos." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: u, error: erroUser } = await usuario.auth.getUser();
  if (erroUser || !u.user) return json({ erro: "Sessão inválida." }, 401);
  const { data: adm, error: erroAdm } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
  if (erroAdm || adm !== true) return json({ erro: "Somente o responsável autorizado pode controlar a publicação." }, 403);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const [l, pol, doms, produtos] = await Promise.all([
    sb.from("lojas").select("id,nome,slug,ambiente,ativa,whatsapp,modo_venda").eq("id", lojaId).maybeSingle(),
    sb.from("loja_politicas").select("status").eq("loja_id", lojaId).maybeSingle(),
    sb.from("loja_dominios").select("dominio,principal,dns_verificado_em,ssl_verificado_em").eq("loja_id", lojaId),
    sb.from("produtos").select("id", { count:"exact", head:true }).eq("loja_id", lojaId).eq("publicado",true),
  ]);
  if (l.error || pol.error || doms.error || produtos.error)
    return json({ erro: "Não foi possível verificar todos os requisitos. Nenhuma mudança feita." }, 503);
  if (!l.data) return json({ erro: "Loja não encontrada." }, 404);
  const loja = l.data;
  const dom = (doms.data ?? []).find((d) => d.principal === true && d.dns_verificado_em && d.ssl_verificado_em) ?? null;
  const dados: DadosDeLancamento = {
    slug: loja.slug,
    ativa: loja.ativa === true,
    politicasAprovadas: pol.data?.status === "aprovada",
    dominioPrincipal: dom?.dominio ?? null,
    dominioVerificado: !!dom,
    produtosPublicados: produtos.count ?? 0,
    modoVenda: loja.modo_venda,
    whatsapp: loja.whatsapp,
  };
  const checks = diagnosticarLancamento(dados);
  const pronto = prontoParaOnline(checks);
  const resposta = () => ({
    loja: { nome: loja.nome, slug: loja.slug, ambiente: loja.ambiente, dominio_online: dom?.dominio ?? null },
    pronto_online: pronto, checks,
  });
  if (corpo.acao === "consultar") return json(resposta());

  const alvo: ModoLoja | null = corpo.fase === "teste" || corpo.fase === "producao" ? corpo.fase : null;
  if (!alvo) return json({ erro: "Selecione Loja teste ou Loja publicada online." }, 400);
  if (alvo === loja.ambiente) return json({ ...resposta(), mensagem: "A loja já está nesta fase." });
  const confirmado = alvo === "producao" ? "PUBLICAR" : "VOLTAR PARA TESTE";
  if (corpo.confirmacao !== confirmado) return json({ erro: "Confirmação explícita obrigatória." }, 422);
  if (alvo === "producao") {
    if (!pronto) return json({ erro: "Publicação bloqueada. Corrija os itens pendentes.", ...resposta() }, 422);
    if (corpo.backup_conferido !== true || corpo.teste_concluido !== true)
      return json({ erro: "Confirme o backup e o teste com clientes antes de publicar." }, 422);
  }

  const chaveLimite = "loja-publicacao:" + lojaId + ":" + u.user.id;
  const { data: permitido, error: erroLimite } = await sb.rpc("limite_chamada", { p_chave:chaveLimite, p_max:8, p_janela_s:3600 });
  if (erroLimite || permitido !== true) return json({ erro: "Limite de alterações atingido. Não houve mudança." }, 429);
  const { data: alterada, error: erroSalvar } = await sb.from("lojas").update({ ambiente: alvo })
    .eq("id", lojaId).eq("ambiente", loja.ambiente).select("ambiente").maybeSingle();
  if (erroSalvar) return json({ erro: "A alteração foi recusada. Refaça o diagnóstico." }, 422);
  if (!alterada) return json({ erro: "A fase mudou em outra sessão. Atualize a página." }, 409);

  await sb.from("auditoria").insert({
    loja_id: lojaId, user_id: u.user.id, acao:"loja.ambiente_alterado", tabela:"lojas",
    depois:{ de:loja.ambiente, para:alvo, backup_confirmado:corpo.backup_conferido===true, teste_clientes_confirmado:corpo.teste_concluido===true },
  });
  return json({
    ...resposta(),
    loja: { ...resposta().loja, ambiente:alterada.ambiente },
    mensagem: alvo === "teste" ? "Loja devolvida à fase de teste." : "Modo online ativado no cadastro. A hospedagem e o domínio exigem implantação e verificação separadas.",
  });
});
