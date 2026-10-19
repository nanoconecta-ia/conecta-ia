// Regras do Studio: o que entra na prévia da PÁGINA PÚBLICA (só dado aprovado), prontidão para publicar e prévia de SEO derivada dos dados reais.
import type { DadosStudio } from "./conectorDados.ts";

export type TipoImagem = "real" | "gerada_ia" | "ilustrativa";
export const ROTULO_IMAGEM: Record<TipoImagem, string> = { real: "Foto real do produto", ilustrativa: "Imagem ilustrativa — não é a foto do produto", gerada_ia: "Gerada por IA — não é foto real" };

export interface Publico {
  imagens: DadosStudio["imagens"]; principal: DadosStudio["imagens"][number] | null;
  codigos: { tipo: string; valor: string }[]; aplicacoes: DadosStudio["aplicacoes"]; descricaoLonga: string | null;
}

/** Só o que o cliente final pode ver: imagem aprovada, códigos/aplicações/descrição aprovados. Pendente nunca vai para a prévia. */
export function dadosPublicos(s: DadosStudio): Publico {
  const imagens = s.imagens.filter((i) => i.aprovada);
  const longa = s.enriquecimento.find((e) => e.campo === "descricao_longa" && e.status === "aprovado");
  return {
    imagens, principal: imagens.find((i) => i.principal) ?? imagens[0] ?? null,
    codigos: s.codigos.filter((c) => c.status === "aprovado").map((c) => ({ tipo: c.tipo, valor: c.valor })),
    aplicacoes: s.aplicacoes.filter((a) => a.status === "aprovado"),
    descricaoLonga: typeof longa?.valor === "string" ? longa.valor : null,
  };
}

export function prontidao(s: DadosStudio): { chave: string; rotulo: string; ok: boolean }[] {
  const p = dadosPublicos(s);
  return [
    { chave: "sku", rotulo: "SKU", ok: !!s.produto.sku }, { chave: "preco", rotulo: "Preço", ok: s.produto.preco != null },
    { chave: "descricao", rotulo: "Descrição curta", ok: !!s.produto.descricao_curta }, { chave: "marca", rotulo: "Marca", ok: !!s.produto.marca },
    { chave: "imagem", rotulo: "Imagem principal aprovada", ok: !!p.principal }, { chave: "taxonomia", rotulo: "Categoria/taxonomia ligada", ok: !!s.taxonomia },
    { chave: "ativo", rotulo: "Produto ativo no Bling", ok: s.produto.situacao === "A" },
  ];
}

const corta = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…");
/** SEO derivado dos dados reais (nada inventado): título = nome; descrição = descrição curta. Avisa o que falta ou passa do limite. */
export function previaSeo(s: DadosStudio): { titulo: string; descricao: string; avisos: string[] } {
  const avisos: string[] = [];
  const nome = s.produto.nome ?? "";
  if (!nome) avisos.push("Produto sem nome.");
  else if (nome.length > 60) avisos.push(`O nome tem ${nome.length} caracteres; buscadores costumam cortar acima de 60.`);
  const d = s.produto.descricao_curta ?? "";
  if (!d) avisos.push("Sem descrição curta: o resumo nos buscadores ficará vazio.");
  else if (d.length > 155) avisos.push(`A descrição tem ${d.length} caracteres; acima de 155 costuma ser cortada.`);
  if (!dadosPublicos(s).principal) avisos.push("Sem imagem principal aprovada.");
  return { titulo: corta(nome, 60), descricao: corta(d, 155), avisos };
}
