/** Autenticação mínima só para o laboratório. NÃO reutilizar como OAuth ou auth comercial. */
export async function autenticarDemo(req, env) {
  if (env?.PILOT_ENABLED !== "true") return null;
  const raw = req.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_-]{20,150}$/.test(raw)) return null;
  const enviado = raw.slice(7);
  const digest = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const guardado = async (s) => {
    // Não permite segredo vazio ou curto; comparação constante sobre SHA-256.
    if (typeof s !== "string" || s.length < 24) return false;
    const a = await digest(enviado), b = await digest(s);
    let diferente = 0;
    for (let i = 0; i < a.length; i++) diferente |= a[i] ^ b[i];
    return diferente === 0;
  };
  if (await guardado(env.PILOT_TOKEN_A)) return "piloto-a";
  if (await guardado(env.PILOT_TOKEN_B)) return "piloto-b";
  return null;
}
export function criarOrcamentoDeChamadas(maximo = 12) {
  if (!Number.isInteger(maximo) || maximo < 1 || maximo > 30) throw new Error("limite_invalido");
  let contador = 0;
  return function registrar() {
    if (++contador > maximo) throw new Error("limite_de_chamadas_internas_excedido");
    return contador;
  };
}
