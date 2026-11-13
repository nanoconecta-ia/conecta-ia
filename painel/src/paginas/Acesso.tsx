import { useState, type FormEvent } from "react";
import "../acesso-publico.css";
import "../workspace-aprovado.css";
import { AtivoAprovado } from "../componentes/AtivoAprovado.tsx";
import { supabase } from "../supabase.ts";
import { ir } from "../lib/rota.ts";

const MIN_SENHA = 10;

export function Entrar({ aviso }: { aviso: string | null }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) setErro("E-mail ou senha incorretos.");
    else if (!/^#\/(?:parear|autorizar-agente)(?:\?|$)/.test(window.location.hash)) ir("/"); // o aprovador do Conecta Pair volta para o link do QR
  }
  async function google() {
    if (/^#\/(?:parear|autorizar-agente)(?:\?|$)/.test(window.location.hash)) { try { sessionStorage.setItem("conecta:retorno", window.location.hash); } catch { /* sem storage: volta para o início */ } }
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
  }
  return (
    <div className="entrada-aprovada" data-acesso-layout="aprovado-v2">
      <section className="ap-auth-origem" aria-labelledby="entrada-titulo">
        <a href="./" className="ap-identidade"><strong>Conecta<span>.IA</span></strong><small>ENRIQUECIMENTO DE CATÁLOGOS</small></a>
        <AtivoAprovado nome="robo" tamanho={120}/>
        <span className="ap-eyebrow">ORIGEM · INTELIGÊNCIA · EXPERIÊNCIA</span>
        <h1 id="entrada-titulo">Três níveis.<br/>Uma origem física.</h1>
        <p>O ERP preserva a origem. A Conecta.IA organiza o conhecimento. O Nano.IA acompanha cada tarefa com contexto e revisão.</p>
        <div className="ap-auth-niveis"><span><b>01</b> ERP e cadastro físico</span><span><b>02</b> Conecta.IA + Nano.IA</span><span><b>03</b> Experiência da loja</span></div>
        <a href="./institucional.html">Conheça a plataforma ↗</a>
      </section>
      <section className="entrada-quadro" aria-label="Autenticação">
        <div className="entrada-quadro-topo"><span className="entrada-ponto" aria-hidden="true" /> ACESSO A USUÁRIOS HABILITADOS</div>
        <div className="entrar entrada-aprovada-form">
          <h2>Entre no seu ambiente</h2>
          <p className="entrada-ajuda">Use as credenciais da sua conta vinculada ao Conecta.IA.</p>
          {aviso === "senha" && <p className="msg-ok">Senha alterada. Entre com a nova senha.</p>}
          <form onSubmit={enviar}>
            <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
            <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" /></label>
            {erro && <p className="msg-erro" role="alert">{erro}</p>}
            <button disabled={ocupado}>{ocupado ? "Verificando…" : "Entrar com e-mail"}</button>
          </form>
          <p className="entrada-recuperar"><a href="#/recuperar">Esqueci minha senha</a></p>
          <div className="entrada-divisor"><span>ou</span></div>
          <button className="sec entrada-google" onClick={() => void google()}>Continuar com Google</button>
          <p className="entrada-privacidade">Ao acessar, consulte os <a href="./termos.html">Termos de uso</a> e a <a href="./privacidade.html">Política de privacidade</a>. O login via Google utiliza o provedor de autenticação; não concede acesso automático aos seus arquivos ou e-mails.</p>
        </div>
        <div className="entrada-quadro-rodape"><span>Não compartilhe senha ou código de verificação.</span><a href="./contato.html">Precisa de ajuda?</a></div>
      </section>
    </div>
  );
}

export function Recuperar() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    // resposta uniforme: não revela se o e-mail existe
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname + "#/redefinir" });
    setEnviado(true);
  }
  return (
    <div className="entrar entrada-aprovada-form">
      <h1>Recuperar senha</h1>
      {enviado ? <p className="msg-ok">Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.</p> : (
        <form onSubmit={enviar}>
          <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <button>Enviar link</button>
        </form>
      )}
      <p><a href="#/entrar">Voltar</a></p>
    </div>
  );
}

export function Redefinir({ aoConcluir }: { aoConcluir: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < MIN_SENHA) { setErro(`Use pelo menos ${MIN_SENHA} caracteres.`); return; }
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setErro("Não foi possível alterar a senha. Peça um novo link.");
    else aoConcluir();
  }
  return (
    <div className="entrar entrada-aprovada-form">
      <h1>Nova senha</h1>
      <form onSubmit={enviar}>
        <label>Nova senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="new-password" /></label>
        {erro && <p className="msg-erro">{erro}</p>}
        <button>Salvar</button>
      </form>
    </div>
  );
}
