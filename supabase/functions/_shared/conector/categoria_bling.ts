// Escrita da categoria no Bling (desenho em docs/conector-ia/escrita-categoria-no-bling.md): PARTE PURA, só leitura.
// Resolve "nó aprovado da taxonomia -> categoria do Bling" e monta os itens de uma proposta de alteração de categoria.
// NÃO chama o Bling, NÃO grava no banco e NÃO liga nenhuma ferramenta: o resultado vai para criarPropostaVersionada
// (que cria a proposta e exige aprovação humana). A ferramenta bling.produtos.alterar continua desligada.
import { montarCorpoProduto } from "./bling_campos.ts";

/** Uma linha de bling_categoria_taxonomia já unida ao nome da categoria em bling_categorias. */
export interface Ponte { bling_categoria_id: string; nome: string; taxonomia_no_id: string }

export type Destino =
  | { tipo: "unico"; categoria_id: string; nome: string }
  | { tipo: "escolha"; candidatas: { id: string; nome: string }[] }
  | { tipo: "sem_equivalente" };

/** Nó -> categoria(s) do Bling pela ponte inversa. Várias categorias para o mesmo nó = o lojista escolhe; nenhuma = bloqueia. */
export function resolverDestino(taxonomiaNoId: string, pontes: readonly Ponte[]): Destino {
  const c = pontes.filter((p) => p.taxonomia_no_id === taxonomiaNoId);
  const unicas = [...new Map(c.map((p) => [p.bling_categoria_id, p])).values()];
  if (unicas.length === 0) return { tipo: "sem_equivalente" };
  if (unicas.length === 1) return { tipo: "unico", categoria_id: unicas[0].bling_categoria_id, nome: unicas[0].nome };
  return { tipo: "escolha", candidatas: unicas.map((p) => ({ id: p.bling_categoria_id, nome: p.nome })).sort((a, b) => a.nome.localeCompare(b.nome)) };
}

/** Um produto com sugestão de categoria APROVADA, como vem do banco. */
export interface Entrada {
  produto_id: string;
  sku: string | null;
  nome: string | null;
  bling_id: string;
  situacao: string | null;
  categoria_atual: string | null;     // categoria que o espelho tem hoje (o executor relê o Bling antes de gravar)
  taxonomia_no_id: string;            // nó aprovado
  no_nome: string;
  confianca: number | null;
  fonte: string | null;
}

export interface Opcoes {
  /** Categorias que existem no espelho do Bling (bling_categorias). Destino fora daqui é recusado. */
  categoriasExistentes: ReadonlySet<string>;
  /** Escolha do lojista para os casos ambíguos: produto_id -> id da categoria do Bling. */
  escolhas?: Readonly<Record<string, string>>;
  /** Produtos que ficam de fora com o motivo (ex.: cadastro provisório sem NF-e). */
  excluir?: ReadonlyMap<string, string>;
  confiancaMinima?: number;           // padrão 0,6
  apenasAtivos?: boolean;             // padrão true
  limiteLoteMedio?: number;           // acima disso o risco sobe para HIGH (padrão 5)
}

export interface ItemProposta {
  produto_id: string;
  sku: string | undefined;
  operacao: "bling.produtos.alterar";
  alvo: string;
  campos: ["categoria_bling_id"];
  antes: { categoria_bling_id: string | null };
  depois: { categoria_bling_id: string };
  fontes: { tipo: string; descricao: string; confianca: number | null }[];
  validacoes: string[];
  risco: "MEDIUM" | "HIGH";
}

export type Motivo = "inativo" | "confianca_baixa" | "excluido" | "ja_na_categoria" | "sem_equivalente" | "escolha_pendente" | "escolha_invalida" | "categoria_inexistente" | "corpo_recusado";
export interface Pendencia { produto_id: string; sku: string | null; motivo: Motivo; detalhe: string; candidatas?: { id: string; nome: string }[] }

export interface Resultado { itens: ItemProposta[]; pendencias: Pendencia[] }

/** Monta os itens da proposta. Quem não entra volta em `pendencias`, com o motivo. Só o campo categoria passa. */
export function montarItensCategoria(entradas: readonly Entrada[], pontes: readonly Ponte[], o: Opcoes): Resultado {
  const minima = o.confiancaMinima ?? 0.6;
  const apenasAtivos = o.apenasAtivos ?? true;
  const itens: ItemProposta[] = [];
  const pendencias: Pendencia[] = [];
  const pend = (e: Entrada, motivo: Motivo, detalhe: string, candidatas?: { id: string; nome: string }[]) =>
    pendencias.push({ produto_id: e.produto_id, sku: e.sku, motivo, detalhe, ...(candidatas ? { candidatas } : {}) });

  for (const e of entradas) {
    const fora = o.excluir?.get(e.produto_id);
    if (fora) { pend(e, "excluido", fora); continue; }
    if (apenasAtivos && e.situacao !== "A") { pend(e, "inativo", "produto inativo no Bling"); continue; }
    if (e.confianca == null || e.confianca < minima) { pend(e, "confianca_baixa", `confiança ${e.confianca ?? "desconhecida"} abaixo de ${minima}`); continue; }

    const d = resolverDestino(e.taxonomia_no_id, pontes);
    let destinoId: string;
    let destinoNome: string;
    if (d.tipo === "sem_equivalente") { pend(e, "sem_equivalente", `o nó "${e.no_nome}" não tem categoria equivalente no Bling`); continue; }
    if (d.tipo === "escolha") {
      const escolhida = o.escolhas?.[e.produto_id];
      if (!escolhida) { pend(e, "escolha_pendente", `o nó "${e.no_nome}" tem mais de uma categoria no Bling`, d.candidatas); continue; }
      const c = d.candidatas.find((x) => x.id === escolhida);
      if (!c) { pend(e, "escolha_invalida", `a categoria ${escolhida} não é uma das candidatas do nó "${e.no_nome}"`, d.candidatas); continue; }
      destinoId = c.id; destinoNome = c.nome;
    } else { destinoId = d.categoria_id; destinoNome = d.nome; }

    if (!o.categoriasExistentes.has(destinoId)) { pend(e, "categoria_inexistente", `a categoria ${destinoId} não existe no espelho do Bling`); continue; }
    if (e.categoria_atual === destinoId) { pend(e, "ja_na_categoria", "o produto já está nessa categoria"); continue; }

    // defesa em profundidade: o corpo que iria ao Bling precisa ser aceito pela lista fechada de campos
    const corpo = montarCorpoProduto({ categoria_bling_id: destinoId });
    if (corpo.erros.length) { pend(e, "corpo_recusado", corpo.erros.join("; ")); continue; }

    itens.push({
      produto_id: e.produto_id,
      sku: e.sku ?? undefined,
      operacao: "bling.produtos.alterar",
      alvo: e.bling_id,
      campos: ["categoria_bling_id"],
      antes: { categoria_bling_id: e.categoria_atual },
      depois: { categoria_bling_id: destinoId },
      fontes: [{ tipo: "decisao_do_lojista", descricao: e.fonte ?? `categoria sugerida aprovada: ${e.no_nome} -> ${destinoNome} (${destinoId})`, confianca: e.confianca }],
      validacoes: [
        `destino ${destinoId} (${destinoNome}) existe no espelho do Bling`,
        "somente o campo categoria; corpo validado contra a lista fechada de campos permitidos",
        "o executor relê o produto no Bling antes de gravar e bloqueia se a categoria de 'antes' mudou",
      ],
      risco: "MEDIUM",
    });
  }
  const limite = o.limiteLoteMedio ?? 5;
  if (itens.length > limite) for (const i of itens) i.risco = "HIGH";
  return { itens, pendencias };
}
