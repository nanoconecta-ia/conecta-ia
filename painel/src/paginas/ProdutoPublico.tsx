import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";
import { RodapeMobisEnxuto } from "../componentes/RodapeMobisEnxuto.tsx";
import type { PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import { ShowroomProdutoMobis } from "../componentes/ShowroomProdutoMobis.tsx";
import "./produto-publico-mobis.css";
import type { FichaProduto as Produto, FichaVeiculo } from "../lib/ficha.ts";
type PaginaVeiculo = { slug:string;titulo:string;modelo:string;status:string;indexavel?:boolean };

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
          .filter(a => a.status === "aprovado" && a.indexavel === true));
      }
    }).catch(() => undefined); // sem ficha, a página mostra só o cabeçalho e o contato
    return () => { vivo = false; };
  }, [slug, sku]);

  return (
    <main className={slug === MOBIS.slug ? "produto-publico-mobis" : undefined}>
      {slug === MOBIS.slug && <nav className="produto-publico-mobis-cab" aria-label="Navegação da loja">
        <a href="#/loja/mobis">← Voltar à loja Mobis Autopeças</a>
      </nav>}
      {ficha && (slug === MOBIS.slug
        ? <ShowroomProdutoMobis produto={ficha.produto} veiculos={ficha.veiculos} aplicacoes={paginasVeiculos} />
        : <FichaProduto produto={ficha.produto} veiculos={ficha.veiculos} />)}
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
