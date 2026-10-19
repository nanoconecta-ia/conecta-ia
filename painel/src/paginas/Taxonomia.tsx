import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { caminhoAte, contar, montarArvore, type No, type NoComTotais } from "../lib/arvore.ts";
import { iconeDaCategoria } from "../lib/icones.ts";
import { IconePeca } from "../componentes/IconePeca.tsx";

type Dados = { nos: No[]; produtos: Map<string, number>; bling: Map<string, number> };

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
      const [n, p, b] = await Promise.all([
        supabase.from("taxonomia_nos").select("id, pai_id, nome, slug, ordem").eq("perfil_ramo", loja.perfil_ramo).order("ordem").order("nome"),
        supabase.from("produtos").select("taxonomia_no_id").eq("loja_id", loja.id).not("taxonomia_no_id", "is", null).limit(10000),
        supabase.from("bling_categoria_taxonomia").select("taxonomia_no_id").eq("loja_id", loja.id),
      ]);
      if (!vivo) return;
      setDados({
        nos: (n.data ?? []) as No[],
        produtos: contar((p.data ?? []) as { taxonomia_no_id: string }[], (x) => x.taxonomia_no_id),
        bling: contar((b.data ?? []) as { taxonomia_no_id: string }[], (x) => x.taxonomia_no_id),
      });
    })();
    return () => { vivo = false; };
  }, [loja.id, loja.perfil_ramo]);

  const raizes = useMemo(() => (dados ? montarArvore(dados.nos, dados.produtos, dados.bling) : []), [dados]);
  const trilha = useMemo(() => caminhoAte(raizes, sel), [raizes, sel]);
  const atual = trilha.at(-1) ?? null;
  const colunas: NoComTotais[][] = [raizes, ...trilha.map((t) => t.filhos)];
  const totalProdutos = raizes.reduce((s, r) => s + r.produtos, 0);

  return (
    <div className="janela" aria-label="Arquitetura espelhada">
      <div className="janela-barra">
        <span className="janela-pontos" aria-hidden="true"><i /><i /><i /></span>
        <span className="janela-aba"><IconePeca nome="motor" tamanho={16} /> Espelho do ERP</span>
        <code className="janela-endereco">conecta.ia/espelho/{loja.perfil_ramo}{trilha.map((t) => `/${t.slug}`).join("")}</code>
      </div>
      <div className="janela-corpo">
        <header className="esp-topo">
          <div><h1>Arquitetura do catálogo</h1>
            <p className="suave">A taxonomia que o agente usa para classificar as peças, espelhada do cadastro. {dados ? `${dados.nos.length} nós · ${totalProdutos} produto(s) classificado(s).` : ""}</p></div>
        </header>
        {dados === null ? <p className="suave">Carregando…</p> : (
          <div className="esp-colunas">
            {colunas.map((itens, i) => (
              <Coluna key={i} titulo={i === 0 ? "Áreas" : trilha[i - 1].nome} itens={itens} ativoId={trilha[i]?.id ?? null} aoEscolher={(n) => setSel(n.id)} />
            ))}
            <aside className="esp-detalhe" aria-label="Detalhe do nó">
              {atual ? (
                <>
                  <IconePeca nome={iconeDaCategoria(atual.slug, atual.nome)} tamanho={72} titulo={atual.nome} />
                  <h2>{atual.nome}</h2>
                  <p className="mono suave">{atual.slug}</p>
                  <dl className="dados">
                    <dt>Produtos no Conecta</dt><dd>{atual.produtos}</dd>
                    <dt>Categorias do Bling ligadas</dt><dd>{atual.categoriasBling}</dd>
                    <dt>Subcategorias</dt><dd>{atual.filhos.length}</dd>
                  </dl>
                  <p className="aviso-discreto">Só leitura. Quando falta um nó, o agente propõe um novo e você aprova na fila.</p>
                </>
              ) : <p className="suave">Escolha uma área para ver as subcategorias e o que está ligado ao Bling.</p>}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
