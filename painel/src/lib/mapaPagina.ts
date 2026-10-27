// Mapa mental da página: a tela atual vira uma ÁRVORE (seções, números e pontos de atenção) que o lojista explora no painel lateral
// e que o Nano.ia usa como contexto. Só contagens e rótulos: nunca custo, preço de compra, dado fiscal nem fornecedor.
// Puro e testável (sem DOM).
export type Tom = "ok" | "atencao" | "erro" | "neutro";
export interface MapaNo { id: string; rotulo: string; valor?: number | string; tom?: Tom; dica?: string; filhos?: MapaNo[] }

/** Chaves que NUNCA entram no mapa nem no resumo (regra do projeto: custo, fiscal e fornecedor não vão a provedor de IA). */
const PROIBIDAS = /(custo|compra|margem|ncm|cfop|cest|cst|icms|fiscal|tribut|fornecedor|importador|senha|token|chave)/i;
export const rotuloPermitido = (r: string) => !PROIBIDAS.test(r);

/** Remove (recursivamente) qualquer nó cujo rótulo ou dica toque em assunto proibido. Defesa em profundidade: quem monta o mapa já filtra. */
export function higienizar(no: MapaNo): MapaNo | null {
  if (!rotuloPermitido(no.rotulo) || (no.dica && !rotuloPermitido(no.dica))) return null;
  const filhos = (no.filhos ?? []).map(higienizar).filter((f): f is MapaNo => f !== null);
  return { ...no, ...(no.filhos ? { filhos } : {}) };
}

export interface Contagens {
  total: number; publicados: number; inativos: number; semCategoria: number; semLugarNaTaxonomia: number; incompletos: number;
  faltando: Record<string, number>;                       // campo vazio -> quantos produtos
  porNo: { id: string; pai_id: string | null; nome: string; produtos: number }[]; // taxonomia: produtos por nó (só o nó)
}

/** Mapa do catálogo. Pontos de atenção ganham tom para chamar o olho; a taxonomia entra como ramo com a soma por nó + descendentes. */
export function mapaDoCatalogo(c: Contagens): MapaNo {
  const atencao = (n: number): Tom => (n === 0 ? "ok" : "atencao");
  const faltando = Object.entries(c.faltando).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const porPai = new Map<string | null, Contagens["porNo"]>();
  const ids = new Set(c.porNo.map((n) => n.id));
  for (const n of c.porNo) { const pai = n.pai_id && ids.has(n.pai_id) && n.pai_id !== n.id ? n.pai_id : null; porPai.set(pai, [...(porPai.get(pai) ?? []), n]); }
  const vistos = new Set<string>();
  const ramo = (n: Contagens["porNo"][number]): MapaNo => {
    vistos.add(n.id);
    const filhos = (porPai.get(n.id) ?? []).filter((f) => !vistos.has(f.id)).sort((a, b) => b.produtos - a.produtos || a.nome.localeCompare(b.nome, "pt-BR")).map(ramo);
    const soma = n.produtos + filhos.reduce((s, f) => s + Number(f.valor ?? 0), 0);
    return { id: `tx:${n.id}`, rotulo: n.nome, valor: soma, ...(filhos.length ? { filhos } : {}) };
  };
  const raizes = (porPai.get(null) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(ramo);
  const raiz: MapaNo = {
    id: "catalogo", rotulo: "Catálogo", valor: c.total, tom: "neutro", filhos: [
      { id: "situacao", rotulo: "Situação", filhos: [
        { id: "publicados", rotulo: "Mostrando no site", valor: c.publicados, tom: "ok" },
        { id: "ocultos", rotulo: "Ocultos", valor: Math.max(0, c.total - c.publicados) },
        { id: "inativos", rotulo: "Inativos no Bling", valor: c.inativos, tom: atencao(c.inativos) },
      ] },
      { id: "atencao", rotulo: "Pontos de atenção", tom: atencao(c.semCategoria + c.semLugarNaTaxonomia + c.incompletos), filhos: [
        { id: "sem-categoria", rotulo: "Sem categoria no Bling", valor: c.semCategoria, tom: atencao(c.semCategoria) },
        { id: "sem-no", rotulo: "Sem lugar na taxonomia", valor: c.semLugarNaTaxonomia, tom: atencao(c.semLugarNaTaxonomia) },
        { id: "incompletos", rotulo: "Com campos vazios", valor: c.incompletos, tom: atencao(c.incompletos), filhos: faltando.map(([campo, n]) => ({ id: `falta:${campo}`, rotulo: `Sem ${campo}`, valor: n, tom: "atencao" as Tom })) },
      ] },
      { id: "taxonomia", rotulo: "Taxonomia", valor: raizes.reduce((s, r) => s + Number(r.valor ?? 0), 0), filhos: raizes },
    ],
  };
  return higienizar(raiz)!;
}

export interface NoPosicionado { id: string; rotulo: string; valor?: number | string; tom: Tom; dica?: string; profundidade: number; x: number; y: number; temFilhos: boolean; recolhido: boolean }
export interface Aresta { de: string; para: string }
export interface Layout { nos: NoPosicionado[]; arestas: Aresta[]; largura: number; altura: number }
export interface OpcoesLayout { colunaLargura?: number; linhaAltura?: number; margem?: number; recolhidos?: ReadonlySet<string> }

/** Árvore horizontal: a raiz à esquerda, um nível por coluna. Cada folha ocupa uma linha; o pai fica no meio dos filhos. Nó recolhido esconde a subárvore. */
export function layoutArvore(raiz: MapaNo, o: OpcoesLayout = {}): Layout {
  const col = o.colunaLargura ?? 220, linha = o.linhaAltura ?? 34, m = o.margem ?? 16;
  const recolhidos = o.recolhidos ?? new Set<string>();
  const nos: NoPosicionado[] = [], arestas: Aresta[] = [];
  let proximaLinha = 0, maxProf = 0;
  const visita = (n: MapaNo, prof: number): number => {
    maxProf = Math.max(maxProf, prof);
    const recolhido = recolhidos.has(n.id) && !!n.filhos?.length;
    const filhos = recolhido ? [] : n.filhos ?? [];
    const ys = filhos.map((f) => { const y = visita(f, prof + 1); arestas.push({ de: n.id, para: f.id }); return y; });
    const y = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 : proximaLinha++;
    nos.push({ id: n.id, rotulo: n.rotulo, valor: n.valor, tom: n.tom ?? "neutro", dica: n.dica, profundidade: prof, x: m + prof * col, y: m + y * linha, temFilhos: !!n.filhos?.length, recolhido });
    return y;
  };
  visita(raiz, 0);
  return { nos: nos.sort((a, b) => a.profundidade - b.profundidade || a.y - b.y), arestas, largura: m * 2 + maxProf * col + col - 24, altura: m * 2 + Math.max(1, proximaLinha) * linha };
}

/** Resumo em frases, calculado aqui (sem IA): o total da raiz, o que está bem (tom ok) e cada ponto de atenção com valor maior que zero. */
export function resumoDoMapa(raiz: MapaNo): string[] {
  const linhas: string[] = [];
  const bons: string[] = [], pontos: string[] = [];
  const colher = (n: MapaNo) => {
    const v = Number(n.valor ?? 0);
    if (n.tom === "ok" && v > 0) bons.push(`${n.rotulo}: ${n.valor}`);
    if (n.tom === "atencao" && v > 0 && !n.id.startsWith("falta:")) pontos.push(`${n.rotulo}: ${n.valor}`);
    n.filhos?.forEach(colher);
  };
  colher(raiz);
  if (raiz.valor !== undefined) linhas.push(`${raiz.rotulo}: ${raiz.valor}.`);
  if (bons.length) linhas.push(`Em ordem — ${bons.join("; ")}.`);
  linhas.push(pontos.length ? `Atenção — ${pontos.join("; ")}.` : "Nenhum ponto de atenção nesta tela.");
  return linhas;
}

/** Texto compacto do mapa para entregar ao Nano.ia como contexto (só rótulos e números, já higienizados). */
export function mapaParaTexto(raiz: MapaNo, limiteLinhas = 80): string {
  const limpo = higienizar(raiz);
  if (!limpo) return "";
  const out: string[] = [];
  const andar = (n: MapaNo, nivel: number) => { if (out.length < limiteLinhas) out.push(`${"  ".repeat(nivel)}- ${n.rotulo}${n.valor !== undefined ? `: ${n.valor}` : ""}`); n.filhos?.forEach((f) => andar(f, nivel + 1)); };
  andar(limpo, 0);
  return out.join("\n");
}
