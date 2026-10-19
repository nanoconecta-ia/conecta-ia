// Monta o cadastro enriquecido SOMENTE com o que tem evidência. Todo atributo traz fonte, data da consulta, confiança e situação "a_confirmar".
// Nunca inventa peso, dimensões, GTIN, NCM, aplicação ou homologação. Nenhuma margem é somada às medidas reais do Bling.
import type { Extracao } from "./extracao.ts";
import { MOTORES_CONHECIDOS } from "./extracao.ts";
import type { Evidencia, TipoFonte } from "./comparacao.ts";
import { chave } from "./texto.ts";

export interface Atributo<T> { valor: T; fonte: string; consultado_em: string; confianca: "media" | "baixa"; situacao: "a_confirmar"; origem: TipoFonte | "cadastro" }
export interface Cadastro {
  sku: string;
  nome_comercial: Atributo<string> | null;
  marca: Atributo<string> | null;
  gtin: Atributo<string> | null;
  codigos_oem: Atributo<string>[];
  aplicacoes: Atributo<{ modelo: string; motor?: string; ano_inicio?: number; ano_fim?: number | null }>[];
  nao_se_aplica: Atributo<string> | null;
  medidas: { peso_kg: Atributo<number> | null; largura_cm: Atributo<number> | null; altura_cm: Atributo<number> | null; profundidade_cm: Atributo<number> | null };
  descricao_tecnica: Atributo<string> | null;
  seo: { slug: string; titulo: string; descricao: string } | null;
  pendencias: string[];
}
export interface EntradaBling { nome?: string; marca?: string; gtin?: string; peso_kg?: number; largura_cm?: number; altura_cm?: number; profundidade_cm?: number }

const MINUSC = new Set(["de", "da", "do", "dos", "das", "com", "para", "e", "em", "a", "o"]);
/** Limpa lixo de digitação ("***", "(O)", "MARCA:") e padroniza a caixa, sem acrescentar acentos nem palavras. */
export function padronizarNome(nome: string): string {
  const limpo = (nome ?? "").replace(/^[\s*\-–—]+/, "").replace(/^\([A-Za-z]\)\s*/, "").replace(/\bMARCA\s*:\s*/gi, "").replace(/\s+/g, " ").trim();
  return limpo.split(" ").map((t, i) => {
    if (/\d/.test(t) || t.includes("/") || MOTORES_CONHECIDOS.includes(t.toUpperCase())) return t.toUpperCase();
    if (i > 0 && MINUSC.has(t.toLowerCase())) return t.toLowerCase();
    if (t.length <= 3 && t === t.toUpperCase()) return t;
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }).join(" ");
}

export const slugify = (s: string) => chave(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const corta = (s: string, n: number) => s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "").trim();

export function montarCadastro(sku: string, entrada: EntradaBling, ext: Extracao, evidencias: Evidencia[], agora: string): Cadastro {
  const pend: string[] = [];
  const attr = <T>(valor: T, fonte: string, origem: Atributo<T>["origem"], confianca: Atributo<T>["confianca"] = "media"): Atributo<T> => ({ valor, fonte, consultado_em: agora, confianca, situacao: "a_confirmar", origem });
  const fonteBling = `bling:${sku}`;
  const nome = entrada.nome ? attr(padronizarNome(entrada.nome), fonteBling, "bling") : null;
  if (!nome) pend.push("nome ausente no cadastro");
  const marca = ext.marca_fabricante ? attr(padronizarNome(ext.marca_fabricante.replace(/^\s*MARCA\s*:\s*/i, "")), fonteBling, "bling") : null;
  if (!marca) pend.push("marca ausente");
  const gtin = ext.gtin ? (ext.gtin.valido ? attr(ext.gtin.valor, fonteBling, "bling") : (pend.push("GTIN do cadastro com dígito verificador inválido: não usado"), null)) : (pend.push("sem GTIN: não inventado"), null);
  const oem = ext.codigos_oem.map((c) => attr(c.normalizado, fonteBling, "cadastro", c.confianca));
  for (const c of ext.codigos_oem.filter((x) => x.confianca === "baixa")) pend.push(`código ${c.normalizado}: sem separador nem rótulo, confirmar se é da montadora`);
  const aplicacoes: Cadastro["aplicacoes"] = [];
  const excluidos = new Set(ext.excluido.motores.map((m) => m.toUpperCase().replace(/[^0-9A-Z]/g, "")));
  for (const ev of evidencias) for (const a of ev.dados.aplicacoes ?? []) {
    if (a.motor && excluidos.has(a.motor.toUpperCase().replace(/[^0-9A-Z]/g, ""))) { pend.push(`fonte ${ev.fonte} afirma aplicação no motor ${a.motor}, que o cadastro exclui (NÃO SE APLICA): não incluída`); continue; }
    aplicacoes.push(attr(a, ev.fonte, ev.tipo_fonte, ev.nao_confiavel ? "baixa" : "media"));
  }
  if (aplicacoes.length === 0) pend.push("sem aplicação por versão do veículo confirmada");
  const nsa = ext.nao_se_aplica ? attr(ext.nao_se_aplica, fonteBling, "bling") : null;
  if (!nsa) pend.push("sem bloco NÃO SE APLICA");
  const num = (v: number | undefined) => (typeof v === "number" && v > 0 ? attr(v, fonteBling, "bling") : null);
  const medidas = { peso_kg: num(entrada.peso_kg), largura_cm: num(entrada.largura_cm), altura_cm: num(entrada.altura_cm), profundidade_cm: num(entrada.profundidade_cm) };
  if (!medidas.peso_kg) pend.push("peso ausente: não inventado");
  if (!medidas.largura_cm || !medidas.altura_cm || !medidas.profundidade_cm) pend.push("dimensões ausentes ou incompletas: não inventadas");
  const partes: string[] = [];
  if (ext.aplicacao.veiculos_citados.length) partes.push(`Veículos citados no cadastro: ${ext.aplicacao.veiculos_citados.join(", ")}.`);
  if (ext.aplicacao.motores.length) partes.push(`Motor: ${ext.aplicacao.motores.join(", ")}${ext.aplicacao.emissoes.length ? ` (${ext.aplicacao.emissoes.join(", ")})` : ""}.`);
  if (ext.nao_se_aplica) partes.push(`Não se aplica: ${ext.nao_se_aplica}`);
  const desc = partes.length ? attr(partes.join(" "), fonteBling, "bling") : null;
  const seo = nome ? { slug: slugify(`${nome.valor} ${sku}`), titulo: corta(`${nome.valor} - ${sku}`, 60), descricao: corta(desc ? `${nome.valor}. ${desc.valor}` : nome.valor, 155) } : null;
  return { sku, nome_comercial: nome, marca, gtin, codigos_oem: oem, aplicacoes, nao_se_aplica: nsa, medidas, descricao_tecnica: desc, seo, pendencias: pend };
}
