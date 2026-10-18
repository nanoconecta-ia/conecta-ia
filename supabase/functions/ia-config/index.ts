// Configuração das integrações de IA da loja (chave do provedor e plugins). POST { loja_id, acao, ... } com o login de quem
// ADMINISTRA a loja. Chaves e credenciais são cifradas no servidor e nunca voltam ao navegador. Toda mudança vai para a auditoria.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cifrar, decifrar } from "../_shared/cripto.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { conversar, IaErro } from "../_shared/ia/claude.ts";
import { testarPlugin, urlPublicaSegura, type PluginRegistro } from "../_shared/ia/plugin.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const CAPACIDADES = ["consultar_bling", "enriquecer", "imagem", "taxonomia", "consultar_catalogo", "buscar_web"];
const TIPOS = ["mcp", "api", "llm", "plugin_pull"];
const RISCOS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const MODELO_PADRAO = "claude-sonnet-5-5";

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
  if (adm !== true) return json({ erro: "Só o responsável da loja pode alterar as integrações de IA." }, 403);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: dentro } = await sb.rpc("limite_chamada", { p_chave: `ia-config:${lojaId}:${u.user.id}`, p_max: 40, p_janela_s: 3600 });
  if (dentro !== true) return json({ erro: "Muitas alterações seguidas. Aguarde um pouco." }, 429);
  const chaveiro = await chaveiroPlataforma(sb, (n) => Deno.env.get(n));
  if (!chaveiro) return json({ erro: "O servidor ainda não está pronto para guardar credenciais." }, 503);
  const auditar = (acao: string, depois: Record<string, unknown>) =>
    sb.from("auditoria").insert({ loja_id: lojaId, user_id: u.user.id, acao, tabela: "ia", depois });
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  switch (c.acao) {
    case "salvar_chave": {
      const chave = texto(c.chave, 400);
      const modelo = texto(c.modelo, 60) || MODELO_PADRAO;
      const limite = c.limite_mensal_tokens == null || c.limite_mensal_tokens === "" ? null : Number(c.limite_mensal_tokens);
      if (c.provedor !== "claude") return json({ erro: "Por enquanto só o provedor Claude está habilitado." }, 400);
      if (chave.length < 20 || /\s/.test(chave)) return json({ erro: "Confira a chave copiada (sem espaços)." }, 400);
      if (!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(modelo)) return json({ erro: "Nome de modelo inválido." }, 400);
      if (limite !== null && (!Number.isInteger(limite) || limite < 1000)) return json({ erro: "O limite mensal deve ser um número de tokens (mínimo 1000) ou ficar vazio." }, 400);
      const { error } = await sb.rpc("ia_salvar_chave", { p_loja: lojaId, p_provedor: "claude", p_cifrada: await cifrar(chave, chaveiro), p_final: chave.slice(-4), p_modelo: modelo, p_limite: limite });
      if (error) return json({ erro: "Não foi possível salvar a chave." }, 500);
      await auditar("ia.chave_salva", { provedor: "claude", final: chave.slice(-4), modelo, limite });
      return json({ ok: true });
    }
    case "testar_chave": {
      const { data } = await sb.rpc("ia_ler_chave", { p_loja: lojaId, p_provedor: "claude" });
      const k = (data as { cifrada: string; modelo: string }[] | null)?.[0];
      if (!k) return json({ erro: "Nenhuma chave ativa. Salve a chave primeiro." }, 409);
      try {
        const r = await conversar({ chave: await decifrar(k.cifrada, chaveiro), modelo: k.modelo ?? MODELO_PADRAO, sistema: "Responda apenas: ok", mensagens: [{ role: "user", content: "ping" }], ferramentas: [], executar: async () => null, maxTokens: 8 });
        await sb.rpc("ia_registrar_uso", { p_loja: lojaId, p_provedor: "claude", p_tokens: r.tokens });
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, erro: e instanceof IaErro ? e.message : "Não foi possível testar a chave." });
      }
    }
    case "remover_chave": {
      await sb.rpc("ia_desativar_chave", { p_loja: lojaId, p_provedor: "claude" });
      await auditar("ia.chave_removida", { provedor: "claude" });
      return json({ ok: true });
    }
    case "salvar_plugin": {
      const nome = texto(c.nome, 60), tipo = texto(c.tipo, 20), risco = texto(c.risco, 10) || "LOW";
      const endereco = texto(c.url, 300), credencial = texto(c.credencial, 600);
      const caps = Array.isArray(c.capacidades) ? c.capacidades.filter((x: unknown) => typeof x === "string") : [];
      if (nome.length < 2) return json({ erro: "Informe o nome do plugin." }, 400);
      if (!TIPOS.includes(tipo)) return json({ erro: "Tipo inválido." }, 400);
      if (!RISCOS.includes(risco)) return json({ erro: "Risco inválido." }, 400);
      if (caps.some((x: string) => !CAPACIDADES.includes(x))) return json({ erro: "Capacidade não reconhecida." }, 400);
      if ((tipo === "api" || endereco) && !urlPublicaSegura(endereco)) return json({ erro: "Use um endereço https público, sem porta, usuário nem parâmetros (?...)." }, 400);
      const { data: id, error } = await sb.rpc("plugin_salvar", { p_loja: lojaId, p_nome: nome, p_tipo: tipo, p_url: endereco || null, p_cifrada: credencial ? await cifrar(credencial, chaveiro) : null, p_capacidades: caps, p_risco: risco });
      if (error) return json({ erro: "Não foi possível salvar o plugin (nome repetido?)." }, 409);
      await auditar("ia.plugin_salvo", { plugin_id: id, nome, tipo, risco, capacidades: caps });
      return json({ ok: true, id });
    }
    case "testar_plugin":
    case "ativar_plugin":
    case "desativar_plugin":
    case "remover_plugin": {
      const id = texto(c.id, 40);
      const { data: p } = await usuario.from("loja_plugins").select("id, nome, tipo, url, capacidades, risco, ativo, ultimo_teste_ok").eq("id", id).eq("loja_id", lojaId).maybeSingle();
      if (!p) return json({ erro: "Plugin não encontrado." }, 404);
      if (c.acao === "remover_plugin") { await sb.rpc("plugin_remover", { p_loja: lojaId, p_id: id }); await auditar("ia.plugin_removido", { plugin_id: id, nome: p.nome }); return json({ ok: true }); }
      if (c.acao === "desativar_plugin") { await sb.rpc("plugin_definir_ativo", { p_loja: lojaId, p_id: id, p_ativo: false }); await auditar("ia.plugin_desativado", { plugin_id: id }); return json({ ok: true }); }
      if (c.acao === "ativar_plugin") {
        if (p.tipo === "api" && p.ultimo_teste_ok !== true) return json({ erro: "Teste a conexão do plugin antes de ativar." }, 409);
        await sb.rpc("plugin_definir_ativo", { p_loja: lojaId, p_id: id, p_ativo: true });
        await auditar("ia.plugin_ativado", { plugin_id: id, nome: p.nome, risco: p.risco });
        return json({ ok: true });
      }
      const { data: cred } = await sb.rpc("plugin_credencial", { p_loja: lojaId, p_id: id });
      const r = await testarPlugin(p as PluginRegistro, typeof cred === "string" ? await decifrar(cred, chaveiro) : null);
      await sb.rpc("plugin_marcar_teste", { p_loja: lojaId, p_id: id, p_ok: r.ok });
      return json(r);
    }
    default: return json({ erro: "Ação desconhecida." }, 400);
  }
});
