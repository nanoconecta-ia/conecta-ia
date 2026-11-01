import { useEffect, useState } from "react";
import { PERFIS, aplicarPerfil, gravarPerfil, lerPerfil } from "../lib/perfilCor.ts";
import { armazemLocal } from "../lib/tema.ts";

/** Perfil de cor do painel e da esfera do Nano.IA: uma escolha só, aplicada na hora e lembrada neste aparelho.
 *  O alto contraste (em Aparência) continua valendo por cima e nunca é alterado pelo perfil. */
export function SeletorCor() {
  const [id, setId] = useState(() => lerPerfil(armazemLocal()));
  useEffect(() => { aplicarPerfil(id); }, [id]);
  const escolher = (v: string) => { setId(v); gravarPerfil(armazemLocal(), v); };
  return (
    <div className="seletor-cor" role="radiogroup" aria-label="Cor do painel e do Nano.IA">
      {PERFIS.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={id === p.id} className="sec" title={p.descricao} onClick={() => escolher(p.id)}
          onKeyDown={(e) => { const i = PERFIS.findIndex((x) => x.id === id); const n = PERFIS.length; if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); escolher(PERFIS[(i + 1) % n].id); } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); escolher(PERFIS[(i - 1 + n) % n].id); } }}
          tabIndex={id === p.id ? 0 : -1}>
          <span className="amostra-cor" data-cor={p.id} aria-hidden="true" />{p.rotulo}
        </button>
      ))}
    </div>
  );
}
