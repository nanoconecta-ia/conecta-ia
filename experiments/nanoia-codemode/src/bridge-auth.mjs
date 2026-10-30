/**
 * Contrato de transporte HTTP autenticado Worker (host confiável) -> ponte CodeMode.
 * Sem dependências de Bling/Supabase. NÃO importar dentro do Worker dinâmico.
 * Assinatura HMAC: método + path + timestamp + nonce + key-id + SHA256(bytes exatos).
 */
export const BRIDGE_PATH = "/v1/codemode/consulta";
export const BRIDGE_TOLERANCIA_MS = 30_000;
export const BRIDGE_MAX_BYTES = 4_096;
const encoder = new TextEncoder();

function bytes(v) { return encoder.encode(v); }
async function digestHex(v) {
  const buf = await crypto.subtle.digest("SHA-256", typeof v === "string" ? bytes(v) : v);
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function hmacHex(secret, v) {
  const key = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, bytes(v));
  return [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function segredoOk(secret) { return typeof secret === "string" && secret.length >= 32 && secret.length <= 512; }
function keyOk(key) { return typeof key === "string" && /^[A-Za-z0-9_-]{3,80}$/.test(key); }
function nonceOk(nonce) { return typeof nonce === "string" && /^[0-9a-fA-F-]{36}$/.test(nonce); }
function carimboOk(ts, agora) {
  return typeof ts === "string" && /^\d{13}$/.test(ts) && Math.abs(Number(ts) - agora) <= BRIDGE_TOLERANCIA_MS;
}
function cadeia(ts, nonce, keyId, hash) {
  return ["POST", BRIDGE_PATH, ts, nonce, keyId, hash].join("\n");
}
function constante(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function assinarBridge({ keyId, secret, corpo, agora = Date.now(), nonce = crypto.randomUUID() }) {
  if (!keyOk(keyId) || !segredoOk(secret) || !nonceOk(nonce) || !Number.isSafeInteger(agora)) throw Error("configuracao_assinatura_invalida");
  if (typeof corpo !== "string" || bytes(corpo).length > BRIDGE_MAX_BYTES) throw Error("corpo_invalido");
  const ts = String(agora);
  const sig = await hmacHex(secret, cadeia(ts, nonce, keyId, await digestHex(corpo)));
  return {
    "x-nano-key-id": keyId,
    "x-nano-timestamp": ts,
    "x-nano-nonce": nonce,
    "x-nano-signature": "v1=" + sig,
  };
}
/**
 * O host implementa buscarChave() usando armazenamento confiável e replay() com TTL atômico.
 * replay(keyId, nonce, expiracao) devolve true SE o nonce já foi usado.
 * No teste local usa Map; em staging multi-instância PRECISA armazenamento compartilhado.
 */
export async function verificarBridge({ method, path, headers, corpo, buscarChave, replay, agora = Date.now() }) {
  if (method !== "POST" || path !== BRIDGE_PATH || typeof corpo !== "string" || bytes(corpo).length > BRIDGE_MAX_BYTES)
    return { ok: false, motivo: "requisicao_invalida" };
  const h = (n) => headers.get(n);
  const keyId = h("x-nano-key-id"), ts = h("x-nano-timestamp"), nonce = h("x-nano-nonce"), sig = h("x-nano-signature");
  if (!keyOk(keyId) || !carimboOk(ts, agora) || !nonceOk(nonce) || !/^v1=[a-f0-9]{64}$/.test(sig ?? ""))
    return { ok: false, motivo: "credencial_invalida" };
  const chave = await buscarChave(keyId);
  if (!chave || !segredoOk(chave.secret) || chave.ativa !== true) return { ok: false, motivo: "credencial_invalida" };
  const esperado = "v1=" + await hmacHex(chave.secret, cadeia(ts, nonce, keyId, await digestHex(corpo)));
  if (!constante(sig, esperado)) return { ok: false, motivo: "credencial_invalida" };
  if (await replay(keyId, nonce, Number(ts) + BRIDGE_TOLERANCIA_MS)) return { ok: false, motivo: "repeticao_bloqueada" };
  return { ok: true, keyId };
}
/** Bloquear HTTP remoto, credenciais em URL, query, fragment e destinos internos. */
export function validarDestinoHost(url, local = false) {
  let u;
  try { u = new URL(url); } catch { throw Error("destino_invalido"); }
  if (u.username || u.password || u.search || u.hash || u.pathname !== BRIDGE_PATH)
    throw Error("destino_invalido");
  if (local && u.protocol === "http:" && u.hostname === "127.0.0.1" && u.port)
    return u.toString();
  if (u.protocol !== "https:" || u.port && u.port !== "443" || !/^[a-z0-9][a-z0-9.-]+$/i.test(u.hostname) ||
    u.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.endsWith(".local"))
    throw Error("destino_invalido");
  return u.toString();
}
export function criarClienteBridge({ url, keyId, secret, local = false, fetchFn = fetch }) {
  const destino = validarDestinoHost(url, local);
  if (!keyOk(keyId) || !segredoOk(secret)) throw Error("configuracao_assinatura_invalida");
  return async (operacao, args = {}) => {
    if (!["catalogo_resumo", "catalogo_listar"].includes(operacao)) throw Error("operacao_nao_autorizada");
    if (!args || typeof args !== "object" || Array.isArray(args)) throw Error("argumento_invalido");
    const corpo = JSON.stringify({ operacao, args });
    if (bytes(corpo).length > BRIDGE_MAX_BYTES) throw Error("argumento_invalido");
    const assinado = await assinarBridge({ keyId, secret, corpo });
    let resp;
    try {
      resp = await fetchFn(destino, {
        method: "POST",
        headers: { "content-type": "application/json", ...assinado },
        body: corpo,
        // Workers não implementa redirect:error; manual evita seguir 3xx, verificação abaixo.
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
    } catch (e) {
      // Apenas classe de erro, sem corpo, URL, credenciais ou mensagem potencialmente sensível.
      if (typeof console !== "undefined" && typeof console.warn === "function")
        console.warn("bridge_host_transport_failed", e instanceof Error ? e.name : "unknown");
      throw Error("host_indisponivel");
    }
    if (!resp.ok) throw Error(resp.status === 401 ? "host_nao_autorizado" : "host_recusou_operacao");
    if (!String(resp.headers.get("content-type") ?? "").includes("application/json"))
      throw Error("resposta_host_invalida");
    const text = await resp.text();
    if (bytes(text).length > 16_384) throw Error("resposta_host_invalida");
    let obj;
    try { obj = JSON.parse(text); } catch { throw Error("resposta_host_invalida"); }
    if (!obj || obj.ok !== true || typeof obj.resultado !== "object" || obj.resultado === null)
      throw Error("resposta_host_invalida");
    return obj.resultado;
  };
}
