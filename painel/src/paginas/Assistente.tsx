import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { escolherVoz, gravarPreferenciaFala, lerPreferenciaFala, useVoz } from "../lib/voz.ts";
import { normalizarEstado, type EstadoEsfera } from "../componentes/Esfera.tsx";
import type { EstadoAgente } from "../lib/estadoAgente.ts";
import { publicarNano } from "../lib/nanoEstado.ts";
import { Icone } from "../componentes/Icone.tsx";
import { gravarConsentimento, lerConsentimento } from "../lib/consentimentoEnvio.ts";
import { consumirPedidoPendente } from "../lib/contextoPagina.ts";
import { PontosPensando } from "../componentes/PontosPensando.tsx";
import { MODELOS_ORBE, aplicarOrbe, gravarOrbe, lerOrbe, type ModeloOrbe } from "../lib/orbe.ts";
import { armazemLocal } from "../lib/tema.ts";
import { apagarVarias, mensagemApagar } from "../lib/apagar-historico.ts";
import { SeletorCor } from "../componentes/SeletorCor.tsx";
import { lerSessao, registrarNaSessao, removerDaSessao } from "../lib/conversasDaSessao.ts";
import { MensagemRetratil } from "../componentes/MensagemRetratil.tsx";
import { Retratil } from "../componentes/Retratil.tsx";
import { mensagemRecolhida } from "../lib/retratil.ts";
import { interpretar, textoAjuda, type Comando, type Item } from "../lib/comandosNL.ts";
import { avaliar, coletar } from "../lib/avaliarLayout.ts";
import { CHAT_ACEITA, CHAT_MAX_ANEXOS, prepararArquivo, rotuloBytes, validarSelecao, type AnexoChat } from "../lib/anexosChat.ts";
import { gravarConversaAtiva, lerConversaAtiva } from "../lib/conversaAtiva.ts";
import { perguntarComStreaming, propostasDoTurno, type PropostaTurno } from "../lib/streamAssistente.ts";
import { useFonte } from "../lib/useFonte.ts";
import { PropostaCompacta } from "../componentes/conector/PropostaCompacta.tsx";
import { escolherInicial, erroAssistente, ESTADO_PROVEDOR, type OpcaoProvedor, type ProvedorChat } from "../lib/provedores.ts";

type Evidencia = { origem: string; simulado: boolean; consultado_em: string; sincronizado_em?: string; motivo?: string; dados: { sku?: string; nome?: string; preco?: number | null; estoque?: number | null } };
type Msg = { de: "eu" | "ia"; texto: string; anexos?: string[]; evidencias?: Evidencia[]; simulado?: boolean; propostas?: PropostaTurno[]; parcial?: boolean };
type Conversa = { id: string; titulo: string; atualizada_em: string };
type Registro = { id: string; papel: string; conteudo: string; criada_em: string; metadados?: { evidencias?: Evidencia[]; simulado?: boolean; propostas?: unknown } };

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** `menu` e `aoNavegar` ligam o agente às telas do painel: ele abre, em sequência, o que o lojista pedir (só telas do menu da loja). */
/** Texto de erro para a tela: sem o prefixo técnico "Error:". */
const msgErro = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^Error:\s*/, "");

export function Assistente({ loja, menu, aoNavegar }: { loja: Loja; menu?: Item[]; aoNavegar?: (rota: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "ia", texto: "Olá! Posso resumir a loja, mostrar o que aguarda aprovação e o que falta para publicar. Para conversar com IA e usar plugins, configure um provedor em Integrações de IA." }]);
  const fonte = useFonte(); // B2b: cartões de proposta leem a proposta do banco (RLS), nunca do texto do modelo
  const [config, setConfig] = useState<{ persistente: boolean; bling: boolean; leitura_administrativa: boolean; retencao_dias: number; streaming?: boolean }>({ persistente: false, bling: false, leitura_administrativa: false, retencao_dias: 180 });
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [idsSessao, setIdsSessao] = useState<string[]>(() => lerSessao(typeof sessionStorage === "undefined" ? null : sessionStorage, loja.id));
  const chatRef = useRef<HTMLDivElement>(null);
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
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());
  const alternarMsg = (i: number) => {
    const recolhida = mensagemRecolhida(i, msgs.length, abertas, modoMsgs, fechadas);
    const todos = msgs.map((_, k) => k);
    let ab = new Set(abertas), fe = new Set(fechadas);
    if (modoMsgs === "expandir") { ab = new Set(todos); fe = new Set(); }
    else if (modoMsgs === "recolher") { ab = new Set(); fe = new Set(todos); }
    if (recolhida) { ab.add(i); fe.delete(i); } else { ab.delete(i); fe.add(i); }
    setModoMsgs("auto"); setAbertas(ab); setFechadas(fe);
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
  useEffect(() => { // o painel lateral (mapa, resumo, atalhos) pede uma pergunta: só preenche a caixa; quem envia é o lojista
    const f = (e: Event) => { const t = (e as CustomEvent<{ texto?: string }>).detail?.texto; if (typeof t === "string" && t.trim()) setTexto(t.slice(0, 4000)); consumirPedidoPendente(); };
    const antes = consumirPedidoPendente(); if (antes) setTexto(antes.slice(0, 4000)); // pedido vindo de outra tela (ficha do produto)
    window.addEventListener("nano:perguntar", f); return () => window.removeEventListener("nano:perguntar", f);
  }, []);
  const [ocupado, setOcupado] = useState(false);
  const [esq, setEsq] = useState(false), [dir, setDir] = useState(false);
  const [menuAnexos, setMenuAnexos] = useState(false);
  const [buscaMenu, setBuscaMenu] = useState(""); // abas laterais retráteis (conversas / modelo e privacidade)
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
  const entradaCamera = useRef<HTMLInputElement>(null);
  const entradaFotos = useRef<HTMLInputElement>(null);
  const selecao = provedores.find((p) => p.id === provedor);
  const armazemSessao = typeof sessionStorage === "undefined" ? null : sessionStorage;
  useEffect(() => { setAceitaEnvio(provedor ? lerConsentimento(armazemSessao, loja.id, provedor) : false); }, [provedor, loja.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const autorizarEnvio = () => { if (!provedor) return; gravarConsentimento(armazemSessao, loja.id, provedor, true); setAceitaEnvio(true); };
  const revogarEnvio = () => { if (provedor) gravarConsentimento(armazemSessao, loja.id, provedor, false); setAceitaEnvio(false); };
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
      void restaurarConversa(data.persistente === true);
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
    } catch (e) { if (lojaAtual.current === origem) setErroHistorico(msgErro(e)); }
  }
  function mostrar(rs: Registro[]) {
    setRegistros(rs); setMsgs(rs.map(m => ({ de: m.papel === "usuario" ? "eu" : "ia", texto: m.conteudo, evidencias: m.metadados?.evidencias, simulado: m.metadados?.simulado, propostas: propostasDoTurno(m.metadados?.propostas) })));
  }
  async function abrir(id: string, mais = false, admin = false) {
    const origem = loja.id; setOcupado(true); setErroHistorico("");
    try {
      const primeira = registros[0];
      const d = await chamada(admin ? "chat_admin" : "chat_mensagens", { conversa_id: id, ...(admin ? { motivo } : {}), ...(mais && primeira ? { antes: primeira.criada_em, antes_id: primeira.id } : {}) });
      if (lojaAtual.current !== origem) return;
      const linhas: Registro[] = admin ? [...d.mensagens].reverse() : d.mensagens;
      mostrar(mais ? [...linhas, ...registros] : linhas); setConversaId(id); setAdministrando(admin); setRetentativa(null);
    } catch (e) { if (lojaAtual.current === origem) setErroHistorico(msgErro(e)); }
    finally { if (lojaAtual.current === origem) setOcupado(false); }
  }
  // B2 (#166): dock e tela /assistente retomam a mesma conversa. Restaurar não é auditado como "abrir" de propósito:
  // é a mesma leitura (chat_mensagens, RLS do próprio usuário); se a conversa não abrir mais, o id guardado é descartado.
  const restaurado = useRef(false);
  async function restaurarConversa(persistente: boolean) {
    const origem = loja.id, id = lerConversaAtiva(origem);
    try {
      if (!persistente || !id) return;
      const d = await chamada("chat_mensagens", { conversa_id: id });
      if (lojaAtual.current !== origem) return;
      mostrar(d.mensagens); setConversaId(id);
    } catch { if (lojaAtual.current === origem) gravarConversaAtiva(origem, null); }
    finally { if (lojaAtual.current === origem) restaurado.current = true; }
  }
  useEffect(() => { restaurado.current = false; }, [loja.id]);
  useEffect(() => { if (restaurado.current && !administrando) gravarConversaAtiva(loja.id, conversaId); }, [conversaId, administrando, loja.id]);
  function nova() { setConversaId(null); setRegistros([]); setMsgs([]); setRetentativa(null); setAdministrando(false); setErroHistorico(""); }
  async function excluir() {
    if (!conversaId || !window.confirm("Excluir definitivamente esta conversa? A auditoria será preservada.")) return;
    setOcupado(true);
    try { const d = await chamada("chat_excluir", { conversa_id: conversaId }); if (!d.excluida) throw new Error("Exclusão não permitida."); nova(); await listarConversas(false); }
    catch (e) { setErroHistorico(msgErro(e)); } finally { setOcupado(false); }
  }
  async function apagarTudo() {
    if (conversas.length === 0 || !window.confirm(`Excluir definitivamente ${conversas.length} conversa(s) do histórico${maisConversas ? " carregadas (há mais antigas)" : ""}? A auditoria será preservada.`)) return;
    setOcupado(true); setErroHistorico("");
    try {
      const r = await apagarVarias(conversas.map((c) => c.id), async (id) => { const d = await chamada("chat_excluir", { conversa_id: id }); if (!d.excluida) throw new Error("Exclusão não permitida."); });
      if (r.apagadas.includes(conversaId ?? "")) nova();
      await listarConversas(false); setErroHistorico(mensagemApagar(r));
    } catch (e) { setErroHistorico(msgErro(e)); } finally { setOcupado(false); }
  }
  async function apagarSessao() {
    const ids = idsSessao.filter((id) => conversas.some((c) => c.id === id) || id === conversaId);
    if (ids.length === 0) { setIdsSessao(removerDaSessao(typeof sessionStorage === "undefined" ? null : sessionStorage, loja.id, idsSessao)); return; }
    if (!window.confirm(`Excluir definitivamente as ${ids.length} conversa(s) criadas nesta sessão? As conversas antigas não são afetadas. A auditoria será preservada.`)) return;
    setOcupado(true); setErroHistorico("");
    try {
      const r = await apagarVarias(ids, async (id) => { const d = await chamada("chat_excluir", { conversa_id: id }); if (!d.excluida) throw new Error("Exclusão não permitida."); });
      setIdsSessao(removerDaSessao(typeof sessionStorage === "undefined" ? null : sessionStorage, loja.id, r.apagadas));
      if (r.apagadas.includes(conversaId ?? "")) nova();
      await listarConversas(false); setErroHistorico(mensagemApagar(r));
    } catch (e) { setErroHistorico(msgErro(e)); } finally { setOcupado(false); }
  }
  async function reter() {
    setOcupado(true); setErroHistorico("");
    try { await chamada("chat_retencao", { dias }); setConfig(v => ({ ...v, retencao_dias: dias })); setErroHistorico("Retenção alterada e auditada."); }
    catch (e) { setErroHistorico(msgErro(e)); } finally { setOcupado(false); }
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
      const campos = { texto: t, ...(persistente ? { conversa_id: conv, idempotency_key: chave, consentimento_ia: aceitaEnvio } : { historico }), ...(prov ? { provedor: prov } : { sem_ia: true }), ...(anexosEnvio.length ? { anexos: anexosEnvio.map(({ nome, tipo, dados }) => ({ nome, tipo, dados })) } : {}) };
      // B2b (#166): com o servidor anunciando streaming, o texto aparece enquanto o provedor escreve; o que vale é o resultado final registrado.
      const data = persistente && config.streaming ? await perguntarStreaming(campos, lojaDoEnvio) : await chamada(persistente ? "chat_perguntar" : "perguntar", campos);
      if (lojaAtual.current !== lojaDoEnvio) return;
      const resposta = String(data.resposta ?? "");
      setMsgs(m => [...m.filter((x) => !x.parcial), { de: "ia", texto: resposta, evidencias: data.evidencias, simulado: data.simulado, propostas: propostasDoTurno(data.propostas) }]);
      setRetentativa(null);
      if (persistente) { setConversaId(data.conversa_id); if (!conv && data.conversa_id) setIdsSessao(registrarNaSessao(typeof sessionStorage === "undefined" ? null : sessionStorage, loja.id, String(data.conversa_id))); await listarConversas(false); }
      if (lerAltoRef.current) voz.falar(resposta);
    } catch (e) { if (lojaAtual.current === lojaDoEnvio) { setMsgs(m => m.filter((x) => !x.parcial)); setErroHistorico(msgErro(e)); } }
    finally { if (lojaAtual.current === lojaDoEnvio) setOcupado(false); }
  }
  /** Turno com streaming: a prévia vai numa mensagem `parcial` que some quando chega o resultado (ou o erro). Erro HTTP vira exceção, como em `chamada`. */
  async function perguntarStreaming(campos: Record<string, unknown>, lojaDoEnvio: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) throw new Error("Sua sessão expirou. Entre de novo.");
    setMsgs(m => [...m, { de: "ia", texto: "", parcial: true }]);
    const r = await perguntarComStreaming({ loja_id: loja.id, ...campos }, s.session.access_token, (delta) => {
      if (lojaAtual.current !== lojaDoEnvio) return;
      setMsgs(m => m.map((x) => x.parcial ? { ...x, texto: x.texto + delta } : x));
    });
    if (r.status >= 400 || typeof r.corpo.erro === "string") throw new Error(String(r.corpo.erro ?? r.corpo.resposta ?? "Não foi possível concluir."));
    return r.corpo as Record<string, any>;
  }
  async function reconhecerCodigoImagem(arquivo: File): Promise<string | null> {
    type Detector = { detect: (imagem: ImageBitmap) => Promise<Array<{ rawValue?: string }>> };
    const api = window as Window & { BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector };
    if (!api.BarcodeDetector || !arquivo.type.startsWith("image/")) return null;
    let imagem: ImageBitmap | null = null;
    try {
      imagem = await createImageBitmap(arquivo);
      const detector = new api.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "code_128", "itf"] });
      return (await detector.detect(imagem)).find(item => item.rawValue?.trim())?.rawValue?.trim() ?? null;
    } catch { return null; }
    finally { imagem?.close(); }
  }
  async function escolherArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (entradaArquivo.current) entradaArquivo.current.value = "";
    if (entradaCamera.current) entradaCamera.current.value = "";
    if (entradaFotos.current) entradaFotos.current.value = "";
    setErroAnexo(""); const pdfOk = provedor !== "compativel_openai"; let atual = [...anexos];
    for (const f of arquivos) {
      const erro = validarSelecao(f, atual, pdfOk); if (erro) { setErroAnexo(erro); break; }
      try { const codigo = await reconhecerCodigoImagem(f); if (codigo) setTexto(t => (t.trim() + "\nCódigo capturado: " + codigo + ". Identifique produto, SKU, OEM e aplicação sem criar duplicata.").trim().slice(0, 1000)); const a = await prepararArquivo(f); const e2 = validarSelecao({ name: a.nome, type: a.tipo, size: a.bytes }, atual, pdfOk); if (e2) { setErroAnexo(e2); break; } atual = [...atual, a]; }
      catch { setErroAnexo(`Não consegui ler "${f.name}".`); break; }
    }
    setAnexos(atual);
  }
  // microfone: o texto vai aparecendo no campo; quando a fala termina, envia sozinho
  const voz = useVoz((t, final) => { setTexto(t); if (final && t) void enviar(t); });
  useEffect(() => { setAbertas(new Set()); setFechadas(new Set()); setModoMsgs("auto"); }, [conversaId]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs.length]);

  const estado: EstadoEsfera = acaoLocal ? acaoLocal.estado : voz.ouvindo ? "ouvindo" : ocupado ? "pensando" : voz.falando ? "falando" : "parado";
  const [modeloOrbe, setModeloOrbe] = useState<ModeloOrbe>(() => lerOrbe(armazemLocal()));
  useEffect(() => { aplicarOrbe(modeloOrbe); }, [modeloOrbe]);
  // publica no store por loja o que realmente está acontecendo (microfone, requisição em curso, voz, ação local); ao sair, volta ao repouso
  useEffect(() => { publicarNano(loja.id, { tipo: "local", estado: normalizarEstado(estado) === "falando" ? "ocioso" : normalizarEstado(estado) as EstadoAgente }); if (estado === "falando") publicarNano(loja.id, { tipo: "fala", falando: true }); }, [estado, loja.id]);
  useEffect(() => () => publicarNano(loja.id, { tipo: "repouso" }), [loja.id]);
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void enviar(texto); };
  const alternarFala = () => { const v = !lerAlto; setLerAlto(v); gravarPreferenciaFala(v); if (!v) voz.calar(); };

  return (
    <div className="abas-caixa" ref={caixa}>
    <div className="cartao chat-tela abas" style={{ minHeight: 0, minWidth: 0, width: "100%", boxSizing: "border-box", overflow: "hidden" }} data-esq={esq ? "aberto" : "fechado"} data-dir={dir ? "aberto" : "fechado"}>
      {(esq || dir) && <button type="button" className="abas-fundo" aria-label="Fechar painel lateral" onClick={() => { setEsq(false); setDir(false); }} />}
      <aside className="aba aba-esq nano-navegacao" id="aba-conversas" aria-label="Menu do Nano.IA">
        <div className="aba-topo nano-menu-topo">
          <strong>Nano.IA</strong>
          <button type="button" className="sec mini" onClick={() => setEsq(false)} aria-label="Fechar menu">✕</button>
        </div>
        <div className="aba-corpo nano-menu-corpo">
          <label className="nano-busca-menu"><span className="so-leitor">Buscar ferramentas ou conversas</span><input type="search" value={buscaMenu} onChange={(e) => setBuscaMenu(e.target.value)} placeholder="Buscar neste painel" /></label>
          <button type="button" className="nano-acao-nova" disabled={ocupado} onClick={() => { nova(); setEsq(false); }}>✎ <span>Nova conversa</span></button>
          <h2 className="nano-grupo-titulo">Ferramentas</h2>
          <nav className="nano-links" aria-label="Ferramentas da loja">
            {(menu ?? []).filter(([rota]) => ["/catalogo", "/imagens", "/fila", "/taxonomia", "/bling", "/integracoes", "/aprovacoes", "/estudio"].includes(rota))
              .filter(([,titulo]) => titulo.toLocaleLowerCase("pt-BR").includes(buscaMenu.toLocaleLowerCase("pt-BR")))
              .map(([rota,titulo]) => (
                <button type="button" key={rota} className="nano-link" onClick={() => { setEsq(false); aoNavegar?.(rota); }}>
                  <span className="nano-icone-rota" aria-hidden="true">{({ "/catalogo":"▦", "/imagens":"▧", "/fila":"✓", "/taxonomia":"⌘", "/bling":"↗", "/integracoes":"✧", "/aprovacoes":"☑", "/estudio":"◈" } as Record<string,string>)[rota] ?? "•"}</span>
                  <span>{titulo}</span>
                </button>
              ))}
          </nav>
          <h2 className="nano-grupo-titulo">Conversas</h2>
          {!(config.persistente || conversas.length > 0) && <p className="suave">O histórico privado aparece aqui quando estiver habilitado.</p>}
          {(config.persistente || conversas.length > 0) && (
            <div className="nano-lista-conversas" role="list">
              {conversas.filter(c => c.titulo.toLocaleLowerCase("pt-BR").includes(buscaMenu.toLocaleLowerCase("pt-BR"))).map(c => (
                <div role="listitem" key={c.id}>
                  <button type="button" className={`nano-link nano-conversa ${conversaId === c.id && !administrando ? "nano-conversa-ativa" : ""}`}
                    disabled={ocupado} onClick={() => { setEsq(false); void abrir(c.id); }} title={c.titulo}>▤ <span>{c.titulo}</span></button>
                </div>
              ))}
              {maisConversas && <button type="button" className="sec" disabled={ocupado} onClick={() => void listarConversas(true)}>Carregar mais conversas</button>}
              {conversaId && !administrando && <button type="button" className="sec mini" disabled={ocupado} onClick={() => void excluir()}>Excluir conversa atual</button>}
              {idsSessao.length > 0 && !administrando && <button type="button" className="sec mini" disabled={ocupado} onClick={() => void apagarSessao()}>Apagar as conversas desta sessão</button>}
              {conversas.length > 0 && !administrando && <button type="button" className="sec mini" disabled={ocupado} onClick={() => void apagarTudo()}>Apagar todo o histórico</button>}
            </div>
          )}
          {conversaId && <p className="suave nano-codigo-conversa">Conversa: {conversaId}{administrando ? " · Acesso auditado" : ""}</p>}
          {podeAdministrar && <details><summary>Retenção e acesso administrativo</summary><p>A auditoria tem política própria e não é excluída junto com as conversas.</p><label>Retenção em dias (7–730)<input type="number" min={7} max={730} value={dias} onChange={e => setDias(Number(e.target.value))} /></label><button className="sec" disabled={ocupado} onClick={() => void reter()}>Salvar retenção</button>
          {config.leitura_administrativa && <><p>Somente conversas desta empresa. Cada consulta registra usuário, motivo e conversa na auditoria.</p><label>Código da conversa<input value={adminId} onChange={e => setAdminId(e.target.value)} /></label><label>Motivo administrativo<input value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)} /></label><button className="sec" disabled={ocupado || motivo.trim().length < 10 || !adminId} onClick={() => void abrir(adminId, false, true)}>Consultar e auditar acesso</button></>}</details>}
        </div>
      </aside>
      <section className="abas-centro" aria-label="Conversa com o Nano.ia">
      <div className="agente">
        <button type="button" className="sec ic-aba" aria-expanded={esq} aria-controls="aba-conversas" aria-label="Abrir menu do Nano.IA" onClick={() => { setEsq((v) => !v); setMenuAnexos(false); if (estreito()) setDir(false); }}><Icone nome="menu" tamanho={20} /></button>
        <div className="agente-titulo"><h1 style={{ margin: 0 }}>Nano.ia</h1><span className="estado" aria-live="polite">{estado === "pensando" && !acaoLocal && <PontosPensando />}{acaoLocal?.texto ?? ({ parado: "Pronto para ajudar", ouvindo: "Ouvindo você…", pensando: "Pensando…", falando: "Falando…" } as Record<string, string>)[estado] ?? "Trabalhando…"}</span></div>
        {<button className="sec nova-conv" style={{ marginLeft: "auto" }} disabled={ocupado} onClick={nova} aria-label="Nova conversa"><span aria-hidden="true"><Icone nome="mais" tamanho={20} /></span></button>}
        <button type="button" className="sec ic-aba" aria-expanded={dir} aria-controls="aba-modelo" aria-label="Modelo e privacidade" onClick={() => { setDir((v) => !v); if (estreito()) setEsq(false); }}><Icone nome="ajustes" tamanho={20} /></button>
      </div>
      {estado !== "parado" && <div className="faixa-acao" role="status" data-estado={estado}><span className="faixa-pulso" aria-hidden="true" />{acaoLocal?.texto ?? { ouvindo: "Ouvindo você…", pensando: "Consultando o modelo e os dados da loja…", falando: "Lendo a resposta em voz alta…" }[estado as string] ?? ""}{estado === "falando" && <button type="button" className="mini sec" onClick={voz.calar}>Parar</button>}</div>}
      {carregando && <p role="status">Verificando provedores…</p>}
      {erroConfig && <p role="alert" className="msg-erro">{erroConfig}</p>}
      {erroHistorico && <p role="status">{erroHistorico}</p>}
      {registros.length >= 100 && conversaId && <button className="sec" disabled={ocupado} onClick={() => void abrir(conversaId, true, administrando)}>Mensagens anteriores</button>}
      {retentativa && <div className="retentativa-linha"><button className="sec" disabled={ocupado || !aceitaEnvio} onClick={() => void enviar(retentativa.texto, true)}>Tentar de novo</button><button className="sec" disabled={ocupado} onClick={nova}>Começar nova conversa</button>{conversaId && !administrando && <button className="sec" disabled={ocupado} onClick={() => void excluir()}>Apagar esta conversa</button>}</div>}
      {msgs.length > 3 && <div className="chat-ferramentas"><button type="button" className="sec icone-btn" aria-label="Ir ao começo da conversa" title="Ir ao começo da conversa" onClick={() => chatRef.current?.scrollTo({ top: 0, behavior: "smooth" })}><Icone nome="topo" tamanho={18} /></button><button type="button" className="sec icone-btn" aria-label="Ir ao fim da conversa" title="Ir ao fim da conversa" onClick={() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" })}><Icone nome="fundo" tamanho={18} /></button>{msgs.length > 10 && <><button type="button" className="sec mini" onClick={() => { setModoMsgs("recolher"); setAbertas(new Set()); }}>Recolher tudo</button><button type="button" className="sec mini" onClick={() => setModoMsgs("expandir")}>Expandir tudo</button></>}<small className="suave">{msgs.length} mensagens</small></div>}
      <div className="chat" ref={chatRef} style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, overflowY: "auto", overflowX: "hidden" }} aria-live="polite">{msgs.map((m, i) => (
        <div key={i}>
          <MensagemRetratil m={m.parcial && !m.texto ? { ...m, texto: "Escrevendo…" } : m} recolhida={!m.parcial && mensagemRecolhida(i, msgs.length, abertas, modoMsgs, fechadas)} onAlternar={() => alternarMsg(i)} />
          {m.propostas?.map((p) => <PropostaCompacta key={p.id} p={p} fonte={fonte} lojaId={loja.id} />)}
        </div>
      ))}<div ref={fim} /></div>
      <div className="barra-extras">
      {selecao && (aceitaEnvio
        ? <p className="consent-ok" role="status">✓ Envio autorizado a {selecao.nome} nesta sessão · <button type="button" className="link" disabled={ocupado} onClick={() => revogarEnvio()}>desfazer</button></p>
        : <div className="consent-linha aviso-envio" role="status">
            <span>Enviar esta pergunta e até 20 mensagens recentes a {selecao.nome}? Pode gerar cobrança na sua chave.{anexos.length > 0 && " Os anexos também são enviados."}</span>
            <button type="button" disabled={ocupado} onClick={() => autorizarEnvio()}>Autorizar e continuar</button>
          </div>)}
      </div>
      <div className="chat-compositor" style={{ flex: "0 0 auto", minWidth: 0, maxHeight: "min(42dvh, 280px)", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box" }}>
      {selecao?.motivo && <p role="status">{selecao.motivo}</p>}
      <form onSubmit={onSubmit} style={{ maxWidth: "none" }}>
        {anexos.length > 0 && <ul className="anexos-lista" style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", marginInline: 0, paddingInline: 0, overflowX: "hidden" }} aria-label="Anexos desta pergunta">{anexos.map((a, i) => <li key={`${a.nome}-${i}`}><span className="anexo-nome" title={a.nome}>{a.tipo.startsWith("image/") ? "🖼" : "📄"} {a.nome}</span><span className="suave">{rotuloBytes(a.bytes)}</span><button type="button" className="sec mini" aria-label={`Remover ${a.nome}`} onClick={() => setAnexos((l) => l.filter((_, k) => k !== i))}>✕</button></li>)}</ul>}
        {erroAnexo && <p role="alert" className="msg-erro">{erroAnexo}</p>}
        <div className="compositor-grade">
          <input ref={entradaArquivo} type="file" hidden multiple accept={CHAT_ACEITA} onChange={(e) => void escolherArquivos(e.target.files)} />
          <input ref={entradaCamera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => void escolherArquivos(e.target.files)} />
          <input ref={entradaFotos} type="file" hidden multiple accept="image/*" onChange={(e) => void escolherArquivos(e.target.files)} />
          <div className="compositor-campo"><span id="rotulo-pergunta" className="so-leitor">Pergunte</span><textarea aria-labelledby="rotulo-pergunta" value={texto} rows={1} style={{ display: "block", width: "100%", minWidth: 0, height: "48px", minHeight: "48px", maxHeight: "96px", overflowY: "auto", resize: "none", boxSizing: "border-box" }} enterKeyHint="send" placeholder="Pergunte ao Nano.ia…" onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(texto); } }} maxLength={1000} /></div>
          <div className="compositor-acoes">
          <button type="button" className="sec mic nano-mais" aria-expanded={menuAnexos} aria-label="Adicionar foto, câmera ou arquivo" title="Adicionar ao Nano.IA"
            onClick={() => { setMenuAnexos(v => !v); setEsq(false); setDir(false); }}><Icone nome="mais" tamanho={20} /></button>
          {voz.suporteMic && <button type="button" className="sec mic" aria-pressed={voz.ouvindo} aria-label={voz.ouvindo ? "Parar de ouvir" : "Falar com o assistente"} onClick={() => (voz.ouvindo ? voz.parar() : voz.ouvir())} disabled={ocupado}><Icone nome="mic" tamanho={20} /></button>}
          {voz.suporteFala && <button type="button" className="sec mic" aria-pressed={lerAlto} aria-label={lerAlto ? "Desligar a leitura das respostas em voz alta" : "Ler as respostas em voz alta"} title={lerAlto ? "Leitura em voz alta ligada" : "Leitura em voz alta desligada"} onClick={alternarFala}><Icone nome={lerAlto ? "voz" : "voz-mudo"} tamanho={20} /></button>}
            <span className="compositor-espaco" />
          <button className="compositor-enviar" aria-label="Enviar" title="Enviar (Enter)" disabled={ocupado || !podeEnviar || administrando || !!retentativa}><span aria-hidden="true"><Icone nome="enviar" tamanho={20} /></span></button>
          </div>
        </div>
        {voz.erro && <p className="msg-erro">{voz.erro}</p>}
        {voz.suporteFala && lerAlto && <details className="voz-escolha"><summary>Voz</summary><label><span className="so-leitor">Voz</span><select value={voz.vozEscolhida ?? ""} onChange={(e) => voz.escolherVozPreferida(e.target.value || null)}><option value="">Automática (a mais natural)</option>{voz.vozes.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label><small className="suave">{voz.vozes.length === 0 ? "Nenhuma voz em português encontrada; uso a padrão do aparelho." : `Em uso: ${escolherVoz(voz.vozes, voz.vozEscolhida)?.name ?? "padrão do aparelho"}${voz.vozes.length === 1 ? " (é a única em português neste aparelho)" : ""}`}</small></details>}
        {!voz.suporteMic && <p className="aviso-voz">Este navegador não oferece microfone para sites. Use o campo de texto.</p>}
      </form>
      </div>
      </section>
      {menuAnexos && <>
        <button type="button" className="nano-anexos-fundo" aria-label="Fechar opções de anexos" onClick={() => setMenuAnexos(false)} />
        <div className="nano-anexos-menu" role="menu" aria-label="Adicionar ao Nano.IA">
          <button type="button" role="menuitem" disabled={ocupado || !provedor || administrando || anexos.length >= CHAT_MAX_ANEXOS} onClick={() => { setMenuAnexos(false); entradaCamera.current?.click(); }}><span className="nano-icone-opcao">📷</span>Câmera</button>
          <button type="button" role="menuitem" disabled={ocupado || !provedor || administrando || anexos.length >= CHAT_MAX_ANEXOS} onClick={() => { setMenuAnexos(false); entradaFotos.current?.click(); }}><span className="nano-icone-opcao">▧</span>Fotos</button>
          <button type="button" role="menuitem" disabled={ocupado || !provedor || administrando || anexos.length >= CHAT_MAX_ANEXOS} onClick={() => { setMenuAnexos(false); entradaArquivo.current?.click(); }}><span className="nano-icone-opcao">📎</span>Arquivos</button>
          <button type="button" role="menuitem" onClick={() => { setMenuAnexos(false); if ((menu ?? []).some(([rota]) => rota === "/integracoes")) aoNavegar?.("/integracoes"); else setDir(true); }}><span className="nano-icone-opcao">✧</span>Integrações de IA</button>
          <button type="button" role="menuitem" onClick={() => { setMenuAnexos(false); setEsq(false); setDir(true); }}><span className="nano-icone-opcao">⚙</span>Modelo e privacidade</button>
        </div>
      </>}
      <aside className="aba aba-dir" id="aba-modelo" aria-label="Modelo e privacidade">
        <div className="aba-topo"><strong>Modelo e privacidade</strong><button type="button" className="sec mini" onClick={() => setDir(false)} aria-label="Recolher modelo e privacidade">Recolher</button></div>
        <div className="aba-corpo">
        <label>Modelo de IA<select value={provedor} disabled={ocupado || carregando || !!erroConfig || !!retentativa || administrando} onChange={(e) => { setProvedor(e.target.value as ProvedorChat | ""); setAceitaEnvio(false); }}>
          <option value="">Resumo local (sem IA externa)</option>
          {provedores.map((p) => <option key={p.id} value={p.id} disabled={p.estado !== "disponivel"}>{p.nome}{p.modelo ? ` · ${p.modelo}` : ""} — {ESTADO_PROVEDOR[p.estado]}</option>)}
        </select></label>
        <fieldset className="grupo-orbe"><legend>Esfera do Nano.IA</legend>
          <div className="grupo-orbe-opcoes" role="radiogroup" aria-label="Modelo da esfera">
            {MODELOS_ORBE.map((m) => <button key={m.valor} type="button" role="radio" aria-checked={modeloOrbe === m.valor} className="sec mini" title={m.descricao} onClick={() => { setModeloOrbe(m.valor); gravarOrbe(armazemLocal(), m.valor); }}>{m.rotulo}</button>)}
          </div>
        </fieldset>
        <fieldset className="grupo-orbe"><legend>Cor do painel e do Nano.IA</legend><SeletorCor /></fieldset>
        <p className="suave">Os estados refletem a configuração e o limite de uso; a API será consultada somente ao enviar.</p>
        <p className="suave">{provedor ? "Se o provedor falhar, escolha outro; não há troca automática." : "Só consultas por palavras-chave, sem enviar a um provedor de IA."} {config.persistente && provedor ? ` Histórico privado no servidor, com retenção de ${config.retencao_dias} dias por mensagem.` : " Histórico temporário nesta tela."}</p>
        {(voz.suporteMic || voz.suporteFala) && <p className="aviso-voz">A voz usa o reconhecimento do próprio navegador; no Chrome o áudio é processado pelo Google. O Conecta.IA não guarda o áudio; o texto segue a política de histórico indicada acima.</p>}
        </div>
      </aside>
    </div>
    </div>
  );
}

