// Correção de CADASTRO sem IA: monta o pedido de proposta a partir do que a pessoa digitou. Função PURA.
// Só campos de cadastro permitidos (marca, GTIN, peso, descrição curta). Nada de preço, custo, fiscal ou estoque.
// O servidor revalida tudo e só cria a PROPOSTA; quem aprova é a pessoa, na fila. Nada é gravado no Bling aqui.
import { marcaGenerica } from "./pedidoCorrecao.ts";

export interface EntradaCorrecao { marca?: string; gtin?: string; pesoKg?: string; descricaoCurta?: string; fonte?: string }
export type PedidoCorrecao = { ok: true; campos: Record<string, string | number>; fonte: string } | { ok: false; erro: string };

const gtinValido = (g: string) => {
  if (!/^\d{8}$|^\d{12,14}$/.test(g)) return false;
  const d = g.split("").map(Number), dv = d.pop()!; // dígito verificador GS1
  const soma = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
};
const PRIVADO = /\b(custo|margem|fornecedor|compra|ncm|cfop|cest|tribut\w*|senha|token)\b/i;

export function montarPedidoCorrecao(e: EntradaCorrecao): PedidoCorrecao {
  const campos: Record<string, string | number> = {};
  const marca = (e.marca ?? "").trim(), gtin = (e.gtin ?? "").replace(/\s/g, ""), peso = (e.pesoKg ?? "").trim().replace(",", "."), desc = (e.descricaoCurta ?? "").trim();
  const fonte = (e.fonte ?? "").trim();
  if (marca) {
    if (marca.length > 80) return { ok: false, erro: "A marca tem no máximo 80 caracteres." };
    if (marcaGenerica(marca)) return { ok: false, erro: `"${marca}" não identifica o fabricante (é origem ou termo genérico). Informe o fabricante real.` };
    campos.marca = marca;
  }
  if (gtin) {
    if (!gtinValido(gtin)) return { ok: false, erro: "GTIN/EAN inválido (8, 12, 13 ou 14 dígitos com dígito verificador correto)." };
    campos.gtin = gtin;
  }
  if (peso) {
    const n = Number(peso);
    if (!Number.isFinite(n) || n <= 0 || n > 5000) return { ok: false, erro: "Peso inválido: informe em kg, maior que zero." };
    campos.pesoLiquido = Math.round(n * 1000) / 1000;
  }
  if (desc) {
    if (desc.length < 10 || desc.length > 500) return { ok: false, erro: "A descrição curta deve ter de 10 a 500 caracteres." };
    if (/[<>]/.test(desc)) return { ok: false, erro: "Descrição só com texto: sem HTML, SVG ou emoji gravado no ERP." };
    if (PRIVADO.test(desc)) return { ok: false, erro: "A descrição não pode citar custo, fornecedor, compra nem dado fiscal." };
    campos.descricaoCurta = desc;
  }
  if (!Object.keys(campos).length) return { ok: false, erro: "Preencha ao menos um campo para corrigir." };
  if (fonte.length < 5 || fonte.length > 500) return { ok: false, erro: "Informe a fonte (URL do fabricante ou documento) dos valores. Sem fonte não há proposta." };
  return { ok: true, campos, fonte };
}
