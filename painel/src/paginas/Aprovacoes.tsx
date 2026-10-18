import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { MOTIVOS, mmss, ROTULOS_TIPO_APROVACAO, segundosAte } from "../lib/pair.ts";

type Aprovacao = {
  id: string; tipo: string; ferramenta: string; agente: string; risco: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; riscos: string[]; versao: number;
  alvos: { tabela: string; id?: string; sku?: string }[]; antes: unknown; depois: unknown; estado: string; expira_em: string; hash_proposta: string;
  criado_em: string; decidido_em: string | null; motivo_decisao: string | null; pair_dispositivos: { nome: string } | null;
};
const COLUNAS = "id, tipo, ferramenta, agente, risco, riscos, versao, alvos, antes, depois, estado, expira_em, hash_proposta, criado_em, decidido_em, motivo_decisao, pair_dispositivos(nome)";
const seloRisco = (r: string) => (r === "LOW" ? "ok" : r === "MEDIUM" ? "atencao" : "erro");
const fmt = (v: unknown) => (v == null ? "—" : JSON.stringify(v, null, 2));

/** Central de Aprovações: cada pedido mostra quem pediu, qual ferramenta, o que muda, os riscos e o prazo. A decisão vale para a VERSÃO exata que você está vendo. */
export function Aprovacoes({ loja, email }: { loja: Loja; email: string | null }) {
  const [pendentes, setPendentes] = useState<Aprovacao[] | null>(null);
  const [historico, setHistorico] = useState<Aprovacao[]>([]);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState("");
  const [senhaPara, setSenhaPara] = useState("");
  const [senha, setSenha] = useState("");
  const [, forcar] = useState(0);

  const carregar = useCallback(async () => {
    const p = await supabase.from("aprovacoes").select(COLUNAS).eq("loja_id", loja.id).eq("estado", "pendente").gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(100);
    setPendentes((p.data ?? []) as unknown as Aprovacao[]);
    const h = await supabase.from("aprovacoes").select(COLUNAS).eq("loja_id", loja.id).neq("estado", "pendente").order("criado_em", { ascending: false }).limit(20);
    setHistorico((h.data ?? []) as unknown as Aprovacao[]);
  }, [loja.id]);
  useEffect(() => {
    void carregar();
    const t = setInterval(() => { void carregar(); forcar((n) => n + 1); }, 15_000);
    const f = () => void carregar();
    window.addEventListener("focus", f);
    return () => { clearInterval(t); window.removeEventListener("focus", f); };
  }, [carregar]);

  async function decidir(a: Aprovacao, decisao: "aprovar" | "recusar") {
    setOcupado(a.id); setMsg((m) => ({ ...m, [a.id]: "" }));
    if (senhaPara === a.id && decisao === "aprovar") {
      const { error } = await supabase.auth.signInWithPassword({ email: email ?? "", password: senha });
      if (error) { setOcupado(""); setMsg((m) => ({ ...m, [a.id]: "Senha incorreta." })); return; }
      setSenha(""); setSenhaPara("");
    }
    // p_hash_visto = o hash da versão que ESTÁ NA TELA. Se a proposta mudou, o banco recusa.
    const { data, error } = await supabase.rpc("aprovacao_decidir", { p_id: a.id, p_hash_visto: a.hash_proposta, p_decisao: decisao });
    setOcupado("");
    if (error) { setMsg((m) => ({ ...m, [a.id]: "Você não tem permissão de lojista nesta loja." })); return; }
    const r = data as { ok: boolean; motivo?: string };
    if (r.ok) { void carregar(); return; }
    if (r.motivo === "reconfirmacao_necessaria") setSenhaPara(a.id);
    if (r.motivo === "proposta_alterada" || r.motivo?.startsWith("estado_") || r.motivo === "expirada") void carregar();
    setMsg((m) => ({ ...m, [a.id]: r.motivo === "expirada" ? "O prazo desta proposta acabou." : MOTIVOS[r.motivo ?? ""] ?? "Não foi possível registrar a decisão." }));
  }

  return (
    <div className="cartao">
      <h1>Central de Aprovações</h1>
      <p className="suave">Agentes só <strong>propõem</strong>. Nada é publicado, alterado ou enviado ao Bling até você aprovar a versão exata mostrada aqui. Se o agente alterar a proposta, a aprovação anterior deixa de valer.</p>
      {pendentes === null ? <p className="suave">Carregando…</p> : pendentes.length === 0 ? <p className="suave">Nada aguardando aprovação.</p> : (
        <div className="grade-aprov">
          {pendentes.map((a) => {
            const seg = segundosAte(a.expira_em);
            const alto = a.risco === "HIGH" || a.risco === "CRITICAL";
            return (
              <article key={a.id} className="cartao">
                <header className="linha">
                  <strong>{ROTULOS_TIPO_APROVACAO[a.tipo] ?? a.tipo}</strong>
                  <span className={`selo ${seloRisco(a.risco)}`}>Risco {a.risco}</span>
                  <span className="selo">v{a.versao}</span>
                </header>
                <p className="suave">Pedido por <strong>{a.agente}</strong>{a.pair_dispositivos?.nome ? ` (dispositivo ${a.pair_dispositivos.nome})` : ""} · ferramenta <span className="mono">{a.ferramenta}</span> · há {mmss(Math.max(0, Math.round((Date.now() - Date.parse(a.criado_em)) / 1000)))}</p>
                <p className="suave">Prazo para decidir: <span className="mono">{seg > 0 ? mmss(seg) : "vencido"}</span></p>
                <h2>Registros afetados</h2>
                <ul>{a.alvos.length === 0 ? <li className="suave">Nenhum registro existente (cria algo novo)</li> : a.alvos.map((x, i) => <li key={i}><span className="mono">{x.tabela}</span>{x.sku ? ` · ${x.sku}` : x.id ? ` · ${x.id.slice(0, 8)}` : ""}</li>)}</ul>
                <div className="diff">
                  <div><h3>Antes</h3><pre>{fmt(a.antes)}</pre></div>
                  <div><h3>Proposto</h3><pre>{fmt(a.depois)}</pre></div>
                </div>
                <h2>Riscos</h2>
                <ul>{(a.riscos.length ? a.riscos : ["Sem riscos adicionais informados pelo agente"]).map((r, i) => <li key={i}>{r}</li>)}</ul>
                <p className="suave">Versão exata: <span className="mono">{a.hash_proposta.slice(0, 12)}</span>{alto ? " · pedirá sua senha ao aprovar" : ""}</p>
                {senhaPara === a.id && <label>Confirme sua senha<input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></label>}
                {msg[a.id] && <p className="msg-erro">{msg[a.id]}</p>}
                <div className="linha">
                  <button disabled={ocupado === a.id || seg === 0 || (senhaPara === a.id && !senha)} onClick={() => void decidir(a, "aprovar")}>Aprovar</button>
                  <button className="perigo" disabled={ocupado === a.id} onClick={() => void decidir(a, "recusar")}>Recusar</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <h2>Últimas decisões</h2>
      {historico.length === 0 ? <p className="suave">Nenhuma ainda.</p> : (
        <div className="rolagem"><table>
          <thead><tr><th>Pedido</th><th>Agente</th><th>Estado</th><th>Quando</th></tr></thead>
          <tbody>{historico.map((a) => (
            <tr key={a.id}><td>{ROTULOS_TIPO_APROVACAO[a.tipo] ?? a.tipo} <span className="suave">v{a.versao}</span></td><td>{a.agente}</td>
              <td><span className={`selo ${a.estado === "executada" || a.estado === "aprovada" ? "ok" : a.estado === "recusada" || a.estado === "falhou" ? "erro" : "atencao"}`}>{a.estado}</span></td>
              <td className="suave">{new Date(a.decidido_em ?? a.criado_em).toLocaleString("pt-BR")}</td></tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}
