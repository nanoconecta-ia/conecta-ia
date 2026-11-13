/** Checklist de lançamento: toda decisão de publicação também é revalidada no servidor. */
export type ModoLoja = "teste" | "producao";
export type Checagem = { codigo: string; titulo: string; ok: boolean; detalhe: string };
export type DadosDeLancamento = {
  slug: string; ativa: boolean; politicasAprovadas: boolean; dominioPrincipal: string | null;
  dominioVerificado: boolean; produtosPublicados: number; modoVenda: string; whatsapp: string | null;
};
export function diagnosticarLancamento(x: DadosDeLancamento): Checagem[] {
  const dominio = (x.dominioPrincipal ?? "").toLowerCase();
  const dominioCorreto = x.slug !== "mobis" ||
    (dominio === "mobisautopecas.com.br" || dominio === "www.mobisautopecas.com.br");
  const contato = String(x.whatsapp ?? "").replace(/\D/g, "");
  const whatsappValido = /^55\d{10,11}$/.test(contato);
  const vendaSegura = x.modoVenda === "whatsapp" || x.modoVenda === "catalogo";
  return [
    { codigo:"loja", titulo:"Cadastro da loja ativo", ok:x.ativa, detalhe:x.ativa ? "Loja ativa" : "Loja inativa" },
    { codigo:"politicas", titulo:"Políticas e dados empresariais aprovados", ok:x.politicasAprovadas, detalhe:x.politicasAprovadas ? "Revisão aprovada" : "Revisar e aprovar privacidade, trocas, entrega, garantia, CNPJ e endereço" },
    { codigo:"dominio", titulo:"Domínio principal com DNS e HTTPS verificados", ok:x.dominioVerificado && dominioCorreto, detalhe:x.dominioVerificado && dominioCorreto ? dominio : x.slug === "mobis" ? "Verificar mobisautopecas.com.br (DNS e SSL)" : "Verificar o domínio principal" },
    { codigo:"catalogo", titulo:"Ao menos um produto aprovado e publicado", ok:x.produtosPublicados > 0, detalhe:x.produtosPublicados > 0 ? String(x.produtosPublicados)+" produto(s) publicado(s)" : "Nenhum produto publicado" },
    { codigo:"venda", titulo:"Modo de venda liberado para o piloto", ok:vendaSegura, detalhe:vendaSegura ? (x.modoVenda === "whatsapp" ? "Atendimento por WhatsApp, sem checkout" : "Apenas catálogo") : "Checkout e híbrido ainda exigem homologação separada" },
    { codigo:"contato", titulo:"WhatsApp de atendimento válido", ok:whatsappValido || x.modoVenda === "catalogo", detalhe:whatsappValido ? "Contato configurado" : "Configurar número de atendimento" },
  ];
}
export function prontoParaOnline(checks: Checagem[]): boolean {
  return checks.length === 6 && checks.every((c) => c.ok);
}
export function modoCliente(modo: ModoLoja, venda: string) {
  return {
    ambiente: modo,
    venda_habilitada: modo === "producao" && (venda === "whatsapp" || venda === "checkout" || venda === "hibrido"),
    modo_venda: modo === "teste" ? "catalogo" : venda,
    aviso_teste: modo === "teste" ? "LOJA EM TESTE — avaliação com clientes. Não é possível concluir pedidos neste site." : null,
  };
}
