import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

export function Bling({ loja, query }: { loja: Loja; query: URLSearchParams }) {
  const [status, setStatus] = useState("…");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    supabase.from("bling_conexoes").select("status").eq("loja_id", loja.id).maybeSingle()
      .then(({ data }) => setStatus(data?.status ?? "pendente"));
  }, [loja.id, query]);

  async function conectar() {
    setOcupado(true); setErro("");
    const { data, error } = await supabase.functions.invoke("bling-conectar", { body: { loja_id: loja.id } });
    if (error) {
      let msg = "Não foi possível iniciar a conexão.";
      try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) msg = j.erro; } catch { /* mantém a mensagem padrão */ }
      setErro(msg); setOcupado(false); return;
    }
    window.location.href = (data as { url: string }).url;
  }

  const conectada = status === "conectada";
  return (
    <div className="cartao">
      <h1>Conexão com o Bling</h1>
      <p><span className={`selo ${conectada ? "ok" : "atencao"}`}>{conectada ? "Conectada" : "Não conectada"}</span></p>
      {query.get("ok") && <p className="msg-ok">Conexão concluída.</p>}
      {query.get("erro") && <p className="msg-erro">Não foi possível conectar ({query.get("erro")}). Tente de novo.</p>}
      <p className="suave">Você autoriza no próprio Bling, sem digitar senha aqui. Pedimos só leitura de produtos, estoques e categorias.</p>
      {erro && <p className="msg-erro">{erro}</p>}
      <button onClick={() => void conectar()} disabled={ocupado}>{conectada ? "Reconectar ao Bling" : "Conectar ao Bling"}</button>
    </div>
  );
}
