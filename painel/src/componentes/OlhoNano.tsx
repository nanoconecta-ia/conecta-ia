import { useEffect, useRef, type RefObject } from "react";
import olho from "../assets/olho-nano-e02.webp";
import "./olho-nano.css";
import { ESCALA_FOCO, SOME_MS, VOLTA_MS, pontoCasa, pontoFoco } from "../lib/olhoNano.ts";

/** Olho do Nano (E02). Desenho original, sem redesenho: anima só posição, escala proporcional e uma oscilação leve.
 *  Aparece com atividade dentro de `area`, vai ao campo em foco, volta à âncora e some. Decorativo: não recebe clique nem foco,
 *  e não lê o conteúdo digitado. Não indica que uma auditoria aconteceu. */
export function OlhoNano({ area, ancora }: { area: RefObject<HTMLElement | null>; ancora: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raiz = area.current, o = el.current;
    if (!raiz || !o) return;
    let volta = 0, some = 0, ultimaDigitacao = 0;
    const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const casa = () => pontoCasa(raiz.querySelector(ancora)?.getBoundingClientRect() ?? null, window.innerWidth, window.innerHeight);
    const por = (p: { x: number; y: number }, escala: number) => { o.style.left = `${p.x}px`; o.style.top = `${p.y}px`; o.style.setProperty("--olho-escala", String(escala)); };
    const limpar = () => { window.clearTimeout(volta); window.clearTimeout(some); };
    const esconder = () => { limpar(); o.classList.remove("visivel", "em-movimento", "em-casa"); };
    const voltar = () => { const c = casa(); if (!c) return esconder(); por(c, 1); o.classList.remove("em-movimento"); o.classList.add("em-casa"); };
    const reagir = (alvo: Element | null) => {
      const c = casa();
      if (!c) return;
      limpar();
      if (!o.classList.contains("visivel")) por(c, 1);
      o.classList.add("visivel");
      const destino = semMovimento() ? null : pontoFoco(alvo?.getBoundingClientRect() ?? null, window.innerWidth, window.innerHeight);
      if (destino) {
        o.classList.remove("em-casa"); o.classList.add("em-movimento");
        requestAnimationFrame(() => requestAnimationFrame(() => por(destino, ESCALA_FOCO)));
        volta = window.setTimeout(voltar, VOLTA_MS);
      } else voltar();
      some = window.setTimeout(esconder, SOME_MS);
    };
    const campo = (t: EventTarget | null) => t instanceof Element ? t.closest("input,textarea,select") : null;
    const aoApontar = (e: Event) => { if (e.target instanceof Element) reagir(e.target.closest("button,input,textarea,select,a") ?? e.target); };
    const aoFocar = (e: Event) => { const c = campo(e.target); if (c) reagir(c); };
    const aoDigitar = (e: Event) => { if (Date.now() - ultimaDigitacao > 850) { ultimaDigitacao = Date.now(); reagir(campo(e.target)); } };
    const reposicionar = () => { if (o.classList.contains("em-casa")) { const c = casa(); if (c) por(c, 1); else esconder(); } };
    const aoOcultar = () => { if (document.hidden) esconder(); };
    raiz.addEventListener("pointerdown", aoApontar, true);
    raiz.addEventListener("focusin", aoFocar, true);
    raiz.addEventListener("input", aoDigitar, true);
    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      limpar();
      raiz.removeEventListener("pointerdown", aoApontar, true);
      raiz.removeEventListener("focusin", aoFocar, true);
      raiz.removeEventListener("input", aoDigitar, true);
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("scroll", reposicionar, true);
      document.removeEventListener("visibilitychange", aoOcultar);
    };
  }, [area, ancora]);
  return <div ref={el} className="olho-nano" aria-hidden="true"><span className="olho-nano-moldura"><img src={olho} alt="" width={54} height={54} draggable={false} /></span></div>;
}
