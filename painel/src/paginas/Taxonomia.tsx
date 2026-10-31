import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { caminhoAte, contar, montarArvore, type No, type NoComTotais } from "../lib/arvore.ts";
import { iconeDaCategoria } from "../lib/icones.ts";
import { IconePeca } from "../componentes/IconePeca.tsx";
import { vistaDaArea } from "../lib/vistas.ts";
import { VistaExplodida } from "../componentes/VistaExplodida.tsx";
import { SincroniaBling } from "../componentes/SincroniaBling.tsx";
import { AtlasTecnico } from "../componentes/AtlasTecnico.tsx";
import { publicar, despublicar } from "../lib/contextoPagina.ts";
import type { MapaNo } from "../lib/mapaPagina.ts";
import { conferir, type CategoriaBling, type Ligacao } from "../lib/taxonomiaBling.ts";

type Dados = { nos: No[]; produtos: Map<string, number>; bling: Map<string, number>; categoriasBling: CategoriaBling[]; ligacoes: Ligacao[] };

function Coluna({ titulo, itens, ativoId, aoEscolher }: { titulo: string; itens: NoComTotais[]; ativoId: string | null; aoEscolher: (n: NoComTotais) => void }) {
  return (
    <section className="esp-coluna" aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul>
        {itens.map((n) => (
          <li key={n.id}>
            <button className={`esp-no ${n.id === ativoId ? "ativo" : ""}`} onClick={() => aoEscolher(n)} aria-current={n.id === ativoId ? "true" : undefined}>
              <IconePeca nome={iconeDaCategoria(n.slug, n.nome)} tamanho={28} />
              <span className="esp-nome">{n.nome}</span>
              <span className="esp-contagem mono" title={`${n.produtos} produto(s) no Conecta`}>{n.produtos}</span>
              {n.filhos.length > 0 && <span className="esp-seta" aria-hidden="true">›</span>}
            </button>
          </li>
        ))}
        {!itens.length && <li className="suave">Nada aqui.</li>}
      </ul>
    </section>
  );
}

/** Arquitetura espelhada: a taxonomia do ramo da loja em colunas (estilo navegador de arquivos), com o que existe no Conecta e no Bling por nó. Somente leitura. */
export function Taxonomia({ loja }: { loja: Loja }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [n, p, b, cb] = await Promise.all([
        supabase.from("taxonomia_nos").select("id, pai_id, nome, slug, ordem").eq("perfil_ramo", loja.perfil_ramo).order("ordem").order("nome"),
        supabase.from("produtos").select("taxonomia_no_id").eq("loja_id", loja.id).not("taxonomia_no_id", "is", null).limit(10000),
        supabase.from("bling_categoria_taxonomia").select("bling_categoria_id, taxonomia_no_id").eq("loja_id", loja.id),
        supabase.from("bling_categorias").select("bling_id, nome, pai_bling_id").eq("loja_id", loja.id).limit(2000),
      ]);
      if (!vivo) return;
      setDados({
        nos: (n.data ?? []) as No[],
        produtos: contar((p.data ?? []) as { taxonomia_no_id: string }[], (x) => x.taxonomia_no_id),
        bling: contar((b.data ?? []) as { taxonomia_no_id: string }[], (x) => x.taxonomia_no_id),
        categoriasBling: (cb.data ?? []) as CategoriaBling[],
        ligacoes: (b.data ?? []) as Ligacao[],
      });
    })();
    return () => { vivo = false; };
  }, [loja.id, loja.perfil_ramo]);

  const conferencia = useMemo(() => (dados ? conferir(dados.nos, dados.categoriasBling, dados.ligacoes) : null), [dados]);
  const raizes = useMemo(() => (dados ? montarArvore(dados.nos, dados.produtos, dados.bling) : []), [dados]);
  const trilha = useMemo(() => caminhoAte(raizes, sel), [raizes, sel]);
  const atual = trilha.at(-1) ?? null;
  const colunas: NoComTotais[][] = [raizes, ...trilha.map((t) => t.filhos)];
  const totalProdutos = raizes.reduce((s, r) => s + r.produtos, 0);
  // Só contagens e rótulos de categoria autorizados; nada é enviado ao modelo automaticamente.
  useEffect(() => {
    if (!dados) return;
    const caminho: MapaNo[] = trilha.map((n, i) => ({
      id: "categoria:"+i, rotulo: n.nome, valor: n.produtos,
    }));
    const mapa: MapaNo = { id:"atlas-taxonomia", rotulo:"Taxonomia e atlas técnico",
      valor: totalProdutos, filhos:[
        {id:"categoria-atual",rotulo:"Categoria selecionada",filhos:caminho},
        {id:"categorias-bling",rotulo:"Categorias do Bling vinculadas",valor:atual?.categoriasBling??0},
        {id:"subcategorias",rotulo:"Subcategorias",valor:atual?.filhos.length??0}
      ] };
    publicar("/taxonomia", "Atlas técnico"+(atual?" · "+atual.nome:""), mapa);
    return () => despublicar("/taxonomia");
  }, [dados, sel, totalProdutos, atual?.id]);


  return (
    <div className="janela" aria-label="Arquitetura espelhada">
      <div className="janela-barra">
        <span className="janela-pontos" aria-hidden="true"><i /><i /><i /></span>
        <span className="janela-aba"><IconePeca nome="motor" tamanho={18} /> Atlas OEM / Espelho do ERP</span>
        <code className="janela-endereco">conecta.ia/espelho/{loja.perfil_ramo}{trilha.map((t) => `/${t.slug}`).join("")}</code>
      </div>
      <div className="janela-corpo">
        <header className="esp-topo">
          <div><h1>Atlas do catálogo técnico</h1>
            <p className="suave">Montadora, veículo, motor, componentes e referências documentadas. Fotografias reais somente com direitos confirmados. {dados ? `${dados.nos.length} nós · ${totalProdutos} produto(s) classificado(s).` : ""}</p></div>
        </header>
        {dados === null ? <p className="suave">Carregando…</p> : (
          <div className="esp-colunas">
            {colunas.map((itens, i) => (
              <Coluna key={i} titulo={i === 0 ? "Áreas" : trilha[i - 1].nome} itens={itens} ativoId={trilha[i]?.id ?? null} aoEscolher={(n) => setSel(n.id)} />
            ))}
            <aside className="esp-detalhe" aria-label="Detalhe do nó">
              {atual ? (
                <>
                  <AtlasTecnico loja={loja} no={atual} />
                  {vistaDaArea(trilha[0]?.slug) && <details className="atlas-ilustracao-legada">
                    <summary>Visualizar ilustração genérica das peças (não é diagrama OEM)</summary>
                    <p className="suave">Desenho técnico ilustrativo criado para navegação. Não valida peça, posição OEM, motor ou aplicação.</p>
                    <VistaExplodida vista={vistaDaArea(trilha[0]?.slug)!} ativo={atual.slug} aoEscolher={(slug) => { const n = dados?.nos.find((x) => x.slug === slug); if (n) setSel(n.id); }} />
                  </details>}
                  <p className="aviso-discreto">Somente leitura. Cadastros, imagens, aplicações e SEO exigem validação antes de publicação ou escrita no Bling.</p>
                </>
              ) : <p className="suave">Escolha uma área para ver as subcategorias e o que está ligado ao Bling.</p>}
            </aside>
          </div>
        )}
        {conferencia && <SincroniaBling c={conferencia} />}
      </div>
    </div>
  );
}
