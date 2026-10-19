// Conteúdo vindo de páginas, planilhas e catálogos externos é DADO, nunca instrução.
// Aqui ele é limpo de marcações ocultas e as linhas que parecem comandos para o agente são retiradas da extração e sinalizadas.
import { chave, semHtml } from "./texto.ts";

export interface AlertaConteudo { tipo: "instrucao_ao_agente" | "texto_oculto" | "referencia_a_ferramenta" | "sintaxe_de_chamada"; trecho: string }
export interface ConteudoSaneado { texto: string; alertas: AlertaConteudo[]; suspeito: boolean }

const INSTRUCAO: RegExp[] = [
  /\b(ignor[ae]r?|desconsider[ae]r?|esquec[ae]r?|disregard|forget)\b.{0,30}\b(instrucoes|instrucao|regras|anteriores|previous|prior|above|rules|instructions)\b/,
  /\b(voce|you)\b.{0,12}\b(agora|now)\b.{0,12}\b(e|sao|are)\b/,
  /\b(system prompt|prompt do sistema|mensagem do sistema|developer message)\b/,
  /\b(aprove|aprovar|aprovado|approve|publique|publicar|publish|execute|executar|apague|apagar|exclua|excluir|delete|libere|liberar)\b.{0,40}\b(produto|produtos|pedido|loja|bling|tudo|agora|imediatamente|now|everything|escrita|catalogo)\b/,
  /\b(responda|diga|escreva|reply|respond|say)\b.{0,25}\b(apenas|somente|sempre|only|always)\b/,
  /\b(nao|n[aã]o|do not|don't)\b.{0,20}\b(informe|avise|mencione|conte|tell|mention|reveal)\b.{0,30}\b(usuario|lojista|dono|user|owner)\b/,
];
const FERRAMENTA = /\b(bling|conecta|engenharia|dev)\.[a-z_]+\.[a-z_]+\b/i;
const CHAMADA = /(<\s*(tool|function_call|invoke|antml)|\b(functions?|tools?)\.[a-z_]+\s*\(|```\s*(json|tool))/i;

/** Remove o que o leitor humano não veria (comentários, scripts, elementos ocultos, caracteres invisíveis) e retira linhas com cara de comando. */
export function sanearConteudoExterno(bruto: string): ConteudoSaneado {
  const alertas: AlertaConteudo[] = [];
  let t = bruto ?? "";
  const ocultos = t.match(/<!--[\s\S]*?-->|<(script|style)[\s\S]*?<\/\1>|<[^>]+(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|aria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/[a-z0-9]+>/gi);
  for (const o of ocultos ?? []) alertas.push({ tipo: "texto_oculto", trecho: semHtml(o).slice(0, 120) || "(marcação oculta)" });
  t = t.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|aria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/[a-z0-9]+>/gi, " ");
  if (/[​-‏⁠﻿‪-‮]/.test(t)) {
    alertas.push({ tipo: "texto_oculto", trecho: "caracteres invisíveis removidos" });
    t = t.replace(/[​-‏⁠﻿‪-‮]/g, "");
  }
  const mantidas: string[] = [];
  for (const linha of semHtmlPorLinha(t)) {
    const k = chave(linha);
    if (INSTRUCAO.some((r) => r.test(k))) { alertas.push({ tipo: "instrucao_ao_agente", trecho: linha.slice(0, 160) }); continue; }
    if (CHAMADA.test(linha)) { alertas.push({ tipo: "sintaxe_de_chamada", trecho: linha.slice(0, 160) }); continue; }
    if (FERRAMENTA.test(linha)) { alertas.push({ tipo: "referencia_a_ferramenta", trecho: linha.slice(0, 160) }); continue; }
    mantidas.push(linha);
  }
  return { texto: mantidas.join("\n"), alertas, suspeito: alertas.length > 0 };
}

function semHtmlPorLinha(t: string): string[] {
  return t.replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, "\n").split(/\n+/).map((l) => semHtml(l)).filter((l) => l.length > 0);
}
