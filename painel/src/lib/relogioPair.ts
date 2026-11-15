/** Relógios independentes: token de acesso do dispositivo e janela autorizada pelo lojista. */
export type AlertaPrazo = "indisponivel" | "normal" | "atencao" | "urgente" | "critico" | "vencido";

export function segundosRestantes(ate: string | null | undefined, agora = Date.now()): number | null {
  if (!ate) return null;
  const fim = Date.parse(ate);
  return Number.isFinite(fim) ? Math.max(0, Math.ceil((fim - agora) / 1000)) : null;
}

export function contadorPrazo(ate: string | null | undefined, agora = Date.now()): string {
  const s = segundosRestantes(ate, agora);
  if (s === null) return "--:--:--";
  const dias = Math.floor(s / 86400), horas = Math.floor(s / 3600) % 24;
  const min = Math.floor(s / 60) % 60, seg = s % 60;
  const horario = [horas, min, seg].map((n) => String(n).padStart(2, "0")).join(":");
  return dias ? `${dias} d ${horario}` : horario;
}

/** Alertas aos 15, 5 e 1 minuto. Não confunde autorização com token válido. */
export function alertaPrazo(ate: string | null | undefined, agora = Date.now()): AlertaPrazo {
  const s = segundosRestantes(ate, agora);
  if (s === null) return "indisponivel";
  if (s === 0) return "vencido";
  if (s <= 60) return "critico";
  if (s <= 300) return "urgente";
  if (s <= 900) return "atencao";
  return "normal";
}

export function mensagemAlertaPrazo(tipo: "token" | "janela", alerta: AlertaPrazo): string {
  if (alerta === "vencido") return tipo === "token"
    ? "O token venceu. Se a renovação automática não ocorreu, é necessário um novo pareamento QR."
    : "A janela autorizada terminou. É necessário novo pareamento QR.";
  if (alerta === "critico") return "Menos de 1 minuto: renove agora.";
  if (alerta === "urgente") return "Menos de 5 minutos para vencer.";
  if (alerta === "atencao") return "Menos de 15 minutos para vencer.";
  if (alerta === "indisponivel") return "Prazo não confirmado pelo servidor.";
  return "";
}

export function tokenEJanelaValidos(tokenAte: string | null | undefined, janelaAte: string | null | undefined, agora = Date.now()): boolean {
  const token = segundosRestantes(tokenAte, agora);
  const janela = segundosRestantes(janelaAte, agora);
  return token !== null && token > 0 && janela !== null && janela > 0;
}
