import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.ts";
import { ir } from "../lib/rota.ts";
import { QrCode } from "../componentes/QrCode.tsx";
import { aleatorioB64u, chamarPair, ESCOPOS, mmss, MOTIVOS, ROTULOS_ESCOPO, segundosAte, sha256Hex, TIPOS_DISPOSITIVO, URL_GATEWAY } from "../lib/pair.ts";

type Desafio = { codigo: string; url: string; verificacao: string; segredo: string; expira_em: string; renovavel: boolean };
type Conectado = { token: string; loja_id: string; escopos: string[]; limite_ate: string; renovavel: boolean };
const DURACOES: [number, string][] = [[15, "15 minutos"], [60, "1 hora"], [240, "4 horas"], [480, "8 horas"]];

/** Lado do SOLICITANTE (sem login): mostra o QR, o código de verificação e espera a aprovação do lojista. */
export function ParearSolicitante() {
  const [nome, setNome] = useState(() => (navigator.platform || "Dispositivo").slice(0, 40));
  const [tipo, setTipo] = useState("navegador");
  const [escopos, setEscopos] = useState<string[]>(["produtos:ler"]);
  const [duracao, setDuracao] = useState(60);
  const [renovavel, setRenovavel] = useState(true);
  const [d, setD] = useState<Desafio | null>(null);
  const [conectado, setConectado] = useState<Conectado | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [restante, setRestante] = useState(0);
  const [mostrarToken, setMostrarToken] = useState(false);
  const token = useRef<string>("");   // 1ª metade do token: nasce AQUI
  const sal = useRef<string>("");     // 2ª metade: entregue pelo servidor (dá a entropia mínima)
  const completo = () => `${token.current}.${sal.current}`;

  // contagem regressiva do QR
  useEffect(() => {
    if (!d || conectado) return;
    const t = setInterval(() => setRestante(segundosAte(d.expira_em)), 500);
    return () => clearInterval(t);
  }, [d, conectado]);

  // consulta (polling) até aprovar, recusar ou expirar
  useEffect(() => {
    if (!d || conectado) return;
    let vivo = true;
    const ciclo = async () => {
      const r = await chamarPair({ acao: "consultar", codigo: d.codigo, segredo: d.segredo });
      if (!vivo) return;
      const estado = r.corpo.estado;
      if (estado === "resgatado") {
        setConectado({ token: completo(), loja_id: String(r.corpo.loja_id), escopos: (r.corpo.escopos as string[]) ?? [], limite_ate: String(r.corpo.limite_ate), renovavel: d.renovavel });
        return;
      }
      if (estado === "recusado" || estado === "expirado" || estado === "invalido" || estado === "cancelado") {
        setD(null); setMensagem(estado === "recusado" ? "O lojista recusou o pareamento." : "O QR expirou. Gere um novo."); return;
      }
      if (r.status === 429) { setTimeout(() => vivo && void ciclo(), 5000); return; }
      setTimeout(() => vivo && void ciclo(), 2000);
    };
    void ciclo();
    return () => { vivo = false; };
  }, [d, conectado]);

  // renovação automática do token (gira a cada 10 min enquanto esta aba estiver aberta)
  useEffect(() => {
    if (!conectado?.renovavel) return;
    const t = setInterval(async () => {
      const novo = aleatorioB64u();
      const r = await chamarPair({ acao: "renovar", novo_token_hash: await sha256Hex(novo) }, completo());
      if (r.status === 200) { token.current = novo; setConectado((c) => (c ? { ...c, token: completo() } : c)); }
      else { setConectado(null); setD(null); setMensagem("A sessão terminou. Faça um novo pareamento."); }
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [conectado?.renovavel]);

  async function iniciar() {
    setMensagem(""); setMostrarToken(false);
    token.current = aleatorioB64u(); // ao servidor vai só o hash desta metade
    const r = await chamarPair({ acao: "iniciar", nome: nome.trim(), tipo, escopos, duracao_min: duracao, renovavel, token_hash: await sha256Hex(token.current) });
    if (r.status !== 200) { setMensagem(String(r.corpo.erro ?? "Não foi possível iniciar.")); return; }
    const x = r.corpo as unknown as Desafio & { expira_em: string; sal: string };
    sal.current = x.sal;
    setD({ codigo: x.codigo, url: x.url, verificacao: x.verificacao, segredo: x.segredo, expira_em: x.expira_em, renovavel });
    setRestante(segundosAte(x.expira_em));
  }
  async function desconectar() {
    await chamarPair({ acao: "encerrar" }, completo());
    token.current = ""; sal.current = ""; setConectado(null); setD(null); setMensagem("Desconectado.");
  }
  const alternar = (e: string) => setEscopos((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]));

  if (conectado) {
    return (
      <div className="entrar">
        <h1>Conectado <span className="selo ok">sessão ativa</span></h1>
        <p className="suave">Este dispositivo está pareado com a loja e pode: {conectado.escopos.map((e) => ROTULOS_ESCOPO[e] ?? e).join("; ")}.</p>
        <p className="suave">Vale até {new Date(conectado.limite_ate).toLocaleString("pt-BR")}. {conectado.renovavel ? "O token gira sozinho enquanto esta aba estiver aberta." : "O token não gira: vale até o fim da duração aprovada."} O lojista pode encerrar a qualquer momento.</p>
        {tipo === "agente_externo" && (
          <div className="cartao">
            <h2>Usar em um agente externo</h2>
            <p className="suave">O pareamento autoriza esta sessão. Conecte o gateway em um cliente que aceite token Bearer, como o Codex CLI. Este QR não instala uma conexão neste chat. A conexão direta pelo ChatGPT ainda depende da integração OAuth.</p>
            <p className="suave">Endereço do gateway (MCP, JSON-RPC por HTTPS):</p>
            <p className="mono" style={{ wordBreak: "break-all" }}>{URL_GATEWAY}</p>
            <p className="suave">Token (envie como <span className="mono">Authorization: Bearer …</span>). Trate como senha: ele só alcança esta loja e só com as permissões acima, mas qualquer pessoa com ele age como este dispositivo até o prazo.</p>
            {mostrarToken ? <p className="mono" style={{ wordBreak: "break-all" }}>{conectado.token}</p> : <button className="sec" onClick={() => setMostrarToken(true)}>Mostrar token</button>}
          </div>
        )}
        <button className="perigo" onClick={() => void desconectar()}>Desconectar agora</button>
      </div>
    );
  }
  if (d) {
    return (
      <div className="entrar">
        <h1>Aprove no seu celular</h1>
        <p className="suave">Abra o Conecta.IA no celular, já logado como lojista, e leia este QR Code. O QR vale <strong>2 minutos</strong> e só pode ser usado uma vez.</p>
        <QrCode texto={d.url} rotulo="QR Code de pareamento do Conecta.IA" />
        <p className="suave">Quando o celular pedir, digite este código:</p>
        <p className="codigo-grande mono" aria-label={`Código de verificação ${d.verificacao.split("").join(" ")}`}>{d.verificacao}</p>
        <p className="suave">Expira em <span className="mono">{mmss(restante)}</span>. Não escaneou? Copie o link: <span className="mono" style={{ wordBreak: "break-all" }}>{d.url}</span></p>
        <button className="sec" onClick={() => { setD(null); setMensagem("Pareamento cancelado."); }}>Cancelar</button>
      </div>
    );
  }
  return (
    <div className="entrar">
      <h1>Conectar um dispositivo</h1>
      <p className="suave">Conecte um navegador, computador, celular ou agente de IA à sua loja sem digitar senha neste aparelho. Quem aprova é você, no celular. Nada é concedido automaticamente.</p>
      {mensagem && <p className="msg-erro">{mensagem}</p>}
      <label>Nome do dispositivo<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} /></label>
      <label>Tipo<select value={tipo} onChange={(e) => { setTipo(e.target.value); setRenovavel(e.target.value !== "agente_externo"); }}>{TIPOS_DISPOSITIVO.filter(([v]) => v !== "agente_desktop").map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      {tipo === "agente_externo" && <p className="suave">Para consultar a API Bling, marque a permissão específica abaixo. A conexão deste agente com o ChatGPT ainda requer OAuth; gerar o QR não conecta esta conversa automaticamente.</p>}
      <fieldset><legend>O que ele poderá fazer</legend>
        {ESCOPOS.map((e) => <label key={e} className="marcar"><input type="checkbox" checked={escopos.includes(e)} onChange={() => alternar(e)} /> {ROTULOS_ESCOPO[e]}</label>)}
      </fieldset>
      <label>Duração máxima<select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}>{DURACOES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <label className="marcar"><input type="checkbox" checked={renovavel} onChange={(e) => setRenovavel(e.target.checked)} /> Renovar o token automaticamente (recomendado). Desmarque só se o agente guarda um token fixo.</label>
      <button disabled={!nome.trim() || escopos.length === 0} onClick={() => void iniciar()}>Gerar QR Code</button>
      <p className="suave">Agente desktop com acesso a aplicativos locais exige instalação própria e consentimento separado — não é criado por aqui.</p>
    </div>
  );
}

type Detalhe = { nome: string; tipo: string; escopos: string[]; capacidades: string[]; duracao_min: number; renovavel: boolean; expira_em: string; lojas: { id: string; nome: string }[] };

/** Lado do APROVADOR (lojista logado): confere o dispositivo, escolhe loja/permissões/duração e confirma digitando o código da tela dele. */
export function ParearAprovador({ codigo, email }: { codigo: string; email: string | null }) {
  const [det, setDet] = useState<Detalhe | null | undefined>(undefined);
  const [loja, setLoja] = useState("");
  const [escopos, setEscopos] = useState<string[]>([]);
  const [duracao, setDuracao] = useState(0);
  const [verif, setVerif] = useState("");
  const [senha, setSenha] = useState("");
  const [pedeSenha, setPedeSenha] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    void supabase.rpc("pair_detalhe", { p_codigo: codigo }).then(({ data, error }) => {
      if (error || !data) { setDet(null); return; }
      const x = data as Detalhe;
      setDet(x); setLoja(x.lojas[0]?.id ?? ""); setEscopos(x.escopos); setDuracao(x.duracao_min); setRestante(segundosAte(x.expira_em));
    });
  }, [codigo]);
  useEffect(() => {
    if (!det) return;
    const t = setInterval(() => setRestante(segundosAte(det.expira_em)), 500);
    return () => clearInterval(t);
  }, [det]);

  async function aprovar() {
    if (!det) return;
    setOcupado(true); setMsg("");
    if (pedeSenha && email) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) { setOcupado(false); setMsg("Senha incorreta."); return; }
      setSenha(""); setPedeSenha(false);
    }
    const { data, error } = await supabase.rpc("pair_aprovar", { p_codigo: codigo, p_loja: loja, p_verificacao: verif.replace(/\s/g, ""), p_escopos: escopos, p_duracao_min: duracao, p_capacidades: det.capacidades });
    setOcupado(false);
    if (error) { setMsg("Você não tem permissão de lojista nesta loja."); return; }
    const r = data as { ok: boolean; motivo?: string; restantes?: number };
    if (r.ok) { setOk(true); return; }
    if (r.motivo === "reconfirmacao_necessaria") setPedeSenha(true);
    setMsg((MOTIVOS[r.motivo ?? ""] ?? "Não foi possível aprovar.") + (r.restantes != null ? ` Tentativas restantes: ${r.restantes}.` : ""));
  }
  async function recusar() { setOcupado(true); await supabase.rpc("pair_recusar", { p_codigo: codigo }); setOcupado(false); setMsg("Pareamento recusado."); setDet(null); }

  if (det === undefined) return <div className="entrar"><p className="suave">Carregando…</p></div>;
  if (ok) return <div className="entrar"><h1>Pareado <span className="selo ok">aprovado</span></h1><p className="suave">O dispositivo já está conectado. Você pode encerrá-lo a qualquer momento em Dispositivos.</p><button onClick={() => ir("/dispositivos")}>Ver dispositivos</button></div>;
  if (det === null) return <div className="entrar"><h1>QR inválido</h1><p className="suave">{msg || "Este QR não existe, já foi usado, foi recusado ou expirou (vale 2 minutos). Gere outro no dispositivo."}</p><button className="sec" onClick={() => ir("/")}>Ir para o painel</button></div>;
  const duracoes = DURACOES.map(([v]) => v).filter((v) => v < det.duracao_min).concat(det.duracao_min);
  return (
    <div className="entrar">
      <h1>Autorizar dispositivo?</h1>
      <div className="cartao">
        <p><strong>{det.nome}</strong> <span className="selo atencao">{TIPOS_DISPOSITIVO.find(([v]) => v === det.tipo)?.[1] ?? det.tipo}</span></p>
        <p className="suave">O nome é informado pelo próprio dispositivo. <strong>Só aprove se ele estiver na sua frente</strong> e mostrando o código de 6 dígitos.</p>
        {det.tipo === "agente_desktop" && <p className="msg-erro">Agente desktop pode operar aplicativos neste computador. Capacidades pedidas: {det.capacidades.length ? det.capacidades.join(", ") : "nenhuma"}.</p>}
        <p className="suave">Expira em <span className="mono">{mmss(restante)}</span></p>
      </div>
      <label>Loja<select value={loja} onChange={(e) => setLoja(e.target.value)}>{det.lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
      {det.lojas.length === 0 && <p className="msg-erro">Você não é lojista de nenhuma loja; não pode aprovar.</p>}
      <fieldset><legend>Permissões</legend>
        {det.escopos.map((e) => <label key={e} className="marcar"><input type="checkbox" checked={escopos.includes(e)} onChange={() => setEscopos((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]))} /> {ROTULOS_ESCOPO[e] ?? e}</label>)}
        <p className="suave">Nenhuma permissão aprova, publica ou altera preço/estoque: o dispositivo só consulta e propõe.</p>
      </fieldset>
      <label>Duração<select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))}>{duracoes.map((v) => <option key={v} value={v}>{v >= 60 ? `${v / 60} h` : `${v} min`}</option>)}</select></label>
      <p className="suave">{det.renovavel ? "O token gira a cada uso e expira em 15 minutos sem renovação." : "Este dispositivo guarda um token fixo: ele vale até o fim da duração escolhida."}</p>
      <label>Código mostrado na tela do dispositivo<input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={verif} onChange={(e) => setVerif(e.target.value)} placeholder="000000" /></label>
      {pedeSenha && <label>Confirme sua senha<input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></label>}
      {msg && <p className="msg-erro">{msg}</p>}
      <div className="linha">
        <button disabled={ocupado || !loja || escopos.length === 0 || verif.replace(/\s/g, "").length !== 6 || restante === 0 || (pedeSenha && !senha)} onClick={() => void aprovar()}>Aprovar</button>
        <button className="perigo" disabled={ocupado} onClick={() => void recusar()}>Recusar</button>
      </div>
    </div>
  );
}
