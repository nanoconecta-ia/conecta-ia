// Ponte "ficha do produto -> Nano.IA": monta o pedido de correção do produto selecionado. Função PURA (sem DOM, sem rede).
// O pedido só preenche a caixa do chat: quem envia é o lojista, e qualquer correção volta como PROPOSTA com fonte, para aprovação humana.
// Nunca inclui custo, fornecedor nem dado fiscal (a ficha também não os tem).
export interface FichaParaPedido {
  sku: string | null; nome: string | null; marca: string | null; gtin: string | null; peso_kg: number | null; imagens: number;
  categoria: string | null; taxonomia: string | null; descricaoVazia: boolean;
  /** Posição da taxonomia que o lojista quer propor (nome do caminho): vai como hipótese; o Nano confirma e propõe. */
  taxonomiaSugerida?: string;
  /** O que o lojista sabe e escreveu: entra como HIPÓTESE sem fonte, nunca como fato. */
  observacaoLojista?: string;
}

/** Valores que descrevem origem ou ausência, não o fabricante. Comparação sem acento e sem caixa. */
const GENERICAS = new Set(["importado", "importada", "nacional", "generico", "generica", "diversos", "diversas", "outros", "outras", "sem marca", "s/marca", "sem", "n/a", "na", "marca", "original", "similar", "paralelo"]);
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
const vazio = (s: string | null | undefined) => s == null || s.trim() === "";

/** A marca está preenchida com algo que não identifica fabricante (ex.: "IMPORTADO", "NACIONAL"). Vazia também conta. */
export function marcaGenerica(marca: string | null | undefined): boolean {
  if (vazio(marca)) return true;
  return GENERICAS.has(normalizar(marca!));
}

export function pendenciasDaFicha(f: FichaParaPedido): string[] {
  const p: string[] = [];
  if (vazio(f.marca)) p.push("Marca vazia: falta o fabricante.");
  else if (marcaGenerica(f.marca)) p.push(`Marca "${f.marca!.trim()}" não identifica o fabricante (é origem ou termo genérico): descobrir o fabricante real.`);
  if (vazio(f.gtin)) p.push("GTIN/EAN ausente.");
  if (f.peso_kg == null || f.peso_kg <= 0) p.push("Peso ausente.");
  if (f.imagens === 0) p.push("Sem imagem registrada.");
  if (f.descricaoVazia) p.push("Descrição curta e complementar vazias.");
  if (vazio(f.taxonomia) || /^(sem |pendente|—)/i.test(f.taxonomia!.trim())) p.push("Sem lugar definido na taxonomia.");
  return p;
}

const linha = (rotulo: string, v: string | null | undefined) => `- ${rotulo}: ${vazio(v) ? "(vazio)" : v!.trim()}`;

export function montarPedidoCorrecao(f: FichaParaPedido): string {
  const pend = pendenciasDaFicha(f);
  const obs = (f.observacaoLojista ?? "").trim().slice(0, 600);
  const partes = [
    `Corrigir o cadastro do produto SKU ${f.sku ?? "(sem SKU)"} — ${f.nome ?? "(sem nome)"}.`,
    "",
    "Dados atuais do espelho (somente leitura):",
    linha("Marca", f.marca), linha("GTIN/EAN", f.gtin), linha("Categoria Bling", f.categoria), linha("Taxonomia", f.taxonomia),
    `- Peso: ${f.peso_kg != null && f.peso_kg > 0 ? `${f.peso_kg} kg` : "(vazio)"}`, `- Imagens registradas: ${f.imagens}`,
    "",
    pend.length ? "Pendências detectadas:" : "Nenhuma lacuna básica detectada; confira apenas se os dados acima estão corretos.",
    ...pend.map((x, i) => `${i + 1}. ${x}`),
  ];
  if (f.taxonomiaSugerida) partes.push("", `Posição na taxonomia sugerida pelo lojista (hipótese, SEM fonte): ${f.taxonomiaSugerida}. Verifique se cabe e proponha a classificação com fonte.`);
  if (obs) partes.push("", `Informação do lojista (hipótese, SEM fonte: confirme antes de usar): ${obs}`);
  partes.push(
    "", "Regras:",
    "- Pesquise fontes confiáveis (catálogo do fabricante, embalagem/etiqueta, GTIN em base pública) e cite URL e data de cada uma.",
    "- SKU, nome do produto ou GTIN sozinhos não provam o fabricante, a aplicação nem a origem. Sem evidência, deixe \"a confirmar\".",
    "- Proponha cada correção como PROPOSTA, com fonte, data e nível de confiança. Você não aprova nem grava no Bling: a aprovação é da pessoa.",
    "- Não use nem mostre custo, fornecedor ou dado fiscal.",
  );
  return partes.join("\n");
}
