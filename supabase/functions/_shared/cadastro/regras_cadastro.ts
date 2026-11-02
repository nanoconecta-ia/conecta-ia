// Regras PURAS do rascunho de PRODUTO NOVO proposto pelo Nano.IA (F3; ordem do dono, 02/11/2026).
// O QUE PROVA: só campos de cadastro permitidos; código (SKU) bem formado; GTIN com dígito verificador; marca com evidência (regras_marca);
// nenhum custo, fornecedor, estoque ou dado fiscal vindo do pedido; o fiscal (NCM/CEST/CFOP) NÃO é proposto aqui (fica "a confirmar", com contador);
// a proposta lista o que ainda falta para o produto poder ser publicado; idempotency_key estável por loja e código.
// O QUE NÃO PROVA: que o produto não existe no Bling (o handler confere duplicidade lendo o Bling agora) nem grava nada: quem escreve é o executor, depois da aprovação.
import { validarMarca, type FonteMarca } from "./regras_marca.ts";

export const CAMPOS_RASCUNHO = ["codigo", "nome", "marca", "gtin", "descricao_curta", "descricao_complementar", "peso_kg", "largura_cm", "altura_cm", "profundidade_cm", "categoria_bling_id", "preco_venda", "origem"] as const;
const FISCAL = /^(ncm|cest|cfop|cst|csosn|origem_fiscal|tributacao|icms|ipi|pis|cofins)$/i;
const PRIVADO_CAMPO = /^(custo|preco_?custo|preco_?compra|compra|fornecedor\w*|margem|lucro|estoque|saldo)$/i;
const PRIVADO_TEXTO = /\b(custo|margem|fornecedor|pre[cç]o\s+de\s+compra|lucro|cnpj|cpf|senha|token)\b/i;
const ORIGENS = new Set(["bling", "nota_fiscal", "manual"]);

export interface ContextoRascunho { lojaId: string; porPessoa?: boolean }
export interface PropostaCadastro {
  codigo: string;
  /** Nomes do Conecta.IA (montarCorpoCriacao converte no corpo do Bling). */
  depois: Record<string, unknown>;
  pendencias: string[];
  validacoes: string[];
  origem: { tipo: "bling" | "nota_fiscal" | "manual"; ref?: string };
  idempotency_key: string;
}
export type ResultadoRascunho = { ok: true; proposta: PropostaCadastro } | { ok: false; erros: string[] };

export function gtinValido(v: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(v)) return false;
  const d = v.split("").map(Number), dv = d.pop()!;
  const soma = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}
export const chaveIdempotenciaCadastro = (lojaId: string, codigo: string) => `cadastro:${lojaId}:${codigo}`;

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;

export function validarRascunho(r: unknown, fontes: FonteMarca[] | undefined, ctx: ContextoRascunho): ResultadoRascunho {
  if (!r || typeof r !== "object" || Array.isArray(r)) return { ok: false, erros: ["Rascunho inválido."] };
  const x = r as Record<string, unknown>;
  const erros: string[] = [];
  for (const k of Object.keys(x)) {
    if (FISCAL.test(k)) erros.push(`${k}: dado fiscal não é proposto no cadastro novo; fica "a confirmar" para o contador, com fonte pública.`);
    else if (PRIVADO_CAMPO.test(k)) erros.push(`${k}: custo, fornecedor, margem e estoque nunca entram no cadastro proposto pelo agente.`);
    else if (!(CAMPOS_RASCUNHO as readonly string[]).includes(k)) erros.push(`${k}: campo não aceito no cadastro novo.`);
  }
  if (!fontes || fontes.length === 0) erros.push("Informe ao menos uma fonte do cadastro.");
  const codigo = typeof x.codigo === "string" ? x.codigo.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(codigo)) erros.push("codigo: use 3 a 40 caracteres (letras, números, ponto, hífen ou sublinhado).");
  const nome = typeof x.nome === "string" ? x.nome.trim() : "";
  if (nome.length < 5 || nome.length > 120) erros.push("nome: de 5 a 120 caracteres.");
  for (const k of ["nome", "descricao_curta", "descricao_complementar"] as const) {
    if (typeof x[k] === "string" && PRIVADO_TEXTO.test(x[k] as string)) erros.push(`${k}: não pode citar custo, margem, fornecedor nem dado pessoal.`);
    if (x[k] !== undefined && (typeof x[k] !== "string" || /[<>]/.test(x[k] as string))) erros.push(`${k}: só texto simples.`);
  }
  if (x.gtin !== undefined && !(typeof x.gtin === "string" && gtinValido(x.gtin))) erros.push("gtin: dígito verificador inválido ou tamanho diferente de 8, 12, 13 e 14.");
  for (const k of ["peso_kg", "largura_cm", "altura_cm", "profundidade_cm"] as const) if (x[k] !== undefined && !num(x[k])) erros.push(`${k}: número maior que zero.`);
  if (x.categoria_bling_id !== undefined && !(typeof x.categoria_bling_id === "string" && /^\d{1,20}$/.test(x.categoria_bling_id))) erros.push("categoria_bling_id: id numérico de categoria que já existe no Bling.");
  if (x.preco_venda !== undefined && !(num(x.preco_venda) && (x.preco_venda as number) <= 10_000_000 && Math.abs((x.preco_venda as number) * 100 - Math.round((x.preco_venda as number) * 100)) < 1e-6)) erros.push("preco_venda: preço de VENDA maior que zero, até 2 casas decimais.");
  let origem: PropostaCadastro["origem"] = { tipo: "manual" };
  if (x.origem !== undefined) {
    const o = x.origem as Record<string, unknown>;
    if (!o || typeof o !== "object" || !ORIGENS.has(String(o.tipo))) erros.push("origem: tipo deve ser bling, nota_fiscal ou manual.");
    else origem = { tipo: o.tipo as PropostaCadastro["origem"]["tipo"], ref: typeof o.ref === "string" ? o.ref.slice(0, 120) : undefined };
  }
  const validacoes: string[] = [`origem do cadastro: ${origem.tipo}${origem.ref ? ` (${origem.ref})` : ""}`];
  let marca: string | undefined;
  if (x.marca !== undefined) {
    const vm = validarMarca(x.marca, fontes, { textosDoCadastro: [nome, x.descricao_curta as string, x.descricao_complementar as string], porPessoa: ctx.porPessoa });
    if (!vm.ok) erros.push(`marca: ${vm.erro}`);
    else { marca = vm.marca; validacoes.push(`marca: evidência ${vm.evidencia}${vm.verificada ? "" : " (não verificada)"}${vm.aviso ? ` — ${vm.aviso}` : ""}`); }
  }
  if (erros.length) return { ok: false, erros };

  const depois: Record<string, unknown> = { codigo, nome };
  for (const k of ["gtin", "descricao_curta", "descricao_complementar", "peso_kg", "largura_cm", "altura_cm", "profundidade_cm", "categoria_bling_id", "preco_venda"] as const) if (x[k] !== undefined) depois[k] = x[k];
  if (marca) depois.marca = marca;
  const pendencias = [
    ...(marca ? [] : ["marca a confirmar (nunca inventada)"]),
    ...(depois.gtin ? [] : ["GTIN a confirmar"]),
    ...(depois.peso_kg && depois.largura_cm && depois.altura_cm && depois.profundidade_cm ? [] : ["peso e medidas a confirmar"]),
    ...(depois.categoria_bling_id ? [] : ["categoria do Bling a definir"]),
    ...(depois.descricao_complementar ? [] : ["descrição completa a escrever"]),
    ...(depois.preco_venda ? [] : ["preço de venda a definir pelo lojista"]),
    "dados fiscais (NCM, CEST, CFOP) a confirmar com o contador; não propostos aqui",
    "imagens a cadastrar e aprovar",
  ];
  return { ok: true, proposta: { codigo, depois, pendencias, validacoes, origem, idempotency_key: chaveIdempotenciaCadastro(ctx.lojaId, codigo) } };
}
