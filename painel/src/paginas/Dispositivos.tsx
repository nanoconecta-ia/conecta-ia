import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { ir } from "../lib/rota.ts";
import { ROTULOS_ESCOPO, TIPOS_DISPOSITIVO } from "../lib/pair.ts";

type Sessao = { id: string; escopos: string[]; expira_em: string; limite_ate: string; ultimo_uso_em: string | null; revogado_em: string | null };
type Dispositivo = { id: string; nome: string; tipo: string; capacidades: string[]; criado_em: string; ultimo_uso_em: string | null; revogado_em: string | null; pair_sessoes: Sessao[] };

const ativa = (s: Sessao) => !s.revogado_em && Date.parse(s.limite_ate) > Date.now();

/** Dispositivos pareados: veja quem está conectado agora e encerre na hora (vale já na próxima chamada do dispositivo). */
export function Dispositivos({ loja }: { loja: Loja }) {
  const [lista, setLista] = useState<Dispositivo[] | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const carregar = useCallback(async () => {
    const { data } = await supabase.from("pair_dispositivos")
      .select("id, nome, tipo, capacidades, criado_em, ultimo_uso_em, revogado_em, pair_sessoes(id, escopos, expira_em, limite_ate, ultimo_uso_em, revogado_em)")
      .eq("loja_id", loja.id).order("criado_em", { ascending: false }).limit(100);
    setLista((data ?? []) as unknown as Dispositivo[]);
  }, [loja.id]);
  useEffect(() => { void carregar(); const t = setInterval(() => void carregar(), 20_000); return () => clearInterval(t); }, [carregar]);

  async function encerrar(d: Dispositivo) {
    setOcupado(d.id); setMsg("");
    const { error } = await supabase.rpc("pair_revogar_dispositivo", { p_dispositivo: d.id, p_motivo: "encerrado pelo lojista no painel" });
    setOcupado("");
    setMsg(error ? "Você não tem permissão para encerrar este dispositivo." : `${d.nome} foi desconectado.`);
    void carregar();
  }
  async function interromperTudo() {
    if (!window.confirm("Encerrar TODOS os dispositivos e agentes conectados a esta loja agora?")) return;
    setOcupado("todos"); setMsg("");
    const { data, error } = await supabase.rpc("pair_revogar_todos", { p_loja: loja.id });
    setOcupado("");
    setMsg(error ? "Você não tem permissão de lojista nesta loja." : `${(data as { sessoes_encerradas: number }).sessoes_encerradas} sessão(ões) encerrada(s).`);
    void carregar();
  }
  const ativos = (lista ?? []).filter((d) => !d.revogado_em && d.pair_sessoes.some(ativa));

  return (
    <div className="cartao">
      <h1>Dispositivos conectados</h1>
      <p className="suave">Computadores, celulares, navegadores e agentes pareados com a sua loja. Eles só consultam e propõem; quem aprova é você.</p>
      <div className="linha">
        <button onClick={() => ir("/parear")}>Conectar novo dispositivo</button>
        <button className="perigo" disabled={ativos.length === 0 || ocupado === "todos"} onClick={() => void interromperTudo()}>Interromper todos ({ativos.length})</button>
      </div>
      {msg && <p className="msg-ok">{msg}</p>}
      {lista === null ? <p className="suave">Carregando…</p> : lista.length === 0 ? <p className="suave">Nenhum dispositivo pareado.</p> : (
        <div className="rolagem"><table>
          <thead><tr><th>Dispositivo</th><th>Permissões</th><th>Estado</th><th>Último uso</th><th /></tr></thead>
          <tbody>{lista.map((d) => {
            const s = d.pair_sessoes.filter(ativa).sort((a, b) => Date.parse(b.limite_ate) - Date.parse(a.limite_ate))[0];
            const viva = !d.revogado_em && !!s;
            return (
              <tr key={d.id}>
                <td><strong>{d.nome}</strong><br /><span className="suave">{TIPOS_DISPOSITIVO.find(([v]) => v === d.tipo)?.[1] ?? d.tipo}</span>
                  {d.tipo === "agente_desktop" && <><br /><span className="suave">Capacidades: {d.capacidades.length ? d.capacidades.join(", ") : "nenhuma"}</span></>}</td>
                <td className="suave">{(s?.escopos ?? d.pair_sessoes[0]?.escopos ?? []).map((e) => ROTULOS_ESCOPO[e] ?? e).join("; ") || "—"}</td>
                <td>{viva ? <span className={`selo ${d.tipo === "agente_desktop" ? "atencao" : "ok"}`}>Sessão ativa até {new Date(s.limite_ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span> : <span className="selo">{d.revogado_em ? "Encerrado" : "Expirado"}</span>}</td>
                <td className="suave">{d.ultimo_uso_em ? new Date(d.ultimo_uso_em).toLocaleString("pt-BR") : "nunca usado"}</td>
                <td>{viva && <button className="perigo" disabled={ocupado === d.id} onClick={() => void encerrar(d)}>Desconectar</button>}</td>
              </tr>);
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}
