import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type Conexao = { status: "pendente" | "conectada" | "revogada" | "erro"; email: string | null; ultimo_erro: string | null };

const AVISOS: Record<string, string> = {
  negado: "A permissão foi negada no Google. Nada foi conectado.",
  estado: "O link de conexão expirou ou já foi usado. Tente de novo.",
  permissao: "Só o responsável da loja pode conectar o Google.",
  troca: "O Google não concluiu a conexão. Marque a permissão de arquivos do Drive e tente de novo.",
  gravar: "Não foi possível salvar a conexão. Tente de novo.",
};

async function mensagem(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}

/** Conexão do Google Drive da loja. Acesso mínimo (arquivos criados pelo Conecta ou escolhidos por você). Nenhum token chega aqui. */
export function GoogleDrive({ loja }: { loja: Loja }) {
  const [c, setC] = useState<Conexao | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => {
    supabase.from("google_conexoes").select("status, email, ultimo_erro").eq("loja_id", loja.id).maybeSingle()
      .then(({ data }) => setC((data as Conexao | null) ?? null));
  };
  useEffect(() => {
    carregar();
    const q = window.location.hash.split("?")[1] ?? "";
    const p = new URLSearchParams(q);
    if (p.get("google_ok")) setMsg({ ok: true, texto: "Google Drive conectado." });
    else if (p.get("google_erro")) setMsg({ ok: false, texto: AVISOS[p.get("google_erro")!] ?? "Não foi possível conectar o Google." });
  }, [loja.id]);

  async function conectar() {
    setOcupado(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("google-conectar", { body: { loja_id: loja.id } });
    if (error) { setMsg({ ok: false, texto: await mensagem(error, "Não foi possível iniciar a conexão.") }); setOcupado(false); return; }
    window.location.href = (data as { url: string }).url;
  }

  async function desconectar() {
    setOcupado(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("google-desconectar", { body: { loja_id: loja.id } });
    setOcupado(false);
    if (error) { setMsg({ ok: false, texto: await mensagem(error, "Não foi possível desconectar.") }); return; }
    const r = data as { revogado_no_google?: boolean };
    setMsg({ ok: true, texto: r.revogado_no_google === false ? "Desconectado aqui. O Google não confirmou a revogação: remova o acesso também em myaccount.google.com/permissions." : "Google Drive desconectado." });
    carregar();
  }

  const conectada = c?.status === "conectada";
  return (
    <div className="cartao">
      <h2>Google Drive</h2>
      <p className="suave">Acesso mínimo: o Conecta só enxerga arquivos que ele criar ou que você escolher. Não lê o resto do seu Drive nem seu e-mail. Você pode desconectar quando quiser.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"}>{msg.texto}</p>}
      {conectada
        ? <p>Conectado como <strong>{c?.email}</strong>.</p>
        : <p className="suave">{c?.status === "erro" ? `Com erro: ${c.ultimo_erro ?? "reconecte."}` : "Não conectado."}</p>}
      {conectada
        ? <button disabled={ocupado} onClick={desconectar}>Desconectar</button>
        : <button disabled={ocupado} onClick={conectar}>Conectar Google Drive</button>}
    </div>
  );
}
