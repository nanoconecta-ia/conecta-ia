import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { ir } from "../lib/rota.ts";
import { estadoAgente, nomeCurto, resumoFaixa } from "../lib/usoGateway.ts";
import "./faixa-agentes.css";
import { restante } from "./Dispositivos.tsx";
import { indicadorQr, type PresencaQr } from "../lib/indicadorQr.ts";
import { consolidarAgentes, type DispositivoComSessoes } from "../lib/estadoConectores.ts";

type Linha = { id: string; nome: string; tipo: string; sessaoId: string; limite_ate: string; token_ate: string; absoluto: string | null; ultima: string | null; escopos: string[]; historicas: number };

/** Faixa fina no topo: quem está conectado AGORA (agente externo, extensão), quanto tempo resta e se está agindo. Só dados reais da loja. */
export function FaixaAgentes({ loja }: { loja: Loja }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [presencaQr, setPresencaQr] = useState<PresencaQr>(null);
  const [agora, setAgora] = useState(Date.now());
  const [msg, setMsg] = useState("");
  const [aberta, setAberta] = useState(false);
  const [avisoConexao, setAvisoConexao] = useState("");
  const agentesAtivosAnteriores = useRef<string | null>(null);
  const carregar = useCallback(async () => {
    const { data: estadoQr, error: erroQr } = await supabase.rpc("chat_qr_disponivel", { p_loja: loja.id });
    setPresencaQr(!erroQr ? (estadoQr as PresencaQr) : null);
    const { data } = await supabase.from("pair_dispositivos")
      .select("id, nome, tipo, revogado_em, pair_sessoes(id, criado_em, escopos, expira_em, limite_ate, limite_absoluto_ate, ultimo_uso_em, revogado_em)").eq("loja_id", loja.id).is("revogado_em", null).order("criado_em", { ascending: false }).limit(100);
    const desde = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: ev } = await supabase.from("auditoria").select("quando, depois").eq("loja_id", loja.id).like("acao", "gateway.%").gte("quando", desde).order("quando", { ascending: false }).limit(200);
    const ultima = new Map<string, string>();
    for (const e of (ev ?? []) as { quando: string; depois: { dispositivo_id?: string } | null }[]) { const d = e.depois?.dispositivo_id; if (d && !ultima.has(d)) ultima.set(d, e.quando); }
    const l: Linha[] = [];
    // A lista é de agentes LÓGICOS, não de sessões OAuth; sem tokens vencidos no topo.
    // O histórico continua preservado na base e aparece na tela Conectores.
    const tInicio = Date.now();
    const grupos = consolidarAgentes((data ?? []) as unknown as DispositivoComSessoes[], tInicio);
    for (const grupo of grupos) {
      const d = grupo.dispositivo, s = grupo.sessao;
      if (s.revogado_em || Date.parse(s.expira_em) <= tInicio || Date.parse(s.limite_ate) <= tInicio) continue;
      l.push({ id: d.id, nome: d.nome, tipo: d.tipo, sessaoId: s.id,
        limite_ate: s.limite_ate, token_ate: s.expira_em,
        absoluto: (s as typeof s & { limite_absoluto_ate?: string | null }).limite_absoluto_ate ?? null,
        ultima: ultima.get(d.id) ?? s.ultimo_uso_em ?? null,
        escopos: s.escopos ?? [], historicas: grupo.historicas });
    }
    setLinhas(l);
    const t = Date.now();
    const ativos = l.filter(x => estadoAgente(x.limite_ate, x.ultima, t, x.token_ate).situacao === "agindo")
      .map(x => x.id).sort().join(",");
    if (agentesAtivosAnteriores.current !== null && agentesAtivosAnteriores.current !== ativos) {
      setAvisoConexao(ativos ? "Conector com atividade recente. Confira as permissões." : "Nenhum conector com atividade recente.");
    }
    agentesAtivosAnteriores.current = ativos;
  }, [loja.id]);
  useEffect(() => { void carregar(); const t = setInterval(() => { setAgora(Date.now()); void carregar(); }, 20_000); return () => clearInterval(t); }, [carregar]);
  async function reconfirmar(sessaoId: string) {
    const { data, error } = await supabase.rpc("pair_reconfirmar", { p_sessao: sessaoId });
    const r = data as { ok?: boolean; motivo?: string } | null;
    setMsg(error || !r?.ok ? (r?.motivo === "login_recente_necessario" ? "Entre de novo para reconfirmar." : "Não foi possível reconfirmar.") : "Estendido por mais 8 horas.");
    void carregar();
  }
  async function desconectar(l: Linha) {
    if (!window.confirm(`Desconectar ${nomeCurto(l.nome)}? O agente perde o acesso na hora.`)) return;
    const { error } = await supabase.rpc("pair_revogar_dispositivo", { p_dispositivo: l.id, p_motivo: "desconectado pelo lojista na faixa de agentes" });
    setMsg(error ? "Não foi possível desconectar. Use a tela Dispositivos." : `${nomeCurto(l.nome)} foi desconectado.`);
    void carregar();
  }
  const sinal = indicadorQr(presencaQr, agora);
  if (linhas.length === 0) return <div className="faixa-agentes faixa-qr-somente" role="status"><span className={`fa-qr ${sinal.online ? "fa-qr-online" : "fa-qr-offline"}`} title={sinal.detalhe} aria-label={sinal.detalhe}>{sinal.rotulo}</span>{msg && <span className="fa-msg">{msg}</span>}{avisoConexao && <span className="fa-msg">{avisoConexao}</span>}<button type="button" onClick={() => ir("/conectores")}>Conectores</button></div>;
  return (
    <div className="faixa-agentes" role="status" aria-live="polite">
      <span className={`fa-qr ${sinal.online ? "fa-qr-online" : "fa-qr-offline"}`} title={sinal.detalhe} aria-label={sinal.detalhe}>{sinal.rotulo}</span>
      <button type="button" className="fa-icone" aria-expanded={aberta} aria-label={aberta ? "Recolher sessões autorizadas" : `Sessões autorizadas: ${linhas.length}`} onClick={() => setAberta(!aberta)}>
        <span aria-hidden style={{ fontSize: 11, fontWeight: 600 }}>IA</span><i className="fa-badge" style={{ background: linhas.some((x) => estadoAgente(x.limite_ate, x.ultima, agora, x.token_ate).situacao === "agindo") ? "#1a6f4d" : linhas.some((x) => estadoAgente(x.limite_ate, x.ultima, agora, x.token_ate).situacao === "parado") ? "#b42318" : "#9a5500" }} aria-hidden />
      </button>
      {!aberta && <button type="button" className="fa-resumo" onClick={() => ir("/conectores")}>{resumoFaixa(linhas.map((x) => x.nome), linhas.length === 1 ? restante(linhas[0].limite_ate, agora) : null)}</button>}
      {aberta && linhas.map((l) => {
        const e = estadoAgente(l.limite_ate, l.ultima, agora, l.token_ate);
        const rotulo = e.situacao === "parado" ? "token expirado: reconectar" : e.situacao === "agindo" ? "atividade recente" : e.situacao === "acabando" ? "sessão acabando" : "autorizado, inativo";
        const min = l.ultima ? Math.floor((agora - Date.parse(l.ultima)) / 60000) : null;
        const podeEstender = l.absoluto !== null && Date.parse(l.absoluto) - Date.parse(l.limite_ate) > 60_000;
        return (
          <div key={l.id} className={`fa-item fa-${e.situacao}`} title={`${l.nome}. Nome informado pelo agente; ação medida pelo Conecta.IA.`}>
            <span className="fa-ponto" aria-hidden>●</span>
            <strong className="fa-nome">{nomeCurto(l.nome)}</strong>
            <span className="fa-estado">{l.escopos.includes("chat:responder") ? "Chat Nano" : l.escopos.some(x => x.startsWith("mcp:")) ? "Catálogo MCP" : "Outro acesso"} · {rotulo}{l.historicas ? ` · ${l.historicas} sessão(ões) antigas no histórico` : ""}</span>
            {e.situacao !== "parado" && <span className="fa-tempo">{restante(l.limite_ate, agora)}</span>}
            {min !== null && e.situacao !== "parado" && <span className="fa-tempo">{min < 1 ? "agora" : `há ${min} min`}</span>}
            {e.situacao === "acabando" && podeEstender && <button onClick={() => void reconfirmar(l.sessaoId)}>+8 h</button>}
            <button onClick={() => ir("/dispositivos")}>Ver</button>
            <button className="perigo" onClick={() => void desconectar(l)}>Desconectar</button>
          </div>
        );
      })}
      {msg && <span className="fa-msg">{msg}</span>}
      {avisoConexao && <span className="fa-msg">{avisoConexao}</span>}
    </div>
  );
}
