import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { gravarPreferenciaFala, lerPreferenciaFala, useVoz } from "../lib/voz.ts";
import { Esfera, type EstadoEsfera } from "../componentes/Esfera.tsx";
import { EvidenciaProduto, type EvidenciaBusca } from "../componentes/EvidenciaProduto.tsx";
import { escolherInicial, erroAssistente, ESTADO_PROVEDOR, type OpcaoProvedor, type ProvedorChat } from "../lib/provedores.ts";

type Evidencia = { origem: string; simulado: boolean; consultado_em: string; sincronizado_em?: string; motivo?: string; dados: { sku?: string; nome?: string; preco?: number | null; estoque?: number | null } };
type Msg = { de: "eu" | "ia"; texto: string; evidencias?: Evidencia[]; simulado?: boolean };
type Conversa = { id: string; titulo: string; atualizada_em: string };
type Registro = { id: string; papel: string; conteudo: string; criada_em: string; metadados?: { evidencias?: Evidencia[]; simulado?: boolean } };
const SUGESTOES = ["Resumo da loja", "O que está pendente?", "Produtos incompletos", "Bling conectado?"];

export function Assistente({ loja }: { loja: Loja }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "ia", texto: "Olá! Posso resumir a loja, mostrar o que aguarda aprovação e o que falta para publicar. Para conversar com IA e usar plugins, configure um provedor em Integrações de IA." }]);
  const [config, setConfig] = useState({ persistente: false, bling: false, leitura_administrativa: false, retencao_dias: 180 });
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [erroHistorico, setErroHistorico] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [maisConversas, setMaisConversas] = useState(false);
  const [administrando, setAdministrando] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(180);
  const [podeAdministrar, setPodeAdministrar] = useState(false);
  const [retentativa, setRetentativa] = useState<{ texto: string; chave: string; provedor: ProvedorChat; conversa: string | null } | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [esq, setEsq] = useState(false), [dir, setDir] = useState(false); // abas laterais retráteis (conversas / modelo e privacidade)
  const caixa = useRef<HTMLDivElement>(null);
  const estreito = () => (caixa.current?.clientWidth ?? 0) < 820; // em tela estreita as abas são gavetas sobrepostas: só uma por vez
  const [provedores, setProvedores] = useState<OpcaoProvedor[]>([]);
  const [provedor, setProvedor] = useState<ProvedorChat | "">("");
  const [carregandoChat, setCarregandoChat] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erroConfig, setErroConfig] = useState("");
  const [aceitaEnvio, setAceitaEnvio] = useState(false);
  const lojaAtual = useRef(loja.id); lojaAtual.current = loja.id;
  const selecao = provedores.find((p) => p.id === provedor);
  const podeEnviar = !carregandoChat && !carregando && !erroConfig && (!provedor || (selecao?.estado === "disponivel" && aceitaEnvio));
  useEffect(() => {
    let ativo = true;
    setConfig({ persistente: false, bling: false, leitura_administrativa: false, retencao_dias: 180 }); setConversas([]); setConversaId(null); setRegistros([]); setRetentativa(null); setAdministrando(false); setErroHistorico("");
    setCarregandoChat(true); setCarregando(true); setErroConfig(""); setProvedores([]); setProvedor(""); setAceitaEnvio(false);
    setMsgs([{ de: "ia", texto: "Olá! Posso consultar os dados desta loja. Escolha um provedor para conversar com IA." }]);
    supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "provedores" } })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error || data?.verificado !== true || !Array.isArray(data?.provedores)) {
          setErroConfig("Não foi possível verificar os provedores. Reabra o Assistente para tentar novamente.");
        } else {
          setProvedores(data.provedores); setProvedor(escolherInicial(data.provedores));
        }
        setCarregando(false);
      }).catch(() => { if (ativo) { setErroConfig("Não foi possível verificar os provedores."); setCarregando(false); } });
    supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "chat_config" } }).then(({ data, error }) => {
      if (!ativo) return;
      setCarregandoChat(false);
      if (error || !data || data.erro) { setErroHistorico("Histórico persistente ainda indisponível. O resumo local continua disponível."); return; }
      setConfig(data); setDias(data.retencao_dias);
      void listarConversas(false);
    }).catch(() => { if (ativo) { setCarregandoChat(false); setErroHistorico("Não foi possível consultar o histórico."); } });
    supabase.rpc("pode_administrar_loja", { p_loja_id: loja.id }).then(({ data, error }) => { if (ativo) setPodeAdministrar(!error && data === true); });
    return () => { ativo = false; };
  }, [loja.id]);
  const [lerAlto, setLerAlto] = useState(lerPreferenciaFala);
  const fim = useRef<HTMLDivElement>(null);
  const msgsRef = useRef(msgs); msgsRef.current = msgs;
  const lerAltoRef = useRef(lerAlto); lerAltoRef.current = lerAlto;

  async function chamada(acao: string, campos: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao, ...campos } });
    if (error) throw new Error(await erroAssistente(error));
    if (data?.erro) throw new Error(String(data.erro));
    return data;
  }
  async function listarConversas(mais: boolean) {
    const origem = loja.id;
    try {
      const ultima = conversas.at(-1);
      const d = await chamada("chat_listar", mais && ultima ? { antes: ultima.atualizada_em, antes_id: ultima.id } : {});
      if (lojaAtual.current !== origem) return;
      setConversas(v => mais ? [...v, ...d.conversas] : d.conversas); setMaisConversas(d.conversas.length === 50);
    } catch (e) { if (lojaAtual.current === origem) setErroHistorico(String(e)); }
  }
  function mostrar(rs: Registro[]) {
    setRegistros(rs); setMsgs(rs.map(m => ({ de: m.papel === "usuario" ? "eu" : "ia", texto: m.conteudo, evidencias: m.metadados?.evidencias, simulado: m.metadados?.simulado })));
  }
  async function abrir(id: string, mais = false, admin = false) {
    const origem = loja.id; setOcupado(true); setErroHistorico("");
    try {
      const primeira = registros[0];
      const d = await chamada(admin ? "chat_admin" : "chat_mensagens", { conversa_id: id, ...(admin ? { motivo } : {}), ...(mais && primeira ? { antes: primeira.criada_em, antes_id: primeira.id } : {}) });
      if (lojaAtual.current !== origem) return;
      const linhas: Registro[] = admin ? [...d.mensagens].reverse() : d.mensagens;
      mostrar(mais ? [...linhas, ...registros] : linhas); setConversaId(id); setAdministrando(admin); setRetentativa(null);
    } catch (e) { if (lojaAtual.current === origem) setErroHistorico(String(e)); }
    finally { if (lojaAtual.current === origem) setOcupado(false); }
  }
  function nova() { setConversaId(null); setRegistros([]); setMsgs([]); setRetentativa(null); setAdministrando(false); setErroHistorico(""); }
  async function excluir() {
    if (!conversaId || !window.confirm("Excluir definitivamente esta conversa? A auditoria será preservada.")) return;
    setOcupado(true);
    try { const d = await chamada("chat_excluir", { conversa_id: conversaId }); if (!d.excluida) throw new Error("Exclusão não permitida."); nova(); await listarConversas(false); }
    catch (e) { setErroHistorico(String(e)); } finally { setOcupado(false); }
  }
  async function reter() {
    setOcupado(true); setErroHistorico("");
    try { await chamada("chat_retencao", { dias }); setConfig(v => ({ ...v, retencao_dias: dias })); setErroHistorico("Retenção alterada e auditada."); }
    catch (e) { setErroHistorico(String(e)); } finally { setOcupado(false); }
  }
  async function enviar(t: string, repetir = false) {
    if (!t.trim() || ocupado || !podeEnviar || administrando || retentativa && !repetir) return;
    const lojaDoEnvio = loja.id;
    const persistente = !!provedor && config.persistente;
    const tentativa = repetir ? retentativa : null;
    const chave = tentativa?.chave ?? crypto.randomUUID();
    const prov = tentativa?.provedor ?? provedor;
    const conv = tentativa ? tentativa.conversa : conversaId;
    if (repetir && (!tentativa || provedor !== tentativa.provedor)) return;
    const historico = msgsRef.current.slice(1);
    if (!repetir) setMsgs(m => [...m, { de: "eu", texto: t }]);
    setTexto(""); setOcupado(true); setErroHistorico("");
    if (persistente && prov) setRetentativa({ texto: t, chave, provedor: prov, conversa: conv });
    try {
      const data = await chamada(persistente ? "chat_perguntar" : "perguntar", { texto: t, ...(persistente ? { conversa_id: conv, idempotency_key: chave, consentimento_ia: aceitaEnvio } : { historico }), ...(prov ? { provedor: prov } : { sem_ia: true }) });
      if (lojaAtual.current !== lojaDoEnvio) return;
      const resposta = String(data.resposta ?? "");
      setMsgs(m => [...m, { de: "ia", texto: resposta, evidencias: data.evidencias, simulado: data.simulado }]);
      setRetentativa(null);
      if (persistente) { setConversaId(data.conversa_id); await listarConversas(false); }
      if (lerAltoRef.current) voz.falar(resposta);
    } catch (e) { if (lojaAtual.current === lojaDoEnvio) setErroHistorico(String(e)); }
    finally { if (lojaAtual.current === lojaDoEnvio) setOcupado(false); }
  }
  // microfone: o texto vai aparecendo no campo; quando a fala termina, envia sozinho
  const voz = useVoz((t, final) => { setTexto(t); if (final && t) void enviar(t); });
  useEffect(() => { fim.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs.length]);

  const estado: EstadoEsfera = voz.ouvindo ? "ouvindo" : ocupado ? "pensando" : voz.falando ? "falando" : "parado";
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void enviar(texto); };
  const alternarFala = () => { const v = !lerAlto; setLerAlto(v); gravarPreferenciaFala(v); if (!v) voz.calar(); };

  return (
    <div className="abas-caixa" ref={caixa}>
    <div className="cartao chat-tela abas" data-esq={esq ? "aberto" : "fechado"} data-dir={dir ? "aberto" : "fechado"}>
      {(esq || dir) && <button type="button" className="abas-fundo" aria-label="Fechar painel lateral" onClick={() => { setEsq(false); setDir(false); }} />}
      <aside className="aba aba-esq" id="aba-conversas" aria-label="Conversas">
        <div className="aba-topo"><strong>Conversas</strong><button type="button" className="sec mini" onClick={() => setEsq(false)} aria-label="Recolher conversas">Recolher</button></div>
        <div className="aba-corpo">
        {!(config.persistente || conversas.length > 0) && <p className="suave">Ainda não há conversas salvas. Elas aparecem aqui quando o histórico privado estiver ativo.</p>}
        {(config.persistente || conversas.length > 0) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 220px" }}>Minhas conversas<select value={administrando ? "" : conversaId ?? ""} disabled={ocupado} onChange={e => e.target.value ? void abrir(e.target.value) : nova()}><option value="">Nova conversa</option>{conversas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></label>
          
          {maisConversas && <button className="sec" disabled={ocupado} onClick={() => void listarConversas(true)}>Mais conversas</button>}
          {conversaId && !administrando && <button className="sec" disabled={ocupado} onClick={() => void excluir()}>Excluir conversa</button>}
        </div>}
        {conversaId && <p className="suave" style={{ overflowWrap: "anywhere" }}>Código da conversa: {conversaId}{administrando ? " · Leitura administrativa auditada" : ""}</p>}
        {podeAdministrar && <details><summary>Retenção e acesso administrativo</summary><p>A auditoria tem política própria e não é excluída junto com as conversas.</p><label>Retenção em dias (7–730)<input type="number" min={7} max={730} value={dias} onChange={e => setDias(Number(e.target.value))} /></label><button className="sec" disabled={ocupado} onClick={() => void reter()}>Salvar retenção</button>
        {config.leitura_administrativa && <><p>Somente conversas desta empresa. Cada consulta registra usuário, motivo e conversa na auditoria.</p><label>Código da conversa<input value={adminId} onChange={e => setAdminId(e.target.value)} /></label><label>Motivo administrativo<input value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)} /></label><button className="sec" disabled={ocupado || motivo.trim().length < 10 || !adminId} onClick={() => void abrir(adminId, false, true)}>Consultar e auditar acesso</button></>}</details>}
        </div>
      </aside>
      <section className="abas-centro" aria-label="Conversa com o Nano.ia">
      <div className="agente">
        <button type="button" className="sec ic-aba" aria-expanded={esq} aria-controls="aba-conversas" aria-label="Conversas" onClick={() => { setEsq((v) => !v); if (estreito()) setDir(false); }}>☰<span> Conversas</span></button>
        <Esfera estado={estado} tamanho={36} />
        <div className="agente-titulo"><h1 style={{ margin: 0 }}>Nano.ia</h1><span className="estado" aria-live="polite">{{ parado: "Pronto para ajudar", ouvindo: "Ouvindo você…", pensando: "Pensando…", falando: "Falando…" }[estado]}</span></div>
        {(config.persistente || conversas.length > 0) && <button className="sec" style={{ marginLeft: "auto" }} disabled={ocupado} onClick={nova}>Nova conversa</button>}
        <button type="button" className="sec ic-aba" aria-expanded={dir} aria-controls="aba-modelo" aria-label="Modelo e privacidade" onClick={() => { setDir((v) => !v); if (estreito()) setEsq(false); }}>⚙<span> Modelo</span></button>
      </div>
      {carregando && <p role="status">Verificando provedores…</p>}
      {erroConfig && <p role="alert" className="msg-erro">{erroConfig}</p>}
      {erroHistorico && <p role="status">{erroHistorico}</p>}
      {registros.length >= 100 && conversaId && <button className="sec" disabled={ocupado} onClick={() => void abrir(conversaId, true, administrando)}>Mensagens anteriores</button>}
      {retentativa && <div><p>Recupere a mesma pergunta para verificar se o turno terminou. Isso preserva a chave de idempotência.</p><button className="sec" disabled={ocupado || !aceitaEnvio} onClick={() => void enviar(retentativa.texto, true)}>Recuperar pergunta</button><button className="sec" disabled={ocupado} onClick={nova}>Começar nova conversa</button></div>}
      <div className="chat" aria-live="polite">{msgs.map((m, i) => <div key={i} className={`bolha ${m.de}`}>{m.texto}{m.simulado === true && <strong> · RESPOSTA SIMULADA</strong>}{m.evidencias?.map((ev, n) => <EvidenciaProduto key={n} ev={ev as EvidenciaBusca} />)}</div>)}<div ref={fim} /></div>
      <p className="linha">{SUGESTOES.map((s) => <button key={s} className="sec" disabled={ocupado || !podeEnviar || administrando || !!retentativa} onClick={() => void enviar(s)}>{s}</button>)}</p>
      <div className="chat-compositor">
      {selecao && <label style={{ display: "flex", gap: 8, alignItems: "start" }}><input type="checkbox" style={{ width: "auto" }} checked={aceitaEnvio} disabled={ocupado} onChange={(e) => setAceitaEnvio(e.target.checked)} />Enviar esta pergunta e até 20 mensagens recentes desta conversa a {selecao.nome}. O uso pode gerar cobrança na sua chave.</label>}
      {selecao?.motivo && <p role="status">{selecao.motivo}</p>}
      <form onSubmit={onSubmit} style={{ maxWidth: "none" }}>
        <div className="linha-voz">
          <label>Pergunte<input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} /></label>
          {voz.suporteMic && <button type="button" className="sec mic" aria-pressed={voz.ouvindo} aria-label={voz.ouvindo ? "Parar de ouvir" : "Falar com o assistente"} onClick={() => (voz.ouvindo ? voz.parar() : voz.ouvir())} disabled={ocupado}>🎤</button>}
          <button disabled={ocupado || !podeEnviar || administrando || !!retentativa}>Enviar</button>
        </div>
        {voz.erro && <p className="msg-erro">{voz.erro}</p>}
        {!voz.suporteMic && <p className="aviso-voz">Este navegador não oferece microfone para sites. Use o campo de texto.</p>}
      </form>
      </div>
      </section>
      <aside className="aba aba-dir" id="aba-modelo" aria-label="Modelo e privacidade">
        <div className="aba-topo"><strong>Modelo e privacidade</strong><button type="button" className="sec mini" onClick={() => setDir(false)} aria-label="Recolher modelo e privacidade">Recolher</button></div>
        <div className="aba-corpo">
        <label>Modelo de IA<select value={provedor} disabled={ocupado || carregando || !!erroConfig || !!retentativa || administrando} onChange={(e) => { setProvedor(e.target.value as ProvedorChat | ""); setAceitaEnvio(false); }}>
          <option value="">Resumo local (sem IA externa)</option>
          {provedores.map((p) => <option key={p.id} value={p.id} disabled={p.estado !== "disponivel"}>{p.nome}{p.modelo ? ` · ${p.modelo}` : ""} — {ESTADO_PROVEDOR[p.estado]}</option>)}
        </select></label>
        <p className="suave">Os estados refletem a configuração e o limite de uso; a API será consultada somente ao enviar.</p>
        <p className="suave">{provedor ? "Se o provedor falhar, escolha outro; não há troca automática." : "Só consultas por palavras-chave, sem enviar a um provedor de IA."} {config.persistente && provedor ? ` Histórico privado no servidor, com retenção de ${config.retencao_dias} dias por mensagem.` : " Histórico temporário nesta tela."}</p>
        {voz.suporteFala && <label className="linha" style={{ display: "flex" }}><input type="checkbox" style={{ width: "auto", minHeight: "auto" }} checked={lerAlto} onChange={alternarFala} /> Ler as respostas em voz alta</label>}
        {voz.suporteFala && lerAlto && voz.vozes.length > 1 && <label>Voz<select value={voz.vozEscolhida ?? ""} onChange={(e) => voz.escolherVozPreferida(e.target.value || null)}><option value="">Automática (a mais natural disponível)</option>{voz.vozes.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label>}
        {(voz.suporteMic || voz.suporteFala) && <p className="aviso-voz">A voz usa o reconhecimento do próprio navegador; no Chrome o áudio é processado pelo Google. O Conecta.IA não guarda o áudio; o texto segue a política de histórico indicada acima.</p>}
        </div>
      </aside>
    </div>
    </div>
  );
}

