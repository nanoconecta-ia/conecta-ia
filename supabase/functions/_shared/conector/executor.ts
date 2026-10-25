// Executor do Nano.ia: só roda o que foi APROVADO (o banco revalida aprovação, hash, prazo, trava e liberação em
// agente_proposta_iniciar_execucao). Para cada item: abre a tentativa, passa pelo Policy Engine, escreve pela porta,
// LÊ DE VOLTA e só então confirma. Timeout/5xx em escrita => "desconhecida" (nunca "falhou" e nunca repetir às cegas).
import { buscarDefinicao } from "./registro.ts";
import { decidir } from "./policy.ts";
import { antesIntacto, divergencias, montarCorpoProduto } from "./bling_campos.ts";
import { TimeoutBling, type PortaBling } from "./porta_bling.ts";
import type { DefinicaoFerramenta } from "./tipos.ts";

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;

export interface ItemExecucao { item_id: string; produto_id: string | null; operacao: string; alvo: string | null; campos: string[]; antes: any; depois: any; idempotency_key: string }
export interface RelatorioItem { item_id: string; operacao: string; estado: "confirmada" | "falhou" | "desconhecida"; motivo?: string; evidencia?: unknown }
export interface RelatorioExecucao { proposta_id: string; itens: RelatorioItem[]; estado_final?: string; erro?: string }

const chamar = async (rpc: Rpc, fn: string, args: Record<string, unknown>) => {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

export interface OpcoesExecucao {
  rpc: Rpc; bling: PortaBling; lojaId: string; propostaId: string;
  /** EMERGENCY STOP: conferido a cada item. */
  parar?: () => boolean;
  /** Permite os testes usarem variantes do registro (ex.: ferramenta Bling 'ativa' com porta mock). */
  definicao?: (id: string) => DefinicaoFerramenta | undefined;
}

type Veredito = { estado: "confirmada" | "falhou" | "desconhecida"; motivo?: string; evidencia?: unknown; resposta?: unknown };

/** Escrita no Bling + leitura de confirmação. Compartilhada pelo executor real (porta mock/liberada) e pelo ensaio. */
export async function escreverEConfirmarNoBling(bling: PortaBling, op: string, item: ItemExecucao, aoEnviar?: () => Promise<void>): Promise<Veredito> {
  const alterar = op === "bling.produtos.alterar", criarProduto = op === "bling.produtos.criar", criarCategoria = op === "bling.categorias.criar";
  if (!alterar && !criarProduto && !criarCategoria) return { estado: "falhou", motivo: `operacao_nao_suportada: ${op}` };
  let corpo: Record<string, unknown>;
  if (criarCategoria) {
    const d = item.depois ?? {};
    if (typeof d.descricao !== "string" || !d.descricao.trim()) return { estado: "falhou", motivo: "categoria sem descrição" };
    corpo = { descricao: d.descricao.trim(), ...(d.categoria_pai_id ? { categoriaPai: { id: Number(d.categoria_pai_id) } } : {}) };
  } else {
    const m = montarCorpoProduto(item.depois ?? {});
    if (m.erros.length) return { estado: "falhou", motivo: `corpo_invalido: ${m.erros.join("; ")}` };
    corpo = m.corpo;
  }
  if (alterar && !(item.alvo && /^\d+$/.test(item.alvo))) return { estado: "falhou", motivo: "alvo (id do produto no Bling) ausente ou inválido" };

  await aoEnviar?.();
  let r;
  try { r = await bling.chamar(op, { id: item.alvo ?? undefined, corpo }, item.idempotency_key); }
  catch (e) { return { estado: "desconhecida", motivo: e instanceof TimeoutBling ? "timeout na escrita" : "falha de rede na escrita" }; }
  if (r.status === 429) return { estado: "falhou", motivo: "limite de requisições do Bling (não processado); tentar mais tarde" };
  if (r.status === 401) return { estado: "falhou", motivo: "acesso ao Bling expirou; reconectar" };
  if (r.status >= 500) return { estado: "desconhecida", motivo: `Bling respondeu ${r.status}; pode ter gravado` };
  if (r.status < 200 || r.status >= 300) return { estado: "falhou", motivo: `Bling recusou (${r.status})`, resposta: { status: r.status } };

  // Leitura de confirmação: sem ela, não há sucesso.
  try {
    if (criarCategoria) {
      const l = await bling.ler("bling.categorias.consultar", {});
      const achou = ((l.corpo as any)?.data ?? []).find((c: any) => c.descricao === corpo.descricao);
      return achou ? { estado: "confirmada", evidencia: { leitura: achou }, resposta: { status: r.status } } : { estado: "desconhecida", motivo: "gravou segundo o Bling, mas a categoria não apareceu na leitura" };
    }
    let id = item.alvo ?? "";
    if (criarProduto) {
      id = String((r.corpo as any)?.data?.id ?? "");
      if (!id) return { estado: "desconhecida", motivo: "Bling não devolveu o id do produto criado" };
    }
    const l = await bling.ler("bling.produtos.confirmar", { id });
    if (l.status !== 200) return { estado: "desconhecida", motivo: `leitura de confirmação falhou (${l.status})` };
    const dados = (l.corpo as any)?.data ?? {};
    const dif = divergencias(corpo, dados);
    return dif.length === 0
      ? { estado: "confirmada", evidencia: { leitura: dados, comparados: Object.keys(corpo) }, resposta: { status: r.status, id } }
      : { estado: "falhou", motivo: `divergência após gravar: ${dif.join("; ")}`, evidencia: { leitura: dados, divergencias: dif }, resposta: { status: r.status, id } };
  } catch {
    return { estado: "desconhecida", motivo: "gravou, mas a leitura de confirmação não respondeu" };
  }
}

export async function executarProposta(o: OpcoesExecucao): Promise<RelatorioExecucao> {
  const rel: RelatorioExecucao = { proposta_id: o.propostaId, itens: [] };
  let itens: ItemExecucao[];
  try { itens = await chamar(o.rpc, "agente_proposta_iniciar_execucao", { p_loja: o.lojaId, p_proposta: o.propostaId }); }
  catch (e) { rel.erro = (e as Error).message; return rel; }
  const achar = o.definicao ?? buscarDefinicao;

  for (const item of itens) {
    const def = achar(item.operacao);
    let opId: string | null = null;
    try {
      opId = await chamar(o.rpc, "agente_operacao_abrir", { p_loja: o.lojaId, p_item: item.item_id, p_ferramenta: item.operacao, p_requisicao: { alvo: item.alvo, campos: item.campos } });
      const fechar = (v: Veredito) => chamar(o.rpc, "agente_operacao_fechar", { p_loja: o.lojaId, p_operacao: opId, p_estado: v.estado, p_resposta: v.resposta ?? null, p_evidencia: v.evidencia ?? null, p_erro: v.motivo ?? null })
        .then(() => { rel.itens.push({ item_id: item.item_id, operacao: item.operacao, estado: v.estado, motivo: v.motivo, evidencia: v.evidencia }); });

      if (o.parar?.()) { await fechar({ estado: "falhou", motivo: "parada_de_emergencia: item não executado" }); continue; }
      const p = decidir(def, { origem: "executor", aprovacaoValida: true, simulado: false, escritaRealLiberada: true, produtoTravado: false });
      if (p.decisao !== "permitida") { await fechar({ estado: "falhou", motivo: `policy: ${p.decisao}: ${p.motivo}` }); continue; }

      const enviada = () => chamar(o.rpc, "agente_operacao_marcar_enviada", { p_loja: o.lojaId, p_operacao: opId });
      let v: Veredito;
      if (item.operacao === "conecta.enriquecimento.definir" || item.operacao === "conecta.publicacao.publicar") {
        await enviada();
        const rpc = item.operacao === "conecta.enriquecimento.definir" ? "agente_aplicar_enriquecimento" : "agente_aplicar_publicacao";
        try {
          const lido = await chamar(o.rpc, rpc, { p_loja: o.lojaId, p_item: item.item_id });
          const esperado = item.operacao === "conecta.publicacao.publicar" ? { publicado: true } : item.depois;
          const dif = Object.entries(esperado ?? {}).filter(([k, val]) => JSON.stringify(lido?.[k]) !== JSON.stringify(val));
          v = dif.length === 0 ? { estado: "confirmada", evidencia: { leitura: lido } } : { estado: "falhou", motivo: `divergência na leitura: ${dif.map(([k]) => k).join(", ")}`, evidencia: { leitura: lido } };
        } catch (e) { v = { estado: "falhou", motivo: (e as Error).message.slice(0, 300) }; }
      } else {
        v = await escreverEConfirmarNoBling(o.bling, item.operacao, item, enviada);
      }
      await fechar(v);
    } catch (e) {
      // Falha ao registrar/abrir: se a tentativa ficou aberta, o banco impede nova tentativa até reconciliar.
      rel.itens.push({ item_id: item.item_id, operacao: item.operacao, estado: "desconhecida", motivo: `erro de controle: ${(e as Error).message.slice(0, 200)}` });
    }
  }
  try { rel.estado_final = await chamar(o.rpc, "agente_proposta_finalizar", { p_loja: o.lojaId, p_proposta: o.propostaId }); }
  catch (e) { rel.erro = (e as Error).message; }
  return rel;
}

/** Reconcilia uma operação "desconhecida" lendo o Bling: prova de que gravou ou de que NÃO gravou. Sem prova => indeterminado. */
export async function reconciliar(o: { rpc: Rpc; bling: PortaBling; lojaId: string; operacaoId: string; userId: string; item: ItemExecucao }): Promise<"gravado" | "nao_gravado" | "indeterminado"> {
  const { item, bling } = o;
  let resultado: "gravado" | "nao_gravado" | "indeterminado" = "indeterminado"; let evidencia: unknown = {};
  if (item.operacao === "bling.produtos.alterar" && item.alvo) {
    const { corpo } = montarCorpoProduto(item.depois ?? {});
    const l = await bling.ler("bling.produtos.confirmar", { id: item.alvo });
    const dados = (l.corpo as any)?.data;
    if (l.status === 200 && dados) {
      if (divergencias(corpo, dados).length === 0) { resultado = "gravado"; evidencia = { leitura: dados, regra: "o produto já contém todos os valores propostos" }; }
      else if (antesIntacto(item.antes ?? {}, dados)) { resultado = "nao_gravado"; evidencia = { leitura: dados, regra: "o produto ainda contém exatamente os valores anteriores" }; }
    }
  } else if (item.operacao === "bling.produtos.criar") {
    const sku = (item.depois ?? {}).sku ?? (item.depois ?? {}).codigo;
    if (typeof sku === "string") {
      const l = await bling.ler("bling.produtos.consultar", { sku });
      const achados = (l.corpo as any)?.data ?? [];
      if (l.status === 200) { resultado = achados.length ? "gravado" : "nao_gravado"; evidencia = { consulta_por_sku: sku, encontrados: achados.length }; }
    }
  } else if (item.operacao === "bling.categorias.criar") {
    const l = await bling.ler("bling.categorias.consultar", {});
    if (l.status === 200) { const achou = ((l.corpo as any)?.data ?? []).some((c: any) => c.descricao === (item.depois ?? {}).descricao); resultado = achou ? "gravado" : "nao_gravado"; evidencia = { listagem_de_categorias: true, encontrou: achou }; }
  }
  if (resultado !== "indeterminado") await chamar(o.rpc, "agente_operacao_reconciliar", { p_loja: o.lojaId, p_operacao: o.operacaoId, p_resultado: resultado, p_evidencia: evidencia, p_user: o.userId });
  return resultado;
}

export interface RelatorioSimulacao { proposta_id: string; simulado: true; itens: { item_id: string; operacao: string; ok: boolean; motivo?: string; previsto?: unknown; confirmacao_simulada?: unknown }[]; simulacao_id?: string }

/** ENSAIO: valida a aprovação e roda cada item contra a porta SIMULADA. Não muda estado de item, proposta nem produto. */
export async function simularProposta(o: { rpc: Rpc; bling: PortaBling; lojaId: string; propostaId: string; userId: string; definicao?: (id: string) => DefinicaoFerramenta | undefined }): Promise<RelatorioSimulacao> {
  if (!o.bling.simulado) throw new Error("ensaio exige porta simulada (mock)");
  const itens: ItemExecucao[] = await chamar(o.rpc, "agente_proposta_validar", { p_loja: o.lojaId, p_proposta: o.propostaId });
  const achar = o.definicao ?? buscarDefinicao;
  const rel: RelatorioSimulacao = { proposta_id: o.propostaId, simulado: true, itens: [] };
  for (const item of itens) {
    const def = achar(item.operacao);
    const p = decidir(def, { origem: "executor", aprovacaoValida: true, simulado: true, produtoTravado: false });
    if (p.decisao !== "simulada" && p.decisao !== "permitida") { rel.itens.push({ item_id: item.item_id, operacao: item.operacao, ok: false, motivo: `policy: ${p.motivo}` }); continue; }
    if (item.operacao.startsWith("bling.")) {
      const v = await escreverEConfirmarNoBling(o.bling, item.operacao, item);
      rel.itens.push({ item_id: item.item_id, operacao: item.operacao, ok: v.estado === "confirmada", motivo: v.motivo, previsto: v.resposta, confirmacao_simulada: v.evidencia });
    } else {
      rel.itens.push({ item_id: item.item_id, operacao: item.operacao, ok: true, previsto: item.depois, motivo: "interna: nada é gravado no ensaio" });
    }
  }
  rel.simulacao_id = await chamar(o.rpc, "agente_simulacao_registrar", { p_loja: o.lojaId, p_proposta: o.propostaId, p_user: o.userId, p_resultado: rel });
  return rel;
}
