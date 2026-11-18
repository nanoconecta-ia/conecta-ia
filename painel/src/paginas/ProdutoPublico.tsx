import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";

import "./produto-publico-mobis.css";
import "./mobis-identidade-2026.css";
import type { FichaProduto as Produto, FichaVeiculo } from "../lib/ficha.ts";
const logoMobis = "/marcas/mobis-logo-metalico-2026.webp";
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
      {ficha && <FichaProduto produto={ficha.produto} veiculos={ficha.veiculos} />}
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
