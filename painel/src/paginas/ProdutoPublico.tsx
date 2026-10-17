import { useState, type FormEvent } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";

/** Página pública do produto (#/p/<loja>/<sku>) com o assistente para o cliente. Só lê dado aprovado e publicado. */
export function ProdutoPublico({ slug, sku }: { slug: string; sku: string }) {
  const [msgs, setMsgs] = useState<{ de: "eu" | "ia"; texto: string }[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim(); if (!t) return;
    setMsgs((m) => [...m, { de: "eu", texto: t }]); setTexto(""); setOcupado(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/vitrine-assistente`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL },
        body: JSON.stringify({ slug, sku, pergunta: t }),
      });
      const j = await r.json().catch(() => ({}));
      setMsgs((m) => [...m, { de: "ia", texto: String(j.resposta ?? "Não consegui responder agora.") }]);
    } catch { setMsgs((m) => [...m, { de: "ia", texto: "Não consegui responder agora." }]); }
    setOcupado(false);
  }
  return (
    <main>
      <div className="cartao">
        <h1>Tire suas dúvidas sobre esta peça</h1>
        <p className="suave">Código <span className="mono">{sku}</span>. O assistente só informa dados confirmados pela loja.</p>
        <div className="chat">{msgs.map((m, i) => <div key={i} className={`bolha ${m.de}`}>{m.texto}</div>)}</div>
        <form onSubmit={enviar} style={{ maxWidth: "none" }}>
          <label>Sua pergunta<input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} placeholder="Ex.: serve no meu veículo? quanto custa?" /></label>
          <div><button disabled={ocupado}>Perguntar</button></div>
        </form>
      </div>
    </main>
  );
}
