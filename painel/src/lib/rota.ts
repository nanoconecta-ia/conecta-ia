import { useEffect, useState } from "react";

/** Rota por hash: "#/bling?ok=1" -> { caminho: "/bling", query: URLSearchParams } */
export function lerRota() {
  const h = window.location.hash.replace(/^#/, "") || "/";
  const [caminho, q] = h.split("?");
  return { caminho: caminho || "/", query: new URLSearchParams(q ?? "") };
}

export function useRota() {
  const [rota, setRota] = useState(lerRota());
  useEffect(() => {
    const f = () => setRota(lerRota());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return rota;
}

export const ir = (caminho: string) => {
  window.location.hash = caminho;
};
