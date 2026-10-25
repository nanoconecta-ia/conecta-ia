// Renovação do access_token do Bling. O refresh_token roda a cada renovação (o antigo morre), então
// só UMA renovação por loja pode acontecer por vez: reserva (lease) no banco antes de chamar o Bling.
// Lógica pura sobre portas (Armazem/Http): testável sem Supabase nem rede. Nunca registra token.
import { decifrar, cifrar, type Chaveiro } from "./cripto.ts";

export const ANTECEDENCIA_MS = 30 * 60_000; // renova quando faltar menos que isso
export const RESERVA_S = 60;

export interface CredCifrada { access_token_cifrado: string; refresh_token_cifrado: string; expira_em: string }

/** Porta do banco (implementada com as RPCs do Supabase em bling_armazem.ts). */
export interface Armazem {
  ler(lojaId: string): Promise<CredCifrada | null>;
  reservar(lojaId: string, por: string, ttlS: number): Promise<boolean>;
  liberar(lojaId: string, por: string): Promise<void>;
  salvar(lojaId: string, access: string, refresh: string, expiraEm: string): Promise<void>; // também libera a reserva
  marcar(lojaId: string, status: "conectada" | "expirada" | "erro", erro: string | null): Promise<void>;
  /** App (Client ID + secret cifrado) que o lojista cadastrou para a loja. */
  lerApp(lojaId: string): Promise<{ client_id: string; client_secret_cifrado: string; cnpj: string } | null>;
}

export interface Config {
  chaveCifra: Chaveiro;
  fetch?: typeof fetch; agora?: () => number; espera?: (ms: number) => Promise<void>; id?: string;
}

export type ResultadoRenovacao = "renovada" | "ja_valida" | "outra_renovacao" | "reconectar" | "falha_temporaria" | "sem_conexao";

const TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

export async function renovarLoja(arm: Armazem, lojaId: string, cfg: Config, forcar = false): Promise<ResultadoRenovacao> {
  const agora = cfg.agora ?? Date.now;
  const f = cfg.fetch ?? fetch;
  const espera = cfg.espera ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const por = cfg.id ?? crypto.randomUUID();

  const antes = await arm.ler(lojaId);
  if (!antes) return "sem_conexao";
  if (!forcar && Date.parse(antes.expira_em) - agora() > ANTECEDENCIA_MS) return "ja_valida";

  if (!(await arm.reservar(lojaId, por, RESERVA_S))) {
    // outra instância está renovando: espera e confere se o token novo já chegou
    for (let i = 0; i < 5; i++) {
      await espera(1000);
      const dep = await arm.ler(lojaId);
      if (dep && dep.refresh_token_cifrado !== antes.refresh_token_cifrado) return "outra_renovacao";
    }
    return "falha_temporaria";
  }

  try {
    // relê com a reserva em mãos: outra renovação pode ter terminado entre a leitura e a reserva
    const atual = (await arm.ler(lojaId)) ?? antes;
    if (!forcar && atual.refresh_token_cifrado !== antes.refresh_token_cifrado) { await arm.liberar(lojaId, por); return "outra_renovacao"; }
    const app = await arm.lerApp(lojaId);
    if (!app) {
      await arm.marcar(lojaId, "erro", "App do Bling não cadastrado. Informe o Client ID e o Client Secret no painel.");
      await arm.liberar(lojaId, por);
      return "reconectar";
    }
    const clientSecret = await decifrar(app.client_secret_cifrado, cfg.chaveCifra);
    const refresh = await decifrar(atual.refresh_token_cifrado, cfg.chaveCifra);

    let r: Response;
    try {
      r = await f(TOKEN_URL, {
        method: "POST", redirect: "manual",
        headers: {
          Authorization: "Basic " + btoa(`${app.client_id}:${clientSecret}`),
          "Content-Type": "application/x-www-form-urlencoded", Accept: "1.0", "enable-jwt": "1",
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      await arm.liberar(lojaId, por);
      return "falha_temporaria"; // rede/timeout: o refresh_token ainda vale
    }

    if (r.status === 400 || r.status === 401) {
      // refresh inválido/revogado: só o humano resolve
      // motivo sanitizado: só o código HTTP e um código OAuth conhecido (nunca o corpo nem tokens)
      const corpo = await r.json().catch(() => null) as { error?: unknown } | null;
      const codigo = typeof corpo?.error === "string" && /^(invalid_grant|invalid_client|invalid_request|unauthorized_client)$/.test(corpo.error) ? `, ${corpo.error}` : "";
      await arm.marcar(lojaId, "expirada", `Autorização do Bling expirou ou foi revogada (HTTP ${r.status}${codigo}). Reconecte no painel.`);
      await arm.liberar(lojaId, por);
      return "reconectar";
    }
    if (!r.ok) { await arm.liberar(lojaId, por); return "falha_temporaria"; }

    const t = await r.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number } | null;
    if (!t?.access_token || !t.refresh_token || !t.expires_in) { await arm.liberar(lojaId, por); return "falha_temporaria"; }
    await arm.salvar(
      lojaId, await cifrar(t.access_token, cfg.chaveCifra), await cifrar(t.refresh_token, cfg.chaveCifra),
      new Date(agora() + t.expires_in * 1000).toISOString(),
    );
    return "renovada";
  } catch {
    await arm.liberar(lojaId, por).catch(() => {});
    return "falha_temporaria";
  }
}

/** Access token válido; renova (uma vez) se estiver perto de vencer. null = precisa reconectar. */
export async function obterAccessToken(arm: Armazem, lojaId: string, cfg: Config): Promise<string | null> {
  let c = await arm.ler(lojaId);
  if (!c) return null;
  if (Date.parse(c.expira_em) - (cfg.agora ?? Date.now)() <= ANTECEDENCIA_MS) {
    const r = await renovarLoja(arm, lojaId, cfg);
    if (r === "reconectar" || r === "sem_conexao") return null;
    c = await arm.ler(lojaId);
    if (!c) return null;
  }
  return decifrar(c.access_token_cifrado, cfg.chaveCifra);
}
