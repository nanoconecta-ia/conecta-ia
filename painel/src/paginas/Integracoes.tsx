import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

async function mensagem(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}

type Chave = { ativa: boolean; final_chave: string | null; modelo: string | null; limite_mensal_tokens: number | null; tokens_mes: number; ultimo_uso_em: string | null };
type Plugin = { id: string; nome: string; tipo: string; url: string | null; capacidades: string[]; risco: string; ativo: boolean; ultimo_teste_ok: boolean | null; ultimo_teste_em: string | null };

const CAPACIDADES: [string, string][] = [
  ["consultar_catalogo", "Consultar catálogo"], ["consultar_bling", "Consultar Bling"], ["enriquecer", "Enriquecer produto"],
  ["imagem", "Imagens"], ["taxonomia", "Taxonomia"], ["buscar_web", "Buscar na web"],
];
const TIPOS: [string, string, string][] = [
  ["api", "API (a plataforma chama o seu endereço)", "Executado pelo agente quando ativo e de risco LOW."],
  ["mcp", "MCP (servidor de ferramentas)", "Cadastro pronto; execução pelo agente ainda não implementada."],
  ["llm", "Modelo de IA próprio", "Cadastro pronto; execução pelo agente ainda não implementada."],
  ["plugin_pull", "Plugin que busca tarefas na fila", "Usa a fila de tarefas; chave própria por plugin."],
];

export function Integracoes({ loja }: { loja: Loja }) {
  const [chave, setChave] = useState<Chave | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [editandoChave, setEditandoChave] = useState(false);
  const [novaChave, setNovaChave] = useState(""); const [modelo, setModelo] = useState(""); const [limite, setLimite] = useState("");
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ nome: "", tipo: "api", url: "", credencial: "", risco: "LOW", caps: [] as string[] });

  const carregar = () => {
    supabase.from("loja_chaves_ia").select("ativa, final_chave, modelo, limite_mensal_tokens, tokens_mes, ultimo_uso_em").eq("loja_id", loja.id).eq("provedor", "claude").maybeSingle()
      .then(({ data }) => setChave((data as Chave | null)?.ativa ? (data as Chave) : null));
    supabase.from("loja_plugins").select("id, nome, tipo, url, capacidades, risco, ativo, ultimo_teste_ok, ultimo_teste_em").eq("loja_id", loja.id).order("criado_em")
      .then(({ data }) => setPlugins((data ?? []) as Plugin[]));
  };
  useEffect(carregar, [loja.id]);

  async function chamar(corpo: Record<string, unknown>, sucesso: string): Promise<{ ok?: boolean; erro?: string } | null> {
    setOcupado(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("ia-config", { body: { loja_id: loja.id, ...corpo } });
    setOcupado(false);
    if (error) { setMsg({ ok: false, texto: await mensagem(error, "Não foi possível concluir.") }); return null; }
    const r = data as { ok?: boolean; erro?: string; mensagem?: string };
    setMsg({ ok: r.ok !== false, texto: r.ok === false ? (r.erro ?? r.mensagem ?? "Falhou.") : (r.mensagem ?? sucesso) });
    carregar();
    return r;
  }

  async function salvarChave(e: FormEvent) {
    e.preventDefault();
    const r = await chamar({ acao: "salvar_chave", provedor: "claude", chave: novaChave, modelo: modelo || undefined, limite_mensal_tokens: limite || null }, "Chave salva.");
    if (r?.ok) { setNovaChave(""); setEditandoChave(false); } // a chave nunca fica na tela nem no navegador
  }
  async function salvarPlugin(e: FormEvent) {
    e.preventDefault();
    const r = await chamar({ acao: "salvar_plugin", nome: f.nome, tipo: f.tipo, url: f.url, credencial: f.credencial, risco: f.risco, capacidades: f.caps }, "Plugin salvo. Teste a conexão antes de ativar.");
    if (r?.ok) { setF({ nome: "", tipo: "api", url: "", credencial: "", risco: "LOW", caps: [] }); setNovo(false); }
  }
  const alternar = (c: string) => setF((x) => ({ ...x, caps: x.caps.includes(c) ? x.caps.filter((y) => y !== c) : [...x.caps, c] }));
  const usoPct = chave?.limite_mensal_tokens ? Math.min(100, Math.round((chave.tokens_mes / chave.limite_mensal_tokens) * 100)) : null;

  return (
    <div className="cartao">
      <h1>Integrações de IA</h1>
      <p className="suave">A chave e as credenciais são cifradas no servidor e nunca voltam para a tela. O agente só lê e propõe; quem aprova é você, na fila.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"}>{msg.texto}</p>}

      <h2>Chave do provedor de IA</h2>
      {chave && !editandoChave ? (
        <>
          <p><span className="selo ok">Ativa</span> Claude · chave terminada em <code>{chave.final_chave}</code> · modelo <code>{chave.modelo}</code></p>
          <p className="suave">Uso no mês: {chave.tokens_mes.toLocaleString("pt-BR")} tokens{chave.limite_mensal_tokens ? ` de ${chave.limite_mensal_tokens.toLocaleString("pt-BR")} (${usoPct}%)` : " (sem limite definido)"}.</p>
          <div className="linha">
            <button className="sec" disabled={ocupado} onClick={() => void chamar({ acao: "testar_chave" }, "A chave respondeu normalmente.")}>Testar chave</button>
            <button className="sec" onClick={() => setEditandoChave(true)}>Trocar chave ou limite</button>
            <button className="sec" disabled={ocupado} onClick={() => { if (confirm("Remover a chave? O assistente volta ao modo simples.")) void chamar({ acao: "remover_chave" }, "Chave removida."); }}>Remover</button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => void salvarChave(e)}>
          <p className="suave">Sem chave, o assistente responde só por palavras-chave. Crie uma chave no console do provedor e cole aqui; o custo de uso é da sua loja.</p>
          <label>Provedor<select value="claude" disabled><option value="claude">Claude</option></select></label>
          <label>Chave de API<input type="password" value={novaChave} onChange={(e) => setNovaChave(e.target.value)} required minLength={20} autoComplete="new-password" spellCheck={false} /></label>
          <label>Modelo (opcional)<input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="deixe vazio para o padrão" /></label>
          <label>Limite mensal de tokens (opcional)<input inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ""))} placeholder="ex.: 500000" /></label>
          <div className="linha"><button disabled={ocupado}>Salvar chave</button>{editandoChave && <button type="button" className="sec" onClick={() => setEditandoChave(false)}>Cancelar</button>}</div>
        </form>
      )}

      <h2>Plugins e conexões</h2>
      {plugins.length === 0 && <p className="suave">Nenhum plugin cadastrado.</p>}
      {plugins.map((p) => (
        <div key={p.id} className="cartao" style={{ margin: "8px 0" }}>
          <p><strong>{p.nome}</strong> <span className={`selo ${p.ativo ? "ok" : "atencao"}`}>{p.ativo ? "Ativo" : "Desligado"}</span> <span className="selo">{p.tipo}</span> <span className="selo">risco {p.risco}</span></p>
          <p className="suave">{p.url ?? "sem endereço"} · {p.capacidades.length ? p.capacidades.map((c) => CAPACIDADES.find(([k]) => k === c)?.[1] ?? c).join(", ") : "sem capacidades"}</p>
          <p className="suave">{p.ultimo_teste_ok === null ? "Ainda não testado." : `Último teste: ${p.ultimo_teste_ok ? "ok" : "falhou"} em ${new Date(p.ultimo_teste_em ?? "").toLocaleString("pt-BR")}.`}{p.risco !== "LOW" ? " Risco acima de LOW: o agente não chama sozinho (exige aprovação)." : ""}</p>
          <div className="linha">
            {p.tipo === "api" && <button className="sec" disabled={ocupado} onClick={() => void chamar({ acao: "testar_plugin", id: p.id }, "O plugin respondeu.")}>Testar</button>}
            {p.ativo
              ? <button className="sec" disabled={ocupado} onClick={() => void chamar({ acao: "desativar_plugin", id: p.id }, "Plugin desligado.")}>Desligar</button>
              : <button disabled={ocupado} onClick={() => void chamar({ acao: "ativar_plugin", id: p.id }, "Plugin ativado.")}>Ativar</button>}
            <button className="sec" disabled={ocupado} onClick={() => { if (confirm(`Remover o plugin ${p.nome}?`)) void chamar({ acao: "remover_plugin", id: p.id }, "Plugin removido."); }}>Remover</button>
          </div>
        </div>
      ))}

      {novo ? (
        <form onSubmit={(e) => void salvarPlugin(e)}>
          <label>Nome<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required minLength={2} maxLength={60} /></label>
          <label>Tipo<select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          <p className="suave">{TIPOS.find(([k]) => k === f.tipo)?.[2]}</p>
          <label>Endereço (https)<input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://api.exemplo.com.br/conecta" required={f.tipo === "api"} /></label>
          <label>Credencial (opcional)<input type="password" value={f.credencial} onChange={(e) => setF({ ...f, credencial: e.target.value })} autoComplete="new-password" spellCheck={false} /></label>
          <label>Risco<select value={f.risco} onChange={(e) => setF({ ...f, risco: e.target.value })}><option value="LOW">LOW (só leitura)</option><option value="MEDIUM">MEDIUM (exige aprovação)</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
          <fieldset><legend>Capacidades habilitadas</legend>
            {CAPACIDADES.map(([k, t]) => <label key={k} className="linha"><input type="checkbox" checked={f.caps.includes(k)} onChange={() => alternar(k)} style={{ width: "auto" }} /> {t}</label>)}
          </fieldset>
          <div className="linha"><button disabled={ocupado}>Salvar plugin</button><button type="button" className="sec" onClick={() => setNovo(false)}>Cancelar</button></div>
        </form>
      ) : <div className="linha"><button className="sec" onClick={() => setNovo(true)}>Adicionar plugin ou conexão</button></div>}
    </div>
  );
}
