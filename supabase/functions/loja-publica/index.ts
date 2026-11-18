// Vitrine pública da loja (verify_jwt = false). POST { slug } ou { host } (domínio do cliente) e opcionais { q, pagina }.
// A loja é resolvida NO SERVIDOR: por domínio verificado (DNS e SSL) ou pelo slug. Loja desconhecida/inativa => 404 genérico.
// Devolve produtos publicados; somente no piloto Mobis em teste admite prévia explicitamente marcada, sem preço nem venda.
import { createClient } from "npm:@supabase/supabase-js@2";
import { FONTES, PERFIS, variaveisCss, type Fonte } from "../_shared/loja/tema.ts";
import { modoCliente } from "../_shared/loja/publicacao.ts";
import { urlProduto } from "../_shared/seo/url.ts";
import { cabecalhoIpConfigurado, guardarPublico, portaViaRpc, segredoDoLimite } from "../_shared/limite/publico.ts";
import { montarBanners, montarVitrine, normalizarHost, veiculosDaFicha, opcoesVeiculo, produtosDoTipo, produtosDoVeiculo, textoSimples, SLUG_RE, TIPOS_VEICULO, tiposDoVeiculo, type Aplicacao } from "../_shared/loja/publica.ts";

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
  // Prévia controlada: somente Mobis no link de teste por slug (nunca por domínio)
  // e somente SKUs selecionados pelo lojista com exibicao_teste=true.
  // A prévia não é indexável, não anuncia preço/estoque nem homologa aplicações.


  // Página filha comercial por veículo: a aplicação aponta para o MESMO produto
  // físico do Bling. Só status aprovado E visibilidade explícita são públicos.
  const slugAplicacao = typeof c?.aplicacao_slug === "string" && /^[a-z0-9-]{4,110}$/.test(c.aplicacao_slug) ? c.aplicacao_slug : null;
  if (slugAplicacao && loja.slug === "mobis") {
    const { data: app } = await sb.from("produto_aplicacoes")
      .select("produto_id,modelo,motorizacao,ano_inicial,ano_final,status,pagina_slug,pagina_titulo,pagina_descricao,pagina_indexavel")
      .eq("loja_id", loja.id).eq("pagina_slug", slugAplicacao).maybeSingle();
    if (!app || app.status !== "aprovado" || app.pagina_indexavel !== true)
      return json({ erro: "Aplicação indisponível." }, 404);
    const { data: p } = await sb.from("produtos")
      .select("id,sku,marca,publicado,exibicao_teste,taxonomia_no_id")
      .eq("loja_id", loja.id).eq("id", app.produto_id).maybeSingle();
    if (!p?.publicado) return json({ erro: "Produto indisponível." }, 404);
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
    return json({
      loja: { nome: loja.nome, slug: loja.slug, ambiente: fase },
      pagina_aplicacao: {
        slug: app.pagina_slug, titulo: app.pagina_titulo, descricao: app.pagina_descricao,
        modelo: app.modelo, motorizacao: app.motorizacao,
        ano_inicial: app.ano_inicial, ano_final: app.ano_final,
        status: app.status, indexavel: app.status === "aprovado" && app.pagina_indexavel === true,
        sku_pai: p.sku, marca: p.marca, categoria: no?.nome ?? null,
        fotos: (imgs ?? []).map((i: { url: string }) => i.url),
        preco: null, estoque: null, whatsapp,
      },
    });
  }

  const pagina = Math.max(1, Math.min(Number.isInteger(c?.pagina) ? c.pagina : 1, 1000));
  const limpar = (v: unknown, n = 60) => (typeof v === "string" ? v.replace(/[%,()*\\]/g, " ").trim().slice(0, n) : "");
  const busca = limpar(c?.q);
  // O modo "código" limita a busca ao SKU real e a referências APROVADAS.
  // O texto de busca nunca é interpretado como SQL, filtro ou id arbitrário.
  const referenciaExata = loja.slug === "mobis" && c?.referencia_exata === true;
  const buscaOr = busca.replace(/[.:"']/g, " ");
  const modelo = limpar(c?.modelo), motor = limpar(c?.motor), montadora = limpar(c?.montadora), categoria = typeof c?.categoria === "string" && SLUG_RE.test(c.categoria) ? c.categoria : "";
  const tipo = typeof c?.tipo === "string" && Object.hasOwn(TIPOS_VEICULO, c.tipo) ? c.tipo : "";
  const ano = Number.isInteger(c?.ano) && c.ano >= 1950 && c.ano <= 2100 ? (c.ano as number) : undefined;
  const anoInicio = Number.isInteger(c?.ano_inicial) && c.ano_inicial >= 1950 && c.ano_inicial <= 2100 ? c.ano_inicial as number : undefined;
  const anoFinal = Number.isInteger(c?.ano_final) && c.ano_final >= 1950 && c.ano_final <= 2100 ? c.ano_final as number : undefined;

  // Um SKU físico pode ter várias aplicações. Todos os vínculos visíveis
  // são homologados e associados a modelos/montadoras do cadastro relacional.
  // Em TESTE, a prévia mostra só produtos explicitamente marcados e ativos.
  const consultaPublicados = sb.from("produtos").select("id,sku,taxonomia_no_id")
    .eq("loja_id", loja.id).eq("publicado", true);
  const { data: pub, error: erroPublicados } = await consultaPublicados.limit(5000);
  if (erroPublicados) return json({ erro: "Catálogo indisponível." }, 503);
  const idsPublicados = (pub ?? []).map((p: { id: string }) => p.id);
  const modoPreviaCatalogo = loja.slug === "mobis" && fase === "teste" && !host && idsPublicados.length === 0;
  const { data: previas, error: erroPrevias } = modoPreviaCatalogo
    ? await sb.from("produtos").select("id,sku,taxonomia_no_id")
        .eq("loja_id",loja.id).eq("exibicao_teste",true).eq("situacao","A").limit(100)
    : {data: [] as {id:string;sku:string;taxonomia_no_id:string|null}[],error:null};
  if(erroPrevias)return json({erro:"Prévia indisponível."},503);
  const elegiveis = modoPreviaCatalogo ? (previas ?? []) : (pub ?? []);
  const idsElegiveis = elegiveis.map((p:{id:string})=>p.id);
  const conjuntoElegiveis = new Set(idsElegiveis);
  type AplicacaoAprovada = Aplicacao & {
    montadora:string|null; restricao:string|null;
    pagina_slug:string|null;pagina_titulo:string|null;pagina_indexavel:boolean;
  };
  let apls:AplicacaoAprovada[]=[];
  if(idsElegiveis.length){
    const {data:rows,error:erroApl}=await sb.from("produto_aplicacoes")
      .select("produto_id,modelo,motorizacao,ano_inicial,ano_final,modelo_id,marca_veiculo_id,restricao,pagina_slug,pagina_titulo,pagina_indexavel")
      .eq("loja_id",loja.id).eq("status","aprovado").limit(5000);
    if(erroApl) return json({erro:"Aplicações indisponíveis."},503);
    const aprovadas=(rows??[]).filter(a=>conjuntoElegiveis.has(a.produto_id));
    const modelosIds=[...new Set(aprovadas.map(a=>a.modelo_id).filter((id):id is string=>!!id))];
    const {data:modelos} = modelosIds.length
      ? await sb.from("modelos").select("id,categoria,montadora_id").in("id",modelosIds)
      : {data:[] as {id:string;categoria:string|null;montadora_id:string|null}[]};
    const modeloPorId=new Map((modelos??[]).map(m=>[m.id,m]));
    const montadorasIds=[...new Set(aprovadas.flatMap(a=>[
      a.marca_veiculo_id,modeloPorId.get(a.modelo_id)?.montadora_id
    ]).filter((id):id is string=>!!id))];
    const {data:montadorasRegistradas}=montadorasIds.length
      ? await sb.from("montadoras").select("id,nome").in("id",montadorasIds)
      : {data:[] as {id:string;nome:string}[]};
    const montadoraPorId=new Map((montadorasRegistradas??[]).map(m=>[m.id,m.nome]));
    apls=aprovadas.map(a=>{
      const m=modeloPorId.get(a.modelo_id);
      return {
        produto_id:a.produto_id,modelo:a.modelo,motorizacao:a.motorizacao,
        ano_inicial:a.ano_inicial,ano_final:a.ano_final,
        categoria:m?.categoria??null,
        montadora:montadoraPorId.get(a.marca_veiculo_id??m?.montadora_id??"")??null,
        restricao:a.restricao??null,pagina_slug:a.pagina_slug??null,
        pagina_titulo:a.pagina_titulo??null,pagina_indexavel:a.pagina_indexavel===true,
      };
    });
  }
  const montadorasMap=new Map<string,Set<string>>();
  for(const a of apls)if(a.montadora){
    if(!montadorasMap.has(a.montadora))montadorasMap.set(a.montadora,new Set());
    montadorasMap.get(a.montadora)!.add(a.modelo);
  }
  const montadoras_aprovadas=[...montadorasMap].map(([nome,modelos])=>({
    nome,modelos:[...modelos].sort((a,b)=>a.localeCompare(b,"pt-BR")),
  })).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  const nosIds=[...new Set(elegiveis.map((p:{taxonomia_no_id:string|null})=>p.taxonomia_no_id).filter(Boolean))] as string[];
  const {data:nos}=nosIds.length
    ? await sb.from("taxonomia_nos").select("id,nome,slug,status").in("id",nosIds)
    : {data:[] as {id:string;nome:string;slug:string;status:string}[]};
  const categorias=(nos??[]).filter(n=>n.status==="aprovado").map(n=>({
    nome:n.nome,slug:n.slug,total:elegiveis.filter((p:{taxonomia_no_id:string|null})=>p.taxonomia_no_id===n.id).length,
  }));
  // filtros calculados do dado aprovado (categorias com ícone, montadoras, fabricantes); falha aqui não derruba a vitrine
  const { data: filtros } = await sb.rpc("filtros_da_vitrine", { p_loja: loja.id });

  let consulta = sb.from("produtos").select("nome, sku, preco, estoque, marca, descricao_curta, sincronizado_em, publicado, exibicao_teste, taxonomia_no_id", { count: "exact" })
    .eq("loja_id", loja.id);
  consulta = modoPreviaCatalogo
    ? consulta.eq("exibicao_teste", true).eq("situacao", "A")
    : consulta.eq("publicado", true);
  consulta = consulta.order("nome").range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  // Espelho de códigos: apenas vínculos realmente aprovados podem levar a um
  // produto; candidato ou pendente não serve como atalho de correspondência.
  let idsPorReferencia: string[] = [];
  if (busca && loja.slug === "mobis") {
    const { data: codigos, error: erroCodigo } = await sb.from("produto_codigos")
      .select("produto_id").eq("loja_id", loja.id).eq("status", "aprovado")
      .in("tipo", ["oem", "fabricante", "sku", "ean", "similar", "substituto", "antigo"])
      .ilike("valor", busca).limit(100);
    if (erroCodigo) console.warn("loja-publica codigo-aprovado indisponivel", erroCodigo.code);
    const publicados = new Set(idsPublicados);
    const refsDiretas = (codigos ?? []) as { produto_id: string; valor?: string }[];
    let refsVerificadas = refsDiretas;
    // Normalização APENAS de separadores de código (ex.: 54410-4B000 = 544104B000).
    // Nunca usar correspondência aproximada nem códigos pendentes. Para lotes maiores,
    // migrar para índice canônico em vez de expandir consulta indiscriminadamente.
    if (!erroCodigo && refsDiretas.length === 0 && busca.length >= 5 &&
      /^[a-z0-9.\/\s-]+$/i.test(busca) && /\d/.test(busca)) {
      const canonico = (v: string) => v.normalize("NFKC").replace(/[^a-z0-9]/gi, "").toUpperCase();
      const chave = canonico(busca);
      const { data: candidatas, error: erroNormalizacao } = await sb.from("produto_codigos")
        .select("produto_id,valor").eq("loja_id", loja.id).eq("status", "aprovado")
        .in("tipo", ["oem", "fabricante", "sku", "ean", "similar", "substituto", "antigo"])
        .limit(1000);
      if (erroNormalizacao) console.warn("loja-publica codigo-normalizado indisponivel", erroNormalizacao.code);
      if (!erroNormalizacao && (candidatas?.length ?? 0) < 1000) {
        refsVerificadas = (candidatas ?? []).filter((r: { valor: string }) => canonico(r.valor) === chave);
      } else if ((candidatas?.length ?? 0) >= 1000) {
        console.warn("loja-publica limite de normalizacao atingido; falha fechada");
      }
    }
    idsPorReferencia = [...new Set(refsVerificadas
      .map((c: { produto_id: string }) => c.produto_id)
      .filter((id: string) => publicados.has(id) && /^[a-f0-9-]{36}$/i.test(id)))];
  }
  if (busca) {
    const trechoIds = idsPorReferencia.length ? `,id.in.(${idsPorReferencia.join(",")})` : "";
    consulta = referenciaExata
      ? consulta.or(`sku.ilike.${buscaOr}${trechoIds}`)
      : consulta.or(`nome.ilike.%${buscaOr}%,sku.ilike.%${buscaOr}%${trechoIds}`);
  }
  if (modelo || montadora || motor || ano !== undefined || anoInicio !== undefined || anoFinal !== undefined) {
    // Filtro cumulativo: sem vínculo aprovado não existe resultado por veículo.
    // Não derivar montadora, ano ou motor de palavras contidas no nome do produto.
    const normal=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
    const combinaModelo=(valor:string,escolha:string)=>{
      const v=normal(valor),q=normal(escolha);
      return v===q||v.startsWith(q+" ")||v.endsWith(" "+q)||v.includes(" "+q+" ");
    };
    const cobreAno=(a:AplicacaoAprovada,valor:number)=>
      a.ano_inicial!==null&&a.ano_final!==null&&a.ano_inicial<=valor&&a.ano_final>=valor;
    const ids=[...new Set(apls.filter(a=>
      (!montadora||(a.montadora!==null&&normal(a.montadora)===normal(montadora))) &&
      (!modelo||combinaModelo(a.modelo,modelo)) &&
      (!motor||(a.motorizacao!==null&&normal(a.motorizacao)===normal(motor))) &&
      (ano===undefined||cobreAno(a,ano)) &&
      (anoInicio===undefined||cobreAno(a,anoInicio)) &&
      (anoFinal===undefined||cobreAno(a,anoFinal)) &&
      (anoInicio===undefined||anoFinal===undefined||anoInicio<=anoFinal)
    ).map(a=>a.produto_id))];
    consulta=consulta.in("id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);
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

  // Ficha por SKU: a matriz pode ser consultada em TESTE sem marcar o produto
  // como publicado. Fotos, boletins, referências e páginas-filhas continuam
  // submetidos aos próprios controles de aprovação.
  const skuFicha=typeof c?.sku==="string"&&c.sku.length<=80&&!/[\u0000-\u001F\u007F]/.test(c.sku)?c.sku:"";
  let ficha: {
    veiculos:ReturnType<typeof veiculosDaFicha>;
    detalhes:{
      descricao_cadastro:string|null;condicao:string|null;categoria:string|null;categoria_status:string|null;
      peso_kg:number|null;largura_cm:number|null;altura_cm:number|null;profundidade_cm:number|null;
      fotos:string[];texto_tecnico_aprovado:string|null;
      aplicacoes:{modelo:string;montadora:string|null;motorizacao:string|null;ano_inicial:number|null;ano_final:number|null;pagina_slug:string|null;titulo:string|null;restricao:string|null}[];
    };
  }|null=null;
  if(skuFicha){
    let consultaFicha=sb.from("produtos")
      .select("id,descricao_curta,descricao_complementar,condicao,peso_kg,largura_cm,altura_cm,profundidade_cm,taxonomia_no_id")
      .eq("loja_id",loja.id).eq("sku",skuFicha);
    consultaFicha=modoPreviaCatalogo
      ? consultaFicha.eq("exibicao_teste",true).eq("situacao","A")
      : consultaFicha.eq("publicado",true);
    const {data:alvo}=await consultaFicha.maybeSingle();
    if(alvo&&conjuntoElegiveis.has(alvo.id)){
      const [i,n,b]=await Promise.all([
        sb.from("imagens_publicaveis").select("url,principal,ordem")
          .eq("loja_id",loja.id).eq("produto_id",alvo.id)
          .order("principal",{ascending:false}).order("ordem").limit(10),
        alvo.taxonomia_no_id
          ? sb.from("taxonomia_nos").select("nome,status").eq("id",alvo.taxonomia_no_id).maybeSingle()
          : Promise.resolve({data:null}),
        sb.from("produto_bula").select("texto_md").eq("loja_id",loja.id)
          .eq("produto_id",alvo.id).eq("status","aprovado").maybeSingle(),
      ]);
      const numOuNulo=(v:unknown)=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);
      ficha={
        veiculos:veiculosDaFicha(apls,alvo.id),
        detalhes:{
          descricao_cadastro:textoSimples(alvo.descricao_complementar||alvo.descricao_curta,1400),
          condicao:alvo.condicao??null,categoria:n.data?.nome??null,
          categoria_status:n.data?.status??null,
          peso_kg:numOuNulo(alvo.peso_kg),largura_cm:numOuNulo(alvo.largura_cm),
          altura_cm:numOuNulo(alvo.altura_cm),profundidade_cm:numOuNulo(alvo.profundidade_cm),
          fotos:(i.data??[]).map(x=>x.url).filter((url:string)=>/^https:\/\//.test(url)),
          texto_tecnico_aprovado:textoSimples(b.data?.texto_md,3000),
          aplicacoes:apls.filter(a=>a.produto_id===alvo.id).map(a=>({
            modelo:a.modelo,montadora:a.montadora,motorizacao:a.motorizacao,
            ano_inicial:a.ano_inicial,ano_final:a.ano_final,
            pagina_slug:a.pagina_indexavel?a.pagina_slug:null,
            titulo:a.pagina_titulo,restricao:a.restricao,
          })),
        },
      };
    }
  }

  // imagem principal aprovada de cada produto da página
  const skus = (linhas ?? []).map((l: { sku: string | null }) => l.sku).filter(Boolean) as string[];
  const imagens = new Map<string, string>();
  const codigosAprovadosPorSku = new Map<string, { tipo: string; valor: string }[]>();
  if (skus.length) {
    const { data: ids } = await sb.from("produtos").select("id, sku").eq("loja_id", loja.id).in("sku", skus);
    const porId = new Map((ids ?? []).map((p: { id: string; sku: string }) => [p.id, p.sku]));
    if (loja.slug === "mobis" && porId.size) {
      const { data: referencias, error: errRef } = await sb.from("produto_codigos")
        .select("produto_id,tipo,valor").eq("loja_id", loja.id).eq("status", "aprovado")
        .in("produto_id", [...porId.keys()]).limit(200);
      if (errRef) console.warn("loja-publica referencias-aprovadas indisponiveis", errRef.code);
      for (const ref of referencias ?? []) {
        const sku = porId.get(ref.produto_id);
        if (!sku) continue;
        const atual = codigosAprovadosPorSku.get(sku) ?? [];
        if (atual.length < 12) atual.push({ tipo: ref.tipo, valor: ref.valor });
        codigosAprovadosPorSku.set(sku, atual);
      }
    }
    // view da migração 20261019000005: só imagem aprovada, sem retirada e com direitos de uso confirmados (nunca url_original)
    const { data: imgs } = await sb.from("imagens_publicaveis").select("produto_id, url, principal, ordem").eq("loja_id", loja.id).in("produto_id", [...porId.keys()]).order("principal", { ascending: false }).order("ordem");
    for (const i of imgs ?? []) { const s = porId.get(i.produto_id); if (s && !imagens.has(s)) imagens.set(s, i.url); }
  }
  const categoriaPorNo = new Map((nos ?? []).map((n: { id: string; nome: string }) => [n.id, n.nome]));
  const categoriaPorSku = new Map((linhas ?? []).map((l: { sku: string | null; taxonomia_no_id: string | null }) =>
    [l.sku, categoriaPorNo.get(l.taxonomia_no_id ?? "") ?? null]));
  const produtos = montarVitrine((linhas ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    preco: modoPreviaCatalogo ? null : l.preco,
    estoque: modoPreviaCatalogo ? null : l.estoque,
    imagem: imagens.get(String(l.sku)) ?? null,
  }) as never), loja.whatsapp, urlDoProduto)
    .map((produto) => ({
      ...produto, consulta_previa: modoPreviaCatalogo,
      categoria: categoriaPorSku.get(produto.sku) ?? null,
      referencias_aprovadas: codigosAprovadosPorSku.get(produto.sku) ?? [],
    }));

  const paginasPorSku: Record<string, { slug: string; titulo: string; modelo: string; status: string }[]> = {};
  if (loja.slug === "mobis" && idsPublicados.length) {
    let aq = sb.from("produto_aplicacoes")
      .select("produto_id,pagina_slug,pagina_titulo,modelo,status,pagina_indexavel")
      .eq("loja_id", loja.id).in("produto_id", idsPublicados).not("pagina_slug", "is", null);
    aq = aq.eq("status", "aprovado").eq("pagina_indexavel", true);
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

  // banners de oferta no ar (loja_banners): só produto publicado e dentro do período; falha aqui não derruba a vitrine
  const { data: bn } = await sb.rpc("banners_da_vitrine", { p_loja: loja.id });
  const banners = montarBanners(Array.isArray(bn) ? bn : [], loja.whatsapp, urlDoProduto);
  // tema da loja (cores/fonte/logo/ícone); sem tema salvo => perfil padrão. As variáveis CSS são calculadas aqui, de valores já validados.
  const { data: tm } = await sb.from("loja_tema").select("cor_primaria, cor_destaque, cor_bloco, fonte, logo_url, icone_url").eq("loja_id", loja.id).maybeSingle();
  const fonteTema = (FONTES as readonly string[]).includes(tm?.fonte) ? (tm!.fonte as Fonte) : "inter";
  const cores = tm ? { primaria: tm.cor_primaria, destaque: tm.cor_destaque, bloco: tm.cor_bloco } : PERFIS.azul_conecta;
  const tema = { variaveis: variaveisCss(cores, fonteTema), logo_url: tm?.logo_url ?? null, icone_url: tm?.icone_url ?? null };
  // Logotipos de montadoras: nunca substituir por marcas artificiais.
  // Só expor imagem liberada individualmente e com origem/direito registrados.
  const logos_montadoras:Record<string,string>={};
  if(loja.slug==="mobis"){
    const {data:midias}=await sb.from("veiculo_midias")
      .select("montadora_id,logo_png_url,logo_direito_uso")
      .eq("loja_id",loja.id).eq("logo_aprovado",true).eq("status","aprovado")
      .not("logo_png_url","is",null).not("logo_direito_uso","is",null).limit(40);
    const aprovadas=(midias??[]).filter(x=>typeof x.logo_direito_uso==="string"&&x.logo_direito_uso.trim().length>3
      &&typeof x.logo_png_url==="string"&&/^https:\/\//.test(x.logo_png_url));
    const ids=[...new Set(aprovadas.map(x=>x.montadora_id).filter(Boolean))];
    if(ids.length){
      const {data:nomes}=await sb.from("montadoras").select("id,nome").in("id",ids);
      const porId=new Map((nomes??[]).map(x=>[x.id,x.nome]));
      for(const imagem of aprovadas){
        const nome=porId.get(imagem.montadora_id);
        if(nome&&!logos_montadoras[nome])logos_montadoras[nome]=imagem.logo_png_url;
      }
    }
  }
  // Rodapé público: somente informações institucionais e políticas formalmente aprovadas.
  // Ausência, erro ou rascunho => null; jamais divulgar contatos ou textos não revisados.
  const { data: politicasAprovadas } = await sb.from("loja_politicas")
    .select("razao_social, cnpj, endereco, telefone, email_contato, privacidade_texto, troca_devolucao_texto, entrega_texto, garantia_texto, termos_texto")
    .eq("loja_id", loja.id).eq("status", "aprovada").maybeSingle();
  // Layout público: somente ponteiro publicado + cinco IDs conhecidos.
  // Nunca enviar versões, editores, autores, auditoria ou campos do Bling.
  const padrao = ["banner","montadoras","taxonomia","catalogo","empresa"];
  let layout = { blocos: padrao, intervalo_segundos: 6 };
  if (loja.slug === "mobis") {
    const {data: atual} = await sb.from("loja_layout_publicado")
      .select("versao_id").eq("loja_id",loja.id).maybeSingle();
    if (atual?.versao_id) {
      const {data: versao} = await sb.from("loja_layout_versoes")
        .select("blocos,intervalo_segundos").eq("loja_id",loja.id).eq("id",atual.versao_id).maybeSingle();
      const ids = versao?.blocos;
      if(Array.isArray(ids) && ids.length === 5 &&
        ids.every((x:unknown)=>typeof x==="string" && padrao.includes(x)) &&
        new Set(ids).size===5) {
        layout = {blocos:ids,intervalo_segundos:
          Number.isInteger(versao?.intervalo_segundos)&&versao.intervalo_segundos>=4&&versao.intervalo_segundos<=15
            ?versao.intervalo_segundos:6};
      }
    }
  }
  // Exposição mínima: somente os cinco tokens da paleta APROVADA e PUBLICADA.
  // Sem ponteiro publicado, a vitrine continua com a identidade institucional do CSS,
  // mesmo que exista um tema legado, rascunho ou proposta de IA no Dashboard.
  let paleta:Record<string,string>|null=null;
  if(loja.slug==="mobis"){
    const {data: atual}=await sb.from("loja_paleta_publicada")
      .select("versao_id").eq("loja_id",loja.id).maybeSingle();
    if(atual?.versao_id){
      const {data: publicavel}=await sb.from("loja_paleta_versoes")
        .select("cor_fundo,cor_superficie,cor_texto,cor_botao,cor_acento,aprovado_em")
        .eq("loja_id",loja.id).eq("id",atual.versao_id).not("aprovado_em","is",null).maybeSingle();
      const campos=["cor_fundo","cor_superficie","cor_texto","cor_botao","cor_acento"] as const;
      if(publicavel&&campos.every(c=>typeof publicavel[c]==="string"&&/^#[0-9a-f]{6}$/.test(publicavel[c])))
        paleta=Object.fromEntries(campos.map(c=>[c,publicavel[c]]));
    }
  }
  return json({ loja: { nome: loja.nome, slug: loja.slug, ...faseCliente, whatsapp: /^55\d{10,11}$/.test(String(loja.whatsapp ?? "").replace(/\D/g, "")) ? String(loja.whatsapp).replace(/\D/g, "") : null }, tema, layout, paleta, logos_montadoras, politicas: politicasAprovadas ?? null, produtos, paginas_aplicacao: paginasPorSku, banners, total: count ?? produtos.length, pagina, por_pagina: POR_PAGINA, veiculos: opcoesVeiculo(apls), montadoras_aprovadas, tipos: tiposDoVeiculo(apls), ficha, categorias, filtros: filtros ?? null });
});
