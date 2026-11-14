import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { ir } from "../lib/rota.ts";
import { estadoAgente, maisRecentePorNome, nomeCurto } from "../lib/usoGateway.ts";
import "./faixa-agentes.css";
import { restante } from "./Dispositivos.tsx";

type Linha = { id: string; nome: string; tipo: string; sessaoId: string; limite_ate: string; token_ate: string; absoluto: string | null; ultima: string | null };

/** Faixa fina no topo: quem está conectado AGORA (agente externo, extensão), quanto tempo resta e se está agindo. Só dados reais da loja. */
export function FaixaAgentes({ loja }: { loja: Loja }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [agora, setAgora] = useState(Date.now());
  const [msg, setMsg] = useState("");
  const [aberta, setAberta] = useState(false);
  const carregar = useCallback(async () => {
    const { data } = await supabase.from("pair_dispositivos")
      .select("id, nome, tipo, pair_sessoes(id, expira_em, limite_ate, limite_absoluto_ate, revogado_em)").eq("loja_id", loja.id).is("revogado_em", null).limit(20);
    const desde = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: ev } = await supabase.from("auditoria").select("quando, depois").eq("loja_id", loja.id).like("acao", "gateway.%").gte("quando", desde).order("quando", { ascending: false }).limit(200);
    const ultima = new Map<string, string>();
    for (const e of (ev ?? []) as { quando: string; depois: { dispositivo_id?: string } | null }[]) { const d = e.depois?.dispositivo_id; if (d && !ultima.has(d)) ultima.set(d, e.quando); }
    const l: Linha[] = [];
    for (const d of (data ?? []) as unknown as { id: string; nome: string; tipo: string; pair_sessoes: { id: string; expira_em: string; limite_ate: string; limite_absoluto_ate?: string; revogado_em: string | null }[] }[]) {
      const s = d.pair_sessoes.filter((x) => !x.revogado_em && Date.parse(x.limite_ate) > Date.now()).sort((a, b) => Date.parse(b.limite_ate) - Date.parse(a.limite_ate))[0];
      if (s) l.push({ id: d.id, nome: d.nome, tipo: d.tipo, sessaoId: s.id, limite_ate: s.limite_ate, token_ate: s.expira_em, absoluto: s.limite_absoluto_ate ?? null, ultima: ultima.get(d.id) ?? null });
    }
    setLinhas(maisRecentePorNome(l));
  }, [loja.id]);
  useEffect(() => { void carregar(); const t = setInterval(() => { setAgora(Date.now()); void carregar(); }, 20_000); return () => clearInterval(t); }, [carregar]);
  async function reconfirmar(sessaoId: string) {
    const { data, error } = await supabase.rpc("pair_reconfirmar", { p_sessao: sessaoId });
    const r = data as { ok?: boolean; motivo?: string } | null;
    setMsg(error || !r?.ok ? (r?.motivo === "login_recente_necessario" ? "Entre de novo para reconfirmar." : "Não foi possível reconfirmar.") : "Estendido por mais 8 horas.");
    void carregar();
  }
  if (linhas.length === 0) return null;
  return (
    <div className="faixa-agentes" role="status" aria-live="polite">
      <button className="fa-icone" aria-expanded={aberta} aria-label={aberta ? "Recolher agentes conectados" : `Agentes conectados: ${linhas.length}`} onClick={() => setAberta(!aberta)}>
        <span aria-hidden style={{ fontSize: 11, fontWeight: 600 }}>IA</span><i className="fa-badge" style={{ background: linhas.some((x) => estadoAgente(x.limite_ate, x.ultima, agora, x.token_ate).situacao === "parado") ? "#b42318" : "#1a6f4d" }} aria-hidden />
      </button>
      {aberta && linhas.map((l) => {
        const e = estadoAgente(l.limite_ate, l.ultima, agora, l.token_ate);
        const rotulo = e.situacao === "parado" ? "parado: reconectar" : e.situacao === "agindo" ? "agindo agora" : e.situacao === "acabando" ? "sessão acabando" : "conectado";
        const min = l.ultima ? Math.floor((agora - Date.parse(l.ultima)) / 60000) : null;
        const podeEstender = l.absoluto !== null && Date.parse(l.absoluto) - Date.parse(l.limite_ate) > 60_000;
        return (
          <div key={l.id} className={`fa-item fa-${e.situacao}`} title={`${l.nome}. Nome informado pelo agente; ação medida pelo Conecta.IA.`}>
            <span className="fa-ponto" aria-hidden>●</span>
            <strong className="fa-nome">{nomeCurto(l.nome)}</strong>
            <span className="fa-estado">{rotulo}</span>
            {e.situacao !== "parado" && <span className="fa-tempo">{restante(l.limite_ate, agora)}</span>}
            {min !== null && e.situacao !== "parado" && <span className="fa-tempo">{min < 1 ? "agora" : `há ${min} min`}</span>}
            {e.situacao === "acabando" && podeEstender && <button onClick={() => void reconfirmar(l.sessaoId)}>+8 h</button>}
            <button onClick={() => ir("/dispositivos")}>Ver</button>
          </div>
        );
      })}
      {msg && <span className="fa-msg">{msg}</span>}
    </div>
  );
}
