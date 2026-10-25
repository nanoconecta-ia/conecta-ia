// Busca de produto com PROVENIÊNCIA REAL. Procura por SKU interno, referência do fabricante (no nome) e GTIN, no espelho E na API do Bling,
// inclusive produtos excluídos e com paginação. Devolve TODOS os candidatos (até o limite) e diz de onde veio cada um.
// Regras: ausência no espelho nunca prova ausência no ERP; só a API com todas as páginas lidas (critério "todos") comprova ausência;
// e NADA aqui autoriza criar cadastro (`autoriza_criacao` é sempre false). Só leitura.
export type Situacao = "ativo" | "inativo" | "excluido" | "ausente_do_espelho" | "desconhecida";
export type Achado = "sku_exato" | "referencia_no_nome" | "gtin";
export interface Candidato {
  id: string; sku: string | null; nome: string | null; situacao: Situacao; preco: number | null; estoque: number | null;
  achado_por: Achado[]; origem: "api_bling" | "espelho"; no_espelho: boolean; sincronizado_em: string | null;
}
export interface Fonte { origem: "api_bling" | "espelho"; consulta: string; consultada: boolean; completa: boolean; total: number; paginas: number; motivo: string | null }
/** Escopo REAL do que foi pesquisado. Ausência vale só para estes filtros/campos; nunca é prova universal de ausência no ERP. */
export interface Escopo { filtros_executados: Achado[]; campos_cobertos: string[]; campos_nao_cobertos: string[]; filtro_nome_aplicado: boolean; gtin_aplicado: boolean; criterio: "todos" | "ativos"; prova_universal: false }
export interface Conclusao { escopo: Escopo; ausencia_nos_filtros_pesquisados: boolean; api_completa: boolean; apenas_espelho: boolean; autoriza_criacao: false; aviso: string }
export interface ResultadoBusca { termo: string; incluir_excluidos: boolean; total_candidatos: number; truncado: boolean; candidatos: Candidato[]; fontes: Fonte[]; conclusao: Conclusao }
export interface LinhaEspelho { bling_id: string; sku: string | null; nome: string | null; preco: unknown; estoque: unknown; situacao: string | null; sincronizado_em: string | null }
export interface PortasBusca {
  /** Lê uma página da API (GET). Lança em falha de rede/timeout; devolve ok=false com o status em erro HTTP. */
  listarApi(caminho: string): Promise<{ ok: boolean; status: number; itens: unknown[] }>;
  /** Espelho da loja (a porta já filtra por loja_id): SKU exato e nome contendo o termo. */
  espelho(termo: string): Promise<LinhaEspelho[]>;
  espera(ms: number): Promise<void>;
}

export const MAX_PAGINAS = 3;
export const POR_PAGINA = 100;
export const MAX_CANDIDATOS = 50;
export const PAUSA_MS = 350;
const TERMO = /^[A-Za-z0-9À-ÿ ._/-]+$/;

export function validarTermo(bruto: unknown): string {
  if (typeof bruto !== "string") throw new Error("Informe um código (SKU, referência do fabricante ou GTIN).");
  const t = bruto.trim().replace(/\s+/g, " ");
  if (!t || t.length > 80 || !TERMO.test(t)) throw new Error("Código inválido: use até 80 letras, números, espaço, ponto, barra, hífen ou sublinhado.");
  return t;
}
/** GTIN-8/12/13/14 com dígito verificador GS1 válido. Só termos assim vão ao filtro de GTIN. */
export function gtinValido(t: string): boolean {
  if (!/^\d+$/.test(t) || ![8, 12, 13, 14].includes(t.length)) return false;
  const d = t.split("").map(Number); const dv = d.pop()!;
  const soma = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const numero = (v: unknown): number | null => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v)) ? Number(v) : null;
const texto = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : null);
export function situacaoBling(c: unknown): Situacao { return c === "A" ? "ativo" : c === "I" ? "inativo" : c === "E" ? "excluido" : "desconhecida"; }
function situacaoEspelho(c: string | null): Situacao { return c === "A" ? "ativo" : c === "I" ? "inativo" : c === "E" ? "excluido" : c === "ausente" ? "ausente_do_espelho" : "desconhecida"; }
const ORDEM: Record<Situacao, number> = { ativo: 0, inativo: 1, ausente_do_espelho: 2, excluido: 3, desconhecida: 4 };

export function planoApi(termo: string, incluirExcluidos: boolean): { chave: Achado; caminho: (pagina: number) => string }[] {
  const enc = encodeURIComponent(termo); const crit = incluirExcluidos ? 5 : 2;
  const base = (filtro: string) => (p: number) => `/produtos?${filtro}&criterio=${crit}&limite=${POR_PAGINA}&pagina=${p}`;
  const plano: { chave: Achado; caminho: (pagina: number) => string }[] = [{ chave: "sku_exato", caminho: base(`codigos[]=${enc}`) }];
  if (termo.length >= 3) plano.push({ chave: "referencia_no_nome", caminho: base(`nome=${enc}`) });
  if (gtinValido(termo)) plano.push({ chave: "gtin", caminho: base(`gtins[]=${enc}`) });
  return plano;
}
const motivoDe = (status: number | null, erro: unknown): string =>
  status === 401 || status === 403 ? "reconectar_bling" : status === 429 ? "limite_bling" : erro instanceof Error && /abort|timeout|tempo/i.test(`${erro.name} ${erro.message}`) ? "tempo_esgotado" : "api_indisponivel_ou_resposta_invalida";

export async function buscarProduto(entrada: { termo: string; incluirExcluidos?: boolean }, p: PortasBusca): Promise<ResultadoBusca> {
  const termo = validarTermo(entrada.termo); const incluir = entrada.incluirExcluidos !== false; const t = norm(termo);
  const fontes: Fonte[] = []; const porId = new Map<string, Candidato>();
  const juntar = (c: Candidato) => {
    const ex = porId.get(c.id);
    if (!ex) { porId.set(c.id, c); return; }
    for (const a of c.achado_por) if (!ex.achado_por.includes(a)) ex.achado_por.push(a);
    if (c.origem === "api_bling" && ex.origem !== "api_bling") { const sinc = ex.sincronizado_em; Object.assign(ex, { ...c, achado_por: ex.achado_por, no_espelho: true, sincronizado_em: sinc }); }
    ex.no_espelho = ex.no_espelho || c.no_espelho;
  };

  // 1) espelho (só produtos ativos sincronizados)
  const fe: Fonte = { origem: "espelho", consulta: "sku_exato + referencia_no_nome", consultada: false, completa: false, total: 0, paginas: 1, motivo: null };
  const noEspelho = new Set<string>(); const sincDoEspelho = new Map<string, string | null>();
  try {
    const linhas = await p.espelho(termo);
    fe.consultada = true; fe.completa = linhas.length < 25; fe.total = linhas.length;
    for (const l of linhas) {
      const id = String(l.bling_id); noEspelho.add(id); sincDoEspelho.set(id, l.sincronizado_em);
      const achado: Achado[] = []; if (l.sku === termo) achado.push("sku_exato");
      if (l.nome && norm(l.nome).includes(t)) achado.push("referencia_no_nome");
      if (!achado.length) continue;
      juntar({ id, sku: l.sku, nome: texto(l.nome), situacao: situacaoEspelho(l.situacao), preco: numero(l.preco), estoque: numero(l.estoque), achado_por: achado, origem: "espelho", no_espelho: true, sincronizado_em: l.sincronizado_em });
    }
  } catch { fe.motivo = "espelho_indisponivel"; }
  fontes.push(fe);

  // 2) API do Bling (inclusive excluídos), todas as consultas do plano, com paginação limitada e declarada
  let apiCompleta = true; let apiTentada = false; let pedidos = 0;
  for (const q of planoApi(termo, incluir)) {
    apiTentada = true;
    const f: Fonte = { origem: "api_bling", consulta: q.chave, consultada: false, completa: false, total: 0, paginas: 0, motivo: null };
    fontes.push(f);
    let status: number | null = null;
    try {
      for (let pg = 1; pg <= MAX_PAGINAS; pg++) {
        if (pedidos++ > 0) await p.espera(PAUSA_MS); // ~3 req/s por conta
        const r = await p.listarApi(q.caminho(pg)); status = r.status;
        if (!r.ok) throw new Error("api");
        f.consultada = true; f.paginas = pg;
        for (const it of r.itens as Record<string, unknown>[]) {
          if (!it || typeof it !== "object" || it.id == null) continue;
          const sku = typeof it.codigo === "string" && it.codigo ? it.codigo : null; const nome = texto(it.nome);
          const exato = sku === termo;
          if (q.chave === "sku_exato" && !exato) continue;                                          // o filtro de código pode ser parcial: só exato conta como SKU
          if (q.chave === "referencia_no_nome" && !(nome && norm(nome).includes(t)) && !(sku && norm(sku).includes(t))) continue; // busca por nome pode ser difusa
          f.total++;
          const id = String(it.id);
          juntar({ id, sku, nome, situacao: situacaoBling(it.situacao), preco: numero(it.preco), estoque: numero((it.estoque as Record<string, unknown> | undefined)?.saldoVirtualTotal),
            achado_por: [q.chave, ...(q.chave !== "sku_exato" && exato ? (["sku_exato"] as Achado[]) : [])], origem: "api_bling", no_espelho: noEspelho.has(id), sincronizado_em: sincDoEspelho.get(id) ?? null });
        }
        if (r.itens.length < POR_PAGINA) { f.completa = true; break; }
        if (pg === MAX_PAGINAS) f.motivo = "paginas_limite_atingido";
      }
    } catch (e) { f.motivo = motivoDe(status, e); }
    if (!f.completa) apiCompleta = false;
    if (f.motivo && !f.consultada) break; // API fora do ar/sem permissão: não insiste nas demais consultas
  }
  if (!apiTentada) apiCompleta = false;

  const todos = [...porId.values()].sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || Number(b.achado_por.includes("sku_exato")) - Number(a.achado_por.includes("sku_exato")) || (a.sku ?? "").localeCompare(b.sku ?? "") || a.id.localeCompare(b.id));
  const apiOk = apiCompleta && fontes.filter((f) => f.origem === "api_bling").every((f) => f.completa);
  const ausencia = apiOk && incluir && todos.length === 0;
  const executados = planoApi(termo, incluir).map((q) => q.chave);
  const escopo: Escopo = { filtros_executados: executados, criterio: incluir ? "todos" : "ativos", filtro_nome_aplicado: executados.includes("referencia_no_nome"), gtin_aplicado: executados.includes("gtin"),
    campos_cobertos: ["SKU (código) exato", ...(executados.includes("referencia_no_nome") ? ["nome"] : []), ...(executados.includes("gtin") ? ["GTIN/EAN"] : [])],
    campos_nao_cobertos: ["descrição", "marca/fabricante", "código do fornecedor", ...(executados.includes("referencia_no_nome") ? [] : ["nome (termo com menos de 3 caracteres: filtro por nome não executado)"]), ...(executados.includes("gtin") ? [] : ["GTIN/EAN (termo não é um GTIN válido)"])], prova_universal: false };
  let aviso: string;
  if (!apiOk) aviso = "A API do Bling NÃO foi consultada por completo (veja `fontes`). O espelho só tem produtos ATIVOS sincronizados: ausência no espelho NÃO prova ausência no ERP. Não afirme que o produto não existe e não crie cadastro com base nesta busca.";
  else if (!incluir) aviso = "Busca na API só entre produtos ATIVOS: não prova ausência de excluídos nem inativos. Não crie cadastro com base nesta busca.";
  else if (todos.length === 0) aviso = `Nenhum registro encontrado na API do Bling nos filtros pesquisados (${escopo.campos_cobertos.join(", ")}), incluindo excluídos. NÃO foram cobertos: ${escopo.campos_nao_cobertos.join(", ")}. Isso NÃO é prova de que o produto não existe no ERP e NÃO autoriza criar cadastro: a criação é outro fluxo, com aprovação.`;
  else aviso = "Candidatos de fontes diferentes. Situação excluído/inativo não é equivalência: compare histórico antes de escolher. GTIN repetido indica conflito de cadastro e não prova, sozinho, que sejam a mesma peça nem peças diferentes. Esta busca NÃO autoriza criar cadastro.";
  return { termo, incluir_excluidos: incluir, total_candidatos: todos.length, truncado: todos.length > MAX_CANDIDATOS, candidatos: todos.slice(0, MAX_CANDIDATOS), fontes,
    conclusao: { escopo, ausencia_nos_filtros_pesquisados: ausencia, api_completa: apiOk, apenas_espelho: !fontes.some((f) => f.origem === "api_bling" && f.consultada), autoriza_criacao: false, aviso } };
}
