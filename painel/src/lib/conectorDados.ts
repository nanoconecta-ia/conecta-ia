// Acesso a dados do Nano.ia. Leituras diretas pelo Supabase (a RLS decide o que cada pessoa vê) e ações pelas Edge Functions
// do contrato. Em desenvolvimento com ?demo=1 a fonte troca para fixtures (lib/demo.ts), que nem entram no pacote de produção.
import { supabase } from "../supabase.ts";
import { DEMO } from "./modo.ts";
import { chamarFuncao, enviarMensagem, type ManipuladoresChat, type ParametrosChat, type Provedor, type RespostaFuncao } from "./chat.ts";
import type { ItemProposta, Operacao, Proposta } from "./propostas.ts";
import { sha256Hex } from "./anexos.ts";

export interface Conversa { id: string; titulo: string; projeto: string | null; provedor: string | null; modelo: string | null; atualizado_em: string }
export interface MensagemSalva { id: string; seq: number; papel: "user" | "assistant" | "tool" | "system"; conteudo: unknown; provedor: string | null; modelo: string | null; criado_em: string }
export interface ProvedorAtivo { provedor: Provedor; modelo: string | null; principal: boolean }
export interface Capacidade { provedor: string; capacidade: string; situacao: "implementado" | "nao_implementado" | "nao_verificado"; observacao: string | null }
export interface ProdutoResumo { id: string; sku: string | null; nome: string | null }
export interface ContextoProduto {
  produto: { id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; marca: string | null; gtin: string | null; peso_kg: number | null; descricao_curta: string | null; categoria_bling_id: string | null; situacao: string | null; publicado: boolean };
  trava: { estado: string; motivo: string | null; alterado_em: string } | null;
  categoriaBling: string | null; taxonomia: { nome: string; status: string } | null;
  faltantes: string[]; fontes: string[]; pendentes: { proposta_id: string; titulo: string; estado: string; operacao: string }[];
}
export interface StatusSync { status: string; ultimo_sync_ok_em: string | null; ultimo_erro: string | null }
export interface ChamadaFerramenta { id: number; quando: string; origem: string; ferramenta: string; risco: string | null; decisao: string; motivo: string | null }
export interface DocumentoFonte { id: string; tipo: string; titulo: string; fonte: string; fonte_versao: string | null; status: string }
export interface LinhaLista { cols: (string | number | null)[]; href?: string }
export interface ListaIndicador { titulo: string; colunas: string[]; linhas: LinhaLista[]; vazio: string }
export interface ChaveMcp { id: string; nome: string; escopos: string[]; ultimo_uso_em: string | null; revogada_em: string | null; expira_em: string | null; criado_em: string }
export interface DadosStudio {
  produto: ContextoProduto["produto"] & { descricao_complementar: string | null; largura_cm: number | null; altura_cm: number | null; profundidade_cm: number | null; unidade: string | null };
  imagens: { id: string; url: string; tipo: "real" | "gerada_ia" | "ilustrativa"; aprovada: boolean; principal: boolean; alt_texto: string | null; licenca_tipo: string | null }[];
  codigos: { tipo: string; valor: string; status: string; fonte: string | null }[];
  aplicacoes: { modelo: string; motorizacao: string | null; ano_inicial: number | null; ano_final: number | null; status: string; fonte: string | null }[];
  enriquecimento: { campo: string; valor: unknown; status: string; fonte: string | null }[];
  categoriaBling: string | null; taxonomia: string | null;
}

export interface FonteDados {
  demo: boolean;
  usuario(): Promise<{ id: string; token: string } | null>;
  enviar(p: ParametrosChat, m: ManipuladoresChat, sinal?: AbortSignal): Promise<void>;
  chamar<T = Record<string, unknown>>(funcao: string, corpo: Record<string, unknown>): Promise<RespostaFuncao<T>>;
  anexar(lojaId: string, conversaId: string, arquivo: File): Promise<{ id: string; nome: string; tipo: string }>;
  urlAnexo(anexoId: string): Promise<string>;
  conversas(lojaId: string): Promise<Conversa[]>;
  mensagens(conversaId: string): Promise<MensagemSalva[]>;
  provedores(lojaId: string): Promise<ProvedorAtivo[]>;
  capacidades(): Promise<Capacidade[]>;
  buscarProdutos(lojaId: string, texto: string): Promise<ProdutoResumo[]>;
  contexto(lojaId: string, produtoId: string): Promise<ContextoProduto | null>;
  statusSync(lojaId: string): Promise<StatusSync | null>;
  chamadas(lojaId: string, limite: number): Promise<ChamadaFerramenta[]>;
  documentos(lojaId: string): Promise<DocumentoFonte[]>;
  produtosEmAnalise(lojaId: string): Promise<ProdutoResumo[]>;
  propostas(lojaId: string, estado: string | null): Promise<Proposta[]>;
  proposta(id: string): Promise<{ proposta: Proposta; itens: ItemProposta[]; operacoes: Operacao[]; produtos: Record<string, ProdutoResumo> } | null>;
  dashboard(lojaId: string): Promise<unknown>;
  lista(lojaId: string, filtro: string): Promise<ListaIndicador>;
  chaves(lojaId: string): Promise<ChaveMcp[]>;
  studio(lojaId: string, produtoId: string): Promise<DadosStudio | null>;
  travas(lojaId: string): Promise<Record<string, string>>;
}

const lista = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
async function token() { const { data } = await supabase.auth.getSession(); return data.session ? { id: data.session.user.id, token: data.session.access_token } : null; }
const FALTA: [keyof ContextoProduto["produto"], string][] = [["sku", "SKU"], ["preco", "preço"], ["descricao_curta", "descrição curta"], ["marca", "marca"], ["gtin", "GTIN"], ["peso_kg", "peso"]];
const faltantesDe = (p: ContextoProduto["produto"]) => FALTA.filter(([k]) => p[k] === null || p[k] === undefined || p[k] === "").map(([, n]) => n);

const COLS_PRODUTO = "id, sku, nome, preco, estoque, marca, gtin, peso_kg, descricao_curta, categoria_bling_id, situacao, publicado";

async function produtosPorIds(lojaId: string, ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase.from("produtos").select("id, sku, nome, preco, estoque, publicado, marca, gtin, peso_kg, descricao_curta").eq("loja_id", lojaId).in("id", ids.slice(0, 200)).order("nome");
  return lista<{ id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; publicado: boolean; marca: string | null; gtin: string | null; peso_kg: number | null; descricao_curta: string | null }>(data);
}
const linhaProduto = (p: { id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; publicado: boolean }): LinhaLista =>
  ({ cols: [p.sku ?? "—", p.nome ?? "—", p.preco, p.estoque, p.publicado ? "publicado" : "não publicado"], href: `/studio?produto=${p.id}` });

export const fonteReal: FonteDados = {
  demo: false,
  usuario: token,
  async enviar(p, m, sinal) {
    const u = await token(); if (!u) throw new Error("Sua sessão expirou. Entre de novo.");
    await enviarMensagem(p, u.token, m, sinal);
  },
  async chamar<T>(funcao: string, corpo: Record<string, unknown>) {
    const u = await token(); if (!u) return { ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo." } as RespostaFuncao<T>;
    return chamarFuncao<T>(funcao, corpo, u.token);
  },
  async anexar(lojaId, conversaId, arquivo) {
    const u = await token(); if (!u) throw new Error("Sua sessão expirou. Entre de novo.");
    // 1) o servidor valida e devolve um caminho com token de envio; 2) o navegador envia com esse token (nunca escreve direto no Storage); 3) registra com o sha256
    const prep = await chamarFuncao<{ path: string; token: string; tipo: string }>("conector-conversas", { loja_id: lojaId, acao: "preparar_anexo", conversa_id: conversaId, nome: arquivo.name, mime: arquivo.type, bytes: arquivo.size }, u.token);
    if (!prep.ok || !prep.dados?.path || !prep.dados.token) throw new Error(prep.erro ?? "Não foi possível preparar o anexo.");
    const sha = await sha256Hex(await arquivo.arrayBuffer());
    const up = await supabase.storage.from("agente-anexos").uploadToSignedUrl(prep.dados.path, prep.dados.token, arquivo, { contentType: arquivo.type });
    if (up.error) throw new Error("Não foi possível enviar o arquivo. Nada foi anexado.");
    const r = await chamarFuncao<{ id: string }>("conector-conversas", { loja_id: lojaId, acao: "registrar_anexo", conversa_id: conversaId, nome: arquivo.name, mime: arquivo.type, bytes: arquivo.size, sha256: sha, path: prep.dados.path }, u.token);
    if (!r.ok || !r.dados?.id) throw new Error(r.erro ?? "Não foi possível registrar o anexo.");
    return { id: r.dados.id, nome: arquivo.name, tipo: prep.dados.tipo };
  },
  async urlAnexo(anexoId) {
    const u = await token(); if (!u) throw new Error("Sua sessão expirou. Entre de novo.");
    const r = await chamarFuncao<{ url: string }>("conector-conversas", { acao: "baixar_anexo", anexo_id: anexoId }, u.token);
    if (!r.ok || !r.dados?.url) throw new Error(r.erro ?? "Não foi possível abrir o anexo.");
    return r.dados.url;   // expira em 300 s
  },
  async conversas(lojaId) {
    const { data } = await supabase.from("agente_conversas").select("id, titulo, projeto, provedor, modelo, atualizado_em").eq("loja_id", lojaId).order("atualizado_em", { ascending: false }).limit(100);
    return lista<Conversa>(data);
  },
  async mensagens(conversaId) {
    const { data } = await supabase.from("agente_mensagens").select("id, seq, papel, conteudo, provedor, modelo, criado_em").eq("conversa_id", conversaId).order("seq").limit(500);
    return lista<MensagemSalva>(data);
  },
  async provedores(lojaId) {
    const { data } = await supabase.from("loja_chaves_ia").select("provedor, modelo, principal, ativa").eq("loja_id", lojaId).eq("ativa", true);
    return lista<ProvedorAtivo & { ativa: boolean }>(data).filter((p) => ["claude", "gemini", "compativel_openai"].includes(p.provedor));
  },
  async capacidades() {
    const { data } = await supabase.from("provedor_capacidades").select("provedor, capacidade, situacao, observacao");
    return lista<Capacidade>(data);
  },
  async buscarProdutos(lojaId, texto) {
    const t = texto.replace(/[%,()*\\]/g, " ").trim();
    let q = supabase.from("produtos").select("id, sku, nome").eq("loja_id", lojaId).order("nome").limit(30);
    if (t) q = q.or(`nome.ilike.%${t}%,sku.ilike.%${t}%`);
    const { data } = await q;
    return lista<ProdutoResumo>(data);
  },
  async contexto(lojaId, produtoId) {
    const { data: p } = await supabase.from("produtos").select(COLS_PRODUTO).eq("loja_id", lojaId).eq("id", produtoId).maybeSingle();
    if (!p) return null;
    const produto = p as ContextoProduto["produto"];
    const [trava, cat, enr, cods, apls, itens] = await Promise.all([
      supabase.from("produto_travas").select("estado, motivo, alterado_em").eq("produto_id", produtoId).maybeSingle(),
      produto.categoria_bling_id ? supabase.from("bling_categorias").select("nome").eq("loja_id", lojaId).eq("bling_id", produto.categoria_bling_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("produto_enriquecimento").select("fonte").eq("produto_id", produtoId).not("fonte", "is", null),
      supabase.from("produto_codigos").select("fonte").eq("produto_id", produtoId).not("fonte", "is", null),
      supabase.from("produto_aplicacoes").select("fonte").eq("produto_id", produtoId).not("fonte", "is", null),
      supabase.from("agente_proposta_itens").select("operacao, proposta_id, agente_propostas(titulo, estado)").eq("produto_id", produtoId).in("estado", ["pendente", "travado"]).limit(20),
    ]);
    let taxonomia: ContextoProduto["taxonomia"] = null;
    const { data: tx } = await supabase.from("produtos").select("taxonomia_nos(nome, status)").eq("id", produtoId).maybeSingle();
    const nodo = (tx as unknown as { taxonomia_nos?: { nome: string; status: string } | null } | null)?.taxonomia_nos;
    if (nodo) taxonomia = nodo;
    const fontes = [...new Set([...lista<{ fonte: string }>(enr.data), ...lista<{ fonte: string }>(cods.data), ...lista<{ fonte: string }>(apls.data)].map((x) => x.fonte))];
    const pendentes = lista<{ operacao: string; proposta_id: string; agente_propostas: { titulo: string; estado: string } | null }>(itens.data)
      .map((i) => ({ proposta_id: i.proposta_id, titulo: i.agente_propostas?.titulo ?? "Proposta", estado: i.agente_propostas?.estado ?? "", operacao: i.operacao }));
    return { produto, trava: (trava.data as ContextoProduto["trava"]) ?? null, categoriaBling: (cat.data as { nome?: string } | null)?.nome ?? null, taxonomia, faltantes: faltantesDe(produto), fontes, pendentes };
  },
  async statusSync(lojaId) {
    const { data } = await supabase.from("bling_conexoes").select("status, ultimo_sync_ok_em, ultimo_erro").eq("loja_id", lojaId).maybeSingle();
    return (data as StatusSync | null) ?? null;
  },
  async chamadas(lojaId, limite) {
    const { data } = await supabase.from("agente_chamadas_ferramenta").select("id, quando, origem, ferramenta, risco, decisao, motivo").eq("loja_id", lojaId).order("quando", { ascending: false }).limit(limite);
    return lista<ChamadaFerramenta>(data);
  },
  async documentos(lojaId) {
    const { data } = await supabase.from("agente_conhecimento").select("id, tipo, titulo, fonte, fonte_versao, status").or(`loja_id.eq.${lojaId},loja_id.is.null`).in("tipo", ["documentacao", "validado"]).order("criado_em", { ascending: false }).limit(30);
    return lista<DocumentoFonte>(data);
  },
  async produtosEmAnalise(lojaId) {
    const { data } = await supabase.from("agente_proposta_itens").select("produto_id, produtos(id, sku, nome)").eq("loja_id", lojaId).eq("estado", "pendente").not("produto_id", "is", null).limit(100);
    const m = new Map<string, ProdutoResumo>();
    for (const l of lista<{ produtos: ProdutoResumo | null }>(data)) if (l.produtos) m.set(l.produtos.id, l.produtos);
    return [...m.values()];
  },
  async propostas(lojaId, estado) {
    let q = supabase.from("agente_propostas").select("*").eq("loja_id", lojaId).order("criado_em", { ascending: false }).limit(100);
    if (estado) q = q.eq("estado", estado);
    const { data } = await q;
    return lista<Proposta>(data);
  },
  async proposta(id) {
    const { data: p } = await supabase.from("agente_propostas").select("*").eq("id", id).maybeSingle();
    if (!p) return null;
    const [it, op] = await Promise.all([
      supabase.from("agente_proposta_itens").select("*").eq("proposta_id", id).order("ordem"),
      supabase.from("agente_operacoes").select("id, item_id, tentativa, ferramenta, estado, erro, evidencia, iniciado_em, concluido_em").eq("proposta_id", id).order("iniciado_em"),
    ]);
    const itens = lista<ItemProposta>(it.data);
    const ids = [...new Set(itens.map((i) => i.produto_id).filter((x): x is string => !!x))];
    const produtos: Record<string, ProdutoResumo> = {};
    if (ids.length) { const { data } = await supabase.from("produtos").select("id, sku, nome").in("id", ids); for (const x of lista<ProdutoResumo>(data)) produtos[x.id] = x; }
    return { proposta: p as Proposta, itens, operacoes: lista<Operacao>(op.data), produtos };
  },
  async dashboard(lojaId) {
    const { data, error } = await supabase.rpc("dashboard_operacional", { p_loja: lojaId });
    if (error) throw new Error("Não foi possível carregar os indicadores (a função do banco pode não estar aplicada neste ambiente).");
    return data;
  },
  async lista(lojaId, filtro) {
    const vazio = "Nenhum registro.";
    const prod = async (titulo: string, ids: string[] | null, extra?: (q: any) => any): Promise<ListaIndicador> => {
      let rows;
      if (ids) rows = await produtosPorIds(lojaId, ids);
      else { let q: any = supabase.from("produtos").select("id, sku, nome, preco, estoque, publicado, marca, gtin, peso_kg, descricao_curta").eq("loja_id", lojaId).neq("situacao", "ausente").order("nome").limit(200); if (extra) q = extra(q); const { data } = await q; rows = lista<any>(data); }
      return { titulo, colunas: ["SKU", "Nome", "Preço", "Estoque", "Site"], linhas: rows.map(linhaProduto), vazio };
    };
    switch (filtro) {
      case "produtos": return prod("Produtos sincronizados", null);
      case "produtos:incompletos": {
        const r = await prod("Produtos incompletos", null, (q) => q.or("sku.is.null,preco.is.null,descricao_curta.is.null,marca.is.null,gtin.is.null,peso_kg.is.null"));
        return r;
      }
      case "produtos:bloqueados": case "produtos:divergencia": {
        const estado = filtro === "produtos:bloqueados" ? "bloqueado" : "erro_divergencia";
        const { data } = await supabase.from("produto_travas").select("produto_id").eq("loja_id", lojaId).eq("estado", estado);
        return prod(filtro === "produtos:bloqueados" ? "Produtos bloqueados" : "Divergências Bling/Conecta.IA", lista<{ produto_id: string }>(data).map((x) => x.produto_id));
      }
      case "produtos:enriquecidos": {
        const { data } = await supabase.from("produto_enriquecimento").select("produto_id").eq("loja_id", lojaId).eq("status", "aprovado");
        return prod("Produtos enriquecidos", [...new Set(lista<{ produto_id: string }>(data).map((x) => x.produto_id))]);
      }
      case "produtos:prontos": {
        const r = await prod("Prontos para publicação", null, (q) => q.eq("publicado", false).eq("situacao", "A").not("sku", "is", null).not("preco", "is", null).not("descricao_curta", "is", null).not("marca", "is", null));
        const { data } = await supabase.from("produto_imagens").select("produto_id").eq("loja_id", lojaId).eq("aprovada", true).eq("principal", true).is("removida_em", null);
        const com = new Set(lista<{ produto_id: string }>(data).map((x) => x.produto_id));
        return { ...r, linhas: r.linhas.filter((l) => com.has((l.href ?? "").split("=")[1] ?? "")) };
      }
      case "taxonomia": {
        const { data } = await supabase.from("bling_categoria_taxonomia").select("bling_categoria_id, definido_em, taxonomia_nos(nome, status)").eq("loja_id", lojaId);
        return { titulo: "Categorias do Bling ligadas à taxonomia", colunas: ["Categoria Bling", "Nó da taxonomia", "Estado do nó", "Definido em"],
          linhas: lista<{ bling_categoria_id: string; definido_em: string; taxonomia_nos: { nome: string; status: string } | null }>(data).map((l) => ({ cols: [l.bling_categoria_id, l.taxonomia_nos?.nome ?? "—", l.taxonomia_nos?.status ?? "—", new Date(l.definido_em).toLocaleString("pt-BR")] })), vazio: "Nenhuma categoria ligada ainda." };
      }
      case "imagens": {
        const { data } = await supabase.from("produto_imagens").select("id, tipo, origem, criado_em, produto_id, produtos(sku, nome)").eq("loja_id", lojaId).eq("aprovada", false).is("removida_em", null).limit(200);
        return { titulo: "Imagens pendentes", colunas: ["SKU", "Produto", "Tipo", "Origem"], linhas: lista<{ tipo: string; origem: string | null; produto_id: string; produtos: { sku: string | null; nome: string | null } | null }>(data).map((l) => ({ cols: [l.produtos?.sku ?? "—", l.produtos?.nome ?? "—", l.tipo, l.origem], href: `/studio?produto=${l.produto_id}` })), vazio: "Nenhuma imagem pendente." };
      }
      case "sincronizacao": {
        const { data } = await supabase.from("sync_erros").select("mensagem, criado_em").eq("loja_id", lojaId).gt("criado_em", new Date(Date.now() - 86_400_000).toISOString()).order("criado_em", { ascending: false }).limit(200);
        return { titulo: "Erros de sincronização (24 h)", colunas: ["Quando", "Mensagem"], linhas: lista<{ mensagem: string; criado_em: string }>(data).map((l) => ({ cols: [new Date(l.criado_em).toLocaleString("pt-BR"), l.mensagem] })), vazio: "Nenhum erro nas últimas 24 horas." };
      }
      case "execucoes": {
        const { data } = await supabase.from("agente_operacoes").select("ferramenta, estado, iniciado_em, proposta_id").eq("loja_id", lojaId).in("estado", ["pendente", "enviada"]).order("iniciado_em", { ascending: false }).limit(200);
        return { titulo: "Ferramentas em execução", colunas: ["Ferramenta", "Estado", "Início"], linhas: lista<{ ferramenta: string; estado: string; iniciado_em: string; proposta_id: string }>(data).map((l) => ({ cols: [l.ferramenta, l.estado, new Date(l.iniciado_em).toLocaleString("pt-BR")], href: `/central?proposta=${l.proposta_id}` })), vazio: "Nada em execução." };
      }
      default: return { titulo: filtro === "seo" ? "Qualidade SEO" : "Indicador", colunas: [], linhas: [], vazio: filtro === "seo" ? "A qualidade SEO ainda não é medida nesta fase." : "Este indicador não tem lista." };
    }
  },
  async chaves(lojaId) {
    const comExpira = await supabase.from("loja_mcp_chaves").select("id, nome, escopos, ultimo_uso_em, revogada_em, expira_em, criado_em").eq("loja_id", lojaId).order("criado_em", { ascending: false });
    if (!comExpira.error) return lista<ChaveMcp>(comExpira.data);
    const { data } = await supabase.from("loja_mcp_chaves").select("id, nome, escopos, ultimo_uso_em, revogada_em, criado_em").eq("loja_id", lojaId).order("criado_em", { ascending: false });
    return lista<ChaveMcp>(data).map((c) => ({ ...c, expira_em: null }));
  },
  async studio(lojaId, produtoId) {
    const { data: p } = await supabase.from("produtos").select(`${COLS_PRODUTO}, descricao_complementar, largura_cm, altura_cm, profundidade_cm, unidade, taxonomia_nos(nome)`).eq("loja_id", lojaId).eq("id", produtoId).maybeSingle();
    if (!p) return null;
    const { taxonomia_nos, ...produto } = p as unknown as DadosStudio["produto"] & { taxonomia_nos: { nome: string } | null };
    const [img, cod, apl, enr, cat] = await Promise.all([
      // sem url_original: a origem de terceiros nunca sai do banco para a tela de prévia
      supabase.from("produto_imagens").select("id, url, tipo, aprovada, principal, alt_texto, licenca_tipo").eq("produto_id", produtoId).is("removida_em", null).order("ordem"),
      supabase.from("produto_codigos").select("tipo, valor, status, fonte").eq("produto_id", produtoId),
      supabase.from("produto_aplicacoes").select("modelo, motorizacao, ano_inicial, ano_final, status, fonte").eq("produto_id", produtoId),
      supabase.from("produto_enriquecimento").select("campo, valor, status, fonte").eq("produto_id", produtoId),
      produto.categoria_bling_id ? supabase.from("bling_categorias").select("nome").eq("loja_id", lojaId).eq("bling_id", produto.categoria_bling_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { produto, imagens: lista(img.data), codigos: lista(cod.data), aplicacoes: lista(apl.data), enriquecimento: lista(enr.data), categoriaBling: (cat.data as { nome?: string } | null)?.nome ?? null, taxonomia: taxonomia_nos?.nome ?? null };
  },
  async travas(lojaId) {
    const { data } = await supabase.from("produto_travas").select("produto_id, estado").eq("loja_id", lojaId);
    return Object.fromEntries(lista<{ produto_id: string; estado: string }>(data).map((t) => [t.produto_id, t.estado]));
  },
};

/** Fonte ativa: real, ou fixtures só em desenvolvimento com ?demo=1 (o ramo some do build de produção). */
export async function dados(): Promise<FonteDados> {
  if (import.meta.env.DEV && DEMO) return (await import("./demo.ts")).fonteDemo;
  return fonteReal;
}
