// Único cliente da API v3 do Bling. enable-jwt: 1 sempre; 401 renova uma vez; 429/5xx recua; timeout;
// nunca registra token nem corpo. Só aceita caminhos da API v3 (sem URL livre).
import { obterAccessToken, renovarLoja, type Armazem, type Config } from "./bling_token.ts";

const BASE = "https://api.bling.com.br/Api/v3";
export const RECUOS_MS = [1000, 3000, 8000];

export interface Opcoes { metodo?: string; corpo?: unknown; timeoutMs?: number; recuos?: number[] }
export class BlingErro extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

export async function blingFetch(arm: Armazem, lojaId: string, caminho: string, cfg: Config, op: Opcoes = {}): Promise<Response> {
  if (!/^\/[a-z0-9/_-]*(\?[A-Za-z0-9%=&_.,\[\]-]*)?$/i.test(caminho)) throw new BlingErro(400, "Caminho inválido para a API do Bling.");
  const f = cfg.fetch ?? fetch;
  const espera = cfg.espera ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const recuos = op.recuos ?? RECUOS_MS;
  const metodo = op.metodo ?? "GET";

  let token = await obterAccessToken(arm, lojaId, cfg);
  if (!token) throw new BlingErro(401, "Bling não conectado. Reconecte no painel.");
  let renovou = false;

  for (let tentativa = 0; ; tentativa++) {
    const r = await f(BASE + caminho, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`, Accept: "application/json", "enable-jwt": "1",
        ...(op.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
      signal: AbortSignal.timeout(op.timeoutMs ?? 20_000),
    });
    if (r.status === 401 && !renovou) {
      renovou = true;
      const res = await renovarLoja(arm, lojaId, cfg, true);
      if (res === "reconectar") throw new BlingErro(401, "Acesso ao Bling expirou. Reconecte no painel.");
      token = await obterAccessToken(arm, lojaId, cfg);
      if (!token) throw new BlingErro(401, "Bling não conectado. Reconecte no painel.");
      continue;
    }
    // Só repete leitura: escrita nunca é repetida às cegas (pode duplicar). Timeout/erro em escrita => estado desconhecido.
    const repetivel = metodo === "GET" && (r.status === 429 || r.status >= 500);
    if (repetivel && tentativa < recuos.length) { await espera(recuos[tentativa]); continue; }
    return r;
  }
}
