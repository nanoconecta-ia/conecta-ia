// Nano/Conecta.IA: prévia de enriquecimento de 1-100 selecionados ou todos os ATIVOS.
// JWT de administrador obrigatório. Apenas ENFILEIRA propostas — não executa IA,
// não escreve no Bling, não aprova OEM, imagem, aplicação, tributo ou publicação.
import { createClient } from "npm:@supabase/supabase-js@2";
import { diagnosticoCadastro, planejarFila, type ProdutoMin, type ReceitaMin } from "../_shared/agente/fila.ts";
import { filtrarLoteCatalogo, validarSelecaoCatalogo, type EscopoCatalogo, type ProdutoParaFila } from "../_shared/agente/catalogo_lotes.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const TAMANHO_LEITURA = 1000;
const MAX_PRODUTOS = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > 12000) return json({ erro: "Requisição muito grande." }, 413);
  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u.user) return json({ erro: "Sessão inválida ou expirada." }, 401);
  const corpo = await req.json().catch(() => ({}));
  const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
  const acao = corpo?.acao;
  const escopo: EscopoCatalogo | null = corpo?.escopo === "selecionados" || corpo?.escopo === "todos_ativos" ? corpo.escopo : null;
  const ids = corpo?.produto_ids ?? [];
  if (!lojaId || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(lojaId)) return json({ erro: "Loja inválida." }, 400);
  if (acao !== "relatorio" && acao !== "enfileirar") return json({ erro: "Ação não suportada." }, 400);
  const erroSelecao = validarSelecaoCatalogo(escopo, ids);
  if (erroSelecao) return json({ erro: erroSelecao }, 400);
  const limite = Math.min(Math.max(Number(corpo?.limite) || 25, 1), 50);
  const { data: pode, error: erroPermissao } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
  if (erroPermissao || pode !== true) return json({ erro: "Somente administrador autorizado pode iniciar enriquecimento." }, 403);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const produtos: ProdutoParaFila[] = [];
  // Lê por páginas para não truncar em 1000 (limite padrão PostgREST).
  for (let offset = 0; offset < MAX_PRODUTOS; offset += TAMANHO_LEITURA) {
    let consulta = usuario.from("produtos")
      .select("id, nome, sku, preco, categoria, marca, gtin, descricao, situacao", { count: "exact" })
      .eq("loja_id", lojaId)
      .order("id", { ascending: true })
      .range(offset, offset + TAMANHO_LEITURA - 1);
    if (escopo === "selecionados") consulta = consulta.in("id", ids);
    else consulta = consulta.eq("situacao", "A");
    const { data, error, count } = await consulta;
    if (error || !Array.isArray(data)) return json({ erro: "Não foi possível ler o espelho de produtos." }, 500);
    if (count !== null && count > MAX_PRODUTOS) return json({ erro: "Catálogo acima de 5.000 produtos: divida em lotes." }, 422);
    produtos.push(...data as ProdutoParaFila[]);
    if (data.length < TAMANHO_LEITURA) break;
  }

  const { data: pausas, error: ePausas } = await sb.from("produto_automacao")
    .select("produto_id", { count:"exact" }).eq("loja_id",lojaId).eq("pausado",true).limit(MAX_PRODUTOS);
  if (ePausas) return json({ erro:"Não foi possível verificar os cadastros pausados. Nenhuma tarefa criada." },500);
  const pausados = new Set((pausas ?? []).map((x: {produto_id:string})=>x.produto_id));
  const elegibilidade = filtrarLoteCatalogo(produtos,{
    escopo: escopo!, selecionados: ids, pausados,
  });

  const [{ data: receitas, error:eReceitas },{data: abertas,error:eAbertas}] = await Promise.all([
    sb.from("receitas").select("codigo, campos_exigidos, gatilho")
      .eq("status","ativa").eq("perfil_ramo","autopecas").limit(2000),
    sb.from("enriquecimento_tarefas").select("produto_id,tipo")
      .eq("loja_id",lojaId).in("status",["na_fila","reivindicada"]).limit(MAX_PRODUTOS),
  ]);
  if (eReceitas || eAbertas) return json({erro:"Receitas ou tarefas existentes indisponíveis. Nenhuma gravação efetuada."},500);
  const porSlug = new Map<string, ReceitaMin>();
  for (const r of receitas ?? []) {
    const slug = (r.gatilho as { taxonomia_slug?: string } | null)?.taxonomia_slug;
    if (slug) porSlug.set(slug, { codigo:r.codigo as string, campos_exigidos:r.campos_exigidos as string[] });
  }
  const abertasSet = new Set((abertas??[]).map((t:{produto_id:string;tipo:string})=>t.produto_id+"|"+t.tipo));
  const plano = planejarFila(elegibilidade.elegiveis, porSlug, abertasSet);
  const cadastro: Record<string, number> = {};
  for (const p of elegibilidade.elegiveis) {
    for (const f of diagnosticoCadastro({...p,preco:p.preco == null?null:Number(p.preco)} as ProdutoMin))
      cadastro[f]=(cadastro[f]??0)+1;
  }
  const resumo = {
    escopo, consultados:elegibilidade.noEscopo, ativos_elegiveis:elegibilidade.elegiveis.length,
    inativos_excluidos:elegibilidade.inativos, pausados:elegibilidade.pausados,
    nao_localizados:elegibilidade.naoEncontrados,
    entrariam_na_fila:plano.enfileirar.length,ja_na_fila:plano.jaNaFila,
    sem_receita:plano.semReceita.length,sem_tipo:plano.semTipo.length,
    cadastro_incompleto:cadastro,
  };
  const detalhes = { modo:acao,escopo,gravou:false,resumo,
    amostra_fila:plano.enfileirar.slice(0,10),
    amostra_sem_tipo:plano.semTipo.slice(0,15),
    limite_por_lote:limite,
    aviso:"Prévia das tarefas. Nenhuma compatibilidade OEM, foto ou campo técnico foi aprovado." };
  if (acao === "relatorio") return json(detalhes);

  if (corpo?.confirmar !== true)
    return json({...detalhes,aviso:"Confirme explicitamente após revisar a prévia. Nenhuma tarefa foi criada."});
  // Revalida autorizações/pausas e o estado antes de gravar; lote limitado para
  // preservar créditos Firecrawl/LLM. O consumidor da fila opera separadamente.
  const candidatos = plano.enfileirar.slice(0,limite);
  if (!candidatos.length) return json({...detalhes,gravou:false,criadas:0,restantes:0});
  const idsCandidatos=candidatos.map(t=>t.produto_id);
  const [{data: atuais,error:eAtuais},{data: pausasAtuais,error:ePauseNovo},{data: abertasAtuais,error:eNovo}] = await Promise.all([
    sb.from("produtos").select("id,situacao").eq("loja_id",lojaId).in("id",idsCandidatos),
    sb.from("produto_automacao").select("produto_id").eq("loja_id",lojaId).eq("pausado",true).in("produto_id",idsCandidatos),
    sb.from("enriquecimento_tarefas").select("produto_id,tipo").eq("loja_id",lojaId)
      .in("produto_id",idsCandidatos).in("status",["na_fila","reivindicada"]),
  ]);
  if(eAtuais||ePauseNovo||eNovo)return json({erro:"Não foi possível revalidar o lote antes de criar tarefas."},500);
  const atuaisAtivos=new Set((atuais??[]).filter(x=>x.situacao==="A").map(x=>x.id));
  const hojePausados=new Set((pausasAtuais??[]).map(x=>x.produto_id));
  const hojeAbertos=new Set((abertasAtuais??[]).map(x=>x.produto_id+"|"+x.tipo));
  const aprovadosParaFila=candidatos.filter(t=>atuaisAtivos.has(t.produto_id)
    && !hojePausados.has(t.produto_id)&&!hojeAbertos.has(t.produto_id+"|"+t.tipo));
  if(!aprovadosParaFila.length)return json({...detalhes,criadas:0,restantes:plano.enfileirar.length,gravou:false,
    aviso:"Nenhum dos itens do primeiro lote continuou elegível na revalidação."});
  const ins=await sb.from("enriquecimento_tarefas").insert(
    aprovadosParaFila.map(t=>({loja_id:lojaId,produto_id:t.produto_id,
      tipo:t.tipo,provedor_preferido:"integrado"}))).select("id");
  if(ins.error)return json({erro:"Não foi possível criar o lote. Confira se há tarefas já abertas."},500);
  return json({...detalhes,modo:"enfileirar",gravou:true,
    criadas:ins.data?.length??0,
    restantes:Math.max(0,plano.enfileirar.length-(ins.data?.length??0)),
    aviso:"Tarefas enfileiradas, ainda NÃO executadas. O Nano precisa consumir a fila; resultados continuam a confirmar."});
});
