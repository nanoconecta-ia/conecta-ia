import { useEffect, useState } from "react";
import { PREFERENCIAS, aplicarTema, armazemLocal, gravarPreferencia, lerPreferencia, type Preferencia } from "../lib/tema.ts";

/** Auto, Claro, Escuro ou Noturno. Aplica na hora e lembra neste aparelho. */
export function SeletorTema() {
  const [pref, setPref] = useState<Preferencia>(() => lerPreferencia(armazemLocal()));
  useEffect(() => { aplicarTema(pref); }, [pref]);
  const escolher = (p: Preferencia) => { setPref(p); gravarPreferencia(armazemLocal(), p); };
  return (
    <div className="seletor-tema" role="group" aria-label="Aparência">
      {PREFERENCIAS.map((p) => <button key={p.valor} type="button" className="sec mini" aria-pressed={pref === p.valor} onClick={() => escolher(p.valor)}>{p.rotulo}</button>)}
    </div>
  );
}
