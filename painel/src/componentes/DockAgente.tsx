import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as PE, type ReactNode } from "react";
import type { Loja } from "../lib/dados.ts";
import { Assistente } from "../paginas/Assistente.tsx";
import type { Item } from "../lib/comandosNL.ts";
import { assinar, obter } from "../lib/contextoPagina.ts";
import { ajustarLargura, larguraPeloPonteiro, LARGURA_MAX, LARGURA_MIN, passoDeTeclado, TELA_MIN_PARA_FIXO, type EstadoPainel } from "../lib/painelLateral.ts";
import { VERSAO_LOCAL, rotuloVersao } from "../lib/versao.ts";
import { MapaMental } from "./MapaMental.tsx";
import { ResumoPagina } from "./ResumoPagina.tsx";

type Aba = "conversa" | "ferramentas" | "mapa" | "resumo";
const Svg = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const I = {
  conversa: <Svg><path d="M4 5h16v11H9l-5 4z" /></Svg>,
  ferramentas: <Svg><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" /></Svg>,
  mapa: <Svg><circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 12h4m0 0c3 0 3-7 6-7m-6 7h6m-6 0c3 0 3 7 6 7" /></Svg>,
  resumo: <Svg><path d="M5 4h14v16H5z" /><path d="M8 9h8M8 13h8M8 17h5" /></Svg>,
  esq: <Svg><path d="M4 4v16" /><path d="M8 6h12v12H8z" /></Svg>,
  dir: <Svg><path d="M20 4v16" /><path d="M4 6h12v12H4z" /></Svg>,
  flutuar: <Svg><path d="M7 7h12v12H7z" /><path d="M4 16V4h12" /></Svg>,
  ampliar: <Svg><path d="M4 9V4h5M20 15v5h-5M4 15v5h5M20 9V4h-5" /></Svg>,
  fechar: <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>,
};

/** Painel lateral do Nano.ia: FLUTUANTE (como antes) ou FIXO à esquerda/direita, com largura ajustável por arrasto ou teclado.
 *  Abas: Conversa (o mesmo Assistente, sem perder o histórico), Mapa mental e Resumo da página (calculados no navegador).
 *  Só monta na primeira abertura: com o painel fechado não há chamada ao servidor. */
export function DockAgente({ loja, aberto, aoFechar, menu, aoNavegar, painel, aoMudarPainel, dividindo, telaW }: {
  loja: Loja; aberto: boolean; aoFechar: () => void; menu?: Item[]; aoNavegar?: (rota: string) => void;
  painel: EstadoPainel; aoMudarPainel: (p: EstadoPainel) => void; dividindo: boolean; telaW: number;
}) {
  const [montado, setMontado] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [aba, setAba] = useState<Aba>("conversa");
  const [arrastando, setArrastando] = useState(false);
  const contexto = useSyncExternalStore(assinar, obter);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (aberto) setMontado(true); }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !dividindo) aoFechar(); }; // fixo não fecha com Esc: ele é parte da tela
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, aoFechar, dividindo]);
  useEffect(() => { // um pedido do mapa/resumo/atalho abre a conversa para o lojista revisar e enviar
    const f = () => setAba("conversa");
    window.addEventListener("nano:perguntar", f); return () => window.removeEventListener("nano:perguntar", f);
  }, []);

  const largura = ajustarLargura(painel.largura, telaW);
  const mudar = useCallback((p: Partial<EstadoPainel>) => aoMudarPainel({ ...painel, ...p }), [painel, aoMudarPainel]);
  const aoPressionar = (e: PE<HTMLDivElement>) => { if (!dividindo) return; e.currentTarget.setPointerCapture(e.pointerId); setArrastando(true); };
  const aoMover = (e: PE<HTMLDivElement>) => { if (arrastando) mudar({ largura: larguraPeloPonteiro(e.clientX, painel.lado, window.innerWidth) }); };
  const aoSoltar = (e: PE<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setArrastando(false); };
  const aoTeclar = (e: React.KeyboardEvent) => { const d = passoDeTeclado(e.key, painel.lado, e.shiftKey); if (d) { e.preventDefault(); mudar({ largura: ajustarLargura(largura + d, telaW) }); } };

  if (!montado) return null;
  const abas: [Aba, string, string, ReactNode][] = [["conversa", "Chat", "Chat global com o Nano.IA", I.conversa], ["ferramentas", "Ferramentas", "Ferramentas e ações do workspace", I.ferramentas], ["mapa", "Mapa", "Mapa mental da página", I.mapa], ["resumo", "Resumo", "Resumir a página", I.resumo]];
  return (
    <aside id="dock-agente" ref={ref} className="dock-agente" data-aberto={aberto} data-ampliado={ampliado} data-modo={dividindo ? "fixo" : "flutuante"} data-lado={painel.lado}
      data-arrastando={arrastando} style={dividindo ? ({ "--dock-w": `${largura}px` } as React.CSSProperties) : undefined} aria-label="Nano.ia" hidden={!aberto}>
      {dividindo && (
        <div className="dock-separador" role="separator" aria-orientation="vertical" aria-label="Ajustar a largura do painel" aria-valuenow={largura} aria-valuemin={LARGURA_MIN} aria-valuemax={LARGURA_MAX}
          tabIndex={0} onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onKeyDown={aoTeclar} />
      )}
      <div className="dock-topo">
        <strong title="Nano.IA · Chat global">Nano.IA <small className="dock-versao mono" title="Versão do painel neste aparelho">v{rotuloVersao(VERSAO_LOCAL)}</small></strong><span className="suave">{loja.nome}</span>
        {telaW >= TELA_MIN_PARA_FIXO && ( // fixar só existe onde funciona: em tela estreita (celular) o painel é sempre flutuante
          <>
          <button className="sec mini dock-ico" onClick={() => mudar({ modo: "fixo", lado: "esq" })} aria-pressed={painel.modo === "fixo" && painel.lado === "esq"} aria-label="Fixar à esquerda" title="Fixar à esquerda">{I.esq}</button>
          <button className="sec mini dock-ico" onClick={() => mudar({ modo: "fixo", lado: "dir" })} aria-pressed={painel.modo === "fixo" && painel.lado === "dir"} aria-label="Fixar à direita" title="Fixar à direita">{I.dir}</button>
          <button className="sec mini dock-ico" onClick={() => mudar({ modo: "flutuante" })} aria-pressed={painel.modo === "flutuante"} aria-label="Flutuar" title="Flutuar sobre a página">{I.flutuar}</button>
          </>
        )}
        {!dividindo && <button className="sec mini dock-ico" onClick={() => setAmpliado((v) => !v)} aria-pressed={ampliado} aria-label={ampliado ? "Reduzir a janela do Nano.ia" : "Ampliar a janela do Nano.ia"} title="Ampliar">{I.ampliar}</button>}
        <button className="sec mini dock-ico" onClick={aoFechar} aria-label="Fechar o Nano.ia" title="Fechar">{I.fechar}</button>
      </div>
      <div className="dock-area">
        <nav className="dock-trilho" role="tablist" aria-orientation="vertical" aria-label="Ferramentas do Nano.ia">
          {abas.map(([id, rotulo, titulo, icone]) => (
            <button key={id} role="tab" type="button" className="sec dock-aba" aria-selected={aba === id} aria-label={titulo} onClick={() => setAba(id)} title={titulo}>{icone}<span>{rotulo}</span></button>
          ))}
          <span className="dock-trilho-sep" aria-hidden="true" />

        </nav>
        <div className="dock-painel">
          <div className="dock-corpo" hidden={aba !== "conversa"}><Assistente key={loja.id} loja={loja} menu={menu} aoNavegar={aoNavegar} /></div>
          {aba === "ferramentas" && <section className="dock-corpo dock-ferramentas" aria-label="Ferramentas de pesquisa">
            <header><h3>Pesquisa e evidências</h3><p>Acesse fontes externas e prepare uma revisão técnica. Uma pesquisa não modifica seu ERP.</p></header>
            <div className="dock-ferramentas-preparar">
              <button type="button" className="sec" onClick={() => aoNavegar?.("/pesquisa")}>Pesquisa Web e B2B ↗</button>
              <button type="button" className="sec" onClick={() => aoNavegar?.("/catalogo")}>Abrir catálogo local ↗</button>
            </div>
            <p className="suave">Portais privados exigem login no próprio fornecedor. O Nano.IA não recolhe senhas nem cookies.</p>
          </section>}
          {aba === "mapa" && (
            <div className="dock-corpo">{contexto ? <MapaMental key={contexto.rota} raiz={contexto.mapa} titulo={contexto.titulo} /> : <p className="suave">Esta tela ainda não publica um mapa. Abra o <b>Catálogo</b> para ver a árvore dele.</p>}</div>
          )}
          {aba === "resumo" && (
            <div className="dock-corpo">{contexto ? <ResumoPagina raiz={contexto.mapa} titulo={contexto.titulo} /> : <p className="suave">Esta tela ainda não publica um resumo. Abra o <b>Catálogo</b> para ver o dele.</p>}</div>
          )}
        </div>
      </div>
    </aside>
  );
}
