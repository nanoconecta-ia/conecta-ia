import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { ir } from "../lib/rota.ts";
import { indicadorQr, type PresencaQr } from "../lib/indicadorQr.ts";
import { estadoSessaoConector, permissoesConector, resumoConectores, situacaoSessao, type SessaoConector } from "../lib/estadoConectores.ts";

type Dispositivo = {
  id: string; nome: string; tipo: string; revogado_em: string | null;
  pair_sessoes: SessaoConector[];
};
type Plugin = { nome: string; tipo: string; ativo: boolean; ultimo_teste_ok: boolean | null; ultimo_teste_em: string | null; url: string | null };
type Snapshot = { dispositivos: Dispositivo[]; plugins: Plugin[]; qr: PresencaQr | null; erroQr: boolean };

/** Painel de leitura. Não cria permissões, ativa plugins nem mistura o público OAuth das duas portas. */
export function Conectores({ loja }: { loja: Loja }) {
  const [dados, setDados] = useState<Snapshot | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [agora, setAgora] = useState(Date.now());
  const anterior = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    const [rDispositivos, rPlugins, rQr] = await Promise.all([
      supabase.from("pair_dispositivos")
        .select("id, nome, tipo, revogado_em, pair_sessoes(id, escopos, expira_em, limite_ate, ultimo_uso_em, chat_escuta_em, revogado_em)")
        .eq("loja_id", loja.id).is("revogado_em", null).limit(100),
      supabase.from("loja_plugins")
        .select("nome, tipo, ativo, ultimo_teste_ok, ultimo_teste_em, url")
        .eq("loja_id", loja.id).is("removido_em", null).limit(50),
      supabase.rpc("chat_qr_disponivel", { p_loja: loja.id }),
    ]);
    if (rDispositivos.error || rPlugins.error) {
      setErro("Não consegui consultar todas as permissões. Nenhum conector foi considerado ligado sem confirmação.");
      return;
    }
    const dispositivos = (rDispositivos.data ?? []) as unknown as Dispositivo[];
    const plugins = (rPlugins.data ?? []) as Plugin[];
    const t = Date.now();
    const identidadesAtivas = dispositivos.filter(d => !d.revogado_em)
      .filter(d => d.pair_sessoes.some(s => estadoSessaoConector(s, t) === "atividade_recente"))
      .map(d => d.id).sort().join(",");
    if (anterior.current !== null && anterior.current !== identidadesAtivas) {
      setAviso(identidadesAtivas ? "Um conector passou a registrar atividade. Confira o agente e suas permissões abaixo." : "Nenhum conector apresenta atividade recente.");
    }
    anterior.current = identidadesAtivas;
    setErro("");
    setDados({ dispositivos, plugins, qr: rQr.error ? null : rQr.data as PresencaQr, erroQr: !!rQr.error });
    setAgora(t);
  }, [loja.id]);

  useEffect(() => {
    void carregar();
    const timer = setInterval(() => void carregar(), 20_000);
    return () => clearInterval(timer);
  }, [carregar]);

  const porDispositivo = (dados?.dispositivos ?? []).map(d => {
    const s = (d.pair_sessoes ?? []).filter(x => !x.revogado_em && Date.parse(x.limite_ate) > agora)
      .sort((a, b) => Date.parse(b.expira_em) - Date.parse(a.expira_em))[0] ?? null;
    return { d, s };
  }).filter(x => x.s !== null);

  const todas = porDispositivo.flatMap(x => x.s ? [x.s] : []);
  const resumo = resumoConectores(todas, agora);
  const qr = dados && !dados.erroQr ? indicadorQr(dados.qr, agora) : null;
  return (
    <div className="cartao">
      <h1>Conectores e agentes</h1>
      <p className="suave">Status real da Mobis Autopeças. Cada agente (ChatGPT, Claude ou outro) tem sua própria sessão, permissões e prazo. <strong>Autorizado não significa online</strong>: presença exige atividade recente; o chat QR exige escuta própria.</p>
      <div className="linha">
        <button type="button" onClick={() => ir("/parear")}>Conectar agente por QR</button>
        <button type="button" className="sec" onClick={() => ir("/gateway")}>Configurar MCP</button>
        <button type="button" className="sec" onClick={() => ir("/dispositivos")}>Permissões e revogação</button>
        <button type="button" className="sec" onClick={() => void carregar()}>Atualizar estados</button>
      </div>
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      {aviso && <p className="msg-ok" role="status" aria-live="polite">{aviso}</p>}
      {!dados ? <p role="status">Consultando agentes e permissões…</p> : <>
        <div className="grade tres">
          <div className="cartao"><strong>{resumo.autorizadas}</strong><p className="suave">Sessões autorizadas com token válido</p></div>
          <div className="cartao"><strong>{resumo.emAtividade}</strong><p className="suave">Sessões com atividade recente</p></div>
          <div className="cartao"><strong>{resumo.podemResponder}</strong><p className="suave">Sessões autorizadas a responder ao Nano</p></div>
        </div>

        <div className="cartao">
          <h2>Canal de conversa Nano.IA</h2>
          <p role="status"><strong>{qr ? qr.rotulo : "Presença QR indisponível para consulta"}</strong></p>
          <p className="suave">{qr?.detalhe ?? "Não foi possível verificar o sinal de escuta do chat."}</p>
          <p><code>conecta-gateway</code> usa a permissão <code>chat:responder</code>. Não é a mesma conexão que consulta o catálogo.</p>
        </div>

        <div className="cartao">
          <h2>Canal de ferramentas MCP</h2>
          <p><code>conector-mcp</code> aceita <code>mcp:leitura</code> e <code>mcp:propor</code>. São permissões para consultar e preparar sugestões; não liberam execução no Bling.</p>
          <p className="suave">Sessões autorizadas a propor: {resumo.podemPropor}. Um token QR não é automaticamente válido no outro canal.</p>
        </div>

        <div className="cartao">
          <h2>Agentes pareados</h2>
          {porDispositivo.length === 0 ? <p className="suave">Nenhum agente com janela de autorização válida.</p> :
            <div className="rolagem"><table>
              <thead><tr><th>Agente</th><th>Estado</th><th>Permissões</th><th>Último uso</th></tr></thead>
              <tbody>{porDispositivo.map(({ d, s }) => {
                if (!s) return null;
                const p = permissoesConector(s.escopos);
                return <tr key={d.id}>
                  <td><strong>{d.nome}</strong><div className="suave">{d.tipo}</div></td>
                  <td>{situacaoSessao(estadoSessaoConector(s, agora))}</td>
                  <td className="suave">{[
                    p.consultar && "Catálogo: consultar",
                    p.propor && "Catálogo: propor",
                    p.responderNano && "Chat Nano: responder",
                  ].filter(Boolean).join("; ") || "Sem escopos destes canais"}
                    <div>Não pode aprovar nem executar no Bling.</div>
                  </td>
                  <td className="suave">{s.ultimo_uso_em ? new Date(s.ultimo_uso_em).toLocaleString("pt-BR") : "Sem chamadas registradas"}</td>
                </tr>;
              })}</tbody>
            </table></div>}
        </div>

        <div className="cartao">
          <h2>Plugins cadastrados</h2>
          {!dados.plugins.length ? <p className="suave">Nenhum plugin cadastrado.</p> : <div className="rolagem"><table>
            <thead><tr><th>Plugin</th><th>Situação verificada</th></tr></thead>
            <tbody>{dados.plugins.map(p => <tr key={p.nome}>
              <td><strong>{p.nome}</strong> <span className="suave">({p.tipo})</span></td>
              <td>{!p.ativo ? "Inativo" : !p.url ? "Sem endpoint configurado" : p.ultimo_teste_ok === true ? "Cadastrado e testado; execução não comprovada" : p.ultimo_teste_ok === false ? "Teste falhou" : "Sem teste concluído"}</td>
            </tr>)}</tbody>
          </table></div>}
          <p className="suave">Plugins inativos não são portas alternativas nem contam como agentes online. A disponibilidade do adaptador de cada tipo exige teste específico.</p>
        </div>
      </>}
      <div className="cartao">
        <h2>Proteções e resolução de conflito</h2>
        <p>Ao detectar falha em uma conexão, o painel deve identificá-la, e não conceder automaticamente escopos de outro servidor. O catálogo MCP e a conversa QR são serviços diferentes; ambos podem operar simultaneamente, inclusive com outros agentes como Claude.</p>
        <p><strong>Decisão humana obrigatória:</strong> imagens, cadastros e propostas precisam de aprovação própria. Tokens de agentes nunca aprovam, publicam ou alteram dados fiscais ou estoque.</p>
      </div>
    </div>
  );
}
