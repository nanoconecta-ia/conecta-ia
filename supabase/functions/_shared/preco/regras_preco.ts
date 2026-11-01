// Regras PURAS da proposta de troca de PREÇO DE VENDA pelo Nano.IA (decisão do dono, 01/11/2026; docs/ARQUITETURA.md, seção 10, decisão 10).
// O QUE PROVA: só preço de venda; nada de custo, preço de compra, margem, fornecedor ou dado fiscal; valor novo válido; diferença calculada pelo
// servidor a partir do preço do ESPELHO; a proposta nasce sempre pendente de aprovação humana (MEDIUM) com idempotency_key estável.
// O QUE NÃO PROVA: que o preço é comercialmente bom (decisão da pessoa) nem executa nada: escrita no Bling continua DESLIGADA (bling_ferramentas.ts).
export interface EntradaPreco { sku: string; preco_novo: number; motivo: string }
export interface ContextoPreco { lojaId: string; precoAtual: number | null }
export interface PropostaPreco {
  sku: string; preco_atual: number; preco_novo: number; diferenca: number; percentual: number; motivo: string;
  alertas: string[]; risco: "MEDIUM"; exige_aprovacao: true; campo: "preco"; idempotency_key: string;
}
export type ResultadoPreco = { ok: true; proposta: PropostaPreco } | { ok: false; erro: string };

/** Termos que nunca podem aparecer no motivo (mesma barreira usada nos pedidos ao provedor de IA). */
const PRIVADO = /\b(custo|margem|fornecedor|compra|pre[cç]o\s+de\s+compra|lucro|cnpj|cpf|ncm|cfop|cest|tribut\w*|senha|token)\b/i;
const CHAVES = new Set(["sku", "preco_novo", "motivo"]);
const LIMITE_ALTA = 20;       // % a partir da qual a proposta carrega alerta de variação alta (sugestão; quem decide é a pessoa)
const LIMITE_ABSURDO = 1000;  // % acima disso é quase certamente erro de digitação: recusa
const PRECO_MAXIMO = 10_000_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function chaveIdempotenciaPreco(lojaId: string, sku: string, precoAtual: number, precoNovo: number): string {
  return `preco:${lojaId}:${sku}:${r2(precoAtual).toFixed(2)}>${r2(precoNovo).toFixed(2)}`;
}

export function validarPropostaPreco(e: unknown, ctx: ContextoPreco): ResultadoPreco {
  if (!e || typeof e !== "object" || Array.isArray(e)) return { ok: false, erro: "Entrada inválida." };
  const x = e as Record<string, unknown>;
  const extras = Object.keys(x).filter((k) => !CHAVES.has(k));
  if (extras.length) return { ok: false, erro: `Só o preço de venda pode ser proposto. Campos não aceitos: ${extras.slice(0, 5).join(", ")}.` };
  if (typeof x.sku !== "string" || !x.sku.trim() || x.sku.length > 80) return { ok: false, erro: "Informe o SKU do produto." };
  if (typeof x.preco_novo !== "number" || !Number.isFinite(x.preco_novo) || x.preco_novo <= 0 || x.preco_novo > PRECO_MAXIMO) return { ok: false, erro: "O preço novo precisa ser um número maior que zero." };
  if (Math.abs(x.preco_novo * 100 - Math.round(x.preco_novo * 100)) > 1e-6) return { ok: false, erro: "O preço novo aceita no máximo 2 casas decimais." };
  const motivo = typeof x.motivo === "string" ? x.motivo.trim() : "";
  if (motivo.length < 10 || motivo.length > 300) return { ok: false, erro: "Explique o motivo em 10 a 300 caracteres." };
  if (PRIVADO.test(motivo)) return { ok: false, erro: "O motivo não pode citar custo, margem, fornecedor, compra nem dado fiscal." };
  if (ctx.precoAtual == null || !Number.isFinite(ctx.precoAtual) || ctx.precoAtual <= 0) return { ok: false, erro: "O produto não tem preço de venda no espelho para comparar. Sincronize com o Bling antes de propor." };
  const novo = r2(x.preco_novo), atual = r2(ctx.precoAtual);
  if (novo === atual) return { ok: false, erro: "O preço novo é igual ao atual." };
  const diferenca = r2(novo - atual), percentual = r2((diferenca / atual) * 100);
  if (Math.abs(percentual) > LIMITE_ABSURDO) return { ok: false, erro: `Variação de ${percentual}% parece erro de digitação. Confira o valor.` };
  const alertas: string[] = [];
  if (Math.abs(percentual) >= LIMITE_ALTA) alertas.push(`Variação alta (${percentual > 0 ? "+" : ""}${percentual}%): confirme antes de aprovar.`);
  alertas.push("O preço no site só muda depois que o Bling for atualizado e sincronizado de volta.");
  return { ok: true, proposta: {
    sku: x.sku.trim(), preco_atual: atual, preco_novo: novo, diferenca, percentual, motivo, alertas, risco: "MEDIUM", exige_aprovacao: true, campo: "preco",
    idempotency_key: chaveIdempotenciaPreco(ctx.lojaId, x.sku.trim(), atual, novo),
  } };
}
