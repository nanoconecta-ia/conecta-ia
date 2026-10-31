// Lê os campos de formulário da página pela ÁRVORE DE ACESSIBILIDADE/rótulos (nunca por coordenada de tela).
// A LEITURA não dispara eventos, não foca e não altera valor. O preenchimento (fase 3, abaixo) só roda quando o lojista clica
// "Preencher" no painel, um campo por vez. Roda no navegador do lojista, dentro da aba do ERP.
import { chaveDe, ehSensivel, type CampoBruto } from "./leitura.ts";

function textoDoRotulo(el: HTMLElement, doc: Document): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return aria;
  const por = el.getAttribute("aria-labelledby");
  if (por) { const t = por.split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? "").join(" ").trim(); if (t) return t; }
  if (el.id) { const l = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l?.textContent?.trim()) return l.textContent; }
  const pai = el.closest("label"); if (pai?.textContent?.trim()) return pai.textContent;
  const ph = el.getAttribute("placeholder"); if (ph?.trim()) return ph;
  return el.getAttribute("title") ?? "";
}

function visivel(el: HTMLElement): boolean {
  if (el.hidden || el.closest("[hidden],[aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && (r.width > 0 || r.height > 0);
}

export function lerCamposDoDocumento(doc: Document = document): CampoBruto[] {
  const els = Array.from(doc.querySelectorAll<HTMLElement>("input, select, textarea, [role='textbox'], [role='combobox'], [contenteditable='true']"));
  return els.map((el) => {
    const tag = el.tagName.toLowerCase();
    const tipo = tag === "input" ? ((el as HTMLInputElement).type || "text").toLowerCase() : tag === "select" ? "select" : tag === "textarea" ? "textarea" : el.getAttribute("role") ?? "editavel";
    let valor = "";
    if (tag === "select") { const s = el as HTMLSelectElement; valor = s.selectedOptions[0]?.textContent?.trim() ?? s.value; }
    else if (tag === "input" && (tipo === "checkbox" || tipo === "radio")) valor = (el as HTMLInputElement).checked ? "sim" : "não";
    else if (tag === "input" || tag === "textarea") valor = (el as HTMLInputElement).value;
    else valor = el.textContent ?? "";
    return { rotulo: textoDoRotulo(el, doc), tipo, valor, id: el.id || undefined, nome: el.getAttribute("name") || undefined,
      obrigatorio: el.hasAttribute("required") || el.getAttribute("aria-required") === "true", visivel: visivel(el) };
  });
}

// ------------------------------------------------------------------ Fase 3: preencher UM campo, com OK do lojista
// Localiza pelo id/name lidos antes e confere o rótulo; sem rótulo igual, não mexe. Nunca clica, nunca envia formulário.
export interface AlvoCampo { rotulo: string; id?: string; nome?: string }
export interface ResultadoPreencher { ok: boolean; antes?: string; depois?: string; erro?: string }

function localizar(doc: Document, alvo: AlvoCampo): HTMLElement | null {
  const candidatos: HTMLElement[] = [];
  if (alvo.id) { const e = doc.getElementById(alvo.id); if (e) candidatos.push(e); }
  if (alvo.nome) candidatos.push(...Array.from(doc.getElementsByName(alvo.nome)) as HTMLElement[]);
  if (!candidatos.length) candidatos.push(...Array.from(doc.querySelectorAll<HTMLElement>("input, select, textarea")));
  const rot = chaveDe(alvo.rotulo);
  return candidatos.find((e) => chaveDe(textoDoRotulo(e, doc)) === rot && visivel(e)) ?? null;
}

const lerValor = (el: HTMLElement) => el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.textContent?.trim() ?? "") : (el as HTMLInputElement).value;

export function preencherCampo(doc: Document, alvo: AlvoCampo, valor: string): ResultadoPreencher {
  if (ehSensivel(alvo.rotulo)) return { ok: false, erro: "Campo sensível: o Nano não preenche." };
  const el = localizar(doc, alvo);
  if (!el) return { ok: false, erro: "Campo não encontrado na tela (a página mudou?). Nada foi alterado." };
  const tipo = el instanceof HTMLInputElement ? el.type : "";
  if (["password", "hidden", "file", "checkbox", "radio"].includes(tipo)) return { ok: false, erro: "Tipo de campo não suportado." };
  if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) return { ok: false, erro: "Campo bloqueado para edição no ERP." };
  const antes = lerValor(el);
  if (el instanceof HTMLSelectElement) {
    const alvoTxt = chaveDe(valor), i = Array.from(el.options).findIndex((o) => chaveDe(o.textContent ?? "") === alvoTxt);
    if (i < 0) return { ok: false, erro: "Esta opção não existe na lista do ERP: escolha à mão." };
    el.selectedIndex = i;
  } else {
    // setter nativo: funciona também em telas feitas com React/Vue, que observam o evento "input"
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, antes, depois: lerValor(el) };
}
