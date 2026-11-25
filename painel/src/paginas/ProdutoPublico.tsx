import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";
import { RodapeMobisEnxuto } from "../componentes/RodapeMobisEnxuto.tsx";
import type { PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import logoMobis from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";
import logoMobisOficial from "../assets/marcas/mobis-mstyle-v3-logo.png";
import { fichaPilotoMobis } from "../lib/fichaPilotoMobis.ts";
import "./produto-publico-mobis.css";
import type { FichaProduto as Produto, FichaVeiculo } from "../lib/ficha.ts";
type PaginaVeiculo = { slug:string;titulo:string;modelo:string;status:string };

/** Redes sociais oficiais da loja. Preencher somente com links confirmados pela loja; vazio = não aparece. */
const REDES_SOCIAIS: { nome: string; url: string }[] = [];

/** Página pública do produto (#/p/<loja>/<sku>): ficha técnica, aplicações aprovadas, WhatsApp e redes. Só lê dado aprovado e publicado. */
export function ProdutoPublico({ slug, sku }: { slug: string; sku: string }) {
  const [ficha, setFicha] = useState<{ produto: Produto; veiculos: FichaVeiculo[] } | null>(null);
  const [paginasVeiculos, setPaginasVeiculos] = useState<PaginaVeiculo[]>([]);
  const [politicasMobis, setPoliticasMobis] = useState<PoliticasLojaPublicas | null>(null);
  const [whatsappMobis, setWhatsappMobis] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`${SUPABASE_URL}/functions/v1/loja-publica`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL }, body: JSON.stringify({ slug, sku, q: sku }),
    }).then((r) => r.json()).then((j) => {
      const produto = (j?.produtos ?? []).find((p: Produto) => p.sku === sku);
      if (!vivo) return;
      if (slug === MOBIS.slug) {
        setPoliticasMobis(j?.politicas ?? null);
        setWhatsappMobis(j?.loja?.whatsapp ?? null);
      }
      // O SKU em prévia tem ficha técnica sem preço e sem aplicações homologadas.
      // Aplicações por veículo continuam invisíveis até aprovação e publicação.
      if (produto && (j?.ficha || (slug === MOBIS.slug && (produto as Produto & { consulta_previa?: boolean }).consulta_previa === true))) {
        const consulta = (produto as Produto & { em_estoque?:boolean|null;consulta_previa?:boolean }).em_estoque;
        const previa = (produto as Produto & { consulta_previa?:boolean }).consulta_previa;
        setFicha({ produto: { ...produto, preco: consulta === true && !previa ? produto.preco : null },
          veiculos: j?.ficha?.veiculos ?? [] });
        setPaginasVeiculos(((j.paginas_aplicacao?.[sku] ?? []) as PaginaVeiculo[])
          .filter(a => a.status === "aprovado"));
      }
    }).catch(() => undefined); // sem ficha, a página mostra só o cabeçalho e o contato
    return () => { vivo = false; };
  }, [slug, sku]);

  const piloto = slug === MOBIS.slug && sku === "CI003696";
  const tecnicaPiloto = piloto && ficha ? fichaPilotoMobis(ficha.produto) : null;
  return (
    <main className={slug === MOBIS.slug ? `produto-publico-mobis${piloto ? " ficha-mobis-piloto" : ""}` : undefined}>
      {slug === MOBIS.slug && <header className="produto-publico-mobis-cab">
        <a href="#/loja/mobis" aria-label="Voltar à loja Mobis Autopeças">
          <img src={piloto ? logoMobisOficial : logoMobis} alt="MOBIS AUTOPEÇAS" /></a>
        {piloto && <span className="ficha-mobis-catalogo">Catálogo<br/>Conecta.IA</span>}
        <a href="#/loja/mobis">← Voltar à loja</a>
      </header>}
      {ficha && <FichaProduto produto={piloto ? { ...ficha.produto, preco: null } : ficha.produto} veiculos={ficha.veiculos} mostrarDetalhes={slug === MOBIS.slug} tecnicaPiloto={tecnicaPiloto} />}
      {slug === MOBIS.slug && ficha && <section className="produto-publico-mobis-aplicacoes" aria-label="Páginas por veículo">
        <h2>{piloto ? "Modelos com aplicação aprovada" : "Aplicações por veículo"}</h2>
        {paginasVeiculos.length ? <div className="produto-publico-mobis-grade">{paginasVeiculos.map(a=>
          <a key={a.slug} href={"#/a/"+encodeURIComponent(a.slug)}>
            {piloto && <span className="ficha-mobis-veiculo-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16v-5l3-4h12l3 4v5H3Zm3 0v2m12-2v2M3 11h18M7 14h1m8 0h1"/></svg></span>}
            <strong>{a.modelo}</strong><small>{a.titulo}</small><span>Ver página da aplicação →</span>
          </a>)}</div>
        : <p>As páginas individuais por veículo serão vinculadas aqui após a aprovação técnica de cada aplicação.</p>}
        <p>O SKU físico continua único: as páginas por veículo não representam peças ou estoques diferentes.</p>
      </section>}
      {piloto && ficha && <aside className="ficha-mobis-alerta" aria-label="Antes de comprar ou montar">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>
        <div><h2>Antes de comprar / montar</h2><p>Confirme sempre o <strong>código gravado no bloco</strong> e o <strong>VIN/chassi</strong>. Compare a versão do motor, a norma de emissão, as interfaces e a composição do conjunto com a peça instalada. Referências OEM e aplicações sem homologação não confirmam compatibilidade.</p>{tecnicaPiloto?.some(c => c.rotulo === "Motor" && c.valor === "D4CB") && <p>Não confunda versões D4CB de outras normas de emissão nem o motor D4BH.</p>}</div>
      </aside>}
      {slug === MOBIS.slug && <RodapeMobisEnxuto nome={MOBIS.nome} whatsapp={whatsappMobis} politicas={politicasMobis}/>}
      {slug !== MOBIS.slug && <div className="cartao">
        {REDES_SOCIAIS.length > 0 && <nav className="produto-publico-redes" aria-label="Redes sociais da loja">
          {REDES_SOCIAIS.map(r => <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.nome}</a>)}
        </nav>}
        {slug === MOBIS.slug && <p className="suave"><a href={MOBIS.site}>mobisautopecas.com.br — site oficial</a></p>}
      </div>}
    </main>
  );
}
