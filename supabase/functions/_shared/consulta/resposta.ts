// Monta a resposta ao cliente a partir do que o BANCO achou. Só entram fatos reais: produto publicado com estoque e aplicação aprovada
// para a versão, e as condições que o LOJISTA cadastrou (políticas). Prazo de entrega, frete, formas de pagamento e distância só aparecem
// se existirem no cadastro; do contrário viram "lacunas" (a conversa pede o CEP em vez de prometer). Sem nome de provedor de IA.
import type { Interpretacao } from "./interpretar.ts";

export interface ProdutoAchado { sku: string; nome: string; preco: number | null; estoque: number | null; base?: string; restricoes?: string | null; aviso?: string | null; url?: string | null }
export interface CondicoesLoja {
  nome: string; arrependimento_dias: number | null; garantia_legal_dias: number | null;
  entrega_texto: string | null; garantia_texto: string | null; troca_devolucao_texto: string | null;
  /** Só o que o lojista cadastrou e aprovou (rpc condicoes_comerciais). Ausente = não cadastrado. */
  formas_pagamento?: string[] | null;
  /** Regra de entrega aprovada para o CEP informado; ausente = sem CEP ou sem regra. */
  entrega_cep?: { tipo: string; prazo_dias_min: number | null; prazo_dias_max: number | null; valor_frete: number | null; frete_a_calcular: boolean; frete_gratis_acima: number | null } | null;
}
export interface RespostaConsulta {
  mensagem: string; precisa_perguntar: boolean; perguntas: string[]; produtos: ProdutoAchado[];
  condicoes: { arrependimento_dias?: number; garantia_legal_dias?: number; entrega?: string; garantia?: string; troca_devolucao?: string; pagamento?: string[]; entrega_prazo?: string };
  lacunas: string[]; aviso: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const t = (v: string | null | undefined) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 400) : null);

export function montarRespostaConsulta(i: Interpretacao, achados: ProdutoAchado[], loja: CondicoesLoja | null): RespostaConsulta {
  const lacunas: string[] = [];
  const cond: RespostaConsulta["condicoes"] = {};
  if (loja) {
    if (loja.arrependimento_dias && loja.arrependimento_dias > 0) cond.arrependimento_dias = loja.arrependimento_dias; else lacunas.push("prazo de arrependimento (lojista não informou)");
    if (loja.garantia_legal_dias && loja.garantia_legal_dias > 0) cond.garantia_legal_dias = loja.garantia_legal_dias; else lacunas.push("prazo de garantia legal (lojista não informou)");
    const e = t(loja.entrega_texto); if (e) cond.entrega = e; else lacunas.push("política de entrega e prazo (informe o CEP para calcular; lojista não cadastrou)");
    const g = t(loja.garantia_texto); if (g) cond.garantia = g;
    const d = t(loja.troca_devolucao_texto); if (d) cond.troca_devolucao = d;
    if (loja.formas_pagamento?.length) cond.pagamento = loja.formas_pagamento; else lacunas.push("formas de pagamento (não cadastradas)");
    const r = loja.entrega_cep;
    if (r && r.prazo_dias_max != null) {
      const prazo = r.prazo_dias_min != null && r.prazo_dias_min !== r.prazo_dias_max ? `${r.prazo_dias_min} a ${r.prazo_dias_max} dias` : `até ${r.prazo_dias_max} dias`;
      const frete = r.valor_frete == null ? "frete a calcular" : r.valor_frete === 0 ? "frete sem custo" : `frete ${brl(r.valor_frete)}`;
      cond.entrega_prazo = `${prazo} (${frete}${r.frete_gratis_acima ? `; sem custo acima de ${brl(r.frete_gratis_acima)}` : ""}), prazo cadastrado pela loja`;
    }
  } else lacunas.push("condições da loja");

  const produtos = achados.slice(0, 10);
  const precisaPerguntar = i.perguntas.length > 0 && produtos.length === 0;
  const partes: string[] = [];
  if (i.veiculo.modelo) partes.push(`Veículo entendido: ${i.veiculo.montadora ?? ""} ${i.veiculo.modelo}${i.veiculo.ano ? ` ${i.veiculo.ano}` : ""}.`.replace("  ", " "));
  if (produtos.length) {
    partes.push(`Encontrei ${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"} com aplicação confirmada para este veículo em ${loja?.nome ?? "nossa loja"}:`);
    for (const p of produtos) partes.push(`- ${p.nome} (cód. ${p.sku})${p.preco != null ? ` — ${brl(p.preco)}` : ""}${p.base === "motor" ? " — confirmada pelo motor; confira a versão antes de comprar" : ""}`);
  } else if (i.veiculo.modelo && i.pecas.length) {
    partes.push("Não há produto com aplicação confirmada para este veículo no momento. Isso significa NÃO CONFIRMADO, não incompatível: posso chamar um atendente para checar.");
  }
  if (precisaPerguntar || (i.perguntas.length && produtos.length)) partes.push(...i.perguntas);
  const g: string[] = [];
  if (cond.arrependimento_dias) g.push(`arrependimento em ${cond.arrependimento_dias} dias na compra a distância`);
  if (cond.garantia_legal_dias) g.push(`garantia legal de ${cond.garantia_legal_dias} dias`);
  if (g.length && produtos.length) partes.push(`Condições da loja: ${g.join("; ")}.`);
  if (cond.entrega_prazo && produtos.length) partes.push(`Entrega para o seu CEP: ${cond.entrega_prazo}.`);
  else if (cond.entrega && produtos.length) partes.push(`Entrega: ${cond.entrega}`);
  if (cond.pagamento && produtos.length) partes.push(`Pagamento: ${cond.pagamento.join(", ")}.`);
  return {
    mensagem: partes.join("\n"), precisa_perguntar: precisaPerguntar, perguntas: i.perguntas, produtos, condicoes: cond, lacunas,
    aviso: "Só inclui produto publicado, com estoque e aplicação aprovada. Prazos, frete e pagamento só aparecem se a loja cadastrou; direitos do consumidor seguem o Código de Defesa do Consumidor (revisão jurídica do texto da loja é do lojista).",
  };
}
