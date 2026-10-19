// DADOS DE EXEMPLO — só desenvolvimento (npm run dev + ?demo=1). Este módulo só é importado atrás de `import.meta.env.DEV`,
// então não existe no build de produção. Nada aqui vem do Bling nem do banco: valores de exemplo são marcados "EX-".
import type { ManipuladoresChat, ParametrosChat } from "./chat.ts";
import type { Capacidade, ChaveMcp, ChamadaFerramenta, Conversa, DadosStudio, DocumentoFonte, FonteDados, ListaIndicador, MensagemSalva, ProdutoResumo, ProvedorAtivo } from "./conectorDados.ts";
import type { Loja } from "./dados.ts";
import type { ItemProposta, Operacao, Proposta } from "./propostas.ts";

export const FAIXA = "DADOS DE EXEMPLO — só desenvolvimento";
export const lojaDemo: Loja = { id: "demo-loja", nome: "Mobis Auto Peças", slug: "demo", modo_venda: "whatsapp", ambiente: "teste", perfil_ramo: "autopecas" };

const U = "u-demo";
const agora = Date.now();
const iso = (deltaMin: number) => new Date(agora + deltaMin * 60_000).toISOString();
const svg = (cor: string, texto: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="${cor}"/><text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="26" text-anchor="middle" dominant-baseline="middle">${texto}</text></svg>`)}`;

const PRODUTOS: (ProdutoResumo & { preco: number | null; marca: string | null; gtin: string | null; peso: number | null; desc: string | null; publicado: boolean })[] = [
  { id: "pr1", sku: "80692", nome: "Jogo de Juntas Completo do Motor HR / K2500 2.5 16V D4CB Euro 5 c/ Retentores SABó", preco: 612.9, marca: "SABó", gtin: "7891252806921", peso: 2.4, desc: "Jogo de juntas completo com retentores.", publicado: false },
  { id: "pr2", sku: "CI001086", nome: "Bomba de óleo HR/K2500 2.5 16V 13/ D4CB Euro V alumínio", preco: 489, marca: "TRIM GO", gtin: null, peso: 5, desc: null, publicado: false },
  { id: "pr3", sku: "CI003696", nome: "Motor HR/K2500 2.5 16V 13/ D4CB Euro V novo parcial c/ cabeçote", preco: 18900, marca: null, gtin: null, peso: 135, desc: null, publicado: false },
  { id: "pr4", sku: null, nome: "Radiador de óleo HR/K2500 2.5 16V 13/ D4CB Euro V", preco: 740, marca: null, gtin: null, peso: null, desc: null, publicado: false },
];
const travas: Record<string, string> = { pr3: "bloqueado" };

const P = (o: Partial<Proposta> & Pick<Proposta, "id" | "titulo" | "estado">): Proposta => ({ loja_id: lojaDemo.id, solicitante_user: U, agente: "Conector IA", provedor: "claude", modelo: "claude-sonnet-5-5", resumo: null, risco: "MEDIUM", versao: 1, lote: false, hash: "a3f9c0d17b2e4c68".padEnd(64, "0"), expira_em: iso(60 * 20), criado_em: iso(-90), enviado_em: iso(-88), decidido_em: null, ...o });
const I = (o: Partial<ItemProposta> & Pick<ItemProposta, "id" | "proposta_id" | "ordem">): ItemProposta => ({ produto_id: "pr1", operacao: "conecta.enriquecimento.definir", alvo: null, campos: ["marca_peca"], antes: { marca_peca: null }, depois: { marca_peca: "EX-Marca" }, fontes: [{ url: "https://exemplo.invalid/catalogo-fabricante.pdf", titulo: "Catálogo do fabricante (exemplo)" }], validacoes: [{ nome: "Fonte registrada", ok: true }], risco: "MEDIUM", estado: "pendente", motivo: null, ...o });

let propostas: Proposta[] = [
  P({ id: "pp1", titulo: "Enriquecer Jogo de Juntas (80692)", estado: "pendente", resumo: "Marca da peça e descrição curta, com fonte do catálogo do fabricante.", risco: "MEDIUM" }),
  P({ id: "pp2", titulo: "Lote: categoria e peso de 3 produtos", estado: "pendente", lote: true, risco: "HIGH", versao: 2, resumo: "Alterar categoria e peso no Bling (simulado). Um produto está travado.", criado_em: iso(-30), hash: "7be21d90ac33e1f4".padEnd(64, "1") }),
  P({ id: "pp3", titulo: "Descrição curta da Bomba de óleo", estado: "executada", decidido_em: iso(-300), criado_em: iso(-400), enviado_em: iso(-399) }),
  P({ id: "pp4", titulo: "Marca do Radiador de óleo", estado: "parcial", decidido_em: iso(-200), criado_em: iso(-260), enviado_em: iso(-259) }),
];
const itens: Record<string, ItemProposta[]> = {
  pp1: [
    I({ id: "i1", proposta_id: "pp1", ordem: 0, campos: ["marca_peca"], antes: { marca_peca: null }, depois: { marca_peca: "SABó" } }),
    I({ id: "i2", proposta_id: "pp1", ordem: 1, campos: ["descricao_curta"], antes: { descricao_curta: "Jogo de juntas" }, depois: { descricao_curta: "Jogo de juntas completo do motor com retentores, para HR e K2500 2.5 16V (D4CB, Euro 5)." }, validacoes: [{ nome: "Fonte registrada", ok: true }, { nome: "Sem custo nem fornecedor no texto", ok: true }] }),
  ],
  pp2: [
    I({ id: "i3", proposta_id: "pp2", ordem: 0, produto_id: "pr1", operacao: "bling.produtos.alterar", alvo: "16719464748", campos: ["categoria_bling_id", "peso_kg"], antes: { categoria_bling_id: "1072643", peso_kg: 2.4 }, depois: { categoria_bling_id: "14054841", peso_kg: 2.4 }, risco: "HIGH" }),
    I({ id: "i4", proposta_id: "pp2", ordem: 1, produto_id: "pr2", operacao: "bling.produtos.alterar", alvo: "16719530080", campos: ["categoria_bling_id"], antes: { categoria_bling_id: "1072643" }, depois: { categoria_bling_id: "14044243" }, risco: "HIGH" }),
    I({ id: "i5", proposta_id: "pp2", ordem: 2, produto_id: "pr3", operacao: "bling.produtos.alterar", alvo: "16719530075", campos: ["categoria_bling_id"], antes: { categoria_bling_id: "1072643" }, depois: { categoria_bling_id: "14044243" }, risco: "HIGH", estado: "travado", motivo: "produto travado: só sugestão" }),
  ],
  pp3: [I({ id: "i6", proposta_id: "pp3", ordem: 0, produto_id: "pr2", campos: ["descricao_curta"], antes: { descricao_curta: null }, depois: { descricao_curta: "Bomba de óleo em alumínio para HR/K2500 2.5 16V." }, estado: "confirmado" })],
  pp4: [I({ id: "i7", proposta_id: "pp4", ordem: 0, produto_id: "pr4", campos: ["marca_peca"], antes: { marca_peca: null }, depois: { marca_peca: "TRIM GO" }, estado: "desconhecido" })],
};
const operacoes: Record<string, Operacao[]> = {
  pp3: [{ id: "o1", item_id: "i6", tentativa: 1, ferramenta: "conecta.enriquecimento.definir", estado: "confirmada", erro: null, evidencia: { leitura: { descricao_curta: "Bomba de óleo em alumínio para HR/K2500 2.5 16V." } }, iniciado_em: iso(-299), concluido_em: iso(-298) }],
  pp4: [{ id: "o2", item_id: "i7", tentativa: 1, ferramenta: "conecta.enriquecimento.definir", estado: "desconhecida", erro: "tempo esgotado", evidencia: null, iniciado_em: iso(-199), concluido_em: iso(-198) }],
};

let conversas: Conversa[] = [
  { id: "cv1", titulo: "Organizar o cabeçote HR", projeto: "Hyundai HR", provedor: "claude", modelo: "claude-sonnet-5-5", atualizado_em: iso(-20) },
  { id: "cv2", titulo: "Taxonomia dos filtros", projeto: null, provedor: "gemini", modelo: "gemini-2.5-flash", atualizado_em: iso(-600) },
  { id: "cv3", titulo: "Descrições do lote de juntas", projeto: "Hyundai HR", provedor: "claude", modelo: "claude-sonnet-5-5", atualizado_em: iso(-1500) },
];
const msgs: Record<string, MensagemSalva[]> = { cv1: [
  { id: "m1", seq: 1, papel: "user", conteudo: [{ type: "text", text: "Conector IA, organize o cadastro do Jogo de Juntas 80692, consulte o Bling e valide as aplicações." }], provedor: null, modelo: null, criado_em: iso(-25) },
  { id: "m2", seq: 2, papel: "assistant", conteudo: [{ type: "text", text: "Vou consultar o produto no Bling e a taxonomia." }, { type: "tool_use", id: "t1", name: "ver_produto", input: { sku: "80692" } }], provedor: "claude", modelo: "claude-sonnet-5-5", criado_em: iso(-24) },
  { id: "m3", seq: 3, papel: "user", conteudo: [{ type: "tool_result", tool_use_id: "t1", content: "{\"sku\":\"80692\",\"faltando_para_publicar\":[\"peso\"]}" }], provedor: null, modelo: null, criado_em: iso(-24) },
  { id: "m4", seq: 4, papel: "assistant", conteudo: [{ type: "text", text: "O produto **80692** está no Bling, mas falta **peso confirmado**.\n\n| Campo | Situação |\n|---|---|\n| Marca | SABó |\n| GTIN | 7891252806921 |\n| Peso | 2,4 kg |\n\nPosso preparar uma proposta com antes/depois para você aprovar." }], provedor: "claude", modelo: "claude-sonnet-5-5", criado_em: iso(-20) },
] };

const sleep = (ms: number, sinal?: AbortSignal) => new Promise<void>((ok, nok) => { const t = setTimeout(ok, ms); sinal?.addEventListener("abort", () => { clearTimeout(t); nok(Object.assign(new Error("abort"), { name: "AbortError" })); }, { once: true }); });

export const fonteDemo: FonteDados = {
  demo: true,
  async usuario() { return { id: U, token: "demo" }; },
  async enviar(p: ParametrosChat, m: ManipuladoresChat, sinal?: AbortSignal) {
    try {
      const id = p.conversa_id ?? "cv-nova";
      if (!p.conversa_id) { conversas = [{ id, titulo: p.texto.slice(0, 50), projeto: null, provedor: p.provedor ?? null, modelo: null, atualizado_em: iso(0) }, ...conversas]; m.conversa?.({ id, titulo: p.texto.slice(0, 50) }); }
      m.estado?.("interpretando"); await sleep(500, sinal);
      if (p.provedor === "gemini") m.aviso?.({ mensagem: "O provedor escolhido não respondeu; o Claude respondeu no lugar.", provedor: "claude" });
      m.estado?.("consultando_ferramentas"); m.ferramentaInicio?.({ id: "t-demo", nome: "ver_produto", risco: "LOW" }); await sleep(700, sinal);
      m.ferramentaFim?.({ id: "t-demo", nome: "ver_produto", decisao: "permitida", ok: true, resumo: "sku 80692 · falta: peso" });
      m.estado?.("pesquisando_fontes"); await sleep(600, sinal);
      m.estado?.("preparando_proposta"); await sleep(600, sinal);
      for (const parte of ["Preparei uma proposta com **2 campos** do Jogo de Juntas 80692. ", "Cada valor tem fonte; confira o antes/depois abaixo e decida. ", "\n\nNada foi gravado no Bling."]) { m.texto?.(parte); await sleep(250, sinal); }
      m.proposta?.({ id: "pp1", versao: 1, hash: propostas[0].hash ?? "", titulo: propostas[0].titulo, risco: "MEDIUM", itens: 2 });
      m.estado?.("aguardando_aprovacao");
      m.uso?.({ provedor: p.provedor ?? "claude", modelo: "claude-sonnet-5-5", tokens: 2034, custo_estimado: null });
      m.fim?.();
    } catch (e) { if ((e as { name?: string }).name !== "AbortError") throw e; }
  },
  async chamar(funcao, corpo) {
    await sleep(250);
    const acao = String(corpo.acao ?? "");
    if (funcao === "conector-aprovacoes" && acao === "decidir") {
      propostas = propostas.map((x) => (x.id === corpo.proposta_id ? { ...x, estado: corpo.decisao === "aprovada" ? "aprovada" : "rejeitada" } : x));
      return { ok: true, status: 200, dados: { ok: true } as never };
    }
    if (funcao === "conector-aprovacoes" && (acao === "travar" || acao === "destravar")) { for (const id of (corpo.produtos as string[])) { if (acao === "travar") travas[id] = "bloqueado"; else delete travas[id]; } return { ok: true, status: 200, dados: { produtos_afetados: 1 } as never }; }
    if (funcao === "conector-aprovacoes" && acao === "executar_simulado") return { ok: true, status: 200, dados: { ok: true, relatorio: { simulado: true, itens: [{ item_id: "i1", operacao: "conecta.enriquecimento.definir", ok: true, confirmacao_simulada: true }, { item_id: "i2", operacao: "bling.produtos.alterar", ok: false, motivo: "ferramenta do Bling desligada" }] }, semeado_de: ["16719464748"], aviso: "Ensaio: nada foi enviado ao Bling." } as never };
    if (funcao === "conector-aprovacoes" && acao === "executar") return { ok: true, status: 200, dados: { ok: true, relatorio: { proposta_id: String(corpo.proposta_id), itens: [{ item_id: "i1", operacao: "conecta.enriquecimento.definir", estado: "confirmada", evidencia: { leitura: "ok" } }, { item_id: "i2", operacao: "bling.produtos.alterar", estado: "falhou", motivo: "Escrita no Bling desligada nesta fase." }], estado_final: "parcial" } } as never };
    if (funcao === "conector-aprovacoes" && acao === "reconciliar") return { ok: true, status: 200, dados: { ok: true, resultado: "indeterminado", aviso: "Exemplo: o Bling não trouxe prova suficiente." } as never };
    if (funcao === "conector-conversas" && acao === "excluir") { conversas = conversas.filter((c) => c.id !== corpo.conversa_id); return { ok: true, status: 200, dados: { ok: true } as never }; }
    if (funcao === "conector-conversas" && acao === "renomear") { conversas = conversas.map((c) => (c.id === corpo.conversa_id ? { ...c, titulo: String(corpo.titulo) } : c)); return { ok: true, status: 200, dados: { ok: true } as never }; }
    if (funcao === "conector-chaves" && acao === "criar") return { ok: true, status: 200, dados: { ok: true, id: "k-novo", token: "EXEMPLO-NAO-FUNCIONA-0000000000000000000000000000", prefixo: "cia_mcp_EXEM", aviso: "Guarde agora: a chave não será mostrada de novo." } as never };
    return { ok: true, status: 200, dados: { ok: true } as never };
  },
  async anexar(_l, _c, arquivo) { return { id: "anexo-demo", nome: arquivo.name, tipo: arquivo.type }; },
  async urlAnexo() { return "https://exemplo.invalid/anexo"; },
  async conversas() { return conversas; },
  async mensagens(id) { return msgs[id] ?? []; },
  async provedores(): Promise<ProvedorAtivo[]> { return [{ provedor: "claude", modelo: "claude-sonnet-5-5", principal: true }, { provedor: "gemini", modelo: "gemini-2.5-flash", principal: false }]; },
  async capacidades(): Promise<Capacidade[]> {
    return ["claude", "gemini", "compativel_openai"].flatMap((p) => [
      { provedor: p, capacidade: "chat", situacao: "implementado" as const, observacao: null }, { provedor: p, capacidade: "tool_calling", situacao: "implementado" as const, observacao: null },
      { provedor: p, capacidade: "streaming", situacao: "nao_implementado" as const, observacao: null }, { provedor: p, capacidade: "visao", situacao: "nao_implementado" as const, observacao: null },
      { provedor: p, capacidade: "geracao_imagem", situacao: "nao_implementado" as const, observacao: null }]);
  },
  async buscarProdutos(_l, t) { const x = t.toLowerCase(); return PRODUTOS.filter((p) => !x || (p.nome ?? "").toLowerCase().includes(x) || (p.sku ?? "").toLowerCase().includes(x)).map(({ id, sku, nome }) => ({ id, sku, nome })); },
  async contexto(_l, id) {
    const p = PRODUTOS.find((x) => x.id === id); if (!p) return null;
    const produto = { id: p.id, sku: p.sku, nome: p.nome, preco: p.preco, estoque: 3, marca: p.marca, gtin: p.gtin, peso_kg: p.peso, descricao_curta: p.desc, categoria_bling_id: "1072643", situacao: "A", publicado: p.publicado };
    const falt: [unknown, string][] = [[p.sku, "SKU"], [p.preco, "preço"], [p.desc, "descrição curta"], [p.marca, "marca"], [p.gtin, "GTIN"], [p.peso, "peso"]];
    return { produto, trava: travas[id] ? { estado: travas[id], motivo: "Auditado pelo lojista", alterado_em: iso(-120) } : null, categoriaBling: null, taxonomia: id === "pr1" ? { nome: "Motor", status: "rascunho" } : null,
      faltantes: falt.filter(([v]) => v == null).map(([, n]) => n), fontes: id === "pr1" ? ["https://exemplo.invalid/catalogo-fabricante.pdf"] : [],
      pendentes: id === "pr1" ? [{ proposta_id: "pp1", titulo: "Enriquecer Jogo de Juntas (80692)", estado: "pendente", operacao: "conecta.enriquecimento.definir" }] : [] };
  },
  async statusSync() { return { status: "conectada", ultimo_sync_ok_em: iso(-8), ultimo_erro: null }; },
  async chamadas(): Promise<ChamadaFerramenta[]> { return [
    { id: 3, quando: iso(-20), origem: "chat", ferramenta: "ver_produto", risco: "LOW", decisao: "permitida", motivo: null },
    { id: 2, quando: iso(-21), origem: "chat", ferramenta: "bling.produtos.alterar", risco: "MEDIUM", decisao: "requer_aprovacao", motivo: "escrita exige aprovação" },
    { id: 1, quando: iso(-60), origem: "gateway_mcp", ferramenta: "listar_produtos", risco: "LOW", decisao: "permitida", motivo: null }]; },
  async documentos(): Promise<DocumentoFonte[]> { return [{ id: "d1", tipo: "documentacao", titulo: "Boas práticas da API do Bling (exemplo)", fonte: "https://exemplo.invalid/boas-praticas", fonte_versao: "1", status: "validado" }]; },
  async produtosEmAnalise() { return [{ id: "pr1", sku: "80692", nome: PRODUTOS[0].nome }]; },
  async propostas(_l, estado) { return estado ? propostas.filter((p) => p.estado === estado) : propostas; },
  async proposta(id) {
    const proposta = propostas.find((p) => p.id === id); if (!proposta) return null;
    const its = itens[id] ?? [];
    const prods: Record<string, ProdutoResumo> = {}; for (const i of its) { const p = PRODUTOS.find((x) => x.id === i.produto_id); if (p) prods[p.id] = { id: p.id, sku: p.sku, nome: p.nome }; }
    return { proposta, itens: its, operacoes: operacoes[id] ?? [], produtos: prods };
  },
  async dashboard() {
    const c = (valor: number | null, filtro: string, observacao?: string) => ({ valor, filtro, ...(observacao ? { observacao } : {}) });
    return { produtos_sincronizados: c(4, "produtos"), produtos_incompletos: c(4, "produtos:incompletos"), produtos_bloqueados: c(1, "produtos:bloqueados"), produtos_enriquecidos: c(0, "produtos:enriquecidos"),
      categorias_aprovadas: c(0, "taxonomia"), prontos_publicacao: c(0, "produtos:prontos"), imagens_pendentes: c(0, "imagens"), erros_sincronizacao_24h: c(0, "sincronizacao"), ferramentas_em_execucao: c(0, "execucoes"),
      aprovacoes_pendentes: c(2, "aprovacoes"), divergencias: c(1, "produtos:divergencia"), qualidade_seo: c(null, "seo", "ainda não medido"),
      custo_por_agente_mes: [{ provedor: "claude", modelo: "claude-sonnet-5-5", tokens: 18420, custo_estimado: null }, { provedor: "gemini", modelo: "gemini-2.5-flash", tokens: 5210, custo_estimado: 0.0031 }] };
  },
  async lista(_l, filtro): Promise<ListaIndicador> {
    if (filtro === "produtos:bloqueados") return { titulo: "Produtos bloqueados", colunas: ["SKU", "Nome", "Preço", "Estoque", "Site"], linhas: PRODUTOS.filter((p) => travas[p.id]).map((p) => ({ cols: [p.sku, p.nome, p.preco, 3, "não publicado"], href: `/studio?produto=${p.id}` })), vazio: "Nenhum." };
    return { titulo: filtro === "produtos:incompletos" ? "Produtos incompletos" : "Produtos sincronizados", colunas: ["SKU", "Nome", "Preço", "Estoque", "Site"], linhas: PRODUTOS.map((p) => ({ cols: [p.sku ?? "—", p.nome, p.preco, 3, "não publicado"], href: `/studio?produto=${p.id}` })), vazio: "Nenhum." };
  },
  async chaves(): Promise<ChaveMcp[]> { return [
    { id: "k1", nome: "Assistente do escritório", escopos: ["leitura", "propor"], ultimo_uso_em: iso(-40), revogada_em: null, expira_em: iso(60 * 24 * 20), criado_em: iso(-60 * 24 * 10) },
    { id: "k2", nome: "Teste antigo", escopos: ["leitura"], ultimo_uso_em: null, revogada_em: iso(-60 * 24), expira_em: null, criado_em: iso(-60 * 24 * 30) }]; },
  async studio(_l, id): Promise<DadosStudio | null> {
    const p = PRODUTOS.find((x) => x.id === id); if (!p) return null;
    return {
      produto: { id: p.id, sku: p.sku, nome: p.nome, preco: p.preco, estoque: 3, marca: p.marca, gtin: p.gtin, peso_kg: p.peso, descricao_curta: p.desc, categoria_bling_id: "1072643", situacao: "A", publicado: false, descricao_complementar: null, largura_cm: id === "pr1" ? 36 : null, altura_cm: id === "pr1" ? 12 : null, profundidade_cm: id === "pr1" ? 70 : null, unidade: "UN" },
      imagens: id === "pr1" ? [
        { id: "im1", url: svg("#0864a0", "Foto real (exemplo)"), tipo: "real", aprovada: true, principal: true, alt_texto: "Jogo de juntas (exemplo)", licenca_tipo: "propria" },
        { id: "im2", url: svg("#6b4fd3", "Ilustrativa (exemplo)"), tipo: "ilustrativa", aprovada: false, principal: false, alt_texto: null, licenca_tipo: "publica_web" }] : [],
      codigos: id === "pr1" ? [{ tipo: "oem", valor: "EX-OEM-0001", status: "aprovado", fonte: "catálogo (exemplo)" }, { tipo: "oem", valor: "EX-OEM-0002", status: "a_confirmar", fonte: null }] : [],
      aplicacoes: id === "pr1" ? [{ modelo: "HR", motorizacao: "2.5 16V D4CB", ano_inicial: 2013, ano_final: null, status: "aprovado", fonte: "catálogo (exemplo)" }, { modelo: "K2500", motorizacao: "2.5", ano_inicial: null, ano_final: null, status: "a_confirmar", fonte: null }] : [],
      enriquecimento: id === "pr1" ? [{ campo: "descricao_longa", valor: "Jogo completo para retífica do motor, com retentores (texto de exemplo).", status: "aprovado", fonte: "catálogo (exemplo)" }] : [],
      categoriaBling: null, taxonomia: id === "pr1" ? "Motor" : null,
    };
  },
  async travas() { return { ...travas }; },
};
