// Plano de consultas PROGRESSIVAS (especificação 02/11/2026, seção 3). Puro: monta as consultas na ordem das seis etapas, com orçamento e deduplicação.
// O QUE PROVA: as consultas só levam dado de identificação do produto (códigos, GTIN válido, descrição técnica); nunca custo, fornecedor, fiscal, CNPJ/CPF ou credencial;
// o total respeita o orçamento; SKU interno é consultado como SKU (não como código de fabricante); sem busca infinita.
// O QUE NÃO PROVA: que as consultas acham algo. Quem executa e valida é `investigacao.ts`.
import { gtinValido } from "../cadastro/regras_cadastro.ts";
import { FABRICANTES_INICIAIS, type CategoriaFabricante, type Fabricante } from "./fabricantes.ts";

export type Etapa = "codigo_fabricante" | "oem" | "gtin" | "descricao_motor_veiculo" | "catalogos_alternativos" | "imagens" | "reformulacao";
export interface DadosProduto {
  sku: string; codigo_fabricante?: string | null; oem?: string[]; gtin?: string | null; marca?: string | null;
  /** Nome/descrição técnica do produto (já sem fornecedor, custo ou fiscal; o planejador também filtra). */
  descricao: string; peca?: string | null; motor?: string | null; veiculo?: string | null; ano?: number | null; categoria?: CategoriaFabricante | null;
}
export interface Consulta { etapa: Etapa; texto: string; alvo: "web" | "imagens"; observacao?: string }
export interface Orcamento { max_consultas: number; max_por_etapa: number }
export const ORCAMENTO_PADRAO: Orcamento = { max_consultas: 6, max_por_etapa: 2 };
export interface Plano { consultas: Consulta[]; omitidas: number; avisos: string[] }

const PRIVADO = /(fornecedor|custo|compra|margem|lucro|cnpj|cpf|ncm|cfop|cest|senha|token|chave|e-?mail|telefone|whats|@|\b\d{2}[.\/]\d{3}[.\/]\d{3})/i;
/** Remove linhas/trechos sensíveis e limita o tamanho. */
export function limparTexto(t: string | null | undefined, max = 140): string {
  return (t ?? "").split(/[\n|;]+/).map((x) => x.trim()).filter((x) => x && !PRIVADO.test(x)).join(" ").replace(/\s+/g, " ").slice(0, max).trim();
}
const aspas = (c: string) => `"${c.replace(/"/g, "").trim()}"`;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function planejarConsultas(d: DadosProduto, orc: Orcamento = ORCAMENTO_PADRAO, lista: readonly Fabricante[] = FABRICANTES_INICIAIS): Plano {
  const avisos: string[] = [], todas: Consulta[] = [];
  const peca = limparTexto(d.peca ?? d.descricao, 80), motor = limparTexto(d.motor, 30), veiculo = limparTexto(d.veiculo, 40), marca = limparTexto(d.marca, 40);
  if (d.codigo_fabricante?.trim()) todas.push({ etapa: "codigo_fabricante", texto: `${aspas(d.codigo_fabricante)} ${peca}`.trim(), alvo: "web" });
  else avisos.push("Sem código de fabricante conhecido: o SKU interno é pesquisado como SKU, e NÃO é tratado como código de fabricante nem como OEM.");
  if (d.sku?.trim()) todas.push({ etapa: "codigo_fabricante", texto: `${aspas(d.sku)} ${peca}`.trim(), alvo: "web", observacao: "SKU interno (pode ser código do distribuidor)" });
  for (const o of (d.oem ?? []).filter((x) => x.trim())) todas.push({ etapa: "oem", texto: `${aspas(o)} ${peca}`.trim(), alvo: "web" });
  if (d.gtin?.trim()) {
    if (gtinValido(d.gtin.trim())) todas.push({ etapa: "gtin", texto: aspas(d.gtin.trim()), alvo: "web" });
    else avisos.push("GTIN informado tem dígito verificador inválido: não foi pesquisado.");
  }
  const desc = [peca, marca, motor, veiculo, d.ano ? String(d.ano) : ""].filter(Boolean).join(" ");
  if (desc.trim()) todas.push({ etapa: "descricao_motor_veiculo", texto: desc, alvo: "web" });
  const nomes = lista.filter((x) => d.categoria && x.categoria === d.categoria).slice(0, 5).map((x) => x.nome);
  if (peca && (motor || veiculo)) todas.push({ etapa: "catalogos_alternativos", texto: `${peca} ${motor || veiculo} catálogo referência cruzada${nomes.length ? " " + nomes.join(" OR ") : ""}`.trim(), alvo: "web" });
  const cod = d.codigo_fabricante?.trim() || d.sku?.trim();
  if (cod) todas.push({ etapa: "imagens", texto: `${aspas(cod)} ${marca || peca}`.trim(), alvo: "imagens" });

  // dedup, limite por etapa e total (ordem das etapas = prioridade)
  const vistos = new Set<string>(), porEtapa = new Map<Etapa, number>(), consultas: Consulta[] = []; let omitidas = 0;
  for (const c of todas) {
    const k = `${c.alvo}|${norm(c.texto)}`;
    if (vistos.has(k)) { omitidas++; continue; }
    vistos.add(k);
    const n = porEtapa.get(c.etapa) ?? 0;
    if (n >= orc.max_por_etapa || consultas.length >= orc.max_consultas) { omitidas++; continue; }
    porEtapa.set(c.etapa, n + 1); consultas.push(c);
  }
  if (omitidas) avisos.push(`${omitidas} consulta(s) fora do orçamento (máx. ${orc.max_consultas} no total e ${orc.max_por_etapa} por etapa).`);
  return { consultas, omitidas, avisos };
}

/** Reformulações quando a busca inicial não resolve: sinônimos técnicos e nomenclatura internacional, fornecidos como DADO (nada é inventado aqui). Respeita o orçamento restante. */
export function reformular(d: DadosProduto, sinonimos: Record<string, string[]>, jaFeitas: readonly string[], restante: number): Consulta[] {
  if (restante <= 0) return [];
  const peca = limparTexto(d.peca ?? d.descricao, 80), motor = limparTexto(d.motor, 30), veiculo = limparTexto(d.veiculo, 40);
  const feitas = new Set(jaFeitas.map(norm)), out: Consulta[] = [];
  const base = norm(peca);
  for (const [chave, alts] of Object.entries(sinonimos)) {
    if (!base.includes(norm(chave))) continue;
    for (const alt of alts) {
      const texto = `${limparTexto(alt, 60)} ${motor} ${veiculo}`.replace(/\s+/g, " ").trim();
      if (texto && !feitas.has(norm(texto)) && out.length < restante) { feitas.add(norm(texto)); out.push({ etapa: "reformulacao", texto, alvo: "web", observacao: `sinônimo de "${chave}"` }); }
    }
  }
  return out.slice(0, Math.min(restante, 2));
}
