// Fase 2: compara a TELA do ERP com o ESPELHO do Conecta.IA (o mesmo produto, pelo SKU) e prepara propostas com fonte.
// Puro. Diferença tela x espelho = espelho desatualizado ou cadastro mudou depois da última sincronização; o Nano só avisa.
import { chaveDe } from "./leitura.ts";
import type { Reconhecimento } from "./reconhecer.ts";

export interface ProdutoEspelho { nome?: string | null; sku?: string | null; marca?: string | null; gtin?: string | null; descricao_curta?: string | null; peso_kg?: number | null; publicado?: boolean; faltando_para_publicar?: string[]; automacao_pausada?: boolean }
export interface Divergencia { campo: string; tela: string; espelho: string }

const norm = (v: unknown) => chaveDe(String(v ?? ""));
const COMPARAR: [canonico: string, campoEspelho: keyof ProdutoEspelho, rotulo: string][] = [["nome", "nome", "Nome"], ["marca", "marca", "Marca"], ["gtin", "gtin", "GTIN/EAN"], ["descricaoCurta", "descricao_curta", "Descrição curta"]];

export function compararComEspelho(r: Reconhecimento, p: ProdutoEspelho): Divergencia[] {
  const saida: Divergencia[] = [];
  for (const [can, campo, rotulo] of COMPARAR) {
    const lido = r.casados.find((c) => c.mapa.canonico === can)?.lido;
    if (!lido || lido.mascarado) continue;
    const tela = lido.valor.trim(), esp = String(p[campo] ?? "").trim();
    if (norm(tela) !== norm(esp)) saida.push({ campo: rotulo, tela: tela || "(vazio)", espelho: esp || "(vazio)" });
  }
  return saida;
}

/** Campos da tela que viram proposta no Conecta.IA e a ferramenta do gateway que aceita cada um (lista fechada do servidor). */
export const PROPONIVEIS: Record<string, { ferramenta: "conecta.propose_enrichment"; campo: string } | { ferramenta: "conecta.propose_code"; tipo: "ean" }> = {
  marca: { ferramenta: "conecta.propose_enrichment", campo: "marca_peca" },
  descricaoCurta: { ferramenta: "conecta.propose_enrichment", campo: "descricao_curta" },
  descricaoComplementar: { ferramenta: "conecta.propose_enrichment", campo: "descricao_longa" },
  pesoLiquido: { ferramenta: "conecta.propose_enrichment", campo: "peso_kg" },
  categoria: { ferramenta: "conecta.propose_enrichment", campo: "categoria_sugerida" },
  gtin: { ferramenta: "conecta.propose_code", tipo: "ean" },
  tags: { ferramenta: "conecta.propose_enrichment", campo: "tags" },
  seoTitulo: { ferramenta: "conecta.propose_enrichment", campo: "seo_titulo" },
  seoDescricao: { ferramenta: "conecta.propose_enrichment", campo: "seo_descricao" },
};
const ESPEC = /^espec:[a-z0-9_]{2,30}$/;

/** Monta a chamada da proposta. Fonte é obrigatória (URL https ou documento); sem SKU não há proposta. Nunca grava no ERP. */
export function montarProposta(canonico: string, sku: string, valor: string, fonte: string): { ferramenta: string; args: Record<string, unknown> } {
  // especificação técnica / campo customizado do ERP: canonico = "espec:<campo>"
  const alvo = ESPEC.test(canonico) ? { ferramenta: "conecta.propose_enrichment" as const, campo: canonico } : PROPONIVEIS[canonico];
  if (!alvo) throw new Error("Este campo não aceita proposta pelo Nano.");
  const v = valor.trim(), f = fonte.trim(), s = sku.trim();
  if (!s) throw new Error("Sem SKU na tela: não dá para saber qual produto propor.");
  if (!v) throw new Error("Informe o valor.");
  if (f.length < 5) throw new Error("Informe a fonte (link do fabricante, catálogo ou documento). Sem fonte não há proposta.");
  if (canonico === "gtin" && !/^\d{8}$|^\d{12,14}$/.test(v)) throw new Error("GTIN/EAN deve ter 8, 12, 13 ou 14 dígitos.");
  if (canonico === "pesoLiquido" && !(Number(v.replace(",", ".")) > 0)) throw new Error("Peso deve ser um número maior que zero (kg).");
  if (canonico === "seoTitulo" && (v.length < 10 || v.length > 70)) throw new Error("Título SEO deve ter de 10 a 70 caracteres.");
  if (canonico === "seoDescricao" && (v.length < 50 || v.length > 160)) throw new Error("Descrição SEO deve ter de 50 a 160 caracteres.");
  if (canonico === "tags") { const t = v.split(",").map((x) => x.trim()).filter(Boolean); if (t.length > 20 || t.some((x) => x.length > 40)) throw new Error("Até 20 tags, cada uma com até 40 caracteres."); }
  if (ESPEC.test(canonico) && v.length > 200) throw new Error("Especificação deve ter até 200 caracteres.");
  return alvo.ferramenta === "conecta.propose_code"
    ? { ferramenta: alvo.ferramenta, args: { sku: s, tipo: alvo.tipo, valor: v, fonte: f.slice(0, 400) } }
    : { ferramenta: alvo.ferramenta, args: { sku: s, campo: alvo.campo, valor: canonico === "pesoLiquido" ? v.replace(",", ".") : v.slice(0, 2000), fonte: f.slice(0, 400) } };
}
