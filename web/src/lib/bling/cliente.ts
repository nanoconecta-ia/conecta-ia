import { BLING_API } from "./config.ts";

const INTERVALO_MS = 340; // 3 req/s com folga

export type OpcoesCliente = { accessToken: () => Promise<string>; fetch?: typeof fetch; dormir?: (ms: number) => Promise<void> };

/** Cliente somente-leitura (GET) com Bearer, enable-jwt, espaçamento de 3 req/s e backoff em 429. */
export function clienteBling(o: OpcoesCliente) {
  const f = o.fetch ?? fetch;
  const dormir = o.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let ultima = 0;

  async function get<T>(caminho: string, params: Record<string, string | number> = {}, tentativas = 4): Promise<T> {
    const u = new URL(BLING_API + caminho);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    for (let i = 0; ; i++) {
      const espera = ultima + INTERVALO_MS - Date.now();
      if (espera > 0) await dormir(espera);
      ultima = Date.now();
      const r = await f(u, { headers: { Authorization: `Bearer ${await o.accessToken()}`, "enable-jwt": "1", Accept: "application/json" } });
      if (r.status === 429 && i < tentativas) {
        await dormir(1000 * 2 ** i);
        continue;
      }
      if (!r.ok) throw new Error(`Bling ${caminho} falhou (HTTP ${r.status})`);
      return (await r.json()) as T;
    }
  }

  /** Percorre todas as páginas de uma listagem (`data` é array). */
  async function* paginas<T>(caminho: string, params: Record<string, string | number> = {}, limite = 100) {
    for (let pagina = 1; ; pagina++) {
      const { data } = await get<{ data: T[] }>(caminho, { ...params, pagina, limite });
      if (!data?.length) return;
      yield data;
      if (data.length < limite) return;
    }
  }

  return { get, paginas };
}
