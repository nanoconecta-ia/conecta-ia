import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { montarArvore, caminhoAte, contar, type No, type NoComTotais } from "../lib/arvore.ts";
import { iconeDaCategoria, tipoDeVeiculo } from "../lib/icones.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { vistaDaArea } from "../lib/vistas.ts";
import { VistaExplodida } from "../componentes/VistaExplodida.tsx";
import { SincroniaBling } from "../componentes/SincroniaBling.tsx";
import { conferir, type CategoriaBling, type Ligacao } from "../lib/taxonomiaBling.ts";
import { atendeBusca, cvVerificado, fotoUtilizavel, tituloSeoCategoria, indicadoresCadastro, urlExternaSegura } from "../lib/taxonomiaVisual.ts";
import "./taxonomia-visual.css";

type Montadora = { id: string; nome: string };
type Modelo = { id: string; montadora_id: string; nome: string; categoria: string | null };
type Motor = { id: string; codigo: string; familia_id: string; status: string; cilindrada_cc: number | null; potencia_kw: number | null };
type Familia = { id: string; nome: string; fabricante: string | null };
type Fabricante = { id: string; nome: string; papel: string };
type Peca = { id: string; codigo: string; descricao: string | null; taxonomia_no_id: string | null; fabricante_id: string | null; montadora_id: string | null; status: string; fonte_id: string | null };
type Fonte = { id: string; url: string | null; titulo: string; licenciada: boolean | null };
type Produto = { id: string; sku: string | null; nome: string | null; marca: string | null; descricao_curta: string | null; taxonomia_no_id: string | null };
type Imagem = { id: string; produto_id: string; url: string; aprovada: boolean; direitos_confirmados_em: string | null; tipo: string | null; removida_em: string | null; alt_texto: string | null; principal: boolean };
type Codigo = { produto_id: string; tipo: string; valor: string; status: string; fonte: string | null };
type Dados = {
  nos: No[]; produtos: Produto[]; montadoras: Montadora[]; modelos: Modelo[];
  motores: Motor[]; familias: Familia[]; fabricantes: Fabricante[];
  pecas: Peca[]; fontes: Fonte[]; imagens: Imagem[]; codigos: Codigo[];
  categoriasBling: CategoriaBling[]; ligacoes: Ligacao[];
};
type Aba = "categorias" | "veiculos" | "motores" | "oem" | "midia";
const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: "categorias", rotulo: "Categorias", icone: "catalogo" },
  { id: "veiculos", rotulo: "Montadoras e modelos", icone: "loja" },
  { id: "motores", rotulo: "Motores e potência", icone: "motor" },
  { id: "oem", rotulo: "Códigos e fabricantes", icone: "caixas" },
  { id: "midia", rotulo: "Fotos e SEO", icone: "imagem" },
];
const formatar = (n: number) => n.toLocaleString("pt-BR");
const STATUS_APROVADO = "aprovado";

function FotoReal({ foto, titulo }: { foto: Imagem | null; titulo: string }) {
  const ok = foto && fotoUtilizavel(foto);
  return <div className={"tx-foto " + (ok ? "tx-foto-real" : "tx-foto-vazia")}>
    {ok ? <img src={urlExternaSegura(foto.url)!} loading="lazy" decoding="async" alt={foto.alt_texto?.trim() || titulo} /> :
      <div className="tx-vazio-visual"><Icone nome="image-off" tamanho={38}/><strong>Foto real ainda não autorizada</strong><small>Somente imagens originais, com direitos confirmados e aprovação.</small></div>}
    <span className="tx-foto-selo">{ok ? "FOTO REAL AUTORIZADA" : "SEM FOTO VALIDADA"}</span>
  </div>;
}

function CartaoCategoria({ n, onClick, ativo }: { n: NoComTotais; onClick: () => void; ativo: boolean }) {
  return <button type="button" onClick={onClick} className={"tx-categoria " + (ativo ? "tx-selecionado" : "")} aria-pressed={ativo}>
    <span className="tx-categoria-icone"><IconePeca nome={iconeDaCategoria(n.slug, n.nome)} tamanho={52}/></span>
    <span className="tx-categoria-textos"><strong>{n.nome}</strong><small>{n.filhos.length} subcategorias · {n.produtos} produtos</small></span>
    <Icone nome="chevron-right" tamanho={17}/>
  </button>;
}
function Aviso({children}:{children:React.ReactNode}) {
  return <p className="tx-aviso"><Icone nome="shield-check" tamanho={17}/><span>{children}</span></p>;
}

export function Taxonomia({ loja }: { loja: Loja }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [aba, setAba] = useState<Aba>("categorias");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [montadoraId, setMontadoraId] = useState<string | null>(null);
  const [detalhesAvancados, setDetalhesAvancados] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const consultas = [
        supabase.from("taxonomia_nos").select("id,pai_id,nome,slug,ordem").eq("perfil_ramo",loja.perfil_ramo).order("ordem").order("nome"),
        supabase.from("produtos").select("id,sku,nome,marca,descricao_curta,taxonomia_no_id").eq("loja_id",loja.id).limit(2500),
        supabase.from("montadoras").select("id,nome").order("nome").limit(500),
        supabase.from("modelos").select("id,montadora_id,nome,categoria").order("nome").limit(2000),
        supabase.from("motores").select("id,codigo,familia_id,status,cilindrada_cc,potencia_kw").limit(600),
        supabase.from("familias_motor").select("id,nome,fabricante").limit(300),
        supabase.from("fabricantes_peca").select("id,nome,papel").limit(500),
        supabase.from("pecas_ref").select("id,codigo,descricao,taxonomia_no_id,fabricante_id,montadora_id,status,fonte_id").limit(2500),
        supabase.from("fontes").select("id,url,titulo,licenciada").limit(500),
        supabase.from("produto_imagens").select("id,produto_id,url,aprovada,direitos_confirmados_em,tipo,removida_em,alt_texto,principal").eq("loja_id",loja.id).eq("aprovada",true).limit(1000),
        supabase.from("produto_codigos").select("produto_id,tipo,valor,status,fonte").eq("loja_id",loja.id).limit(1500),
        supabase.from("bling_categorias").select("bling_id,nome,pai_bling_id").eq("loja_id",loja.id).limit(2000),
        supabase.from("bling_categoria_taxonomia").select("bling_categoria_id,taxonomia_no_id").eq("loja_id",loja.id).limit(2000),
      ] as const;
      const resultados = await Promise.all(consultas);
      if (!vivo) return;
      const falhas = resultados.flatMap((r,i) => r.error ? [(["Taxonomia","Produtos","Montadoras","Modelos","Motores","Famílias motor","Fabricantes","Peças OEM","Fontes","Fotos","Códigos","Categorias Bling","Vínculos Bling"][i])] : []);
      setErros(falhas);
      const lista = <T,>(i:number) => (resultados[i].error ? [] : resultados[i].data ?? []) as T[];
      setDados({
        nos:lista<No>(0),produtos:lista<Produto>(1),montadoras:lista<Montadora>(2),modelos:lista<Modelo>(3),
        motores:lista<Motor>(4),familias:lista<Familia>(5),fabricantes:lista<Fabricante>(6),
        pecas:lista<Peca>(7),fontes:lista<Fonte>(8),imagens:lista<Imagem>(9),codigos:lista<Codigo>(10),
        categoriasBling:lista<CategoriaBling>(11),ligacoes:lista<Ligacao>(12),
      });
    })().catch(() => { if (vivo) setErros(["O servidor não respondeu."]); });
    return () => { vivo = false; };
  },[loja.id,loja.perfil_ramo]);

  const raizes = useMemo(() => dados ? montarArvore(dados.nos,contar(dados.produtos,x=>x.taxonomia_no_id),contar(dados.ligacoes,x=>x.taxonomia_no_id)) : [],[dados]);
  const trilha = useMemo(() => caminhoAte(raizes,sel),[raizes,sel]);
  const categoriaAtual = trilha.at(-1) ?? null;
  const setor = trilha[0] ?? null;
  const arvoreVisivel = categoriaAtual?.filhos.length ? categoriaAtual.filhos : raizes;
  const categoriasFiltradas = arvoreVisivel.filter(n=>atendeBusca(busca,n.nome,n.slug));
  const filhosIds = useMemo(()=>{
    const ids = new Set<string>();
    const recolher=(n:NoComTotais)=>{ids.add(n.id);for(const f of n.filhos)recolher(f);};
    if(categoriaAtual) recolher(categoriaAtual);
    return ids;
  },[categoriaAtual]);
  const produtosCategoria = dados?.produtos.filter(p=>filhosIds.has(p.taxonomia_no_id??"") && atendeBusca(busca,p.nome,p.sku,p.marca)).slice(0,16) ?? [];
  const pecasCategoria = dados?.pecas.filter(p=>filhosIds.has(p.taxonomia_no_id??"")).slice(0,10) ?? [];
  const imagensValidas = (dados?.imagens??[]).filter(fotoUtilizavel);
  const fotosPorProduto = new Map(imagensValidas.map(i=>[i.produto_id,i]));
  const modelosMontadora = (dados?.modelos??[]).filter(m=>m.montadora_id===montadoraId&&atendeBusca(busca,m.nome));
  const montadoraSelecionada = dados?.montadoras.find(m=>m.id===montadoraId) ?? null;
  const conferencia=useMemo(()=>dados ? conferir(dados.nos,dados.categoriasBling,dados.ligacoes) : null,[dados]);
  const fotoPrincipal = produtosCategoria.map(p=>fotosPorProduto.get(p.id)).find(Boolean) ?? null;
  const OEMaprovados = dados?.codigos.filter(c=>c.tipo==="oem"&&c.status===STATUS_APROVADO).length ?? 0;
  const fonteValida = (id: string | null) => dados?.fontes.find(f=>f.id===id);
  const vista = vistaDaArea(setor?.slug);

  return <main className="tx-workspace" aria-label="Engenharia visual do catálogo">
    <header className="tx-header">
      <div><div className="tx-supratitulo"><Icone nome="layers" tamanho={16}/> CONECTA.IA / CATÁLOGO TÉCNICO</div>
        <h1>Taxonomia visual de autopeças</h1>
        <p>Montadoras, motores, categorias, códigos originais e imagens — com origem e situação de validação.</p>
      </div>
      <a className="tx-link-pesquisa" href="#/pesquisa"><Icone nome="search" tamanho={18}/> Pesquisa OEM e fontes ↗</a>
    </header>

    <div className="tx-indicadores">
      <div><strong>{dados ? formatar(dados.nos.length) : "—"}</strong><span>Nós da taxonomia</span></div>
      <div><strong>{dados ? formatar(dados.montadoras.length) : "—"}</strong><span>Montadoras cadastradas</span></div>
      <div><strong>{dados ? formatar(dados.motores.length) : "—"}</strong><span>Motores na base</span></div>
      <div><strong>{dados ? imagensValidas.length : "—"}</strong><span>Fotos reais autorizadas</span></div>
    </div>
    {erros.length>0 && <div className="tx-erro" role="alert">Não foi possível consultar: {erros.join(", ")}. Informações não carregadas não devem ser interpretadas como zero.</div>}

    <div className="tx-navegador">
      <div className="tx-busca"><Icone nome="search" tamanho={20}/><input aria-label="Localizar categoria, veículo, motor, peça ou fabricante" placeholder="Localizar categoria, montadora, motor, SKU ou OEM..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        {busca&&<button type="button" aria-label="Limpar filtro" onClick={()=>setBusca("")}><Icone nome="x" tamanho={17}/></button>}
      </div>
      <nav className="tx-abas" aria-label="Áreas do catálogo">
        {ABAS.map(t=><button type="button" key={t.id} aria-current={aba===t.id?"page":undefined} onClick={()=>setAba(t.id)}>
          <Icone nome={t.icone} tamanho={17}/><span>{t.rotulo}</span>
        </button>)}
      </nav>
    </div>

    {!dados ? <div className="tx-carregando" role="status">Consultando taxonomia e conhecimento automotivo...</div> : <>
      {aba==="categorias" && <div className="tx-conteudo">
        <section className="tx-painel-categorias" aria-label="Categorias e subcategorias">
          <div className="tx-trilha"><button type="button" onClick={()=>setSel(null)}>Todas as áreas</button>{trilha.map(n=><span key={n.id}>/ <button type="button" onClick={()=>setSel(n.id)}>{n.nome}</button></span>)}</div>
          <div className="tx-secao-titulo"><h2>{categoriaAtual?.filhos.length?"Subcategorias de "+categoriaAtual.nome: categoriaAtual?.nome??"Sistemas automotivos"}</h2><small>{categoriasFiltradas.length} opções</small></div>
          <div className="tx-grade-categorias">
            {categoriasFiltradas.map(n=><CartaoCategoria key={n.id} n={n} ativo={sel===n.id} onClick={()=>setSel(n.id)}/>)}
          </div>
          {categoriaAtual&&<div className="tx-categoria-escolhida">
            <div className="tx-secao-titulo"><h2>Produtos do cadastro · {categoriaAtual.nome}</h2><small>{categoriaAtual.produtos} classificados</small></div>
            {produtosCategoria.length===0 ? <p className="tx-sem-dados">Não há produtos vinculados a este nó ou os dados ainda não foram liberados.</p>:
              <div className="tx-lista-produtos">{produtosCategoria.map(p=><article key={p.id} className="tx-produto">
                <FotoReal foto={fotosPorProduto.get(p.id)??null} titulo={p.nome??"Peça do catálogo"} />
                <div><strong>{p.nome??"Produto sem descrição"}</strong><small>SKU {p.sku||"a confirmar"} · Marca {p.marca||"a confirmar"}</small>
                  <span>{dados.codigos.some(c=>c.produto_id===p.id&&c.tipo==="oem"&&c.status==="aprovado")?"OEM aprovado vinculado":"OEM não validado"}</span></div>
                <a href={"#/studio?produto="+encodeURIComponent(p.id)}>Ficha técnica ↗</a></article>)}</div>}
          </div>}
        </section>
        <aside className="tx-detalhe" aria-label="Detalhes técnicos da categoria">
          <div className="tx-detalhe-titulo"><span className="tx-selo">VISÃO DOCUMENTADA</span><h2>{categoriaAtual?.nome??"Selecione uma categoria"}</h2></div>
          <FotoReal foto={fotoPrincipal} titulo={categoriaAtual?.nome??"Foto técnica"} />
          {vista ? <div className="tx-diagrama"><div className="tx-selo tx-ilustracao">DIAGRAMA ILUSTRATIVO · NÃO OEM</div>
              <VistaExplodida vista={vista} ativo={categoriaAtual?.slug} aoEscolher={slug=>{
                const n = dados.nos.find(x=>x.slug===slug);
                if(n) setSel(n.id);
              }}/></div>:
              <div className="tx-sem-diagrama"><Icone nome="layers" tamanho={26}/><p>Esta área ainda não tem diagrama técnico associado. Não substituir por imagem de motor ou veículo diferente.</p></div>}
          {categoriaAtual&&<div className="tx-checklist"><h3>Conferência antes da publicação</h3>
            {indicadoresCadastro({foto:!!fotoPrincipal,codigoOem:produtosCategoria.some(p=>dados.codigos.some(c=>c.produto_id===p.id&&c.tipo==="oem"&&c.status==="aprovado")),versaoConfirmada:false,fonte:pecasCategoria.some(p=>!!fonteValida(p.fonte_id))}).map(x=><div key={x.chave}><span className={x.ok?"tx-check-ok":"tx-check-pendente"}>{x.ok?"✓":"—"}</span>{x.nome}</div>)}
            <a href="#/pesquisa">Buscar documentação OEM ↗</a>
          </div>}
        </aside>
      </div>}

      {aba==="veiculos" && <div className="tx-conteudo">
        <section className="tx-painel-categorias"><div className="tx-secao-titulo"><h2>Montadoras e veículos</h2><small>{dados.montadoras.length} montadoras</small></div>
          <div className="tx-grade-marcas">{dados.montadoras.filter(m=>atendeBusca(busca,m.nome)).map(m=><button key={m.id} className={"tx-marca "+(montadoraId===m.id?"tx-selecionado":"")} type="button" onClick={()=>setMontadoraId(m.id)} aria-pressed={montadoraId===m.id}>
            <span className="tx-marca-monograma" aria-hidden="true">{m.nome.slice(0,2).toUpperCase()}</span><strong>{m.nome}</strong><small>{dados.modelos.filter(x=>x.montadora_id===m.id).length} modelos cadastrados</small></button>)}</div>
          <Aviso>Monogramas representam texto, não logomarcas licenciadas. Fotos reais e logotipos precisam de direitos de uso verificados.</Aviso>
        </section>
        <aside className="tx-detalhe">
          <div className="tx-detalhe-titulo"><span className="tx-selo">MODELOS CADASTRADOS</span><h2>{montadoraSelecionada?.nome??"Escolha uma montadora"}</h2></div>
          {!montadoraId?<p className="tx-sem-dados">Selecione a montadora para visualizar seus modelos.</p>: modelosMontadora.length?
            <div className="tx-modelos">{modelosMontadora.map(m=><article key={m.id}><div className="tx-silhueta">{tipoDeVeiculo(m.categoria) ? <IconeVeiculo tipo={tipoDeVeiculo(m.categoria)!} largura={124}/> : <IconePeca nome="todas" tamanho={60}/>}</div>
              <div><strong>{m.nome}</strong><span>{m.categoria??"Categoria a confirmar"}</span><small>Foto e versão técnica não cadastradas.</small></div></article>)}</div>:
            <p className="tx-sem-dados">Não há modelos cadastrados para esta seleção.</p>}
          <Aviso>A associação entre modelo, versão, motor, anos e potência ainda precisa de evidências aprovadas. Compartilhar um motor não prova a aplicação da peça.</Aviso>
        </aside>
      </div>}

      {aba==="motores" && <div className="tx-painel-amplo"><div className="tx-secao-titulo"><h2>Biblioteca de motores</h2><small>Potência em CV apenas quando o dado de kW estiver aprovado</small></div>
        <div className="tx-grade-motores">{dados.motores.filter(m=>atendeBusca(busca,m.codigo,dados.familias.find(f=>f.id===m.familia_id)?.nome)).map(m=>{
          const fam=dados.familias.find(f=>f.id===m.familia_id);const cv=cvVerificado(m.potencia_kw,m.status);
          return <article className="tx-motor" key={m.id}>
            <div className="tx-motor-arte"><IconePeca nome="motor" tamanho={86}/><span>ILUSTRAÇÃO DA FAMÍLIA</span></div>
            <div className="tx-motor-dados"><span className={"tx-selo "+(m.status==="aprovado"?"tx-aprovado":"tx-pendente")}>{m.status==="aprovado"?"DADO APROVADO":"A CONFIRMAR"}</span>
              <h3>{m.codigo}</h3><strong>{fam?.nome??"Família não relacionada"}</strong><p>Fabricante do motor: {fam?.fabricante||"não informado"}</p>
              <div className="tx-motor-metricas"><div><b>{m.status==="aprovado"&&m.cilindrada_cc?formatar(m.cilindrada_cc):"—"}</b><small>cm³ confirmados</small></div><div><b>{cv??"—"}</b><small>CV calculado de kW validado</small></div></div>
              <small>Vínculo ao veículo/ano: não confirmado nesta visão.</small>
            </div></article>})}</div>
        <Aviso>A potência é calculada a partir de kW aprovado (1 kW ≈ 1,35962 CV). Não exibir um número só por semelhança entre motores.</Aviso>
      </div>}

      {aba==="oem" && <div className="tx-conteudo">
        <section className="tx-painel-categorias"><div className="tx-secao-titulo"><h2>Referências OEM e peças</h2><small>{OEMaprovados} OEM aprovados em produtos</small></div>
          <div className="tx-lista-referencias">{dados.pecas.filter(p=>atendeBusca(busca,p.codigo,p.descricao,dados.fabricantes.find(x=>x.id===p.fabricante_id)?.nome)).map(p=>{
            const f=fonteValida(p.fonte_id),link=urlExternaSegura(f?.url);
            return <article className="tx-referencia" key={p.id}><div><span className="tx-codigo">{p.codigo}</span><span className={"tx-selo "+(p.status==="aprovado"?"tx-aprovado":"tx-pendente")}>{p.status==="aprovado"?"APROVADO":"A CONFIRMAR"}</span></div>
              <h3>{p.descricao??"Referência sem descrição"}</h3><p>{dados.fabricantes.find(x=>x.id===p.fabricante_id)?.nome??"Fabricante a confirmar"} · {dados.montadoras.find(x=>x.id===p.montadora_id)?.nome??"Montadora não vinculada"}</p>
              {link?<a href={link} target="_blank" rel="noopener noreferrer">Documento de origem: {f?.titulo} ↗</a>:<small>Sem documento público vinculado.</small>}
            </article>})}</div>
          {!dados.pecas.length&&<p className="tx-sem-dados">Ainda não existem referências cadastradas.</p>}
        </section>
        <aside className="tx-detalhe"><div className="tx-detalhe-titulo"><span className="tx-selo">PROCEDÊNCIA</span><h2>Fabricantes e sistemistas</h2></div>
          <div className="tx-lista-fabricantes">{dados.fabricantes.filter(f=>atendeBusca(busca,f.nome,f.papel)).map(f=><div key={f.id}><div className="tx-fab-monograma">{f.nome.slice(0,2).toUpperCase()}</div><div><strong>{f.nome}</strong><small>{f.papel.replaceAll("_"," ")}</small></div></div>)}</div>
          <Aviso>OEM, marca do veículo, fabricante da peça e importador são entidades diferentes. Códigos cruzados não representam equivalência homologada automaticamente.</Aviso>
        </aside>
      </div>}

      {aba==="midia" && <div className="tx-conteudo">
        <section className="tx-painel-categorias"><div className="tx-secao-titulo"><h2>Fotografia real e diagramas</h2><small>{imagensValidas.length} imagens elegíveis</small></div>
          {imagensValidas.length ? <div className="tx-grade-fotos">{imagensValidas.map(f=><figure key={f.id}><img loading="lazy" src={urlExternaSegura(f.url)!} alt={f.alt_texto??"Produto com imagem aprovada"}/><figcaption>{dados.produtos.find(p=>p.id===f.produto_id)?.nome??"Produto do catálogo"}<small>Direitos confirmados</small></figcaption></figure>)}</div>:
            <div className="tx-fotos-vazias"><Icone nome="image-off" tamanho={50}/><h3>Nenhuma foto real está autorizada nesta biblioteca.</h3><p>Importe fotografias do fabricante/distribuidor com licença confirmada, registre a origem, revise a aplicação e aprove antes de mostrar ao cliente.</p><a href="#/imagens">Abrir Imagens e SEO ↗</a></div>}
          <Aviso>Vista explodida SVG é ilustrativa. Diagrama OEM só deve aparecer associado ao documento autorizado, modelo e versão exatos.</Aviso>
        </section>
        <aside className="tx-detalhe"><div className="tx-detalhe-titulo"><span className="tx-selo">SEO TÉCNICO</span><h2>Prévia de metadados</h2></div>
          <div className="tx-seo"><small>Prévia interna · não publicada</small><strong>{tituloSeoCategoria(categoriaAtual?.nome??"Categoria automotiva",montadoraSelecionada?.nome)}</strong><p>Metadados definitivos exigem SKU, aplicação, código e imagem aprovados. Não anunciar compatibilidade presumida.</p></div>
          <div className="tx-checklist"><h3>Checklist de publicação</h3>{indicadoresCadastro({foto:imagensValidas.length>0,codigoOem:OEMaprovados>0,versaoConfirmada:false,fonte:dados.fontes.length>0}).map(x=><div key={x.chave}><span className={x.ok?"tx-check-ok":"tx-check-pendente"}>{x.ok?"✓":"—"}</span>{x.nome}</div>)}</div>
          <a className="tx-link-pesquisa" href="#/studio">Revisar Studio de produtos ↗</a>
        </aside>
      </div>}
    </>}
    <div className="tx-avancado"><button type="button" onClick={()=>setDetalhesAvancados(!detalhesAvancados)} aria-expanded={detalhesAvancados}>
      <Icone nome="chevron-down" tamanho={18}/> Auditoria de categorias do Bling {detalhesAvancados?"−":"+"}</button>
      {detalhesAvancados&&conferencia&&<SincroniaBling c={conferencia}/>}
      <span>Consulta somente leitura; cadastro, imagens e aplicações não são alterados nesta tela.</span>
    </div>
  </main>;
}
