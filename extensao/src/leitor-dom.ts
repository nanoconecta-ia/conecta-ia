// Lê os campos de formulário da página pela ÁRVORE DE ACESSIBILIDADE/rótulos (nunca por coordenada de tela).
// Só leitura: não dispara eventos, não foca, não altera valor. Roda no navegador do lojista, dentro da aba do ERP.
import type { CampoBruto } from "./leitura.ts";

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
