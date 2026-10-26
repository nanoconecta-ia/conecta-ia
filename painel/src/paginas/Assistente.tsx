import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { escolherVoz, gravarPreferenciaFala, lerPreferenciaFala, useVoz } from "../lib/voz.ts";
import { Esfera, type EstadoEsfera } from "../componentes/Esfera.tsx";
import { MensagemRetratil } from "../componentes/MensagemRetratil.tsx";
import { Retratil } from "../componentes/Retratil.tsx";
import { mensagemRecolhida } from "../lib/retratil.ts";
import { interpretar, textoAjuda, type Comando, type Item } from "../lib/comandosNL.ts";
import { avaliar, coletar } from "../lib/avaliarLayout.ts";
import { CHAT_ACEITA, CHAT_MAX_ANEXOS, prepararArquivo, rotuloBytes, validarSelecao, type AnexoChat } from "../lib/anexosChat.ts";
import { escolherInicial, erroAssistente, ESTADO_PROVEDOR, type OpcaoProvedor, type ProvedorChat } from "../lib/provedores.ts";

type Evidencia = { origem: string; simulado: boolean; consultado_em: string; sincronizado_em?: string; motivo?: string; dados: { sku?: string; nome?: string; preco?: number | null; estoque?: number | null } };
type Msg = { de: "eu" | "ia"; texto: string; anexos?: string[]; evidencias?: Evidencia[]; simulado?: boolean };
type Conversa = { id: string; titulo: string; atualizada_em: string };
type Registro = { id: string; papel: string; conteudo: string; criada_em: string; metadados?: { evidencias?: Evidencia[]; simulado?: boolean } };
const SUGESTOES = ["Resumo da loja", "O que está pendente?", "Produtos incompletos", "Bling conectado?"];

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** `menu` e `aoNavegar` ligam o agente às telas do painel: ele abre, em sequência, o que o lojista pedir (só telas do menu da loja). */
export function Assistente({ loja, menu, aoNavegar }: { loja: Loja; menu?: Item[]; aoNavegar?: (rota: string) => void }) {
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
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const [modoMsgs, setModoMsgs] = useState<"auto" | "recolher" | "expandir">("auto");
  const alternarMsg = (i: number) => {
    const recolhida = mensagemRecolhida(i, msgs.length, abertas, modoMsgs);
    setModoMsgs("auto");
    setAbertas((a) => { const n = new Set(modoMsgs === "expandir" ? msgs.map((_, k) => k) : a); if (recolhida) n.add(i); else n.delete(i); return n; });
  };
  const [acaoLocal, setAcaoLocal] = useState<{ estado: EstadoEsfera; texto: string } | null>(null);
  async function comandoLocal(t: string, cmd: Exclude<Comando, { tipo: "nenhum" }>) {
    setMsgs((m) => [...m, { de: "eu", texto: t }]); setTexto("");
    const dizer = (texto: string) => setMsgs((m) => [...m, { de: "ia", texto }]);
    try {
      if (cmd.tipo === "ajuda") { dizer(menu ? textoAjuda(menu) : "Posso resumir a loja e mostrar o que está pendente."); return; }
      if (cmd.tipo === "avaliar_layout") {
        setAcaoLocal({ estado: "consultando_ferramentas", texto: "Medindo o layout desta tela…" }); await espera(450);
        dizer(avaliar(coletar()).resumo); return;
      }
      const nomes = cmd.passos.map((p) => p[1]);
      dizer(`Certo, vou abrir: ${nomes.join(" → ")}.${cmd.naoEntendido.length ? ` Não encontrei no seu menu: ${cmd.naoEntendido.join(", ")}.` : ""}`);
      for (const [rota, titulo] of cmd.passos) {
        setAcaoLocal({ estado: "executando", texto: `Abrindo ${titulo}…` });
        aoNavegar?.(rota); window.dispatchEvent(new CustomEvent("nano:guia", { detail: { rota, titulo } }));
        await espera(1300);
      }
      dizer(`Pronto: abri ${nomes.join(", depois ")}. Você está em ${nomes.at(-1)}. Quer que eu avalie o layout desta tela ou abra outra?`);
    } finally { setAcaoLocal(null); }
  }
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
  const [anexos, setAnexos] = useState<AnexoChat[]>([]);
  const [erroAnexo, setErroAnexo] = useState("");
  const entradaArquivo = useRef<HTMLInputElement>(null);
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
  /** Atalhos: resposta direta dos dados da loja (contagens), sem chamar IA externa — instantâneo, sem custo e sem depender de cota. */
  async function atalho(t: string) {
    if (ocupado || administrando || carregando) return;
    const lojaDoEnvio = loja.id;
    setMsgs((m) => [...m, { de: "eu", texto: t }]); setOcupado(true); setErroHistorico("");
    try {
      const data = await chamada("perguntar", { texto: t, sem_ia: true });
      if (lojaAtual.current !== lojaDoEnvio) return;
      setMsgs((m) => [...m, { de: "ia", texto: String(data.resposta ?? "") }]);
    } catch (e) { if (lojaAtual.current === lojaDoEnvio) setErroHistorico(String(e)); }
    finally { if (lojaAtual.current === lojaDoEnvio) setOcupado(false); }
  }
  async function enviar(t: string, repetir = false) {
    if (!repetir && menu && t.trim() && !ocupado && !acaoLocal && !administrando && !retentativa) { const cmd = interpretar(t, menu); if (cmd.tipo !== "nenhum") { await comandoLocal(t, cmd); return; } }
    if (!t.trim() || ocupado || !podeEnviar || administrando || retentativa && !repetir) return;
    const lojaDoEnvio = loja.id;
    const persistente = !!provedor && config.persistente;
    const tentativa = repetir ? retentativa : null;
    const chave = tentativa?.chave ?? crypto.randomUUID();
    const prov = tentativa?.provedor ?? provedor;
    const conv = tentativa ? tentativa.conversa : conversaId;
    if (repetir && (!tentativa || provedor !== tentativa.provedor)) return;
    const historico = msgsRef.current.slice(1);
    const anexosEnvio = repetir ? [] : anexos;
    if (!repetir) setMsgs(m => [...m, { de: "eu", texto: t, ...(anexosEnvio.length ? { anexos: anexosEnvio.map((a) => a.nome) } : {}) }]);
    setAnexos([]); setErroAnexo("");
    setTexto(""); setOcupado(true); setErroHistorico("");
    if (persistente && prov) setRetentativa({ texto: t, chave, provedor: prov, conversa: conv });
    try {
      const data = await chamada(persistente ? "chat_perguntar" : "perguntar", { texto: t, ...(persistente ? { conversa_id: conv, idempotency_key: chave, consentimento_ia: aceitaEnvio } : { historico }), ...(prov ? { provedor: prov } : { sem_ia: true }), ...(anexosEnvio.length ? { anexos: anexosEnvio.map(({ nome, tipo, dados }) => ({ nome, tipo, dados })) } : {}) });
      if (lojaAtual.current !== lojaDoEnvio) return;
      const resposta = String(data.resposta ?? "");
      setMsgs(m => [...m, { de: "ia", texto: resposta, evidencias: data.evidencias, simulado: data.simulado }]);
      setRetentativa(null);
      if (persistente) { setConversaId(data.conversa_id); await listarConversas(false); }
      if (lerAltoRef.current) voz.falar(resposta);
    } catch (e) { if (lojaAtual.current === lojaDoEnvio) setErroHistorico(String(e)); }
    finally { if (lojaAtual.current === lojaDoEnvio) setOcupado(false); }
  }
  async function escolherArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []); if (entradaArquivo.current) entradaArquivo.current.value = "";
    setErroAnexo(""); const pdfOk = provedor !== "compativel_openai"; let atual = [...anexos];
    for (const f of arquivos) {
      const erro = validarSelecao(f, atual, pdfOk); if (erro) { setErroAnexo(erro); break; }
      try { const a = await prepararArquivo(f); const e2 = validarSelecao({ name: a.nome, type: a.tipo, size: a.bytes }, atual, pdfOk); if (e2) { setErroAnexo(e2); break; } atual = [...atual, a]; }
      catch { setErroAnexo(`Não consegui ler "${f.name}".`); break; }
    }
    setAnexos(atual);
  }
  // microfone: o texto vai aparecendo no campo; quando a fala termina, envia sozinho
  const voz = useVoz((t, final) => { setTexto(t); if (final && t) void enviar(t); });
  useEffect(() => { setAbertas(new Set()); setModoMsgs("auto"); }, [conversaId]);
  useEffect(() => { const c = fim.current?.parentElement; c?.scrollTo({ top: c.scrollHeight, behavior: "smooth" }); }, [msgs.length]); // rola só a lista (scrollIntoView arrastava o painel todo para o lado)

  const estado: EstadoEsfera = acaoLocal ? acaoLocal.estado : voz.ouvindo ? "ouvindo" : ocupado ? "pensando" : voz.falando ? "falando" : "parado";
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
        <Esfera estado={estado} tamanho={estado === "parado" ? 40 : 56} />
        <div className="agente-titulo"><h1 style={{ margin: 0 }}>Nano.ia</h1><span className="estado" aria-live="polite">{acaoLocal?.texto ?? ({ parado: "Pronto para ajudar", ouvindo: "Ouvindo você…", pensando: "Pensando…", falando: "Falando…" } as Record<string, string>)[estado] ?? "Trabalhando…"}</span></div>
        {(config.persistente || conversas.length > 0) && <button className="sec nova-conv" style={{ marginLeft: "auto" }} disabled={ocupado} onClick={nova} aria-label="Nova conversa"><span className="rot-longo">Nova conversa</span><span className="rot-curto" aria-hidden="true">＋<span className="rot-curto-txt"> Nova</span></span></button>}
        <button type="button" className="sec ic-aba" aria-expanded={dir} aria-controls="aba-modelo" aria-label="Modelo e privacidade" onClick={() => { setDir((v) => !v); if (estreito()) setEsq(false); }}>⚙<span> Modelo</span></button>
      </div>
      {estado !== "parado" && <div className="faixa-acao" role="status" data-estado={estado}><span className="faixa-pulso" aria-hidden="true" />{acaoLocal?.texto ?? { ouvindo: "Ouvindo você…", pensando: "Consultando o modelo e os dados da loja…", falando: "Lendo a resposta em voz alta…" }[estado as string] ?? ""}{estado === "falando" && <button type="button" className="mini sec" onClick={voz.calar}>Parar</button>}</div>}
      {carregando && <p role="status">Verificando provedores…</p>}
      {erroConfig && <p role="alert" className="msg-erro">{erroConfig}</p>}
      {erroHistorico && <p role="status">{erroHistorico}</p>}
      {registros.length >= 100 && conversaId && <button className="sec" disabled={ocupado} onClick={() => void abrir(conversaId, true, administrando)}>Mensagens anteriores</button>}
      {retentativa && <div><p>Recupere a mesma pergunta para verificar se o turno terminou. Isso preserva a chave de idempotência.</p><button className="sec" disabled={ocupado || !aceitaEnvio} onClick={() => void enviar(retentativa.texto, true)}>Recuperar pergunta</button><button className="sec" disabled={ocupado} onClick={nova}>Começar nova conversa</button></div>}
      {msgs.length > 3 && <div className="chat-ferramentas"><button type="button" className="sec mini" onClick={() => { setModoMsgs("recolher"); setAbertas(new Set()); }}>Recolher tudo</button><button type="button" className="sec mini" onClick={() => setModoMsgs("expandir")}>Expandir tudo</button><small className="suave">{msgs.length} mensagens</small></div>}
      <div className="chat" aria-live="polite">{msgs.map((m, i) => <MensagemRetratil key={i} m={m} recolhida={mensagemRecolhida(i, msgs.length, abertas, modoMsgs)} onAlternar={() => alternarMsg(i)} />)}<div ref={fim} /></div>
      <div className="barra-extras">
      <Retratil id="atalhos" titulo="Atalhos" resumo="perguntas rápidas" aberto={msgs.length < 2} recolherQuando={msgs.length >= 3}><p className="linha">{SUGESTOES.map((s) => <button key={s} className="sec" disabled={ocupado || carregando || administrando} onClick={() => void atalho(s)}>{s}</button>)}</p></Retratil>
      {selecao && <Retratil id="consentimento" titulo="Privacidade" resumo={aceitaEnvio ? "autorizado" : "autorize para enviar"} status={aceitaEnvio ? "go" : "warn"} recolherQuando={aceitaEnvio}><label className="consentimento" style={{ display: "flex", gap: 8, alignItems: "start" }}><input type="checkbox" style={{ width: "auto" }} checked={aceitaEnvio} disabled={ocupado} onChange={(e) => setAceitaEnvio(e.target.checked)} />Enviar esta pergunta e até 20 mensagens recentes desta conversa a {selecao.nome}. O uso pode gerar cobrança na sua chave.{anexos.length > 0 && " Os anexos desta pergunta também são enviados."}</label></Retratil>}
      </div>
      <div className="chat-compositor">
      {selecao?.motivo && <p role="status">{selecao.motivo}</p>}
      <form onSubmit={onSubmit} style={{ maxWidth: "none" }}>
        {anexos.length > 0 && <ul className="anexos-lista" aria-label="Anexos desta pergunta">{anexos.map((a, i) => <li key={`${a.nome}-${i}`}><span className="anexo-nome" title={a.nome}>{a.tipo.startsWith("image/") ? "🖼" : "📄"} {a.nome}</span><span className="suave">{rotuloBytes(a.bytes)}</span><button type="button" className="sec mini" aria-label={`Remover ${a.nome}`} onClick={() => setAnexos((l) => l.filter((_, k) => k !== i))}>✕</button></li>)}</ul>}
        {erroAnexo && <p role="alert" className="msg-erro">{erroAnexo}</p>}
        <div className="compositor-grade">
          <input ref={entradaArquivo} type="file" hidden multiple accept={CHAT_ACEITA} onChange={(e) => void escolherArquivos(e.target.files)} />
          <div className="compositor-campo"><span id="rotulo-pergunta">Pergunte</span><textarea aria-labelledby="rotulo-pergunta" value={texto} rows={2} enterKeyHint="send" placeholder="Escreva aqui…" onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(texto); } }} maxLength={1000} /></div>
          <div className="compositor-acoes">
          <button type="button" className="sec mic" aria-label="Anexar imagem ou arquivo" title={provedor ? `Anexar imagem, PDF, TXT ou CSV (até ${CHAT_MAX_ANEXOS})` : "Escolha um modelo de IA para anexar arquivos"} disabled={ocupado || !provedor || administrando || anexos.length >= CHAT_MAX_ANEXOS} onClick={() => entradaArquivo.current?.click()}>📎</button>
          {voz.suporteMic && <button type="button" className="sec mic" aria-pressed={voz.ouvindo} aria-label={voz.ouvindo ? "Parar de ouvir" : "Falar com o assistente"} onClick={() => (voz.ouvindo ? voz.parar() : voz.ouvir())} disabled={ocupado}>🎤</button>}
          {voz.suporteFala && <button type="button" className="sec mic" aria-pressed={lerAlto} aria-label={lerAlto ? "Desligar a leitura das respostas em voz alta" : "Ler as respostas em voz alta"} title={lerAlto ? "Leitura em voz alta ligada" : "Leitura em voz alta desligada"} onClick={alternarFala}>{lerAlto ? "🔊" : "🔈"}</button>}
            <span className="compositor-espaco" />
          <button className="compositor-enviar" disabled={ocupado || !podeEnviar || administrando || !!retentativa}>Enviar</button>
          </div>
        </div>
        {voz.erro && <p className="msg-erro">{voz.erro}</p>}
        {voz.suporteFala && lerAlto && <div className="voz-escolha"><label>Voz<select value={voz.vozEscolhida ?? ""} onChange={(e) => voz.escolherVozPreferida(e.target.value || null)}><option value="">Automática (a mais natural)</option>{voz.vozes.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label><small className="suave">{voz.vozes.length === 0 ? "Nenhuma voz em português encontrada; uso a padrão do aparelho." : `Em uso: ${escolherVoz(voz.vozes, voz.vozEscolhida)?.name ?? "padrão do aparelho"}${voz.vozes.length === 1 ? " (é a única em português neste aparelho)" : ""}`}</small></div>}
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
        {(voz.suporteMic || voz.suporteFala) && <p className="aviso-voz">A voz usa o reconhecimento do próprio navegador; no Chrome o áudio é processado pelo Google. O Conecta.IA não guarda o áudio; o texto segue a política de histórico indicada acima.</p>}
        </div>
      </aside>
    </div>
    </div>
  );
}

