import { useCallback, useEffect, useRef, useState } from "react";
import { Orbe } from "./Esfera.tsx";
import { useEstadoNano } from "../lib/nanoEstado.ts";
import { ROTULO_ESTADO } from "../lib/estadoAgente.ts";
import { coordenadas, encaixar, gravar, ler, pontoDeGuia, type PosicaoSalva } from "../lib/posicaoBalao.ts";

const TAMANHO = { w: 168, h: 68 };
const ARRASTO_MIN = 6;

/** Balão flutuante do Nano.ia: acompanha o lojista em qualquer tela. Arrasta e gruda na borda, lembra onde ficou, e quando o agente abre uma tela
 *  ele sobe até o título dela ("guia") e depois volta. Abre/fecha o agente; sem chamada ao servidor por si só. */
export function BalaoGenesis({ lojaId, aberto, aoAlternar, compacto = false }: { lojaId: string; aberto: boolean; aoAlternar: () => void; compacto?: boolean }) {
  const estado = useEstadoNano(lojaId); // o mesmo estado do chat e do cabeçalho: só eventos reais (a navegação guiada não conta como execução)
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<PosicaoSalva>(ler);
  const [tela, setTela] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [guia, setGuia] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<{ x: number; y: number } | null>(null);
  const [pulo, setPulo] = useState(false);
  const movido = useRef(false);
  const origem = useRef({ px: 0, py: 0, x: 0, y: 0 });

  useEffect(() => { const f = () => setTela({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { document.documentElement.dataset.balao = pos.lado; }, [pos.lado]);
  useEffect(() => { // o agente abriu uma tela: o balão sobe até ela e, passado um tempo, volta ao lugar escolhido
    let volta: ReturnType<typeof setTimeout> | undefined;
    const f = (e: Event) => { const t = (e as CustomEvent<{ titulo?: string }>).detail?.titulo ?? null; setGuia(t); clearTimeout(volta); volta = setTimeout(() => setGuia(null), 3800); };
    window.addEventListener("nano:guia", f);
    return () => { window.removeEventListener("nano:guia", f); clearTimeout(volta); };
  }, []);
  useEffect(() => { // trocou de tela por qualquer meio: um pulinho curto mostra que ele está junto
    const f = () => { setPulo(true); setTimeout(() => setPulo(false), 700); };
    window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f);
  }, []);

  // Na visão Mobis em celular, a posição salva no desktop não deve cobrir títulos e filtros.
  // O Nano continua clicável, com o desenho e os estados originais, mas fica no canto inferior.
  const noCanto = compacto && tela.w <= 740;
  const efetiva = guia && !noCanto ? pontoDeGuia(tela, TAMANHO) : pos;
  const c = noCanto
    ? { x: Math.max(12, tela.w - 72), y: Math.max(68, tela.h - 96) }
    : arrastando ?? coordenadas(efetiva, tela, TAMANHO);

  const aoPressionar = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    movido.current = false; const atual = coordenadas(pos, tela, TAMANHO);
    origem.current = { px: e.clientX, py: e.clientY, x: atual.x, y: atual.y };
    ref.current?.setPointerCapture(e.pointerId);
  }, [pos, tela]);
  const aoMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - origem.current.px, dy = e.clientY - origem.current.py;
    if (!movido.current && Math.hypot(dx, dy) < ARRASTO_MIN) return;
    movido.current = true; setGuia(null);
    setArrastando({ x: origem.current.x + dx, y: origem.current.y + dy });
  };
  const aoSoltar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
    if (arrastando) { const p = encaixar(arrastando.x, arrastando.y, tela, TAMANHO); setPos(p); gravar(p); setArrastando(null); }
  };
  const aoClicar = () => { if (movido.current) { movido.current = false; return; } aoAlternar(); };
  const aoTeclar = (e: React.KeyboardEvent) => { // acessível: setas movem o balão sem mouse
    const passo = 40; const base = coordenadas(pos, tela, TAMANHO);
    if (!e.altKey) return;
    const mapa: Record<string, [number, number]> = { ArrowUp: [0, -passo], ArrowDown: [0, passo], ArrowLeft: [-passo * 6, 0], ArrowRight: [passo * 6, 0] };
    const d = mapa[e.key]; if (!d) return; e.preventDefault();
    const p = encaixar(base.x + d[0], base.y + d[1], tela, TAMANHO); setPos(p); gravar(p);
  };

  return (
    <button ref={ref} type="button" className={`sec balao-genesis ${noCanto ? "balao-catalogo-compacto" : ""} ${pulo && !noCanto ? "balao-pulo" : ""} ${guia && !noCanto ? "balao-guia" : ""} ${arrastando && !noCanto ? "balao-arrastando" : ""}`}
      style={{ left: c.x, top: c.y }} data-lado={efetiva.lado}
      onClick={aoClicar} onPointerDown={noCanto ? undefined : aoPressionar} onPointerMove={noCanto ? undefined : aoMover} onPointerUp={noCanto ? undefined : aoSoltar} onPointerCancel={noCanto ? undefined : aoSoltar} onKeyDown={noCanto ? undefined : aoTeclar}
      aria-expanded={aberto} aria-controls="dock-agente" aria-label={`${aberto ? "Fechar o Nano.ia" : "Abrir o Nano.ia"} — ${estado === "falando" ? "Falando" : ROTULO_ESTADO[estado]}`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight">
      <Orbe estado={estado} tamanho={56} decorativo />
      <span className="balao-texto"><b>Nano.ia</b><small>{guia ? `Aqui: ${guia}` : aberto ? "Conversando" : "Toque para falar"}</small></span>
    </button>
  );
}
