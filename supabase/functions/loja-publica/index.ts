// Vitrine pública da loja (verify_jwt = false). POST { slug } ou { host } (domínio do cliente) e opcionais { q, pagina }.
// A loja é resolvida NO SERVIDOR: por domínio verificado (DNS e SSL) ou pelo slug. Loja desconhecida/inativa => 404 genérico.
// Só devolve produtos PUBLICADOS e campos públicos (sem custo, fornecedor ou id do ERP).
import { createClient } from "npm:@supabase/supabase-js@2";
import { FONTES, PERFIS, variaveisCss, type Fonte } from "../_shared/loja/tema.ts";
import { modoCliente } from "../_shared/loja/publicacao.ts";
import { urlProduto } from "../_shared/seo/url.ts";
import { cabecalhoIpConfigurado, guardarPublico, portaViaRpc, segredoDoLimite } from "../_shared/limite/publico.ts";
import { montarBanners, montarVitrine, normalizarHost, veiculosDaFicha, opcoesVeiculo, produtosDoTipo, produtosDoVeiculo, SLUG_RE, TIPOS_VEICULO, tiposDoVeiculo, type Aplicacao } from "../_shared/loja/publica.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const POR_PAGINA = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // limite de requisições ANTES de qualquer consulta pesada: IP (rajada e sustentado) + teto por loja; corpo pequeno
  const g = await guardarPublico({
    endpoint: "loja-publica", req, segredo: segredoDoLimite(Deno.env), cabecalhoIp: cabecalhoIpConfigurado(Deno.env.get("LIMITE_CABECALHO_IP")),
    lojaDe: (b) => normalizarHost(b?.host) ?? (typeof b?.slug === "string" && SLUG_RE.test(b.slug) ? b.slug : null),
    porta: portaViaRpc(sb),
    aoFalhar: (m) => console.warn("limite-publico", m),
    modo: Deno.env.get("LIMITE_MODO") === "bloquear" ? "bloquear" : "observar",
    aoObservar: (camada, negaria) => { if (negaria) console.info("limite-publico", JSON.stringify({ endpoint: "loja-publica", camada, decisao: "negaria" })); },
  });
  if (!g.ok) return new Response(JSON.stringify(g.corpo), { status: g.status, headers: { ...CORS, "Content-Type": "application/json", ...g.cabecalhos } });
  const c = g.corpo;
  const host = normalizarHost(c?.host);
  const slug = typeof c?.slug === "string" && SLUG_RE.test(c.slug) ? c.slug : null;
  if (!host && !slug) return json({ erro: "Loja não encontrada." }, 404);
  const urlDoProduto = (sku: string) => urlProduto(host, sku); // só com domínio informado pelo servidor; sem domínio, sem link
  let lojaId: string | null = null;
  if (host) {
    const { data: d } = await sb.from("dominios_ativos").select("loja_id").eq("dominio", host).maybeSingle();
    lojaId = d?.loja_id ?? null;
  }
  const q = sb.from("lojas").select("id, nome, slug, modo_venda, whatsapp, ativa, ambiente");
  const { data: loja } = await (lojaId ? q.eq("id", lojaId) : host ? q.eq("id", "00000000-0000-0000-0000-000000000000") : q.eq("slug", slug!)).maybeSingle();
  if (!loja || loja.ativa === false) return json({ erro: "Loja não encontrada." }, 404);
  // A vitrine via domínio ativo exige liberação; no modo teste a prévia é acessível apenas pelo slug.
  if (host && loja.ambiente !== "producao") return json({ erro: "Loja ainda em preparação." }, 404);
  const fase = loja.ambiente === "producao" ? "producao" : "teste";
  const faseCliente = modoCliente(fase, loja.modo_venda);
  // Catálogo consultivo limitado à Mobis em teste: NÃO altera a publicação
  // definitiva, não informa preço/estoque e não autoriza anúncios ou checkout.
  const previaConsultaMobis = loja.slug === "mobis" && fase === "teste";


  // Página filha comercial por veículo: a aplicação aponta para o MESMO produto
  // físico do Bling. Em teste, rascunhos ficam noindex e sem preço/estoque.
  const slugAplicacao = typeof c?.aplicacao_slug === "string" && /^[a-z0-9-]{4,110}$/.test(c.aplicacao_slug) ? c.aplicacao_slug : null;
  if (slugAplicacao && loja.slug === "mobis") {
    const { data: app } = await sb.from("produto_aplicacoes")
      .select("id,produto_id,modelo_id,modelo,motorizacao,ano_inicial,ano_final,status,pagina_slug,pagina_titulo,pagina_descricao,pagina_indexavel,codigo_oem,restricao,contraindicacao")
      .eq("loja_id", loja.id).eq("pagina_slug", slugAplicacao).maybeSingle();
    if (!app || (!previaConsultaMobis && !(app.status === "aprovado" && app.pagina_indexavel)))
      return json({ erro: "Aplicação indisponível." }, 404);
    const { data: p } = await sb.from("produtos")
      .select("id,sku,marca,publicado,exibicao_teste,taxonomia_no_id,descricao_complementar")
      .eq("loja_id", loja.id).eq("id", app.produto_id).maybeSingle();
    if (!p || (!p.publicado && !(previaConsultaMobis && p.exibicao_teste)))
      return json({ erro: "Produto indisponível." }, 404);
    // Só imagens com direitos confirmados são herdadas pelo filho. Fotos
    // candidatas da internet e recortes de fornecedores nunca saem desta view.
    const { data: imgs } = await sb.from("imagens_publicaveis")
      .select("url,principal,ordem").eq("loja_id", loja.id).eq("produto_id", p.id)
      .order("principal", { ascending: false }).order("ordem").limit(8);
    const { data: no } = p.taxonomia_no_id ? await sb.from("taxonomia_nos")
      .select("nome").eq("id", p.taxonomia_no_id).maybeSingle() : { data: null };
    const tel = String(loja.whatsapp ?? "").replace(/\D/g, "");
    const whatsapp = /^55\d{10,11}$/.test(tel)
      ? "https://wa.me/" + tel + "?text=" + encodeURIComponent(
        "Olá, preciso confirmar a aplicação em " + app.modelo + " (" + (app.motorizacao ?? "motor não informado") +
        "), peça Mobis SKU " + p.sku + ". Podem conferir pelo chassi e informar disponibilidade?")
      : null;
    // Procedência só pode ser anunciada depois de conferência documental.
    const { data: procedencia }=await sb.from("produto_procedencia")
      .select("originalidade,condicao_importacao,pais_fabricacao,estado")
      .eq("loja_id",loja.id).eq("produto_id",p.id).eq("estado","aprovado").maybeSingle();
    // A vitrine recebe SOMENTE o NCM cadastrado/validado, sem fornecedor,
    // custo, nota fiscal de entrada, observações internas ou origem comercial.
    // NCM do Bling ainda pendente de XML da NF pode ser exibido como "cadastrado",
    // mas jamais confundido com homologação fiscal concluída.
    const { data: fiscal } = await sb.from("produto_fiscal")
      .select("ncm,origem_ncm,status")
      .eq("loja_id",loja.id).eq("produto_id",p.id).maybeSingle();
    const ncmBruto = fiscal && fiscal.status !== "rejeitado"
      && (fiscal.status === "validado" || fiscal.origem_ncm === "bling_erp")
      && typeof fiscal.ncm === "string" && /^[0-9]{8}$/.test(fiscal.ncm)
        ? fiscal.ncm : null;
    const ncmPublico = ncmBruto ? ncmBruto.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3") : null;
    // Ícones de veículos: somente fotos REAIS PNG e logotipos autorizados,
    // vinculados à montadora real do modelo e a registro de mídia aprovado.
    let fotoVeiculo: string | null = null;
    let logoMontadora: string | null = null;
    let fotoCredito: string | null = null;
    if (app.modelo_id) {
      const { data: modeloRef } = await sb.from("modelos")
        .select("montadora_id").eq("id",app.modelo_id).maybeSingle();
      if (modeloRef?.montadora_id) {
        const camposMidia = "modelo_id,aplicacao_id,montadora_id,ano_inicial,ano_final,foto_png_url,foto_aprovada,logo_png_url,logo_aprovado,foto_autor,foto_licenca,foto_fonte";
        const { data: especial } = await sb.from("veiculo_midias")
          .select(camposMidia).eq("loja_id",loja.id).eq("aplicacao_id",app.id)
          .eq("status","aprovado").limit(1).maybeSingle();
        const { data: gerais } = await sb.from("veiculo_midias")
          .select(camposMidia).eq("loja_id",loja.id).eq("modelo_id",app.modelo_id)
          .eq("status","aprovado").order("atualizado_em",{ascending:false}).limit(12);
        const midias = [...(especial ? [especial] : []),...(gerais ?? [])];
        for (const m of midias) {
          if (m.montadora_id !== modeloRef.montadora_id) continue;
          if (!logoMontadora && m.logo_aprovado && typeof m.logo_png_url==="string")
            logoMontadora=m.logo_png_url;
          const anosCobertos = m.aplicacao_id === app.id ||
            (app.ano_inicial != null && app.ano_final != null
             && m.ano_inicial != null && m.ano_final != null
             && m.ano_inicial <= app.ano_inicial && m.ano_final >= app.ano_final);
          if (!fotoVeiculo && anosCobertos && m.foto_aprovada && typeof m.foto_png_url==="string") {
            fotoVeiculo=m.foto_png_url;
            fotoCredito=[m.foto_autor,m.foto_licenca,m.foto_fonte].filter(Boolean).join(" · ");
          }
        }
      }
    }
    // História editorial de modelo / marca, com fontes e status explícitos.
    // Nunca usar história para homologar aplicação nem como OEM do produto.
    let historiaVeiculo: Record<string,unknown>|null=null;
    if (app.modelo_id) {
      const historiaQ=sb.from("catalogo_historias")
        .select("titulo,resumo,eventos,fontes,status").eq("loja_id",loja.id).eq("modelo_id",app.modelo_id);
      const { data: h }=await (previaConsultaMobis?historiaQ.in("status",["aprovado","a_confirmar"]):historiaQ.eq("status","aprovado")).maybeSingle();
      if (h) historiaVeiculo=h;
    }
    let historiaMarca: Record<string,unknown>|null=null;
    if (p.marca) {
      const { data: marca }=await sb.from("marcas").select("id")
        .eq("loja_id",loja.id).eq("tipo","peca").ilike("nome",p.marca).limit(1).maybeSingle();
      if (marca) {
        const marcaQ=sb.from("catalogo_historias")
          .select("titulo,resumo,eventos,fontes,status").eq("loja_id",loja.id).eq("marca_id",marca.id);
        const { data: h }=await (previaConsultaMobis?marcaQ.in("status",["aprovado","a_confirmar"]):marcaQ.eq("status","aprovado")).maybeSingle();
        if (h) historiaMarca=h;
      }
    }
    // Informações institucionais: exclusivamente política aprovada para a loja.
    const { data: politicasAplicacao } = await sb.from("loja_politicas")
      .select("razao_social,cnpj,endereco,telefone,email_contato,privacidade_texto,troca_devolucao_texto,entrega_texto,garantia_texto,termos_texto")
      .eq("loja_id",loja.id).eq("status","aprovada").maybeSingle();
    return json({
      loja: { nome: loja.nome, slug: loja.slug, ambiente: fase, whatsapp: tel },
      politicas: politicasAplicacao ?? null,
      pagina_aplicacao: {
        slug: app.pagina_slug, titulo: app.pagina_titulo, descricao: app.pagina_descricao,
        modelo: app.modelo, motorizacao: app.motorizacao,
        ano_inicial: app.ano_inicial, ano_final: app.ano_final,
        status: app.status, indexavel: app.status === "aprovado" && app.pagina_indexavel === true,
        sku_pai: p.sku, marca: p.marca, categoria: no?.nome ?? null,
        fotos: (imgs ?? []).map((i: { url: string }) => i.url),
        // OEM só pode ser exibido como referência confirmada após homologação.
        codigo_oem: app.status === "aprovado" ? app.codigo_oem ?? null : null,
        restricao: app.restricao ?? null, contraindicacao: app.contraindicacao ?? null,
        bula_tecnica: p.descricao_complementar ? "Informações declaradas no cadastro da peça (confirmar documentação técnica do fabricante):\\n" + p.descricao_complementar : null,
        // Só preencher com registros fiscais validados e arquivos licenciados após integração específica.
        codigo_fiscal: ncmPublico, foto_veiculo: fotoVeiculo, logo_montadora: logoMontadora, foto_credito: fotoCredito,
        procedencia_publica: procedencia?{
          originalidade:procedencia.originalidade,importacao:procedencia.condicao_importacao,
          pais:procedencia.pais_fabricacao??null}:null,
        preco: null, estoque: null, whatsapp, historia_veiculo: historiaVeiculo, historia_marca: historiaMarca,
      },
    });
  }

  const pagina = Math.max(1, Math.min(Number.isInteger(c?.pagina) ? c.pagina : 1, 1000));
  const limpar = (v: unknown, n = 60) => (typeof v === "string" ? v.replace(/[%,()*\\]/g, " ").trim().slice(0, n) : "");
  const busca = limpar(c?.q);
  const chaveMarca = typeof c?.marca === "string" && c.marca.length <= 80
    ? c.marca.trim().toUpperCase().replace(/\s+/g," ") : "";
  const nomeMarcaNormalizado=(x:string)=>x.trim().toUpperCase().replace(/\s+/g," ");
  const modelo = limpar(c?.modelo), motor = limpar(c?.motor), categoria = typeof c?.categoria === "string" && SLUG_RE.test(c.categoria) ? c.categoria : "";
  const tipo = typeof c?.tipo === "string" && Object.hasOwn(TIPOS_VEICULO, c.tipo) ? c.tipo : "";
  const ano = Number.isInteger(c?.ano) && c.ano >= 1950 && c.ano <= 2100 ? (c.ano as number) : undefined;

  // Publicados (id + categoria) e as aplicações APROVADAS deles: alimentam as opções de busca e os filtros.
  let consultaPublicados = sb.from("produtos").select("id, sku, taxonomia_no_id, marca").eq("loja_id", loja.id);
  consultaPublicados = previaConsultaMobis
    ? consultaPublicados.or("publicado.eq.true,exibicao_teste.eq.true")
    : consultaPublicados.eq("publicado", true);
  const { data: pub } = await consultaPublicados.limit(5000);
  const idsPublicados = (pub ?? []).map((p: { id: string }) => p.id);
  let apls: Aplicacao[] = [];
  if (idsPublicados.length) {
    let { data, error: eApl } = await sb.from("produto_aplicacoes").select("produto_id, modelo, motorizacao, ano_inicial, ano_final, modelos(categoria)").eq("loja_id", loja.id).eq("status", "aprovado").limit(5000);
    // antes da migração do tipo de veículo o embed não existe: cai para a leitura simples (sem tipos) em vez de derrubar a busca por veículo
    if (eApl) ({ data } = await sb.from("produto_aplicacoes").select("produto_id, modelo, motorizacao, ano_inicial, ano_final").eq("loja_id", loja.id).eq("status", "aprovado").limit(5000));
    const publicados = new Set(idsPublicados); // filtra em memória: lista grande de ids estoura o tamanho da URL
    apls = ((data ?? []) as unknown as (Aplicacao & { modelos: { categoria: string } | null })[]).filter((a) => publicados.has(a.produto_id)).map(({ modelos: m, ...a }) => ({ ...a, categoria: m?.categoria ?? null }));
  }
  const nosIds = [...new Set((pub ?? []).map((p: { taxonomia_no_id: string | null }) => p.taxonomia_no_id).filter(Boolean))] as string[];
  const { data: nos } = nosIds.length ? await sb.from("taxonomia_nos").select("id, nome, slug").in("id", nosIds) : { data: [] as { id: string; nome: string; slug: string }[] };
  const categorias = (nos ?? []).map((n: { id: string; nome: string; slug: string }) => ({ nome: n.nome, slug: n.slug, total: (pub ?? []).filter((p: { taxonomia_no_id: string | null }) => p.taxonomia_no_id === n.id).length }));

  // Diretório de marcas baseado APENAS em SKUs visíveis na mesma vitrine.
  // Variações de grafia permanecem separadas até homologação de alias;
  // só espaço/capitalização não mudam a identidade literal.
  const { data: catalogoMarcas }=await sb.from("marcas")
    .select("id,nome").eq("loja_id",loja.id).eq("tipo","peca").limit(800);
  const mapaIdMarca=new Map((catalogoMarcas??[]).map(m=>[m.id,m.nome]));
  const { data: aliasesAprovados }=await sb.from("marca_aliases")
    .select("marca_id,nome_normalizado").eq("loja_id",loja.id).eq("estado","aprovado").limit(800);
  const aliasesSeguros=new Map((aliasesAprovados??[])
    .filter(a=>mapaIdMarca.has(a.marca_id))
    .map(a=>[nomeMarcaNormalizado(a.nome_normalizado),nomeMarcaNormalizado(mapaIdMarca.get(a.marca_id)??"")]));
  const porMarca=new Map<string,{chave:string;nome:string;quantidade:number;valores:string[]}>();
  for(const p of pub??[]) {
    const raw=typeof p.marca==="string"?p.marca.trim():"";
    if(!raw || /^(importado|sem marca|n[aã]o informado|diversos)$/i.test(raw)) continue;
    const normalizado=nomeMarcaNormalizado(raw);
    const chave=aliasesSeguros.get(normalizado)??normalizado;
    let perfil=porMarca.get(chave);
    if(!perfil){perfil={chave,nome:raw,quantidade:0,valores:[]};porMarca.set(chave,perfil);}
    perfil.quantidade++;
    if(!perfil.valores.includes(raw))perfil.valores.push(raw);
  }
  const marcasOrdenadas=[...porMarca.values()].sort((a,b)=>b.quantidade-a.quantidade||a.nome.localeCompare(b.nome,"pt-BR"));
  const marcasVitrine=marcasOrdenadas.map(({chave,nome,quantidade})=>({chave,nome,quantidade,logo:null as string|null}));
  const valoresMarca=chaveMarca?porMarca.get(chaveMarca)?.valores??[]:[];
  // Identidades editoriais só entram se marca + logotipo aprovado e uso documentado.
  const porIdMarca=new Map((catalogoMarcas??[]).map(m=>[nomeMarcaNormalizado(m.nome),m.id]));
  const listaIds=[...new Set([...porIdMarca.values()])];
  const { data: logosMarca }=listaIds.length ? await sb.from("marca_identidade_publica")
    .select("marca_id,logo_png_url,status").eq("loja_id",loja.id).eq("status","aprovado")
    .in("marca_id",listaIds) : {data:[]};
  const logosPorId=new Map((logosMarca??[]).map(m=>[m.marca_id,m.logo_png_url]));
  for(const m of marcasVitrine){const id=porIdMarca.get(m.chave);m.logo=id?logosPorId.get(id)??null:null;}
  let historiaMarcaCatalogo:Record<string,unknown>|null=null;
  if (chaveMarca && valoresMarca.length) {
    const id=porIdMarca.get(chaveMarca);
    if(id){
      const qHist=sb.from("catalogo_historias").select("titulo,resumo,eventos,fontes,status")
        .eq("loja_id",loja.id).eq("marca_id",id);
      const { data: h }=await (previaConsultaMobis?qHist.in("status",["aprovado","a_confirmar"]):qHist.eq("status","aprovado")).maybeSingle();
      if(h)historiaMarcaCatalogo=h;
    }
  }

  // filtros calculados do dado aprovado (categorias com ícone, montadoras, fabricantes); falha aqui não derruba a vitrine
  const { data: filtros } = await sb.rpc("filtros_da_vitrine", { p_loja: loja.id });

  let consulta = sb.from("produtos").select("nome, sku, preco, estoque, marca, descricao_curta, sincronizado_em, publicado, exibicao_teste, taxonomia_no_id", { count: "exact" })
    .eq("loja_id", loja.id);
  consulta = previaConsultaMobis
    ? consulta.or("publicado.eq.true,exibicao_teste.eq.true")
    : consulta.eq("publicado", true);
  consulta = consulta.order("nome").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (chaveMarca) consulta = consulta.in("marca",valoresMarca.length?valoresMarca:["__marca_inexistente__"]);
  if (busca) consulta = consulta.or(`nome.ilike.%${busca}%,sku.ilike.%${busca}%`);
  if (modelo || motor || ano !== undefined) {
    const ids = [...produtosDoVeiculo(apls, { modelo, motor, ano })];
    consulta = consulta.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (tipo) {
    const ids = [...produtosDoTipo(apls, tipo)];
    consulta = consulta.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (categoria) {
    const no = (nos ?? []).find((n: { slug: string }) => n.slug === categoria);
    consulta = consulta.eq("taxonomia_no_id", no?.id ?? "00000000-0000-0000-0000-000000000000");
  }
  const { data: linhas, count } = await consulta;

  // Ficha do produto (página do produto): pedido com { sku } devolve as aplicações aprovadas daquele produto publicado
  const skuFicha = typeof c?.sku === "string" && c.sku.length <= 80 && !/[\u0000-\u001F\u007F]/.test(c.sku) ? c.sku : "";
  let ficha: { veiculos: ReturnType<typeof veiculosDaFicha> } | null = null;
  if (skuFicha) {
    let consultaFicha = sb.from("produtos").select("id").eq("loja_id", loja.id).eq("sku", skuFicha);
    consultaFicha = previaConsultaMobis
      ? consultaFicha.or("publicado.eq.true,exibicao_teste.eq.true")
      : consultaFicha.eq("publicado", true);
    const { data: alvo } = await consultaFicha.maybeSingle();
    if (alvo) ficha = { veiculos: veiculosDaFicha(apls, alvo.id as string) };
  }

  // imagem principal aprovada de cada produto da página
  const skus = (linhas ?? []).map((l: { sku: string | null }) => l.sku).filter(Boolean) as string[];
  const imagens = new Map<string, string>();
  if (skus.length) {
    const { data: ids } = await sb.from("produtos").select("id, sku").eq("loja_id", loja.id).in("sku", skus);
    const porId = new Map((ids ?? []).map((p: { id: string; sku: string }) => [p.id, p.sku]));
    // view da migração 20261019000005: só imagem aprovada, sem retirada e com direitos de uso confirmados (nunca url_original)
    const { data: imgs } = await sb.from("imagens_publicaveis").select("produto_id, url, principal, ordem").eq("loja_id", loja.id).in("produto_id", [...porId.keys()]).order("principal", { ascending: false }).order("ordem");
    for (const i of imgs ?? []) { const s = porId.get(i.produto_id); if (s && !imagens.has(s)) imagens.set(s, i.url); }
  }
  // Itens só de consulta não mostram preço, estoque ou disponibilidade como
  // certeza. Continuam usando exclusivamente imagens com direitos liberados.
  const skusConsulta = new Set((linhas ?? [])
    .filter((l: { sku: string | null; publicado: boolean; exibicao_teste: boolean }) =>
      previaConsultaMobis && l.exibicao_teste && !l.publicado)
    .map((l: { sku: string | null }) => l.sku).filter(Boolean) as string[]);
  const categoriaPorNo = new Map((nos ?? []).map((n: { id: string; nome: string }) => [n.id, n.nome]));
  const categoriaPorSku = new Map((linhas ?? []).map((l: { sku: string | null; taxonomia_no_id: string | null }) =>
    [l.sku, categoriaPorNo.get(l.taxonomia_no_id ?? "") ?? null]));
  const produtos = montarVitrine((linhas ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    preco: skusConsulta.has(String(l.sku)) ? null : l.preco,
    estoque: skusConsulta.has(String(l.sku)) ? null : l.estoque,
    imagem: imagens.get(String(l.sku)) ?? null,
  }) as never), loja.whatsapp, urlDoProduto)
    .map((produto) => ({ ...produto, consulta_previa: skusConsulta.has(produto.sku), categoria: categoriaPorSku.get(produto.sku) ?? null }));

  const paginasPorSku: Record<string, { slug: string; titulo: string; modelo: string; status: string }[]> = {};
  if (loja.slug === "mobis" && idsPublicados.length) {
    let aq = sb.from("produto_aplicacoes")
      .select("produto_id,pagina_slug,pagina_titulo,modelo,status,pagina_indexavel")
      .eq("loja_id", loja.id).in("produto_id", idsPublicados).not("pagina_slug", "is", null);
    aq = previaConsultaMobis
      ? aq.in("status", ["aprovado", "a_confirmar"])
      : aq.eq("status", "aprovado").eq("pagina_indexavel", true);
    const { data: aps } = await aq.limit(1500);
    const skusDosIds = new Map((pub ?? []).map((p: { id: string; sku?: string | null }) => [p.id, p.sku]));
    for (const a of aps ?? []) {
      const sku = skusDosIds.get(a.produto_id);
      if (!sku || !a.pagina_slug || !a.pagina_titulo) continue;
      (paginasPorSku[sku] ??= []).push({
        slug: a.pagina_slug, titulo: a.pagina_titulo, modelo: a.modelo, status: a.status,
      });
    }
    // Ordem estável ao clicar na foto: HR -> Bongo -> demais; nunca escolher
    // aplicação aleatória baseada na ordem retornada pelo Postgres.
    for (const paginas of Object.values(paginasPorSku))
      paginas.sort((a, b) => a.modelo.localeCompare(b.modelo, "pt-BR"));
  }

  // Miniaturas institucionais reais para as três entradas do catálogo.
  // Modelo e montadora devem coincidir. A imagem ilustrativa do MODELO nunca
  // substitui o registro de compatibilidade do MOTOR ou da peça.
  const midiasVeiculoCatalogo: Record<string,{foto:string|null;logo:string|null;credito:string|null}> = {};
  if (loja.slug === "mobis") {
    const { data: modelosVitrine } = await sb.from("modelos")
      .select("id,nome,montadora_id").in("nome",["HR","Bongo K2500","L200"]);
    const idsModelo = (modelosVitrine??[]).map(m=>m.id);
    const { data: fotosModelo } = idsModelo.length ? await sb.from("veiculo_midias")
      .select("modelo_id,montadora_id,foto_png_url,foto_aprovada,logo_png_url,logo_aprovado,foto_autor,foto_licenca,foto_fonte")
      .eq("loja_id",loja.id).in("modelo_id",idsModelo).eq("status","aprovado").limit(15)
      : {data:[]};
    for(const m of modelosVitrine??[]) {
      const r=(fotosModelo??[]).find(f=>f.modelo_id===m.id && f.montadora_id===m.montadora_id);
      if(!r)continue;
      const chave=m.nome==="Bongo K2500"?"Bongo":m.nome;
      midiasVeiculoCatalogo[chave]={
        foto:r.foto_aprovada?r.foto_png_url:null,
        logo:r.logo_aprovado?r.logo_png_url:null,
        credito:r.foto_aprovada?[r.foto_autor,r.foto_licenca,r.foto_fonte].filter(Boolean).join(" · "):null,
      };
    }
  }

  // Banner institucional por marca, independente de alteração de SKU/estoque/preço.
  const agora=new Date().toISOString();
  const { data: campanhasAprovadas }=loja.slug==="mobis"
    ? await sb.from("marca_campanhas")
      .select("marca_id,titulo,chamada,banner_imagem_url,ordem")
      .eq("loja_id",loja.id).eq("status","aprovado")
      .lte("inicio",agora).or("fim.is.null,fim.gt."+agora)
      .order("ordem",{ascending:true}).limit(12)
    : {data:[]};
  const chavePorIdMarca=new Map([...porIdMarca.entries()].map(([chave,id])=>[id,chave]));
  const bannersMarca=(campanhasAprovadas??[]).flatMap(c=>{
    const chave=chavePorIdMarca.get(c.marca_id);
    if(!chave||!porMarca.has(chave))return [];
    return [{marca_chave:chave,nome:c.titulo,chamada:c.chamada??null,
      imagem:c.banner_imagem_url??null}];
  });

  // banners de oferta no ar (loja_banners): só produto publicado e dentro do período; falha aqui não derruba a vitrine
  const { data: bn } = await sb.rpc("banners_da_vitrine", { p_loja: loja.id });
  const banners = montarBanners(Array.isArray(bn) ? bn : [], loja.whatsapp, urlDoProduto);
  // tema da loja (cores/fonte/logo/ícone); sem tema salvo => perfil padrão. As variáveis CSS são calculadas aqui, de valores já validados.
  const { data: tm } = await sb.from("loja_tema").select("cor_primaria, cor_destaque, cor_bloco, fonte, logo_url, icone_url").eq("loja_id", loja.id).maybeSingle();
  const fonteTema = (FONTES as readonly string[]).includes(tm?.fonte) ? (tm!.fonte as Fonte) : "inter";
  const cores = tm ? { primaria: tm.cor_primaria, destaque: tm.cor_destaque, bloco: tm.cor_bloco } : PERFIS.azul_conecta;
  const tema = { variaveis: variaveisCss(cores, fonteTema), logo_url: tm?.logo_url ?? null, icone_url: tm?.icone_url ?? null };
  // Rodapé público: somente informações institucionais e políticas formalmente aprovadas.
  // Ausência, erro ou rascunho => null; jamais divulgar contatos ou textos não revisados.
  const { data: politicasAprovadas } = await sb.from("loja_politicas")
    .select("razao_social, cnpj, endereco, telefone, email_contato, privacidade_texto, troca_devolucao_texto, entrega_texto, garantia_texto, termos_texto")
    .eq("loja_id", loja.id).eq("status", "aprovada").maybeSingle();
  return json({ loja: { nome: loja.nome, slug: loja.slug, ...faseCliente, whatsapp: /^55\d{10,11}$/.test(String(loja.whatsapp ?? "").replace(/\D/g, "")) ? String(loja.whatsapp).replace(/\D/g, "") : null }, tema, politicas: politicasAprovadas ?? null, produtos, paginas_aplicacao: paginasPorSku, midias_veiculo: midiasVeiculoCatalogo, marcas:marcasVitrine, marca_historia:historiaMarcaCatalogo, banners_marca:bannersMarca, banners, total: count ?? produtos.length, pagina, por_pagina: POR_PAGINA, veiculos: opcoesVeiculo(apls), tipos: tiposDoVeiculo(apls), ficha, categorias, filtros: filtros ?? null });
});
