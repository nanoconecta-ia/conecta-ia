import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dialogo } from "../componentes/Dialogo.tsx";
import { dataBr } from "../componentes/conector/ui.tsx";
import { SUPABASE_URL } from "../config.ts";
import type { ChaveMcp } from "../lib/conectorDados.ts";
import type { Loja } from "../lib/dados.ts";
import { useFonte } from "../lib/useFonte.ts";

const ESCOPOS: [string, string, string][] = [
  ["leitura", "Leitura", "Consultar catálogo, taxonomia e status. Não altera nada."],
  ["propor", "Propor", "Criar propostas “a confirmar”. Nunca aprova nem executa."],
  ["simular", "Simular", "Rodar a execução simulada (sem Bling real)."],
];
const VALIDADES: [number, string][] = [[7, "7 dias"], [30, "30 dias (padrão)"], [90, "90 dias"], [365, "365 dias (máximo)"]];
const situacao = (c: ChaveMcp) => c.revogada_em ? "revogada" : c.expira_em && Date.parse(c.expira_em) < Date.now() ? "expirada" : "ativa";

/** Chaves do gateway para clientes externos (GPT, Gemini, Claude…). Escopos limitados, expiração e revogação; o token aparece uma única vez. */
export function GatewayMCP({ loja }: { loja: Loja }) {
  const fonte = useFonte();
  const [chaves, setChaves] = useState<ChaveMcp[] | null>(null);
  const [nome, setNome] = useState(""); const [escopos, setEscopos] = useState<string[]>(["leitura"]); const [dias, setDias] = useState(30);
  const [novo, setNovo] = useState<{ token: string; prefixo: string; aviso: string } | null>(null); const [copiado, setCopiado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revogar, setRevogar] = useState<ChaveMcp | null>(null);
  const carregar = useCallback(() => { if (fonte) void fonte.chaves(loja.id).then(setChaves).catch(() => setChaves([])); }, [fonte, loja.id]);
  useEffect(carregar, [carregar]);
  if (!fonte) return <p className="suave">Carregando…</p>;

  async function criar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setMsg(null);
    const expira = new Date(Date.now() + dias * 86_400_000).toISOString();
    const r = await fonte!.chamar<{ id: string; token: string; prefixo?: string; aviso?: string }>("conector-chaves", { loja_id: loja.id, acao: "criar", nome: nome.trim(), escopos, expira_em: expira });
    setOcupado(false);
    if (!r.ok || !r.dados?.token) { setMsg({ ok: false, t: r.erro ?? "Não foi possível criar a chave." }); return; }
    setNovo({ token: r.dados.token, prefixo: r.dados.prefixo ?? r.dados.token.slice(0, 12), aviso: r.dados.aviso ?? "Ela não será mostrada de novo." }); setNome(""); setEscopos(["leitura"]); setCopiado(false); carregar();
  }
  async function revogarChave() {
    if (!revogar) return; setOcupado(true);
    const r = await fonte!.chamar("conector-chaves", { loja_id: loja.id, acao: "revogar", id: revogar.id });
    setOcupado(false); setRevogar(null);
    setMsg(r.ok ? { ok: true, t: "Chave revogada. Ela deixa de funcionar imediatamente." } : { ok: false, t: r.erro ?? "Não foi possível revogar." }); carregar();
  }
  const alternar = (k: string) => setEscopos((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <>
      <div className="cartao">
        <h1>Gateway multiagente (MCP/API)</h1>
        <p className="suave">Permite que um cliente externo autorizado use as ferramentas do Gênesis. Cada chave é <strong>só desta loja</strong>, tem escopos limitados, validade e pode ser revogada. Nenhum cliente recebe <code>service_role</code>, token do Bling nem acesso administrativo, e <strong>nenhuma chave pode aprovar ou executar</strong>: quem decide é você, na Central de Inteligência.</p>
      </div>
      <div className="grade tres">
        <div className="cartao"><h2>1. LLM via API do provedor</h2><p className="suave">O Gênesis chama Claude, Gemini ou um modelo compatível com OpenAI usando a <strong>chave que você cadastrou</strong> em Integrações de IA. O custo é do seu provedor.</p></div>
        <div className="cartao"><h2>2. Cliente externo autorizado</h2><p className="suave">Um app de IA seu se conecta ao endereço abaixo com uma chave desta página e chama as ferramentas permitidas pelo escopo. Depende de o cliente suportar MCP ou chamadas HTTP.</p></div>
        <div className="cartao"><h2>3. Plugins e serviços externos</h2><p className="suave">Serviços integrados <strong>um a um</strong> em Integrações de IA (risco, capacidades e teste próprios). Assinaturas e plugins do ChatGPT <strong>não</strong> são transferidos automaticamente para cá.</p></div>
      </div>

      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role={msg.ok ? "status" : "alert"}>{msg.t}</p>}
      {novo && (
        <div className="cartao token-novo" role="alert">
          <h2 style={{ marginTop: 0 }}>Copie a chave agora</h2>
          <p className="aviso"><strong>{novo.aviso}</strong> Guarde em local seguro; nunca a coloque em código, site ou repositório. Prefixo para reconhecê-la depois: <code>{novo.prefixo}</code></p>
          <p className="mono token">{novo.token}</p>
          <div className="linha"><button onClick={() => void navigator.clipboard?.writeText(novo.token).then(() => setCopiado(true))}>{copiado ? "Copiada" : "Copiar chave"}</button><button className="sec" onClick={() => setNovo(null)}>Já guardei, fechar</button></div>
        </div>
      )}

      <div className="cartao">
        <h2>Nova chave</h2>
        <form onSubmit={(e) => void criar(e)}>
          <label>Nome (para você reconhecer)<input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} maxLength={60} placeholder="Ex.: Assistente GPT do escritório" /></label>
          <fieldset><legend>Escopos</legend>
            {ESCOPOS.map(([k, t, d]) => <label key={k} className="linha marcar-linha"><input type="checkbox" checked={escopos.includes(k)} onChange={() => alternar(k)} /><span><strong>{t}</strong> — {d}</span></label>)}
          </fieldset>
          <label>Validade<select value={dias} onChange={(e) => setDias(Number(e.target.value))}>{VALIDADES.map(([d, t]) => <option key={d} value={d}>{t}</option>)}</select></label>
          <button disabled={ocupado || escopos.length === 0 || nome.trim().length < 3}>Gerar chave</button>
        </form>
        <p className="suave">Endereço do gateway: <code>{SUPABASE_URL}/functions/v1/conector-mcp</code> — enviar <code>Authorization: Bearer &lt;chave&gt;</code>. O endereço só responde depois que a função for publicada.</p>
      </div>

      <div className="cartao">
        <h2>Chaves da loja</h2>
        {chaves === null ? <p className="suave">Carregando…</p> : chaves.length === 0 ? <p className="suave">Nenhuma chave criada.</p> : (
          <div className="rolagem"><table>
            <thead><tr><th>Nome</th><th>Escopos</th><th>Situação</th><th>Expira</th><th>Último uso</th><th /></tr></thead>
            <tbody>{chaves.map((c) => { const s = situacao(c); return (
              <tr key={c.id}><td>{c.nome}</td><td>{c.escopos.join(", ")}</td><td><span className={`selo ${s === "ativa" ? "ok" : "erro"}`}>{s}</span></td><td>{dataBr(c.expira_em)}</td><td>{dataBr(c.ultimo_uso_em)}</td>
                <td>{s === "ativa" && <button className="perigo" onClick={() => setRevogar(c)}>Revogar</button>}</td></tr>); })}</tbody></table></div>)}
      </div>
      <Dialogo aberto={!!revogar} titulo="Revogar chave" perigo rotuloConfirmar="Revogar agora" ocupado={ocupado} aoCancelar={() => setRevogar(null)} aoConfirmar={() => void revogarChave()}>
        <p>A chave <strong>{revogar?.nome}</strong> deixa de funcionar na hora. Quem a usa perde o acesso.</p>
      </Dialogo>
    </>
  );
}
