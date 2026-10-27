import { useMemo, useState } from "react";
import { layoutArvore, mapaParaTexto, type MapaNo, type Tom } from "../lib/mapaPagina.ts";
import { perguntarAoNano } from "../lib/contextoPagina.ts";

const COR: Record<Tom, string> = { ok: "var(--ok)", atencao: "var(--atencao)", erro: "var(--erro)", neutro: "var(--ciano)" };
const LARG_NO = 176, ALT_NO = 26;

/** Mapa mental da página: árvore horizontal em SVG. Clique (ou Enter/Espaço) recolhe e expande um ramo. Só mostra números e rótulos já higienizados. */
export function MapaMental({ raiz, titulo }: { raiz: MapaNo; titulo: string }) {
  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => new Set(raiz.filhos?.filter((f) => f.id === "taxonomia").map((f) => f.id)));
  const l = useMemo(() => layoutArvore(raiz, { colunaLargura: 200, linhaAltura: 34, margem: 14, recolhidos }), [raiz, recolhidos]);
  const posicao = useMemo(() => new Map(l.nos.map((n) => [n.id, n])), [l]);
  const alternar = (id: string) => setRecolhidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const comFilhos = useMemo(() => { const ids: string[] = []; const a = (n: MapaNo) => { if (n.filhos?.length) ids.push(n.id); n.filhos?.forEach(a); }; a(raiz); return ids; }, [raiz]);
  return (
    <section className="mapa" aria-label={`Mapa mental: ${titulo}`}>
      <div className="mapa-barra">
        <button type="button" className="sec mini" onClick={() => setRecolhidos(new Set())}>Expandir tudo</button>
        <button type="button" className="sec mini" onClick={() => setRecolhidos(new Set(comFilhos.filter((id) => id !== raiz.id)))}>Recolher tudo</button>
        <button type="button" className="mini" onClick={() => perguntarAoNano(`Analise este mapa da tela "${titulo}" e diga por onde começar. Use só estes dados:\n${mapaParaTexto(raiz)}`)}>Perguntar ao Nano.ia</button>
      </div>
      <div className="mapa-rolagem" tabIndex={0} aria-label="Área do mapa (use as setas para rolar)">
        <svg viewBox={`0 0 ${l.largura} ${l.altura}`} style={{ width: `max(100%, ${Math.round(l.largura * 0.92)}px)`, height: "auto", aspectRatio: `${l.largura} / ${l.altura}` }} role="tree" aria-label={`Árvore da tela ${titulo}`}>
          {l.arestas.map((a) => {
            const de = posicao.get(a.de)!, para = posicao.get(a.para)!;
            const x1 = de.x + LARG_NO, y1 = de.y + ALT_NO / 2, x2 = para.x, y2 = para.y + ALT_NO / 2, mx = (x1 + x2) / 2;
            return <path key={`${a.de}>${a.para}`} className="mapa-aresta" d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} />;
          })}
          {l.nos.map((n) => {
            const cor = COR[n.tom];
            const rotulo = n.rotulo.length > 19 ? `${n.rotulo.slice(0, 18)}…` : n.rotulo;
            const valor = n.valor !== undefined ? String(n.valor) : "";
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} className={`mapa-no mapa-no--${n.tom}`} role="treeitem" aria-expanded={n.temFilhos ? !n.recolhido : undefined}
                tabIndex={0} onClick={() => n.temFilhos && alternar(n.id)} onKeyDown={(e) => { if (n.temFilhos && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); alternar(n.id); } }}>
                <title>{n.dica ?? `${n.rotulo}${valor ? `: ${valor}` : ""}`}</title>
                <rect width={LARG_NO} height={ALT_NO} rx={8} style={{ stroke: cor }} />
                <rect width={5} height={ALT_NO} rx={2} style={{ fill: cor }} />
                <text x={14} y={ALT_NO / 2 + 4} className="mapa-rotulo">{rotulo}</text>
                {valor && <text x={LARG_NO - 10} y={ALT_NO / 2 + 4} textAnchor="end" className="mapa-valor" style={{ fill: cor }}>{valor}</text>}
                {n.temFilhos && <text x={LARG_NO + 6} y={ALT_NO / 2 + 4} className="mapa-seta" aria-hidden="true">{n.recolhido ? "›" : "‹"}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="suave mapa-nota">Só contagens e nomes de seções. Custo, preço de compra, dados fiscais e fornecedor nunca entram neste mapa.</p>
    </section>
  );
}
