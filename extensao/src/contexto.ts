// Contexto Vivo (ponte ERP): informa ao Conecta.IA/Nano QUAL produto está aberto na tela do ERP. Só com o interruptor ligado pelo lojista.
// Vai o SKU lido da tela; o servidor resolve o produto NA loja da sessão e grava como a pessoa que aprovou o pareamento. Nada é alterado no ERP.
export const SKU_VALIDO = /^[A-Za-z0-9_.\/-]{1,60}$/;
export type PlanoContexto = { acao: "aberto" | "fechado"; sku: string } | null;
export const skuUsavel = (sku: string | null | undefined): string | null => { const t = (sku ?? "").trim(); return SKU_VALIDO.test(t) && !t.startsWith(".") ? t : null; };

/** Decide o que enviar comparando o SKU anterior com o atual: sem mudança não envia nada (sem spam); tela que deixou de ser produto fecha o anterior. */
export function planejarContexto(anterior: string | null, atual: string | null): PlanoContexto {
  const a = skuUsavel(anterior), n = skuUsavel(atual);
  if (n && n !== a) return { acao: "aberto", sku: n };
  if (!n && a) return { acao: "fechado", sku: a };
  return null;
}

export type Chamar = (nome: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
export interface EstadoContexto { sku: string | null; mensagem: string }
export const SEM_ESCOPO = "Reconecte à loja para liberar o compartilhamento do produto aberto (a conexão atual foi criada sem essa permissão).";

/** Aplica o plano. Devolve o novo estado e a mensagem REAL (sucesso do servidor ou erro), nunca uma confirmação presumida. */
export async function publicarContexto(estado: EstadoContexto, atual: string | null, chamar: Chamar): Promise<EstadoContexto> {
  const plano = planejarContexto(estado.sku, atual);
  if (!plano) return estado;
  try {
    const r = await chamar("conecta.set_active_product", { sku: plano.sku, acao: plano.acao });
    if (r.erro) return { sku: estado.sku, mensagem: String(r.erro) };
    return plano.acao === "aberto"
      ? { sku: plano.sku, mensagem: `Compartilhado com o Nano: produto ${plano.sku} (versão ${String(r.versao ?? "?")}).` }
      : { sku: null, mensagem: "Nenhum produto aberto na tela; contexto limpo." };
  } catch (e) {
    const m = (e as Error).message ?? "";
    return { sku: estado.sku, mensagem: /escopo|parear de novo|Permiss/i.test(m) ? SEM_ESCOPO : `Não foi possível compartilhar agora: ${m}` };
  }
}
