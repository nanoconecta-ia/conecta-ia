import { useEffect, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { FichaProduto } from "./FichaProduto.tsx";
import type { FichaProduto as ProdutoBase, FichaVeiculo } from "../lib/ficha.ts";

type Produto = ProdutoBase & { em_estoque?: boolean | null; consulta_previa?: boolean };
type PaginaVeiculo = { slug: string; titulo: string; modelo: string; status: string };
type Dados = { produto: Produto; veiculos: FichaVeiculo[]; paginas: PaginaVeiculo[] };

function urlProduto(slug: string, sku: string) {
  return "#/p/" + encodeURIComponent(slug) + "/" + encodeURIComponent(sku);
}

/** Detalhe comercial dentro da MESMA página, sem abrir nova aba.
 * Uma ficha por SKU físico; as aplicações individuais apontam para #/a/<slug>.
 * Nenhuma aplicação, fotografia, preço ou disponibilidade é inferida do banner.
 */
export function ProdutoFlashModal({ slug, sku, fechar }: { slug: string; sku: string; fechar: () => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [estado, setEstado] = useState<"carregando" | "erro" | "ok">("carregando");
  const fecharRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let ativo = true;
    setEstado("carregando"); setDados(null);
    const controller = new AbortController();
    void fetch(SUPABASE_URL + "/functions/v1/loja-publica", {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL },
      body: JSON.stringify({ slug, sku, q: sku, referencia_exata: true }),
      signal: controller.signal,
    }).then(async resposta => {
      if (!resposta.ok) throw Error("Produto indisponível");
      const j = await resposta.json();
      if (j?.loja?.slug !== slug || !Array.isArray(j.produtos)) throw Error("Resposta inválida");
      const p = j.produtos.find((x: Produto) => x.sku === sku) as Produto | undefined;
      if (!p || !j.ficha) throw Error("Produto não aprovado ou sem ficha");
      if (ativo) {
        setDados({produto: p, veiculos: j.ficha.veiculos ?? [],
          paginas: (j.paginas_aplicacao?.[sku] ?? []).filter((a: PaginaVeiculo) => a.status === "aprovado")});
        setEstado("ok");
      }
    }).catch(() => { if (ativo) setEstado("erro"); });
    return () => { ativo = false; controller.abort(); };
  }, [slug, sku]);
  useEffect(() => {
    fecharRef.current?.focus();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); fechar(); }
      if (e.key === "Tab") {
        const painel = document.getElementById("mobis-flash-modal-painel");
        const focaveis = [...(painel?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea") ?? [])];
        if (!focaveis.length) return;
        const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    };
    document.addEventListener("keydown", teclas);
    return () => { document.removeEventListener("keydown", teclas); document.body.style.overflow = antes; };
  }, [fechar]);

  // Saldo espelhado não é promessa de pronta entrega: na vitrine de consulta,
  // preço é omitido quando o produto não tem estoque confirmado.
  const ficha = dados ? { ...dados.produto,
    preco: dados.produto.em_estoque === true && !dados.produto.consulta_previa ? dados.produto.preco : null } : null;
  return (
    <div className="m4-flash-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <section id="mobis-flash-modal-painel" className="m4-flash-modal" role="dialog" aria-modal="true" aria-labelledby="m4-flash-titulo">
        <header className="m4-flash-modal-cab">
          <div><small>MOBIS AUTOPEÇAS · FICHA DO PRODUTO</small>
            <h2 id="m4-flash-titulo">Motor e peças · SKU {sku}</h2></div>
          <button ref={fecharRef} type="button" onClick={fechar} aria-label="Fechar detalhes e voltar à vitrine">Fechar ×</button>
        </header>
        <div className="m4-flash-modal-conteudo">
          {estado === "carregando" && <p role="status">Buscando a ficha real e as aplicações aprovadas…</p>}
          {estado === "erro" && <div role="alert"><h3>Ficha indisponível</h3><p>Este produto ainda não está liberado para a vitrine. Consulte a equipe Mobis.</p></div>}
          {ficha && <><FichaProduto produto={ficha} veiculos={dados?.veiculos ?? []}/>
            <div className="m4-flash-modal-rodape">
              <p>Um produto físico, com um único SKU e estoque. Preço, aplicação e disponibilidade devem ser confirmados com a loja.</p>
              <a className="m4-flash-botao" href={urlProduto(slug, sku)}>Abrir página completa do produto →</a>
            </div>
            <section className="m4-flash-aplicacoes" aria-label="Páginas individuais por veículo">
              <h3>Páginas por veículo</h3>
              {dados?.paginas.length ? <div className="m4-flash-aplicacoes-grade">{dados.paginas.map(a =>
                <a key={a.slug} href={"#/a/" + encodeURIComponent(a.slug)}>
                  <strong>{a.modelo}</strong><small>{a.titulo}</small><span>Ver página desta aplicação →</span>
                </a>)}</div>
              : <p>As páginas individuais dos veículos serão exibidas somente quando cada aplicação estiver tecnicamente aprovada.</p>}
            </section>
          </>}
        </div>
      </section>
    </div>
  );
}
