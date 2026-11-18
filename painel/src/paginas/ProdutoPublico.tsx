import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";

import "./produto-publico-mobis.css";
import "./mobis-identidade-2026.css";
import type { FichaProduto as Produto, FichaVeiculo } from "../lib/ficha.ts";
const logoMobis = "/marcas/mobis-logo-metalico-2026.webp";

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
  const [ficha, setFicha] = useState<{ produto: Produto; veiculos: FichaVeiculo[] } | null>(null);
  const [paginasVeiculos, setPaginasVeiculos] = useState<PaginaVeiculo[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch(`${SUPABASE_URL}/functions/v1/loja-publica`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL }, body: JSON.stringify({ slug, sku, q: sku }),
    }).then((r) => r.json()).then((j) => {
      const produto = (j?.produtos ?? []).find((p: Produto) => p.sku === sku);
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
        <span>Ficha do produto</span><span aria-hidden="true">/</span>
        <strong>SKU {ficha.produto.sku}</strong>
      </div>}
      {ficha && (slug === MOBIS.slug ?
        <div className="produto-publico-mobis-layout">
          <FichaProduto produto={ficha.produto} veiculos={ficha.veiculos} />
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
