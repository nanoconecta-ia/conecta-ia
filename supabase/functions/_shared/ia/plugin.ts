// Chamada de plugin tipo "api" (a plataforma chama um endpoint cadastrado pela loja). Contrato SDK v1:
//   POST <url>  Authorization: Bearer <credencial>   { sdk: "1", capacidade, entrada }   =>   JSON
// O retorno é DADO: nunca vira instrução nem grava nada sozinho. Só capacidade declarada, plugin ativo, risco LOW.
export interface PluginRegistro { id: string; nome: string; tipo: string; url: string | null; capacidades: string[]; risco: string; ativo: boolean }

/** Endereço seguro para chamar de dentro do servidor: https, host público (sem IP literal nem rede interna). */
export function urlPublicaSegura(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.port && u.port !== "443") return false;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
  if (h === "localhost" || /\.(local|internal|localhost|lan|home|corp)$/.test(h)) return false;
  return true;
}

/**
 * O cadastro de um plugin não significa que o Nano sabe executar seu protocolo.
 * Somente a ponte SDK v1 ("api") é executável hoje; MCP/LLM/pull permanecem rascunhos.
 * Nenhum risco MEDIUM/HIGH/CRITICAL vira autorização de execução automática.
 */
export function permissaoAtivacaoPlugin(p: PluginRegistro & { ultimo_teste_ok?: boolean | null }): { permitido: boolean; motivo: string } {
  if (p.tipo !== "api") return { permitido: false, motivo: `O plugin ${p.tipo.toUpperCase()} está somente cadastrado: a execução desse protocolo pelo Nano ainda não foi implementada. Não é uma conexão MCP autenticada.` };
  if (p.risco !== "LOW") return { permitido: false, motivo: "Plugins MEDIUM, HIGH ou CRITICAL exigem fluxo de aprovação separado; ativação automática bloqueada." };
  if (!Array.isArray(p.capacidades) || p.capacidades.length === 0) return { permitido: false, motivo: "Declare pelo menos uma capacidade antes de ativar." };
  if (!p.url || !urlPublicaSegura(p.url)) return { permitido: false, motivo: "Configure uma URL HTTPS pública permitida antes de ativar." };
  if (p.ultimo_teste_ok !== true) return { permitido: false, motivo: "Teste a conexão SDK v1 e confirme resultado positivo antes de ativar." };
  return { permitido: true, motivo: "API SDK v1 testada, somente capacidades declaradas e risco LOW." };
}

export type ResultadoPlugin = { ok: true; dados: unknown } | { ok: false; erro: string };

export async function chamarPlugin(p: PluginRegistro, credencial: string | null, capacidade: string, entrada: unknown, f: typeof fetch = fetch): Promise<ResultadoPlugin> {
  if (!p.ativo) return { ok: false, erro: "Plugin desligado." };
  if (p.tipo !== "api") return { ok: false, erro: `Plugins do tipo ${p.tipo} ainda não são executados pelo agente.` };
  if (!p.capacidades.includes(capacidade)) return { ok: false, erro: "Capacidade não habilitada para este plugin." };
  if (p.risco !== "LOW") return { ok: false, erro: "Plugin de risco acima de LOW exige aprovação humana: o agente não o chama sozinho." };
  if (!p.url || !urlPublicaSegura(p.url)) return { ok: false, erro: "Endereço do plugin não é permitido." };
  try {
    const r = await f(p.url, {
      method: "POST", redirect: "manual",
      headers: { "content-type": "application/json", ...(credencial ? { authorization: `Bearer ${credencial}` } : {}) },
      body: JSON.stringify({ sdk: "1", capacidade, entrada }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return { ok: false, erro: `O plugin respondeu ${r.status}.` };
    const texto = (await r.text()).slice(0, 20_000);
    try { return { ok: true, dados: JSON.parse(texto) }; } catch { return { ok: true, dados: texto }; }
  } catch {
    return { ok: false, erro: "O plugin não respondeu." };
  }
}

/** Teste de conexão (antes de ativar): mesma regra de URL e contrato, capacidade reservada "__teste__". Não exige plugin ativo. */
export async function testarPlugin(p: PluginRegistro, credencial: string | null, f: typeof fetch = fetch): Promise<{ ok: boolean; mensagem: string }> {
  if (p.tipo !== "api") return { ok: false, mensagem: `Teste automático só existe para o tipo api (este é ${p.tipo}).` };
  if (!p.url || !urlPublicaSegura(p.url)) return { ok: false, mensagem: "Endereço do plugin não é permitido (use https público, sem porta, usuário ou parâmetros)." };
  try {
    const r = await f(p.url, {
      method: "POST", redirect: "manual",
      headers: { "content-type": "application/json", ...(credencial ? { authorization: `Bearer ${credencial}` } : {}) },
      body: JSON.stringify({ sdk: "1", capacidade: "__teste__", entrada: {} }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok ? { ok: true, mensagem: "O plugin respondeu." } : { ok: false, mensagem: `O plugin respondeu ${r.status}.` };
  } catch {
    return { ok: false, mensagem: "O plugin não respondeu." };
  }
}
