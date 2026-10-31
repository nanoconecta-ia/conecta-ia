// Painel lateral do Nano Guardião — PILOTO SÓ LEITURA. Lê a tela do ERP aberta, reconhece o cadastro de produto pelo mapa
// (versão a confirmar), mostra o que falta e sugere tags. Não preenche nada, não envia nada a servidor ou IA.
import { MAPA_PRODUTO_BLING } from "./mapa-produto.ts";
import { reconhecer, type Reconhecimento } from "./reconhecer.ts";
import { sugerir } from "./sugestoes.ts";
import { estruturaParaRegistro, type Leitura } from "./registro.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
let ultima: { leitura: Leitura; r: Reconhecimento } | null = null;

/** Monta o painel a partir de uma leitura (exportado para o teste visual usar sem Chrome). */
export function mostrar(leitura: Leitura): void {
  const r = reconhecer(leitura.campos, MAPA_PRODUTO_BLING);
  const { sugestoes, pendencias } = sugerir(r);
  ultima = { leitura, r };
  const reconhecida = r.estado === "reconhecida";
  $("estado").innerHTML = reconhecida
    ? `<span class="ponto ok"></span>Cadastro de produto reconhecido <small>(mapa v${r.versaoMapa}${r.mapaConferido ? "" : " · a confirmar"})</small>`
    : `<span class="ponto atencao"></span>Tela não reconhecida <small>— o Nano não sugere nada aqui</small>`;
  $("site").textContent = `${leitura.origem}${leitura.caminho}`;
  const linhas = r.casados.map((c) => `<li><span class="rot">${esc(c.mapa.descricao)}</span><span class="val ${c.lido.mascarado ? "oculto" : c.lido.valor.trim() ? "" : "vazio"}">${c.lido.mascarado ? "oculto" : c.lido.valor.trim() ? esc(c.lido.valor.slice(0, 80)) : "vazio"}</span></li>`).join("");
  $("campos").innerHTML = reconhecida ? linhas : "";
  $("sugestoes").innerHTML = sugestoes.map((s) => `<li><b>${esc(s.campo)}</b><p>${esc(s.valor)}</p><small>Origem: ${esc(s.origem)}. Não aplicado: copie se quiser usar.</small></li>`).join("") || (reconhecida ? "<li class=\"suave\">Sem sugestões nesta tela.</li>" : "");
  $("pendencias").innerHTML = pendencias.map((p) => `<li><b>${esc(p.campo)}</b> <small>${esc(p.motivo)}</small></li>`).join("") || (reconhecida ? "<li class=\"suave\">Nenhum campo essencial vazio.</li>" : "");
  $("resultado").hidden = false;
  $("registrar").removeAttribute("disabled");
}

async function lerAbaAtual(): Promise<void> {
  const erro = $("erro"); erro.textContent = "";
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id || !aba.url || !/^https:\/\//.test(aba.url)) { erro.textContent = "Abra o cadastro de produto do ERP numa aba https e tente de novo."; return; }
  const origem = new URL(aba.url).origin;
  const ok = await chrome.permissions.request({ origins: [`${origem}/*`] });
  if (!ok) { erro.textContent = `Sem permissão para ler ${origem}. Nada foi lido.`; return; }
  await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ["conteudo.js"] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: () => window.__nanoGuardiaoLer?.() ?? null });
  if (!res?.result) { erro.textContent = "Não consegui ler esta página."; return; }
  mostrar(res.result as Leitura);
}

function registrar(): void {
  if (!ultima) return;
  const blob = new Blob([JSON.stringify(estruturaParaRegistro(ultima.leitura, ultima.r), null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nano-guardiao-tela-${Date.now()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

if (typeof chrome !== "undefined" && chrome.tabs) {
  $("ler").addEventListener("click", () => { void lerAbaAtual().catch(() => { $("erro").textContent = "Não consegui ler esta página."; }); });
  $("registrar").addEventListener("click", registrar);
}
(window as unknown as { __nanoMostrar?: typeof mostrar }).__nanoMostrar = mostrar;
