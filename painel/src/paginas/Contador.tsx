import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { normalizarWhatsapp } from "../lib/whatsapp.ts";

export function Contador({ loja }: { loja: Loja }) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    supabase.from("loja_contador").select("nome, whatsapp, email").eq("loja_id", loja.id).maybeSingle()
      .then(({ data }) => { if (data) { setNome(data.nome); setWhatsapp(data.whatsapp); setEmail(data.email ?? ""); } });
  }, [loja.id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const numero = normalizarWhatsapp(whatsapp);
    if (!numero) { setMsg({ ok: false, texto: "WhatsApp inválido. Use DDD + número, por exemplo (62) 99999-9999." }); return; }
    const { error } = await supabase.from("loja_contador").upsert({ loja_id: loja.id, nome: nome.trim(), whatsapp: numero, email: email.trim() || null }, { onConflict: "loja_id" });
    setMsg(error ? { ok: false, texto: "Não foi possível salvar." } : { ok: true, texto: "Contador salvo. O histórico de trocas fica na auditoria." });
    if (!error) setWhatsapp(numero);
  }

  return (
    <div className="cartao">
      <h1>Contador da loja</h1>
      <p className="suave">Quem valida NCM, CEST e regras fiscais antes de irem ao Bling ou ao site. Pode trocar sempre que mudar de contabilidade; cada troca fica registrada.</p>
      <form onSubmit={salvar}>
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} required /></label>
        <label>WhatsApp (com DDD)<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" required /></label>
        <label>E-mail (opcional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"}>{msg.texto}</p>}
        <button>Salvar contador</button>
      </form>
    </div>
  );
}
