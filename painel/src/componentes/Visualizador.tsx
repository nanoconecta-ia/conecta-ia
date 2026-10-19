import { useEffect, useRef } from "react";

/** Visualização ampliada de imagem (diálogo nativo: Esc fecha, foco preso). */
export function Visualizador({ url, legenda, aoFechar }: { url: string | null; legenda: string; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (url && !d.open) d.showModal(); if (!url && d.open) d.close(); }, [url]);
  return (
    <dialog ref={ref} className="dialogo visualizador" aria-label={legenda} onCancel={(e) => { e.preventDefault(); aoFechar(); }} onClick={(e) => { if (e.target === ref.current) aoFechar(); }}>
      {url && <img src={url} alt={legenda} />}
      <div className="linha" style={{ justifyContent: "space-between", marginTop: 8 }}><span className="suave">{legenda}</span><button autoFocus onClick={aoFechar}>Fechar</button></div>
    </dialog>
  );
}
