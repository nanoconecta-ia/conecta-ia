import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import { SUPABASE_URL } from "../config.ts";
import type { Loja } from "../lib/dados.ts";

const CALLBACK = `${SUPABASE_URL}/functions/v1/bling-callback`;

async function mensagem(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}

const MOTIVOS: Record<string, string> = {
  conta: "A conta do Bling que autorizou não é a da empresa cadastrada (CNPJ diferente). Entre na conta certa do Bling e tente de novo.",
  conta_verificacao: "Não foi possível confirmar qual conta do Bling autorizou. Tente de novo.",
  estado: "O link de autorização expirou ou já foi usado. Clique em Conectar de novo.",
  permissao: "Só o responsável da loja pode conectar o Bling.",
  app: "O app do Bling não está cadastrado. Informe o Client ID e o Client Secret.",
  troca: "O Bling recusou a autorização. Confira o Client ID, o Client Secret e o link de redirecionamento do app.",
};

export function Bling({ loja, query }: { loja: Loja; query: URLSearchParams }) {
  const [status, setStatus] = useState("…");
  const [motivo, setMotivo] = useState<string | null>(null);
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [editando, setEditando] = useState(false);
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);
  const [sincMsg, setSincMsg] = useState("");

  const carregar = () => {
    supabase.from("bling_conexoes").select("status, ultimo_sync_ok_em, ultimo_erro").eq("loja_id", loja.id).maybeSingle().then(({ data }) => { setStatus(data?.status ?? "pendente"); setMotivo(data?.status === "conectada" ? null : data?.ultimo_erro ?? null); setUltimoSync(data?.ultimo_sync_ok_em ?? null); });
    supabase.rpc("bling_app_configurado", { p_loja_id: loja.id }).then(({ data }) => setConfigurado(data === true));
  };
  useEffect(carregar, [loja.id, query]);

  async function salvar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setErro("");
    const { error } = await supabase.functions.invoke("bling-app", { body: { loja_id: loja.id, client_id: clientId, client_secret: secret, cnpj } });
    setOcupado(false);
    if (error) { setErro(await mensagem(error, "Não foi possível salvar.")); return; }
    setClientId(""); setSecret(""); setCnpj(""); setEditando(false); carregar(); // o secret nunca fica na tela nem no navegador
  }

  async function conectar() {
    setOcupado(true); setErro("");
    const { data, error } = await supabase.functions.invoke("bling-conectar", { body: { loja_id: loja.id } });
    if (error) { setErro(await mensagem(error, "Não foi possível iniciar a conexão.")); setOcupado(false); return; }
    window.location.href = (data as { url: string }).url;
  }

  async function sincronizarAgora() {
    setOcupado(true); setErro(""); setSincMsg("");
    const { data, error } = await supabase.functions.invoke("bling-sync", { body: { loja_id: loja.id } });
    setOcupado(false);
    if (error) { setErro(await mensagem(error, "Não foi possível sincronizar agora.")); return; }
    const r = (data as { resultado?: { gravados?: number; completo?: boolean }[] })?.resultado?.[0];
    setSincMsg(r?.completo ? `Sincronização concluída: ${r.gravados ?? 0} produtos atualizados.` : "Sincronização parcial; continua na próxima rodada.");
    carregar();
  }

  const conectada = status === "conectada";
  const mostrarForm = configurado === false || editando;
  return (
    <div className="cartao">
      <h1>Conexão com o Bling</h1>
      <p><span className={`selo ${conectada ? "ok" : "atencao"}`}>{conectada ? "Conectada" : "Não conectada"}</span>{" "}
        {configurado && <span className="selo ok">App cadastrado</span>}</p>
      {!conectada && motivo && <p className="msg-erro">{motivo}</p>}
      {query.get("ok") &&<p className="msg-ok">Conexão concluída.</p>}
      {query.get("erro") && <p className="msg-erro">{MOTIVOS[query.get("erro") ?? ""] ?? "Não foi possível conectar. Confira o cadastro do app e tente de novo."}</p>}
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
            <label>CNPJ da empresa no Bling<input value={cnpj} onChange={(e) => setCnpj(e.target.value)} required inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00" /></label>
            <label>Client Secret<input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} required autoComplete="new-password" spellCheck={false} /></label>
            <p className="suave">O CNPJ evita conectar a conta errada. A chave é guardada cifrada no servidor e não aparece mais depois de salva. Só o responsável da loja pode alterar.</p>
            <div className="linha"><button disabled={ocupado}>Salvar</button>{editando && <button type="button" className="sec" onClick={() => setEditando(false)}>Cancelar</button>}</div>
          </form>
        </>
      ) : (
        <>
          <p className="suave">Você autoriza no próprio Bling. Depois disso o sistema mantém a conexão e renova o acesso sozinho; você não precisa voltar aqui.</p>
          <div className="linha">
            <button onClick={() => void conectar()} disabled={ocupado}>{conectada ? "Reconectar ao Bling" : "Conectar ao Bling"}</button>
            <button className="sec" onClick={() => setEditando(true)}>Trocar as chaves do app</button>
            {conectada && <button className="sec" onClick={() => void sincronizarAgora()} disabled={ocupado}>Sincronizar agora</button>}
          </div>
          {conectada && <p className="suave">Última sincronização: {ultimoSync ? new Date(ultimoSync).toLocaleString("pt-BR") : "ainda não houve"}. O catálogo é uma cópia só de leitura: nada é gravado no Bling.</p>}
          {sincMsg && <p className="msg-ok">{sincMsg}</p>}
        </>
      )}
    </div>
  );
}
