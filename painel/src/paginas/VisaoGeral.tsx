import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type Notificacao = { id: string; titulo: string; corpo: string | null; severidade: string; fonte_url: string | null; lida_em: string | null };

export function VisaoGeral({ loja }: { loja: Loja }) {
  const [conexao, setConexao] = useState<string>("…");
  const [produtos, setProdutos] = useState<number | null>(null);
  const [avisos, setAvisos] = useState<Notificacao[]>([]);

  const carregar = () =>
    supabase.from("notificacoes").select("id, titulo, corpo, severidade, fonte_url, lida_em")
      .is("resolvida_em", null).order("criada_em", { ascending: false }).limit(20)
      .then(({ data }) => setAvisos((data ?? []) as Notificacao[]));

  useEffect(() => {
    supabase.from("bling_conexoes").select("status").eq("loja_id", loja.id).maybeSingle()
      .then(({ data }) => setConexao(data?.status ?? "pendente"));
    supabase.from("produtos").select("id", { count: "exact", head: true }).eq("loja_id", loja.id)
      .then(({ count }) => setProdutos(count ?? 0));
    void carregar();
  }, [loja.id]);

  async function resolver(id: string) {
    await supabase.from("notificacoes").update({ resolvida_em: new Date().toISOString() }).eq("id", id);
    void carregar();
  }

  return (
    <>
      <div className="cartao">
        <h1>{loja.nome}</h1>
        <p className="suave">
          Ambiente <span className={`selo ${loja.ambiente === "teste" ? "atencao" : "ok"}`}>{loja.ambiente === "teste" ? "em teste" : "produção"}</span>{" "}
          · modo de venda: {loja.modo_venda} · perfil: {loja.perfil_ramo}
        </p>
        <p>Bling: <span className={`selo ${conexao === "conectada" ? "ok" : "atencao"}`}>{conexao}</span> · Produtos espelhados: <strong>{produtos ?? "…"}</strong></p>
      </div>
      <div className="cartao">
        <h2>Avisos</h2>
        {avisos.length === 0 ? <p className="suave">Nenhum aviso pendente.</p> : avisos.map((a) => (
          <div key={a.id} style={{ borderTop: "1px solid var(--borda)", padding: "8px 0" }}>
            <strong>{a.titulo}</strong> <span className={`selo ${a.severidade === "bloqueio" ? "erro" : a.severidade === "atencao" ? "atencao" : ""}`}>{a.severidade}</span>
            {a.corpo && <p className="suave">{a.corpo}</p>}
            {a.fonte_url && <p><a href={a.fonte_url} target="_blank" rel="noreferrer noopener">Abrir fonte oficial</a></p>}
            <button className="sec" onClick={() => void resolver(a.id)}>Marcar como resolvido</button>
          </div>
        ))}
      </div>
    </>
  );
}
