import { useEffect, useState } from "react";
import { alertaPrazo, contadorPrazo, mensagemAlertaPrazo, tokenEJanelaValidos } from "../lib/relogioPair.ts";

/** Só este componente atualiza a cada segundo; não redesenha o Estúdio inteiro. */
export function RelogioPair({ tokenAte, janelaAte, compacto = false }: {
  tokenAte: string | null | undefined; janelaAte: string | null | undefined; compacto?: boolean;
}) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const atualiza = () => setAgora(Date.now());
    atualiza();
    const intervalo = window.setInterval(atualiza, 1000);
    const visivel = () => { if (!document.hidden) atualiza(); };
    document.addEventListener("visibilitychange", visivel);
    return () => { window.clearInterval(intervalo); document.removeEventListener("visibilitychange", visivel); };
  }, []);
  const token = alertaPrazo(tokenAte, agora), janela = alertaPrazo(janelaAte, agora);
  const valido = tokenEJanelaValidos(tokenAte, janelaAte, agora);
  const avisoToken = mensagemAlertaPrazo("token", token);
  const avisoJanela = mensagemAlertaPrazo("janela", janela);
  return (
    <div className={compacto ? "suave" : "cartao"} aria-label="Prazos da conexão QR">
      <p><strong>{valido ? "Token e janela dentro da validade" : "Token ou janela indisponível"}</strong></p>
      <p>Janela do lojista: <strong className="mono" aria-label="Contagem regressiva da janela autorizada">{contadorPrazo(janelaAte, agora)}</strong></p>
      <p>Token do dispositivo: <strong className="mono" aria-label="Contagem regressiva do token">{contadorPrazo(tokenAte, agora)}</strong></p>
      {janela !== "normal" && avisoJanela && <p className={janela === "urgente" || janela === "critico" || janela === "vencido" ? "msg-erro" : "suave"}>Janela: {avisoJanela}</p>}
      {token !== "normal" && avisoToken && <p className={token === "urgente" || token === "critico" || token === "vencido" ? "msg-erro" : "suave"}>Token: {avisoToken}</p>}
    </div>
  );
}
