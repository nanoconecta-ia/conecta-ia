/** Indicadores do cockpit. Não inferir zero ou conexão ativa em erros de leitura. */
export const totalLegivel = (valor: number | null): string =>
  valor === null || !Number.isSafeInteger(valor) || valor < 0 ? "—" : valor.toLocaleString("pt-BR");

export function estadoBling(valor: string | null): { rotulo: string; tipo: "ok" | "alerta" | "neutro" } {
  if (valor === null) return { rotulo: "Consultando…", tipo: "neutro" };
  const texto = valor.trim().toLowerCase();
  if (texto === "conectada" || texto === "conectado") return { rotulo: "Conectado", tipo: "ok" };
  if (texto === "indisponível") return { rotulo: "Consulta indisponível", tipo: "alerta" };
  if (!texto || texto === "pendente") return { rotulo: "Conexão pendente", tipo: "alerta" };
  return { rotulo: valor.slice(0, 60), tipo: "neutro" };
}

/** Impede abrir URLs com javascript:, data:, file: ou credenciais embutidas. */
export function linkFonteSegura(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const u = new URL(valor);
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
