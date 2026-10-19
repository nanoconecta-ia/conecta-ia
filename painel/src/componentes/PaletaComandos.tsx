import { useEffect, useMemo, useRef, useState } from "react";
import { ir } from "../lib/rota.ts";
import { filtrarComandos, type Item } from "../lib/navegacao.ts";

// Paleta de comandos: Ctrl/⌘+K abre, setas navegam, Enter vai, Esc fecha. Só navega entre telas já visíveis no menu.
export function PaletaComandos({ itens, aberta, aoFechar }: { itens: Item[]; aberta: boolean; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const lista = useMemo(() => filtrarComandos(itens, q), [itens, q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) { setQ(""); setSel(0); d.showModal(); }
    if (!aberta && d.open) d.close();
  }, [aberta]);

  const abrir = (i: Item | undefined) => { if (!i) return; aoFechar(); ir(i[0]); };
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, Math.max(lista.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); abrir(lista[sel]); }
  };

  return (
    <dialog ref={ref} className="paleta" onClose={aoFechar} onClick={(e) => { if (e.target === ref.current) aoFechar(); }} aria-label="Paleta de comandos">
      <input autoFocus placeholder="Ir para… (digite o nome da tela)" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={tecla}
        role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-activedescendant={lista[sel] ? `paleta-${sel}` : undefined} />
      <ul id="paleta-lista" role="listbox">
        {lista.map((i, n) => (
          <li key={i[0]} id={`paleta-${n}`} role="option" aria-selected={n === sel} className={n === sel ? "sel" : ""} onMouseEnter={() => setSel(n)} onClick={() => abrir(i)}>
            <span>{i[1]}</span><code>{i[0] === "/" ? "início" : i[0]}</code>
          </li>
        ))}
        {!lista.length && <li className="vazio" role="presentation">Nenhuma tela com esse nome.</li>}
      </ul>
      <p className="suave">↑ ↓ navegar · Enter abrir · Esc fechar</p>
    </dialog>
  );
}
