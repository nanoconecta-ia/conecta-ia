import { useEffect, useRef, type ReactNode } from "react";

/** Diálogo modal acessível (elemento <dialog> nativo: foco preso, Esc fecha). Ações críticas sempre passam por aqui. O foco inicial é "Cancelar". */
export function Dialogo({ aberto, titulo, children, rotuloConfirmar, perigo, ocupado, desabilitarConfirmar, aoConfirmar, aoCancelar }: {
  aberto: boolean; titulo: string; children: ReactNode; rotuloConfirmar: string; perigo?: boolean; ocupado?: boolean; desabilitarConfirmar?: boolean;
  aoConfirmar: () => void; aoCancelar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} className="dialogo" aria-labelledby="dialogo-titulo" onCancel={(e) => { e.preventDefault(); aoCancelar(); }}>
      <h2 id="dialogo-titulo" style={{ marginTop: 0 }}>{titulo}</h2>
      <div>{children}</div>
      <div className="linha" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        <button className="sec" autoFocus onClick={aoCancelar} disabled={ocupado}>Cancelar</button>
        <button className={perigo ? "perigo" : ""} onClick={aoConfirmar} disabled={ocupado || desabilitarConfirmar}>{ocupado ? "Aguarde…" : rotuloConfirmar}</button>
      </div>
    </dialog>
  );
}
