// Aparência da loja pública (cores, fonte, logo e ícone). POST { loja_id, acao, ... } com o login de quem ADMINISTRA a loja.
// O servidor valida contraste AA e o tipo REAL da imagem (PNG/WebP/JPEG, até 512 KB; SVG recusado). Toda mudança vai para a auditoria.
import { createClient } from "npm:@supabase/supabase-js@2";
import { FONTES, LIMITE_IMAGEM_BYTES, MIME, PERFIS, tipoImagem, validarCores, type Fonte } from "../_shared/loja/tema.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);
  const c = await req.json().catch(() => ({}));
  const lojaId = typeof c?.loja_id === "string" ? c.loja_id : "";
  const { data: adm } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
  if (adm !== true) return json({ erro: "Só o responsável da loja pode alterar a aparência." }, 403);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: dentro } = await sb.rpc("limite_chamada", { p_chave: `loja-tema:${lojaId}:${u.user.id}`, p_max: 30, p_janela_s: 3600 });
  if (dentro !== true) return json({ erro: "Muitas alterações seguidas. Aguarde um pouco." }, 429);
  const auditar = (acao: string, depois: Record<string, unknown>) => sb.from("auditoria").insert({ loja_id: lojaId, user_id: u.user.id, acao, tabela: "loja_tema", depois });

  if (c.acao === "salvar") {
    const perfil = texto(c.perfil, 30);
    const fonte = texto(c.fonte, 20) as Fonte;
    if (!FONTES.includes(fonte)) return json({ erro: "Fonte não permitida." }, 400);
    let cores;
    if (perfil in PERFIS) cores = { primaria: PERFIS[perfil].primaria, destaque: PERFIS[perfil].destaque, bloco: PERFIS[perfil].bloco };
    else if (perfil === "personalizado") {
      const v = validarCores({ primaria: texto(c.primaria, 7), destaque: texto(c.destaque, 7), bloco: texto(c.bloco, 7) });
      if (!v.ok) return json({ erro: v.erro }, 422);
      cores = v.cores;
    } else return json({ erro: "Perfil inválido." }, 400);
    const { error } = await sb.rpc("tema_salvar", { p_loja: lojaId, p_perfil: perfil, p_primaria: cores.primaria, p_destaque: cores.destaque, p_bloco: cores.bloco, p_fonte: fonte });
    if (error) return json({ erro: "Não foi possível salvar o tema." }, 500);
    await auditar("tema.salvo", { perfil, fonte, ...cores });
    return json({ ok: true });
  }

  if (c.acao === "enviar_imagem") {
    const tipo = c.tipo === "logo" || c.tipo === "icone" ? c.tipo : "";
    if (!tipo) return json({ erro: "Tipo de imagem inválido." }, 400);
    const b64 = typeof c.dados === "string" ? c.dados.replace(/^data:[^,]*,/, "") : "";
    if (!b64 || b64.length > Math.ceil(LIMITE_IMAGEM_BYTES * 4 / 3) + 8) return json({ erro: "Imagem vazia ou maior que 512 KB." }, 413);
    let bytes: Uint8Array<ArrayBuffer>;
    try { bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); } catch { return json({ erro: "Imagem inválida." }, 400); }
    if (bytes.length > LIMITE_IMAGEM_BYTES) return json({ erro: "A imagem tem mais de 512 KB." }, 413);
    const t = tipoImagem(bytes);
    if (!t) return json({ erro: "Use PNG, WebP ou JPEG (SVG não é aceito)." }, 415);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).slice(0, 6).map((x) => x.toString(16).padStart(2, "0")).join("");
    const caminho = `${lojaId}/${tipo}-${hash}.${t === "jpeg" ? "jpg" : t}`;
    const { error: e1 } = await sb.storage.from("lojas-marca").upload(caminho, bytes, { contentType: MIME[t], upsert: true, cacheControl: "31536000" });
    if (e1) return json({ erro: "Não foi possível guardar a imagem." }, 500);
    const publica = `${url}/storage/v1/object/public/lojas-marca/${caminho}`;
    const { error: e2 } = await sb.rpc("tema_definir_imagem", { p_loja: lojaId, p_tipo: tipo, p_url: publica });
    if (e2) return json({ erro: "Não foi possível salvar a imagem no tema." }, 500);
    await auditar("tema.imagem_enviada", { tipo, formato: t, bytes: bytes.length });
    return json({ ok: true, url: publica });
  }

  if (c.acao === "remover_imagem") {
    const tipo = c.tipo === "logo" || c.tipo === "icone" ? c.tipo : "";
    if (!tipo) return json({ erro: "Tipo de imagem inválido." }, 400);
    await sb.rpc("tema_definir_imagem", { p_loja: lojaId, p_tipo: tipo, p_url: null });
    await auditar("tema.imagem_removida", { tipo });
    return json({ ok: true });
  }
  return json({ erro: "Ação desconhecida." }, 400);
});
