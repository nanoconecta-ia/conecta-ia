import { useEffect, useState } from "react";
import { dados, type FonteDados } from "./conectorDados.ts";

/** Fonte de dados do Conector IA (real; ou fixtures só no dev com ?demo=1). Devolve null enquanto carrega. */
export function useFonte(): FonteDados | null {
  const [f, setF] = useState<FonteDados | null>(null);
  useEffect(() => { let vivo = true; void dados().then((x) => { if (vivo) setF(x); }); return () => { vivo = false; }; }, []);
  return f;
}
