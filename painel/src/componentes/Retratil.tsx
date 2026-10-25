import { useState, type ReactNode } from "react";
const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Bloco retrátil padrão do painel: cabeçote minimizável que abre na vertical (altura) ou na horizontal (vira uma trilha lateral).
 *  O estado aberto/fechado é lembrado por navegador (`id`); sem armazenamento, usa `aberto` como inicial. */
export function Retratil({ id, titulo, resumo, aberto = true, orientacao = "vertical", status, children, className }: {
  id: string; titulo: string; resumo?: string; aberto?: boolean; orientacao?: "vertical" | "horizontal";
  status?: "go" | "warn" | "stop"; children: ReactNode; className?: string;
}) {
  const [on, setOn] = useState(() => { try { const v = localStorage.getItem(`conecta:retratil:${id}`); return v === null ? aberto : v === "1"; } catch { return aberto; } });
  const alternar = () => setOn((v) => { try { localStorage.setItem(`conecta:retratil:${id}`, v ? "0" : "1"); } catch { /* sem armazenamento */ } return !v; });
  const painel = `retratil-${id}`;
  return (
    <section className={cn("retratil", `retratil--${orientacao}`, on ? "retratil--aberto" : "retratil--fechado", status && `retratil--${status}`, className)} data-aberto={on}>
      <button type="button" className="retratil-cabecote sec" aria-expanded={on} aria-controls={painel} onClick={alternar}>
        <span className="retratil-seta" aria-hidden="true">{orientacao === "horizontal" ? (on ? "‹" : "›") : on ? "▾" : "▸"}</span>
        <span className="retratil-titulo">{titulo}</span>
        {!on && resumo && <small className="retratil-resumo">{resumo}</small>}
      </button>
      <div className="retratil-corpo" id={painel} hidden={!on}>{children}</div>
    </section>
  );
}
