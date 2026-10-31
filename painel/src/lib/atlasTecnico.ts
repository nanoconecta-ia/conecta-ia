/** Regras puras de evidência: não confundir imagem encontrada na web com mídia licenciada. */
export type MidiaCadastro = {
  url: string | null; url_tratada: string | null; alt_texto: string | null;
  tipo: string | null; origem: string | null; direitos: string | null;
  licenca_tipo: string | null; direitos_confirmados_em: string | null;
  aprovada: boolean | null; removida_em: string | null;
};
export type CodigoTecnico = {
  tipo: string; valor: string; fonte: string | null; coletado_em: string | null; status: string;
};
export type AplicacaoTecnica = {
  modelo: string; motorizacao: string | null; ano_inicial: number | null;
  ano_final: number | null; fonte: string | null; coletado_em: string | null;
  status: string; marca_veiculo_id: string | null;
};
export function urlPublicaSegura(candidato: unknown): string | null {
  if (typeof candidato !== "string" || candidato.length > 2000) return null;
  try {
    const url = new URL(candidato);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")
      || /^\d+(?:\.\d+){3}$/.test(host) || host === "[::1]") return null;
    return url.href;
  } catch { return null; }
}
export function fotoAprovada(foto: MidiaCadastro): string | null {
  if (foto.aprovada !== true || foto.removida_em !== null || !foto.direitos_confirmados_em
    || !foto.licenca_tipo?.trim() || !foto.direitos?.trim() || !foto.origem?.trim()) return null;
  return urlPublicaSegura(foto.url_tratada || foto.url);
}
export function fonteAprovada(item: {status:string;fonte:string|null;coletado_em:string|null}): boolean {
  return item.status === "aprovado" && !!item.coletado_em && !!urlPublicaSegura(item.fonte);
}
export function resumirOem(codigos: CodigoTecnico[]): string[] {
  return [...new Set(codigos.filter(c => c.tipo === "oem" && fonteAprovada(c)).map(c => c.valor.trim()).filter(Boolean))];
}
function compactar(s: string, max: number): string {
  const c = s.replace(/\s+/g, " ").trim();
  return c.length <= max ? c : c.slice(0, max + 1).replace(/\s+\S*$/, "").trim();
}
/** Apenas prévia editorial: não altera o ERP nem gera aplicação onde não há fonte. */
export function seoCandidato(p: {nome:string;sku:string;marca:string|null}, codigos:CodigoTecnico[], aplicacoes:AplicacaoTecnica[]) {
  const oem = resumirOem(codigos)[0];
  const aplicacao = aplicacoes.find(fonteAprovada);
  const titulo = compactar([p.nome, p.marca, oem ? "OEM "+oem : null].filter(Boolean).join(" · "), 60);
  const descricao = compactar(
    [p.nome + " (" + p.sku + ").",
     oem ? "Referência OEM documentada: "+oem+"." : "Referência OEM ainda não homologada.",
     aplicacao ? "Aplicação documentada: "+aplicacao.modelo+(aplicacao.motorizacao?" · "+aplicacao.motorizacao:"")+"." : "Confirme aplicação e medidas antes de comprar."].join(" "), 155);
  return {titulo,descricao,publicavel:false as const};
}
