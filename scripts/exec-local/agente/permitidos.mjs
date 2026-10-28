// Lista permitida LOCAL do agente: defesa em profundidade. Mesmo que o servidor seja comprometido, o agente só roda
// um argv que case EXATAMENTE com o modelo fixo de uma capacidade de consulta (parâmetros por regex ancorada).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function compilar(capacidades) {
  return capacidades.map((c) => {
    const partes = c.modelo.split(/(\{\{[a-z_]+\}\})/);
    const re = partes.map((p) => { const m = /^\{\{([a-z_]+)\}\}$/.exec(p); return m ? `(?:${c.parametros[m[1]].replace(/^\^/, "").replace(/\$$/, "")})` : esc(p); }).join("");
    return { id: c.id, timeoutMs: c.timeoutMs, re: new RegExp(`^${re}$`) };
  });
}
const FIXOS = ["powershell.exe", "-NoProfile", "-NonInteractive", "-NoLogo", "-Command"];
/** Devolve a capacidade que autoriza este argv, ou null. `capacidadeId` é a capacidade que o servidor DIZ estar executando:
 *  o comando precisa casar com o modelo DESSA capacidade (formato válido de outra capacidade, ou de comando qualquer, é recusado). */
export function autorizar(argv, tabela, capacidadeId) {
  if (typeof capacidadeId !== "string") return null;
  if (!Array.isArray(argv) || argv.length !== 6 || argv.some((a) => typeof a !== "string")) return null;
  if (FIXOS.some((f, i) => argv[i] !== f)) return null;
  if (/[\r\n\u0000]/.test(argv[5])) return null;
  return tabela.find((c) => c.id === capacidadeId && c.re.test(argv[5])) ?? null;
}
