import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { PREFERENCIAS, aplicarTema, armazemLocal, gravarPreferencia, lerPreferencia, type Preferencia } from "../lib/tema.ts";

/** Aparência: Automático, Claro, Escuro, Noturno ou Alto contraste. Um botão compacto abre a lista (funciona também no celular);
 *  cada opção mostra uma amostra com as cores reais do tema. Aplica na hora e lembra neste aparelho. */
export function SeletorTema() {
  const [pref, setPref] = useState<Preferencia>(() => lerPreferencia(armazemLocal()));
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const opcoes = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  useEffect(() => { aplicarTema(pref); }, [pref]);

  const fechar = useCallback((devolverFoco: boolean) => { setAberto(false); if (devolverFoco) gatilho.current?.focus(); }, []);
  useEffect(() => {
    if (!aberto) return;
    const i = Math.max(0, PREFERENCIAS.findIndex((p) => p.valor === pref));
    opcoes.current[i]?.focus();
    const fora = (e: MouseEvent | TouchEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) fechar(false); };
    document.addEventListener("mousedown", fora); document.addEventListener("touchstart", fora);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("touchstart", fora); };
  }, [aberto, pref, fechar]);

  const escolher = (p: Preferencia) => { setPref(p); gravarPreferencia(armazemLocal(), p); fechar(true); };
  const teclar = (e: KeyboardEvent, i: number) => {
    const n = PREFERENCIAS.length;
    const ir = (j: number) => { e.preventDefault(); opcoes.current[(j + n) % n]?.focus(); };
    if (e.key === "ArrowDown" || e.key === "ArrowRight") ir(i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") ir(i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(n - 1);
    else if (e.key === "Escape") { e.preventDefault(); fechar(true); }
    else if (e.key === "Tab") fechar(false);
  };
  const atual = PREFERENCIAS.find((p) => p.valor === pref) ?? PREFERENCIAS[0];

  return (
    <div className="seletor-tema" ref={raiz}>
      <button ref={gatilho} type="button" className="sec seletor-gatilho" aria-haspopup="true" aria-expanded={aberto} aria-controls={`${id}-lista`}
        aria-label={`Aparência: ${atual.rotulo}. Abrir opções`} onClick={() => setAberto((v) => !v)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a9 9 0 100 18c1.4 0 2-1 2-2 0-1.2-.9-1.6-.9-2.7 0-1 .8-1.8 1.9-1.8H17a4 4 0 004-4c0-4.4-4-7.5-9-7.5z" /><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />
        </svg>
        <span className="seletor-rotulo">{atual.rotulo}</span>
      </button>
      {aberto && (
        <div id={`${id}-lista`} className="seletor-painel" role="radiogroup" aria-label="Aparência">
          {PREFERENCIAS.map((p, i) => (
            <button key={p.valor} type="button" role="radio" aria-checked={pref === p.valor} tabIndex={pref === p.valor ? 0 : -1} ref={(el) => { opcoes.current[i] = el; }}
              className="sec seletor-opcao" onClick={() => escolher(p.valor)} onKeyDown={(e) => teclar(e, i)}>
              <span className="amostra" aria-hidden="true">
                {p.valor === "auto"
                  ? <><span className="amostra-meia" data-tema="claro" /><span className="amostra-meia" data-tema="escuro" /></>
                  : <span className="amostra-cheia" data-tema={p.valor}><i /><i /><i /></span>}
              </span>
              <span className="seletor-texto"><b>{p.rotulo}</b><small>{p.descricao}</small></span>
              <span className="seletor-marca" aria-hidden="true">{pref === p.valor ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
