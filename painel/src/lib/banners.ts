// Banners de oferta: regras de exibição no painel. A decisão final (publicado, período, limite) é do banco; aqui só traduzimos para o lojista.
export type Estilo = "auto" | "padrao" | "flash";
export interface Banner { id: string; produto_id: string; chamada: string | null; estilo: Estilo; inicio: string; fim: string | null; ativo: boolean }
export type Situacao = "rascunho" | "agendado" | "no-ar" | "encerrado";
export const LIMITE_ATIVOS = 5;

export function situacao(b: Pick<Banner, "ativo" | "inicio" | "fim">, agora: Date = new Date()): Situacao {
  if (!b.ativo) return "rascunho";
  if (b.fim && new Date(b.fim) <= agora) return "encerrado";
  if (new Date(b.inicio) > agora) return "agendado";
  return "no-ar";
}
export const ROTULO_SITUACAO: Record<Situacao, string> = { rascunho: "RASCUNHO", agendado: "AGENDADO", "no-ar": "NO AR", encerrado: "ENCERRADO" };

/** Ids dos nós da área Motor (nó raiz com slug "motor" e todos os descendentes). */
export function nosDoMotor(nos: { id: string; pai_id: string | null; slug: string }[]): Set<string> {
  const raiz = nos.find((n) => n.slug === "motor" && n.pai_id == null);
  const ids = new Set<string>();
  if (!raiz) return ids;
  ids.add(raiz.id);
  let cresceu = true;
  while (cresceu) { cresceu = false; for (const n of nos) if (n.pai_id && ids.has(n.pai_id) && !ids.has(n.id)) { ids.add(n.id); cresceu = true; } }
  return ids;
}
/** Mesma regra do banco (banners_da_vitrine): flash manual, ou automático quando o produto está na área Motor. */
export function ehFlash(estilo: Estilo, taxonomiaNoId: string | null, motor: Set<string>): boolean {
  return estilo === "flash" || (estilo === "auto" && !!taxonomiaNoId && motor.has(taxonomiaNoId));
}

/** Converte o valor de <input type="datetime-local"> (horário local) em ISO; vazio => null. */
export function isoDeLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export function validarFormulario(f: { produto: string; chamada: string; inicio: string; fim: string }): string | null {
  if (!f.produto) return "Escolha o produto.";
  if (f.chamada.length > 80) return "A chamada pode ter no máximo 80 caracteres.";
  const i = isoDeLocal(f.inicio), fim = isoDeLocal(f.fim);
  if (f.inicio && !i) return "Início inválido.";
  if (f.fim && !fim) return "Fim inválido.";
  if (i && fim && fim <= i) return "O fim precisa ser depois do início.";
  return null;
}
/** Tradução do erro do banco para o lojista. */
export function erroBanner(codigo: string | undefined, mensagem: string | undefined): string {
  if (codigo === "42501") return "Só o lojista da loja pode gerenciar banners.";
  if (mensagem?.includes("máximo de 5")) return `Já existem ${LIMITE_ATIVOS} banners no ar ou agendados. Desative um antes.`;
  if (mensagem?.includes("publicado")) return "Só produto publicado pode ter banner ativo. Mostre o produto no site primeiro.";
  return "Não foi possível salvar o banner.";
}

/** Mensagem pronta do vendedor para o cliente (abre o WhatsApp para escolher o contato). Sem preço digitado: o valor vale o do Bling na hora. */
export function mensagemParaCliente(nome: string, sku: string, flash: boolean): string {
  return `${flash ? "Oferta relâmpago" : "Separei esta oferta para você"}: ${nome} (cód. ${sku}). Me chame aqui para fechar.`;
}
export function linkEnvioWhatsapp(texto: string): string { return `https://wa.me/?text=${encodeURIComponent(texto)}`; }
