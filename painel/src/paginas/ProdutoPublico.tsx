import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";

import "./produto-publico-mobis.css";
import "./mobis-identidade-2026.css";
import { periodo, type FichaProduto as Produto, type FichaVeiculo } from "../lib/ficha.ts";
type ProdutoMobis=Produto & {categoria_caminho?:{nome:string;slug:string}[];referencias_aprovadas?:{tipo:string;valor:string}[];galeria_aprovada?:string[]};
const logoMobis = "/marcas/mobis-logo-metalico-2026.webp?v=20261118-m2";

/** QR enviado pelo próprio WhatsApp Business MOBIS em 18/11/2026.
 * O botão usa o link de produto validado pela API quando existir; caso contrário, a URL institucional.
 */
const QR_WHATSAPP_OFICIAL="/marcas/mobis-qr-whatsapp-business-oficial.png";
const WHATSAPP_OFICIAL="https://wa.me/mobisautopecas?src=qr";
const SISTEMAS_VISUAIS_MOBIS=[
  {nome:"Motor",img:"motor"},
  {nome:"Cabeçote",img:"cabecote"},
  {nome:"Suspensão",img:"suspensao"},
  {nome:"Transmissão",img:"transmissao"},
  {nome:"Elétrica",img:"eletrica"},
  {nome:"Carroceria",img:"carroceria"},
  {nome:"Acessórios",img:"acessorios"},
] as const;

type PaginaVeiculo = { slug:string;titulo:string;modelo:string;status:string };

/** Redes sociais oficiais da loja. Preencher somente com links confirmados pela loja; vazio = não aparece. */
const REDES_SOCIAIS: { nome: string; url: string }[] = [];

/** Página pública do produto (#/p/<loja>/<sku>): ficha técnica, aplicações aprovadas, WhatsApp e redes. Só lê dado aprovado e publicado. */
export function ProdutoPublico({ slug, sku }: { slug: string; sku: string }) {
  const [ficha, setFicha] = useState<{ produto: ProdutoMobis; veiculos: FichaVeiculo[] } | null>(null);
  const [abaDetalhe,setAbaDetalhe]=useState<"descricao"|"especificacoes"|"aplicacoes">("descricao");
  const [fotoSelecionada,setFotoSelecionada]=useState<string|null>(null);
  useEffect(()=>{setFotoSelecionada(null)},[sku]);
  const [paginasVeiculos, setPaginasVeiculos] = useState<PaginaVeiculo[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch(`${SUPABASE_URL}/functions/v1/loja-publica`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL }, body: JSON.stringify({ slug, sku, q: sku }),
    }).then((r) => r.json()).then((j) => {
      const produto = (j?.produtos ?? []).find((p: ProdutoMobis) => p.sku === sku);
      if (!vivo) return;
      if (produto && j?.ficha) {
        const consulta = (produto as Produto & { em_estoque?:boolean|null;consulta_previa?:boolean }).em_estoque;
        const previa = (produto as Produto & { consulta_previa?:boolean }).consulta_previa;
        setFicha({ produto: { ...produto, preco: consulta === true && !previa ? produto.preco : null },
          veiculos: j.ficha.veiculos ?? [] });
        setPaginasVeiculos(((j.paginas_aplicacao?.[sku] ?? []) as PaginaVeiculo[])
          .filter(a => a.status === "aprovado"));
      }
    }).catch(() => undefined); // sem ficha, a página mostra só o cabeçalho e o contato
    return () => { vivo = false; };
  }, [slug, sku]);

  return (
    <main className={slug === MOBIS.slug ? "produto-publico-mobis" : undefined}>
      {slug === MOBIS.slug && <header className="produto-publico-mobis-cab">
        <a href="#/loja/mobis" aria-label="Voltar à loja Mobis Autopeças">
          <img src={logoMobis} alt="MOBIS AUTOPEÇAS" /></a>
        <a href="#/loja/mobis">← Voltar à loja</a>
      </header>}
      {slug === MOBIS.slug && ficha && <div className="produto-publico-mobis-navegacao" aria-label="Caminho do produto">
        <a href="#/loja/mobis">Catálogo</a><span aria-hidden="true">/</span>
        {(ficha.produto.categoria_caminho??[]).map(n=><span key={n.slug} className="produto-publico-mobis-pai">
          <a href={"#/loja/mobis/sistema/"+encodeURIComponent(n.slug)}>{n.nome}</a><span aria-hidden="true">/</span>
        </span>)}
        <span>Ficha do produto</span><span aria-hidden="true">/</span>
        <strong>SKU {ficha.produto.sku}</strong>
      </div>}
      {ficha && (slug === MOBIS.slug ?
        <div className="produto-publico-mobis-layout">
          <div className="produto-publico-mobis-ficha-coluna">
            <FichaProduto produto={fotoSelecionada?{...ficha.produto,imagem:fotoSelecionada}:ficha.produto}
              veiculos={ficha.veiculos} />
            {(ficha.produto.galeria_aprovada?.length??0)>1&&<div className="produto-publico-mobis-galeria"
              role="group" aria-label="Fotografias aprovadas da peça">
              {ficha.produto.galeria_aprovada?.map((url,i)=><button type="button" key={url}
                aria-pressed={(fotoSelecionada??ficha.produto.imagem)===url}
                aria-label={"Visualizar foto "+(i+1)+" da peça "+ficha.produto.sku}
                onClick={()=>setFotoSelecionada(url)}>
                <img src={url} width={82} height={82} loading="lazy"
                  alt={"Vista "+(i+1)+" da peça "+ficha.produto.sku}/>
              </button>)}
            </div>}
          </div>
          <aside className="produto-publico-mobis-contato" aria-label="Atendimento pelo WhatsApp da MOBIS">
            <span className="produto-publico-mobis-marcador">ATENDIMENTO MOBIS</span>
            <h2>Consulte sua peça</h2>
            <p>Informe o SKU <strong>{ficha.produto.sku}</strong>, modelo, ano e motorização para confirmar a aplicação.</p>
            <a className="produto-publico-mobis-acessar" href={ficha.produto.whatsapp || WHATSAPP_OFICIAL} target="_blank" rel="noopener noreferrer">
              Falar pelo WhatsApp
            </a>
            <div className="produto-publico-mobis-qr-area">
              <span>Aponte a câmera</span>
              <a href={WHATSAPP_OFICIAL} target="_blank" rel="noopener noreferrer" aria-label="Abrir o WhatsApp Business oficial da MOBIS">
                <img src={QR_WHATSAPP_OFICIAL} width={244} height={244} alt="QR Code oficial do WhatsApp Business da MOBIS AUTOPEÇAS"/>
              </a>
              <small>QR oficial da MOBIS · Não informa compatibilidade</small>
            </div>
            <p className="produto-publico-mobis-dominio"><a href={MOBIS.site} target="_blank" rel="noopener noreferrer">www.mobisautopecas.com.br</a></p>
          </aside>
        </div>
      : <FichaProduto produto={ficha.produto} veiculos={ficha.veiculos} />)}
      {slug === MOBIS.slug && ficha && <section className="produto-publico-mobis-detalhes" aria-label="Informações técnicas do produto">
        <div className="produto-publico-mobis-detalhes-titulo">
          <span>CATÁLOGO TÉCNICO</span>
          <h2>Descrição e especificações</h2>
        </div>
        <div className="produto-publico-mobis-abas" role="tablist" aria-label="Informações do SKU">
          <button type="button" role="tab" aria-selected={abaDetalhe==="descricao"}
            onClick={()=>setAbaDetalhe("descricao")}>Descrição</button>
          <button type="button" role="tab" aria-selected={abaDetalhe==="especificacoes"}
            onClick={()=>setAbaDetalhe("especificacoes")}>Especificações técnicas</button>
          <button type="button" role="tab" aria-selected={abaDetalhe==="aplicacoes"}
            onClick={()=>setAbaDetalhe("aplicacoes")}>Utilização em veículos</button>
        </div>
        <div className="produto-publico-mobis-conteudo-abas" role="tabpanel">
          {abaDetalhe==="descricao"&&<div>
            <h3>Descrição do produto</h3>
            {ficha.produto.descricao
              ? <p>{ficha.produto.descricao}</p>
              : <p>Descrição complementar a confirmar com a equipe MOBIS. Consulte o código SKU antes da compra.</p>}
          </div>}
          {abaDetalhe==="especificacoes"&&<div>
            <h3>Dados técnicos e referências aprovadas</h3>
            <dl className="produto-publico-mobis-especificacoes">
              <div><dt>Código SKU</dt><dd>{ficha.produto.sku}</dd></div>
              <div><dt>Marca</dt><dd>{ficha.produto.marca??"A confirmar"}</dd></div>
              {(ficha.produto.categoria_caminho??[]).length>0&&<div>
                <dt>Classificação</dt>
                <dd>{ficha.produto.categoria_caminho?.map(x=>x.nome).join(" → ")}</dd>
              </div>}
              {(ficha.produto.referencias_aprovadas??[]).map((r,i)=><div key={r.tipo+":"+r.valor+":"+i}>
                <dt>{r.tipo.toUpperCase()} aprovado</dt><dd>{r.valor}</dd>
              </div>)}
            </dl>
            <p>Dimensões, composição, OEM e outros dados só aparecem após validação documental no cadastro.</p>
          </div>}
          {abaDetalhe==="aplicacoes"&&<div>
            <h3>Aplicações confirmadas do produto</h3>
            {ficha.veiculos.length
              ? <ul className="produto-publico-mobis-aplicacoes-lista">
                  {ficha.veiculos.map((v,i)=><li key={v.modelo+"-"+i}>
                    <strong>{v.modelo}</strong>
                    <span>{[v.motor,periodo(v.de,v.ate)].filter(Boolean).join(" · ")||"Dados técnicos a confirmar"}</span>
                  </li>)}
                </ul>
              : <p>Nenhuma aplicação técnica aprovada para publicação. Informe o modelo, motor, ano e chassi à equipe MOBIS.</p>}
            <p>O mesmo SKU físico pode atender modelos diferentes somente após aprovação técnica.</p>
          </div>}
        </div>
      </section>}
      {slug === MOBIS.slug && ficha && <section className="produto-publico-mobis-sistemas" aria-label="Sistemas de peças da MOBIS">
        <div className="produto-publico-mobis-sistemas-titulo">
          <div><span>SISTEMAS DO CATÁLOGO</span><h2>Encontre outras peças</h2></div>
          <a href="#/loja/mobis">Ver catálogo completo →</a>
        </div>
        <div className="produto-publico-mobis-sistemas-grade">
          {SISTEMAS_VISUAIS_MOBIS.map(s=><div key={s.img} className="produto-publico-mobis-sistema">
            <img src={"/icones-catalogo-mobis/mobis-sistema-"+s.img+"-512.webp"} alt="" aria-hidden="true" width={115} height={115} loading="lazy"/>
            <span>{s.nome}</span>
          </div>)}
        </div>
        <p>Os ícones identificam sistemas automotivos, não uma compatibilidade confirmada para este produto.</p>
      </section>}
      {slug === MOBIS.slug && ficha && <section className="produto-publico-mobis-aplicacoes" aria-label="Páginas por veículo">
        <h2>Aplicações por veículo</h2>
        {paginasVeiculos.length ? <div className="produto-publico-mobis-grade">{paginasVeiculos.map(a=>
          <a key={a.slug} href={"#/a/"+encodeURIComponent(a.slug)}>
            <strong>{a.modelo}</strong><small>{a.titulo}</small><span>Ver página da aplicação →</span>
          </a>)}</div>
        : <p>As páginas individuais por veículo serão vinculadas aqui após a aprovação técnica de cada aplicação.</p>}
        <p>O SKU físico continua único: as páginas por veículo não representam peças ou estoques diferentes.</p>
      </section>}
      <div className="cartao">
        {REDES_SOCIAIS.length > 0 && <nav className="produto-publico-redes" aria-label="Redes sociais da loja">
          {REDES_SOCIAIS.map(r => <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.nome}</a>)}
        </nav>}
        {slug === MOBIS.slug && <p className="suave"><a href={MOBIS.site}>mobisautopecas.com.br — site oficial</a></p>}
      </div>
    </main>
  );
}
