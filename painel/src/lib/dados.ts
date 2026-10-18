import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase.ts";

export type Loja = { id: string; nome: string; slug: string; modo_venda: string; ambiente: string; perfil_ramo: string };

export function useSessao() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [recuperando, setRecuperando] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { sessao, recuperando, fimRecuperacao: () => setRecuperando(false) };
}

/** Lojas que a pessoa enxerga (a RLS decide). */
export function useLojas(ativo: boolean) {
  const [lojas, setLojas] = useState<Loja[] | null>(null);
  useEffect(() => {
    if (!ativo) return;
    supabase
      .from("lojas")
      .select("id, nome, slug, modo_venda, ambiente, perfil_ramo")
      .order("nome")
      .then(({ data }) => setLojas((data ?? []) as Loja[]));
  }, [ativo]);
  return lojas;
}
