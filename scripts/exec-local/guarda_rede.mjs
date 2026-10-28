// Guarda de rede do executor Browser: bloqueia destinos internos (SSRF) em CADA requisição, inclusive redirecionamentos e subrecursos.
const PRIV = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
export function hostInterno(h) {
  h = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (/^[0-9.]+$/.test(h)) return /^\d+$/.test(h) || h.split(".").length !== 4 || PRIV.some((r) => r.test(h)); // decimal/curto = ofuscação
  if (h.includes(":")) return h === "::1" || h === "::" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith("::ffff:");
  return false;
}
export function destinoPermitido(url, hostsPermitidos) {
  let u; try { u = new URL(url); } catch { return { ok: false, motivo: "url_invalida" }; }
  if (u.protocol !== "https:") return { ok: false, motivo: `protocolo_bloqueado:${u.protocol}` };
  if (u.username || u.password) return { ok: false, motivo: "credencial_na_url" };
  if (hostInterno(u.hostname)) return { ok: false, motivo: `host_interno:${u.hostname}` };
  if (!hostsPermitidos.includes(u.hostname)) return { ok: false, motivo: `host_fora_da_lista:${u.hostname}` };
  return { ok: true };
}
