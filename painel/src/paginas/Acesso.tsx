import { useState, type FormEvent } from "react";
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
    else ir("/");
  }
  async function google() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
  }
  return (
    <div className="entrar">
      <h1>Entrar</h1>
      {aviso === "senha" && <p className="msg-ok">Senha alterada. Entre com a nova senha.</p>}
      <form onSubmit={enviar}>
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" /></label>
        {erro && <p className="msg-erro">{erro}</p>}
        <button disabled={ocupado}>Entrar</button>
      </form>
      <p><a href="#/recuperar">Esqueci minha senha</a></p>
      <button className="sec" onClick={() => void google()}>Entrar com Google</button>
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
    <div className="entrar">
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
    <div className="entrar">
      <h1>Nova senha</h1>
      <form onSubmit={enviar}>
        <label>Nova senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="new-password" /></label>
        {erro && <p className="msg-erro">{erro}</p>}
        <button>Salvar</button>
      </form>
    </div>
  );
}
