import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type No = { id: string; pai_id: string | null; nome: string; slug: string; ordem: number };

function Ramo({ no, filhos }: { no: No; filhos: Map<string | null, No[]> }) {
  const sub = filhos.get(no.id) ?? [];
  if (!sub.length) return <li>{no.nome} <span className="suave mono">{no.slug}</span></li>;
  return (
    <li><details open><summary>{no.nome}</summary>
      <ul>{sub.map((n) => <Ramo key={n.id} no={n} filhos={filhos} />)}</ul></details></li>
  );
}

/** Árvore de taxonomia do perfil de ramo da loja (somente leitura; nó novo entra como proposto). */
export function Taxonomia({ loja }: { loja: Loja }) {
  const [nos, setNos] = useState<No[] | null>(null);
  useEffect(() => {
    supabase.from("taxonomia_nos").select("id, pai_id, nome, slug, ordem").eq("perfil_ramo", loja.perfil_ramo).order("ordem").order("nome")
      .then(({ data }) => setNos((data ?? []) as No[]));
  }, [loja.perfil_ramo]);
  const filhos = new Map<string | null, No[]>();
  for (const n of nos ?? []) filhos.set(n.pai_id, [...(filhos.get(n.pai_id) ?? []), n]);
  return (
    <div className="cartao">
      <h1>Taxonomia</h1>
      <p className="suave">Como o agente classifica as peças ({loja.perfil_ramo}). {nos ? `${nos.length} nós.` : ""} Quando falta um nó, o agente propõe um novo e você aprova.</p>
      {nos === null ? <p className="suave">Carregando…</p> : <ul className="arvore">{(filhos.get(null) ?? []).map((n) => <Ramo key={n.id} no={n} filhos={filhos} />)}</ul>}
    </div>
  );
}
