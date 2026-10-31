// Assistente do lojista (JWT do usuário). POST { loja_id, acao: "perguntar", texto } ou { loja_id, acao: "decidir", id, decisao: "aprovar"|"rejeitar" }.
// Responde só com dados da própria loja (a RLS decide o acesso). Decidir grava via service role e registra auditoria.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { AJUDA_LOJISTA, intencaoLojista } from "../_shared/intencoes.ts";
import { decifrar } from "../_shared/cripto.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { conversar, IaErro, type Mensagem } from "../_shared/ia/claude.ts";
import { executarFerramenta, FERRAMENTAS, SISTEMA } from "../_shared/ia/ferramentas.ts";
import { dadosSupabase } from "../_shared/conector/dados.ts";
import { BlingLeituraReal } from "../_shared/conector/porta_bling.ts";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import type { PluginRegistro } from "../_shared/ia/plugin.ts";
import { listarProvedores, modeloDaChave, validarProvedor } from "../_shared/assistente/provedores.ts";
import { MSG_SO_LOJISTA, podeDecidir } from "../_shared/assistente/permissao.ts";

import { conteudoComAnexos, REGRAS_ANEXO, validarAnexos } from "../_shared/assistente/anexos.ts";
import { atenderChat } from "../_shared/assistente/chat.ts";
import { pesquisarWebPublica, validarConsultaPublica } from "../_shared/assistente/pesquisa_web.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Não autenticado." }, 401);
  const corpo = await req.json().catch(() => ({}));
  const c = corpo && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : {};
  const lojaId = typeof c?.loja_id === "string" ? c.loja_id : "";
  const { data: loja } = await usuario.from("lojas").select("id, nome").eq("id", lojaId).maybeSingle();
  if (!loja) return json({ erro: "Loja não encontrada." }, 404);

  if (typeof c.acao === "string" && c.acao.startsWith("chat_")) {
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    try {
      const r = await atenderChat(c, { usuario, admin, loja, userId: u.user.id, get: (n) => Deno.env.get(n) });
      return json(r.corpo, r.status);
    } catch { return json({ erro: "Chat indisponível; nenhuma resposta foi confirmada." }, 503); }
  }

  // Só metadados da loja visível ao JWT. Nenhum cofre, decriptação, teste de chave ou chamada ao provedor.
  if (c.acao === "provedores") {
    const { data, error } = await usuario.from("loja_chaves_ia")
      .select("provedor, ativa, principal, modelo, base_url, limite_mensal_tokens, tokens_mes, mes_ref").eq("loja_id", loja.id);
    return json({ provedores: listarProvedores(data ?? [], !!error), verificado: !error });
  }

  // Preparação de enriquecimento: grava SOMENTE proposta a confirmar no Conecta.IA, nunca no Bling.
  // A pesquisa e a fonte são escolhidas pelo operador; proposta não equivale à verificação documental.
  if (c.acao === "propor_enriquecimento_web") {
    const uuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
    const campo = c.campo === "descricao_curta" || c.campo === "descricao_longa" ? c.campo : "";
    const valor = typeof c.valor === "string" ? c.valor.trim() : "";
    const fonte = typeof c.fonte === "string" ? c.fonte.trim() : "";
    let origem: URL | null = null; try { origem = new URL(fonte); } catch { /* inválida */ }
    if (!uuid(c.produto_id) || !campo || valor.length < 25 || valor.length > (campo === "descricao_curta" ? 320 : 3000)
      || !origem || origem.protocol !== "https:" || origem.username || origem.password
      || origem.port || origem.hostname === "localhost" || origem.hostname.endsWith(".local")
      || /^(?:127\\.|10\\.|192\\.168\\.|169\\.254\\.)/.test(origem.hostname))
      return json({ erro: "Produto, descrição ou URL pública da fonte inválidos." }, 400);
    if (/(?:\\b(?:senha|token|cpf|cnpj|api key|conta bancária)\\b|R\\$\\s*\\d)/i.test(valor))
      return json({ erro: "Não inclua credenciais, dados pessoais ou preços na descrição." }, 400);
    const { data: produto, error: pe } = await usuario.from("produtos").select("id").eq("loja_id", loja.id).eq("id", c.produto_id).maybeSingle();
    if (pe || !produto) return json({ erro: "Produto não encontrado ou sem acesso nesta loja." }, 404);
    const sbProposta = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: pendente, error: pErro } = await sbProposta.from("produto_enriquecimento")
      .select("id").eq("loja_id", loja.id).eq("produto_id", produto.id).eq("campo", campo).eq("status", "a_confirmar").limit(1);
    if (pErro) return json({ erro: "Não foi possível verificar propostas existentes." }, 503);
    if (pendente?.length) return json({ erro: "Já existe proposta pendente para esse campo; revise-a na Fila de aprovação." }, 409);
    const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode([loja.id,produto.id,campo,valor,origem.href].join("|")));
    const hash = Array.from(new Uint8Array(hashBytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const { data: proposta, error: e } = await sbProposta.from("produto_enriquecimento")
      .insert({ loja_id:loja.id, produto_id:produto.id, campo, valor, fonte:origem.href, coletado_em:new Date().toISOString(),
        hash_origem:hash, status:"a_confirmar" }).select("id").single();
    if (e || !proposta) return json({ erro: "Não foi possível registrar a proposta." }, 503);
    await sbProposta.from("auditoria").insert({ loja_id:loja.id, user_id:u.user.id, acao:"enriquecimento.proposta_web",
      tabela:"produto_enriquecimento", depois:{ id:proposta.id, produto_id:produto.id, campo, origem:origem.hostname } });
    return json({ proposta_id:proposta.id, status:"a_confirmar", gravou_bling:false });
  }

  // Aprovar/rejeitar muda dado que vai ao site: só quem ADMINISTRA a loja (lojista), nunca o editor. Conversar e consultar seguem abertos.
  if ((c.acao === "decidir" || c.acao === "decidir_imagem") && !(await podeDecidir(usuario, loja.id))) return json({ erro: MSG_SO_LOJISTA }, 403);

  if (c.acao === "decidir") {
    const id = typeof c.id === "string" ? c.id : "";
    const decisao = c.decisao === "aprovar" ? "aprovado" : c.decisao === "rejeitar" ? "rejeitado" : "";
    if (!id || !decisao) return json({ erro: "Informe id e decisao (aprovar ou rejeitar)." }, 400);
    const { data: item } = await usuario.from("produto_enriquecimento").select("id, loja_id, campo, status, fonte, coletado_em").eq("id", id).eq("loja_id", loja.id).maybeSingle();
    if (!item) return json({ erro: "Item não encontrado." }, 404);
    if (item.status !== "a_confirmar") return json({ erro: "Este item já foi decidido." }, 409);
    if (decisao === "aprovado" && (!item.fonte || !item.coletado_em)) return json({ erro: "Sem fonte e data, o item não pode ser aprovado." }, 422);
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { error } = await sb.from("produto_enriquecimento").update({ status: decisao }).eq("id", id).eq("loja_id", loja.id).eq("status", "a_confirmar");
    if (error) return json({ erro: "Não foi possível registrar a decisão." }, 500);
    await sb.from("auditoria").insert({ loja_id: loja.id, user_id: u.user.id, acao: `enriquecimento.${decisao}`, tabela: "produto_enriquecimento", antes: { status: "a_confirmar", campo: item.campo }, depois: { status: decisao } });
    return json({ ok: true, status: decisao });
  }


  if (c.acao === "decidir_imagem") {
    const id = typeof c.id === "string" ? c.id : "";
    const decisao = c.decisao === "aprovar" ? "aprovar" : c.decisao === "rejeitar" ? "rejeitar" : "";
    if (!id || !decisao) return json({ erro: "Informe id e decisao (aprovar ou rejeitar)." }, 400);
    const sb2 = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { error } = await sb2.rpc("imagem_decidir", { p_loja: loja.id, p_imagem: id, p_decisao: decisao });
    if (error) return json({ erro: "Não foi possível registrar a decisão (a imagem já pode ter sido decidida)." }, 409);
    await sb2.from("auditoria").insert({ loja_id: loja.id, user_id: u.user.id, acao: `imagem.${decisao === "aprovar" ? "aprovada" : "rejeitada"}`, tabela: "produto_imagens", depois: { id } });
    return json({ ok: true });
  }

  const entradaTexto = c.acao === "pesquisar_web" ? c.consulta : c?.texto;
  const texto = typeof entradaTexto === "string" ? entradaTexto.slice(0, 1000) : "";
  if (!texto.trim()) return json({ erro: "Escreva sua pergunta." }, 400);

  // Com chave de IA configurada: chat de verdade com ferramentas. Sem chave: respostas por palavras-chave (abaixo).
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let provedor;
  try { provedor = validarProvedor(c.acao === "pesquisar_web" ? "gemini" : c.provedor); }
  catch { return json({ erro: "Provedor inválido.", codigo: "provedor_invalido" }, 400); }
  const { data: kRows, error: erroChave } = c.sem_ia === true
    ? { data: null, error: null }
    : await sb.rpc("ia_chave_ativa", { p_loja: loja.id, ...(provedor ? { p_provedor: provedor } : {}) });
  const k = (kRows as { provedor: "claude" | "gemini" | "compativel_openai"; cifrada: string; modelo: string | null; limite: number | null; tokens_mes: number; base_url: string | null }[] | null)?.[0];
  if (erroChave) return json({ erro: "Não foi possível consultar a configuração de IA.", codigo: "provedor_indisponivel" }, 503);
  if (provedor && (!k || k.provedor !== provedor)) return json({ erro: "Este provedor não está configurado. Escolha outro em Integrações de IA.", codigo: "provedor_nao_configurado" }, 409);
  if (k && !modeloDaChave(k)) return json({ erro: "Configure o modelo em Integrações de IA.", codigo: "provedor_indisponivel" }, 409);
  const chaveiro = k ? await chaveiroPlataforma(sb, (n) => Deno.env.get(n)) : undefined;
  if (k && !chaveiro) return json({ erro: "O provedor está indisponível na configuração do servidor.", codigo: "provedor_indisponivel" }, 503);
  // Pesquisa pública fundamentada, separada do chat e das ferramentas do Bling.
  // Apenas consulta técnica digitada pelo operador; nenhum histórico, custo ou cadastro é enviado.
  if (c.acao === "pesquisar_web") {
    if (!k || k.provedor !== "gemini" || !chaveiro) return json({ erro: "Configure um modelo Gemini ativo em Integrações de IA." }, 409);
    if (c.consentimento_web !== true) return json({ erro: "Confirme o envio da referência técnica pública ao Google." }, 403);
    let consulta: string;
    try { consulta = validarConsultaPublica(texto); }
    catch (e) { return json({ erro: e instanceof IaErro ? e.message : "Consulta inválida." }, 400); }
    if (k.limite != null && k.tokens_mes >= k.limite) return json({ erro: "Limite mensal de IA atingido." }, 429);
    try {
      const r = await pesquisarWebPublica(await decifrar(k.cifrada, chaveiro), modeloDaChave(k), consulta);
      await sb.rpc("ia_registrar_uso", { p_loja: loja.id, p_provedor: "gemini", p_tokens: r.tokens });
      await sb.from("auditoria").insert({ loja_id: loja.id, user_id: u.user.id, acao: "assistente.pesquisa_web", tabela: "ia", depois: { provedor: "gemini", modelo: modeloDaChave(k), tokens: r.tokens, fontes: r.fontes.length, fundamentada: r.fundamentada } });
      return json({ ...r, modelo: modeloDaChave(k), gravou_bling: false, modo: "web_publica" });
    } catch (e) {
      return json({ erro: e instanceof IaErro ? e.message : "Não foi possível pesquisar no Google.", codigo: "pesquisa_indisponivel" }, e instanceof IaErro ? e.status : 502);
    }
  }

  if (c.anexos != null && !(k && chaveiro)) return json({ erro: "Anexos exigem um provedor de IA configurado.", codigo: "anexo_sem_provedor" }, 409);
  if (k && chaveiro) {
    const va = c.anexos != null ? await validarAnexos(c.anexos, k.provedor) : null;
    if (va && !va.ok) return json({ erro: va.erro, codigo: "anexo_invalido" }, 400);
    if (k.limite != null && k.tokens_mes >= k.limite) return json({ erro: "O limite mensal deste provedor foi atingido. Ajuste em Integrações de IA ou escolha outro provedor.", codigo: "limite_ia" }, 429);
    const { data: plugs } = await usuario.from("loja_plugins").select("id, nome, tipo, url, capacidades, risco, ativo").eq("loja_id", loja.id);
    const { data: biRows } = await sb.rpc("busca_imagem_ler", { p_loja: loja.id });
    const bi = (biRows as { api_key_cifrada: string; cx: string }[] | null)?.[0];
    const buscaImagem = bi ? { chave: await decifrar(bi.api_key_cifrada, chaveiro), cx: bi.cx } : null;
    const historico: Mensagem[] = (Array.isArray(c.historico) ? c.historico : []).slice(-10)
      .filter((m: any) => m && (m.de === "eu" || m.de === "ia") && typeof m.texto === "string")
      .map((m: any): Mensagem => ({ role: m.de === "eu" ? "user" : "assistant", content: m.texto.slice(0, 2000) }));
    while (historico.length && historico[0].role !== "user") historico.shift();
    const mensagens: Mensagem[] = [];
    for (const m of [...historico, { role: "user", content: va?.ok ? conteudoComAnexos(texto, va.anexos) : texto } as Mensagem]) { // a API exige alternância user/assistant
      if (mensagens.length && mensagens[mensagens.length - 1].role === m.role) mensagens.pop();
      mensagens.push(m);
    }
    // Motor de propostas do Bling (só leitura do Bling + criação de proposta; nunca grava no Bling aqui).
    const bling = new BlingLeituraReal(armazemSupabase(sb), loja.id, { chaveCifra: chaveiro });
    const conector = { origem: "chat" as const, lojaId: loja.id, userId: u.user.id, dados: dadosSupabase(sb, loja.id), rpc: (fn: string, args: Record<string, unknown>) => sb.rpc(fn, args), admin: sb, bling, agente: { nome: "Nano.ia", provedor: k.provedor, modelo: modeloDaChave(k) } };
    try {
      const r = await conversar({
        provedor: k.provedor, baseUrl: k.base_url ?? undefined, chave: await decifrar(k.cifrada, chaveiro), modelo: modeloDaChave(k), sistema: `${SISTEMA}\nLoja: ${loja.nome}.${va?.ok && va.anexos.length ? `\n${REGRAS_ANEXO}` : ""}`, mensagens, ferramentas: FERRAMENTAS,
        executar: (nome, entrada) => executarFerramenta(nome, entrada, {
          usuario, admin: sb, lojaId: loja.id, plugins: (plugs ?? []) as PluginRegistro[], buscaImagem, conector,
          credencial: async (pid) => { const { data } = await sb.rpc("plugin_credencial", { p_loja: loja.id, p_id: pid }); return typeof data === "string" ? await decifrar(data, chaveiro) : null; },
        }),
      });
      await sb.rpc("ia_registrar_uso", { p_loja: loja.id, p_provedor: k.provedor, p_tokens: r.tokens });
      await sb.from("auditoria").insert({ loja_id: loja.id, user_id: u.user.id, acao: "assistente.consulta", tabela: "ia", depois: { provedor: k.provedor, modelo: modeloDaChave(k), tokens: r.tokens, passos: r.passos, ferramentas: r.ferramentasUsadas } });
      return json({ resposta: r.texto || "Não encontrei uma resposta. Pode reformular?", ia: true, provedor: k.provedor, modelo: modeloDaChave(k) });
    } catch (e) {
      return json({ erro: e instanceof IaErro ? e.message : "Não consegui responder agora.", codigo: "provedor_indisponivel", provedor: k.provedor }, e instanceof IaErro && [429, 502, 504].includes(e.status) ? e.status : 502);
    }
  }
  const q = (t: string, f?: (b: any) => any) => { const b = usuario.from(t).select("id", { count: "exact", head: true }).eq("loja_id", loja.id); return f ? f(b) : b; };
  switch (intencaoLojista(texto)) {
    case "resumo": {
      const [p, pend, pub] = await Promise.all([q("produtos"), q("produto_enriquecimento", (b) => b.eq("status", "a_confirmar")), q("produtos", (b) => b.eq("publicado", true))]);
      return json({ resposta: `${loja.nome}: ${p.count ?? 0} produtos espelhados, ${pub.count ?? 0} publicados, ${pend.count ?? 0} itens aguardando sua aprovação.` });
    }
    case "pendentes": {
      const { count } = await q("produto_enriquecimento", (b) => b.eq("status", "a_confirmar"));
      return json({ resposta: count ? `Há ${count} itens aguardando aprovação. Abra "Fila de aprovação" para aprovar ou rejeitar um a um.` : "Nada pendente de aprovação." });
    }
    case "incompletos": {
      const { data } = await usuario.from("produtos").select("nome, sku, preco").eq("loja_id", loja.id).eq("publicado", false).limit(10);
      const sem = (data ?? []).filter((p: any) => !p.sku || !p.preco).length;
      return json({ resposta: `${(data ?? []).length} produtos ainda não publicados (mostrando até 10); ${sem} deles sem SKU ou preço. Produto incompleto não é publicado.` });
    }
    case "taxonomia": {
      const { count } = await usuario.from("taxonomia_nos").select("id", { count: "exact", head: true });
      return json({ resposta: `A taxonomia de autopeças tem ${count ?? 0} nós. Veja a árvore em "Taxonomia". Nós novos só entram como propostos, até você aprovar.` });
    }
    case "bling": {
      const { data } = await usuario.from("bling_conexoes").select("status, ultimo_erro").eq("loja_id", loja.id).maybeSingle();
      return json({ resposta: `Conexão com o Bling: ${data?.status ?? "pendente"}.${data?.ultimo_erro ? ` Último erro: ${data.ultimo_erro}` : ""}` });
    }
    default: return json({ resposta: AJUDA_LOJISTA });
  }
});

