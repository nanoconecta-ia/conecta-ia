import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

async function mensagem(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}

type Chave = { provedor: string; ativa: boolean; principal: boolean; final_chave: string | null; modelo: string | null; base_url: string | null; limite_mensal_tokens: number | null; tokens_mes: number; ultimo_uso_em: string | null };

const PROVEDORES = [
  { id: "claude", nome: "Claude", aviso: "Pago por uso; crie a chave no console do provedor.", modelo: "claude-sonnet-5-5", precisaEndereco: false },
  { id: "gemini", nome: "Gemini (Google AI Studio)", aviso: "Há plano gratuito, mas no gratuito o Google pode usar o conteúdo enviado para melhorar os produtos dele. O agente não envia custo nem fornecedor, só dados de catálogo.", modelo: "gemini-2.5-flash", precisaEndereco: false },
  { id: "compativel_openai", nome: "Llama ou outro modelo compatível com OpenAI", aviso: "Use um provedor que hospede o Llama e exponha uma API compatível com OpenAI (por exemplo Groq, Together ou OpenRouter). Um Llama rodando só no seu computador não é alcançável pelo servidor.", modelo: "", precisaEndereco: true },
] as const;
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
  const [chaves, setChaves] = useState<Record<string, Chave>>({});
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [campos, setCampos] = useState<Record<string, { chave: string; modelo: string; limite: string; base: string }>>({});
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState<{ ativa: boolean } | null>(null);
  const [buscaChave, setBuscaChave] = useState(""); const [buscaCx, setBuscaCx] = useState(""); const [editandoBusca, setEditandoBusca] = useState(false);
  const [f, setF] = useState({ nome: "", tipo: "api", url: "", credencial: "", risco: "LOW", caps: [] as string[] });

  const carregar = () => {
    supabase.from("loja_chaves_ia").select("provedor, ativa, principal, final_chave, modelo, base_url, limite_mensal_tokens, tokens_mes, ultimo_uso_em").eq("loja_id", loja.id)
      .then(({ data }) => setChaves(Object.fromEntries(((data ?? []) as Chave[]).filter((c) => c.ativa).map((c) => [c.provedor, c]))));
    supabase.from("loja_plugins").select("id, nome, tipo, url, capacidades, risco, ativo, ultimo_teste_ok, ultimo_teste_em").eq("loja_id", loja.id).order("criado_em")
      .then(({ data }) => setPlugins((data ?? []) as Plugin[]));
    supabase.from("loja_busca_imagem").select("ativa").eq("loja_id", loja.id).maybeSingle()
      .then(({ data }) => setBusca((data as { ativa: boolean } | null)?.ativa ? (data as { ativa: boolean }) : null));
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

  const campo = (id: string) => campos[id] ?? { chave: "", modelo: "", limite: "", base: "" };
  const mudar = (id: string, p: Partial<{ chave: string; modelo: string; limite: string; base: string }>) => setCampos((c) => ({ ...c, [id]: { ...campo(id), ...p } }));
  async function salvarChave(e: FormEvent, id: string) {
    e.preventDefault();
    const v = campo(id);
    const r = await chamar({ acao: "salvar_chave", provedor: id, chave: v.chave, modelo: v.modelo || undefined, base_url: v.base || undefined, limite_mensal_tokens: v.limite || null }, "Chave salva. Toque em Testar chave.");
    if (r?.ok) { setCampos((c) => ({ ...c, [id]: { chave: "", modelo: "", limite: "", base: "" } })); setAbertos((x) => ({ ...x, [id]: false })); } // a chave nunca fica na tela nem no navegador
  }
  async function salvarPlugin(e: FormEvent) {
    e.preventDefault();
    const r = await chamar({ acao: "salvar_plugin", nome: f.nome, tipo: f.tipo, url: f.url, credencial: f.credencial, risco: f.risco, capacidades: f.caps }, "Plugin salvo. Teste a conexão antes de ativar.");
    if (r?.ok) { setF({ nome: "", tipo: "api", url: "", credencial: "", risco: "LOW", caps: [] }); setNovo(false); }
  }
  const alternar = (c: string) => setF((x) => ({ ...x, caps: x.caps.includes(c) ? x.caps.filter((y) => y !== c) : [...x.caps, c] }));
  async function salvarBusca(e: FormEvent) {
    e.preventDefault();
    const r = await chamar({ acao: "salvar_busca_imagem", chave: buscaChave, cx: buscaCx }, "Busca de imagens ativada.");
    if (r?.ok) { setBuscaChave(""); setBuscaCx(""); setEditandoBusca(false); }
  }
  
  return (
    <div className="cartao">
      <h1>Integrações de IA</h1>
      <p className="suave">A chave e as credenciais são cifradas no servidor e nunca voltam para a tela. O agente só lê e propõe; quem aprova é você, na fila.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"}>{msg.texto}</p>}

      <h2>Provedores de IA</h2>
      <p className="suave">Cadastre um ou mais. O principal responde no Assistente; se ele falhar por falta de chave, outro ativo assume. Sem nenhum, o assistente responde só por palavras-chave.</p>
      {PROVEDORES.map((pv) => {
        const k = chaves[pv.id]; const v = campo(pv.id); const aberto = !k || abertos[pv.id];
        const pct = k?.limite_mensal_tokens ? Math.min(100, Math.round((k.tokens_mes / k.limite_mensal_tokens) * 100)) : null;
        return (
          <div key={pv.id} className="cartao" style={{ margin: "8px 0" }}>
            <p><strong>{pv.nome}</strong> {k ? <span className="selo ok">Ativa</span> : <span className="selo atencao">Sem chave</span>} {k?.principal && <span className="selo">principal</span>}</p>
            <p className="suave">{pv.aviso}</p>
            {k && !aberto && (
              <>
                <p className="suave">Chave terminada em <code>{k.final_chave}</code> · modelo <code>{k.modelo}</code>{k.base_url ? <> · <code>{k.base_url}</code></> : null}</p>
                <p className="suave">Uso no mês: {k.tokens_mes.toLocaleString("pt-BR")} tokens{k.limite_mensal_tokens ? ` de ${k.limite_mensal_tokens.toLocaleString("pt-BR")} (${pct}%)` : " (sem limite definido)"}.</p>
                <div className="linha">
                  <button className="sec" disabled={ocupado} onClick={() => void chamar({ acao: "testar_chave", provedor: pv.id }, "A chave respondeu normalmente.")}>Testar chave</button>
                  {!k.principal && <button className="sec" disabled={ocupado} onClick={() => void chamar({ acao: "definir_principal", provedor: pv.id }, "Provedor principal atualizado.")}>Usar como principal</button>}
                  <button className="sec" onClick={() => setAbertos((x) => ({ ...x, [pv.id]: true }))}>Trocar chave ou limite</button>
                  <button className="sec" disabled={ocupado} onClick={() => { if (confirm(`Remover a chave de ${pv.nome}?`)) void chamar({ acao: "remover_chave", provedor: pv.id }, "Chave removida."); }}>Remover</button>
                </div>
              </>
            )}
            {aberto && (
              <form onSubmit={(e) => void salvarChave(e, pv.id)}>
                {pv.precisaEndereco && <label>Endereço da API (https)<input value={v.base} onChange={(e) => mudar(pv.id, { base: e.target.value })} placeholder="https://api.groq.com/openai/v1" required /></label>}
                <label>Chave de API<input type="password" value={v.chave} onChange={(e) => mudar(pv.id, { chave: e.target.value })} required minLength={8} autoComplete="new-password" spellCheck={false} /></label>
                <label>Modelo{pv.precisaEndereco ? "" : " (opcional)"}<input value={v.modelo} onChange={(e) => mudar(pv.id, { modelo: e.target.value })} required={pv.precisaEndereco} placeholder={pv.modelo ? `padrão: ${pv.modelo}` : "nome do modelo no seu provedor"} /></label>
                <label>Limite mensal de tokens (opcional)<input inputMode="numeric" value={v.limite} onChange={(e) => mudar(pv.id, { limite: e.target.value.replace(/\D/g, "") })} placeholder="ex.: 500000" /></label>
                <div className="linha"><button disabled={ocupado}>Salvar chave</button>{k && <button type="button" className="sec" onClick={() => setAbertos((x) => ({ ...x, [pv.id]: false }))}>Cancelar</button>}</div>
              </form>
            )}
          </div>
        );
      })}

      <h2>Busca de imagem de produto</h2>
      <p className="suave">Permite o agente procurar fotos da peça na web e propor para a sua aprovação. Use uma chave do Google Programmable Search (cse.google.com): 100 buscas grátis por dia.</p>
      {busca && !editandoBusca ? (
        <div className="linha"><span className="selo ok">Ativa</span>
          <button className="sec" onClick={() => setEditandoBusca(true)}>Trocar</button>
          <button className="sec" disabled={ocupado} onClick={() => { if (confirm("Desligar a busca de imagens?")) void chamar({ acao: "remover_busca_imagem" }, "Desligada."); }}>Desligar</button>
        </div>
      ) : (
        <form onSubmit={(e) => void salvarBusca(e)}>
          <label>Chave de API do Google<input type="password" value={buscaChave} onChange={(e) => setBuscaChave(e.target.value)} required minLength={10} autoComplete="new-password" spellCheck={false} /></label>
          <label>Mecanismo de busca (cx)<input value={buscaCx} onChange={(e) => setBuscaCx(e.target.value)} required placeholder="ex.: a1b2c3d4e5f6g7h8i" /></label>
          <div className="linha"><button disabled={ocupado}>Salvar</button>{busca && <button type="button" className="sec" onClick={() => setEditandoBusca(false)}>Cancelar</button>}</div>
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
