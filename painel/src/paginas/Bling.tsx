import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import { SUPABASE_URL } from "../config.ts";
import type { Loja } from "../lib/dados.ts";

const CALLBACK = `${SUPABASE_URL}/functions/v1/bling-callback`;

async function mensagem(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}

export function Bling({ loja, query }: { loja: Loja; query: URLSearchParams }) {
  const [status, setStatus] = useState("…");
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [editando, setEditando] = useState(false);
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = () => {
    supabase.from("bling_conexoes").select("status").eq("loja_id", loja.id).maybeSingle().then(({ data }) => setStatus(data?.status ?? "pendente"));
    supabase.rpc("bling_app_configurado", { p_loja_id: loja.id }).then(({ data }) => setConfigurado(data === true));
  };
  useEffect(carregar, [loja.id, query]);

  async function salvar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setErro("");
    const { error } = await supabase.functions.invoke("bling-app", { body: { loja_id: loja.id, client_id: clientId, client_secret: secret } });
    setOcupado(false);
    if (error) { setErro(await mensagem(error, "Não foi possível salvar.")); return; }
    setClientId(""); setSecret(""); setEditando(false); carregar(); // o secret nunca fica na tela nem no navegador
  }

  async function conectar() {
    setOcupado(true); setErro("");
    const { data, error } = await supabase.functions.invoke("bling-conectar", { body: { loja_id: loja.id } });
    if (error) { setErro(await mensagem(error, "Não foi possível iniciar a conexão.")); setOcupado(false); return; }
    window.location.href = (data as { url: string }).url;
  }

  const conectada = status === "conectada";
  const mostrarForm = configurado === false || editando;
  return (
    <div className="cartao">
      <h1>Conexão com o Bling</h1>
      <p><span className={`selo ${conectada ? "ok" : "atencao"}`}>{conectada ? "Conectada" : "Não conectada"}</span>{" "}
        {configurado && <span className="selo ok">App cadastrado</span>}</p>
      {query.get("ok") && <p className="msg-ok">Conexão concluída.</p>}
      {query.get("erro") && <p className="msg-erro">Não foi possível conectar ({query.get("erro")}). Confira o cadastro do app e tente de novo.</p>}
      {erro && <p className="msg-erro">{erro}</p>}

      {mostrarForm ? (
        <>
          <h2>1. Crie o seu app no Bling (uma vez)</h2>
          <ol className="suave">
            <li>No Bling, abra <strong>Central de Extensões → Área do Integrador → Cadastro de aplicativos → Novo</strong>.</li>
            <li>Tipo <strong>API</strong>, uso <strong>privado</strong>. Dê o nome que quiser.</li>
            <li>No campo de <strong>link de redirecionamento (callback)</strong>, cole exatamente: <code>{CALLBACK}</code>{" "}
              <button type="button" className="sec" onClick={() => { void navigator.clipboard?.writeText(CALLBACK); setCopiado(true); }}>{copiado ? "Copiado" : "Copiar"}</button></li>
            <li>Nos escopos, marque <strong>somente leitura</strong> de Produtos, Estoques e Categorias.</li>
            <li>Salve e copie o <strong>Client ID</strong> e o <strong>Client Secret</strong>.</li>
          </ol>
          <h2>2. Cole as duas chaves aqui</h2>
          <form onSubmit={salvar}>
            <label>Client ID<input value={clientId} onChange={(e) => setClientId(e.target.value)} required autoComplete="off" spellCheck={false} /></label>
            <label>Client Secret<input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required autoComplete="new-password" spellCheck={false} /></label>
            <p className="suave">A chave é guardada cifrada no servidor e não aparece mais depois de salva.</p>
            <div className="linha"><button disabled={ocupado}>Salvar</button>{editando && <button type="button" className="sec" onClick={() => setEditando(false)}>Cancelar</button>}</div>
          </form>
        </>
      ) : (
        <>
          <p className="suave">Você autoriza no próprio Bling. Depois disso o sistema mantém a conexão e renova o acesso sozinho; você não precisa voltar aqui.</p>
          <div className="linha">
            <button onClick={() => void conectar()} disabled={ocupado}>{conectada ? "Reconectar ao Bling" : "Conectar ao Bling"}</button>
            <button className="sec" onClick={() => setEditando(true)}>Trocar as chaves do app</button>
          </div>
        </>
      )}
    </div>
  );
}
