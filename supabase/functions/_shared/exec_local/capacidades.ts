// Capacidades LOCAIS (Windows/Browser) vendor-neutral: o mesmo contrato serve a qualquer LLM.
// Fase 1: só contrato + validação + execução injetada (mock). Nada aqui abre processo nem toca em dispositivo.
import type { Risco } from "../conector/tipos.ts";

/** consulta = automática; proposta = gera registro sem efeito; aprovacao = humano aprova ESTA operação; escrita = desligada na fase 1. */
export type Camada = "consulta" | "proposta" | "aprovacao" | "escrita";
export type Executor = "windows" | "browser";

export interface CapacidadeLocal {
  id: string;
  executor: Executor;
  camada: Camada;
  risco: Risco;
  descricao: string;
  timeoutMs: number;
  /** parâmetros: nome -> regex ancorada. Qualquer parâmetro fora da lista é rejeitado. */
  parametros: Record<string, RegExp>;
  /** modelo FIXO do comando; {{p}} só recebe parâmetro já validado. Nunca texto livre vindo do LLM. */
  modelo: string;
  estado: "ativa" | "desligada";
}

const NOME = /^[A-Za-z0-9_.-]{1,40}$/;
const UNIDADE = /^[A-Za-z]:?$/;

export const CAPACIDADES_LOCAIS: readonly CapacidadeLocal[] = [
  { id: "windows.sistema.inventario", executor: "windows", camada: "consulta", risco: "LOW", timeoutMs: 15000, parametros: {}, estado: "ativa",
    descricao: "SO, versão, RAM e arquitetura (somente leitura).",
    modelo: "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture,TotalVisibleMemorySize | ConvertTo-Json -Compress" },
  { id: "windows.disco.livre", executor: "windows", camada: "consulta", risco: "LOW", timeoutMs: 15000, parametros: { unidade: UNIDADE }, estado: "ativa",
    descricao: "Espaço livre de uma unidade.",
    modelo: "Get-PSDrive -Name {{unidade}} | Select-Object Name,Used,Free | ConvertTo-Json -Compress" },
  { id: "windows.processo.existe", executor: "windows", camada: "consulta", risco: "LOW", timeoutMs: 15000, parametros: { nome: NOME }, estado: "ativa",
    descricao: "Informa se um processo está em execução (nome e contagem, sem linha de comando).",
    modelo: "Get-Process -Name {{nome}} -ErrorAction SilentlyContinue | Measure-Object | Select-Object Count | ConvertTo-Json -Compress" },
  { id: "windows.servico.estado", executor: "windows", camada: "consulta", risco: "LOW", timeoutMs: 15000, parametros: { nome: NOME }, estado: "ativa",
    descricao: "Estado de um serviço do Windows.",
    modelo: "Get-Service -Name {{nome}} -ErrorAction SilentlyContinue | Select-Object Name,Status | ConvertTo-Json -Compress" },
  { id: "windows.servico.reiniciar", executor: "windows", camada: "escrita", risco: "HIGH", timeoutMs: 30000, parametros: { nome: NOME }, estado: "desligada",
    descricao: "Reinicia serviço. DESLIGADA na fase 1.", modelo: "Restart-Service -Name {{nome}}" },
  { id: "browser.pagina.ler", executor: "browser", camada: "consulta", risco: "LOW", timeoutMs: 30000, parametros: { url: /^https:\/\/[a-z0-9.-]{1,100}\/[A-Za-z0-9._~\-\/?=&%]{0,200}$/ }, estado: "ativa",
    descricao: "Abre a URL em perfil ISOLADO (sem logins do dono) e devolve título e texto visível. Host precisa estar na lista da sessão.",
    modelo: "ler {{url}}" },
  { id: "browser.elemento.clicar", executor: "browser", camada: "aprovacao", risco: "MEDIUM", timeoutMs: 30000, parametros: { url: /^https:\/\/[a-z0-9.-]{1,100}\/[A-Za-z0-9._~\-\/?=&%]{0,200}$/, alvo: /^[A-Za-z0-9 _.\-]{1,80}$/ }, estado: "ativa",
    descricao: "Clica num elemento por rótulo/papel (nunca coordenada). Exige aprovação por operação.", modelo: "clicar {{url}} {{alvo}}" },
];
const POR_ID = new Map(CAPACIDADES_LOCAIS.map((c) => [c.id, c]));
export const buscarCapacidade = (id: string) => POR_ID.get(id);

export type ResultadoRender = { ok: true; comando: string } | { ok: false; motivo: string };

/** Valida parâmetros e monta o comando a partir do modelo fixo. */
export function renderizar(c: CapacidadeLocal, params: Record<string, unknown>): ResultadoRender {
  for (const k of Object.keys(params)) if (!(k in c.parametros)) return { ok: false, motivo: `parametro_desconhecido:${k}` };
  let cmd = c.modelo;
  for (const [k, re] of Object.entries(c.parametros)) {
    const v = params[k];
    if (typeof v !== "string" || !re.test(v)) return { ok: false, motivo: `parametro_invalido:${k}` };
    cmd = cmd.replaceAll(`{{${k}}}`, v);
  }
  return { ok: true, comando: cmd };
}

/** argv fixo do PowerShell: sem perfil, sem prompt, sem ExecutionPolicy relaxada, e o comando vai como UM argumento. */
export const argvPowerShell = (comando: string): string[] =>
  ["powershell.exe", "-NoProfile", "-NonInteractive", "-NoLogo", "-Command", comando];
