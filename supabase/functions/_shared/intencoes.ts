// Assistentes sem provedor de IA: reconhecem a intenção por palavras-chave e respondem SÓ com dados do banco.
// Quando um provedor for ligado (camada OpenAI-compatível), ele entra por trás desta mesma interface.
export type IntencaoLojista = "resumo" | "pendentes" | "incompletos" | "taxonomia" | "bling" | "ajuda";
export type IntencaoCliente = "preco" | "estoque" | "aplicacao" | "marca" | "codigo" | "comprar" | "outra";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tem = (t: string, ...ps: string[]) => ps.some((p) => t.includes(p));

export function intencaoLojista(texto: string): IntencaoLojista {
  const t = semAcento(texto);
  if (tem(t, "pendent", "aprovar", "fila", "confirmar")) return "pendentes";
  if (tem(t, "incomplet", "faltando", "falta", "publicar", "sem imagem", "sem sku")) return "incompletos";
  if (tem(t, "taxonomia", "categoria", "arvore")) return "taxonomia";
  if (tem(t, "bling", "conex", "sincron")) return "bling";
  if (tem(t, "resumo", "quantos", "visao", "status", "como esta")) return "resumo";
  return "ajuda";
}

export function intencaoCliente(texto: string): IntencaoCliente {
  const t = semAcento(texto);
  if (tem(t, "comprar", "pedido", "quero", "reservar")) return "comprar";
  if (tem(t, "preco", "valor", "quanto custa", "quanto")) return "preco";
  if (tem(t, "estoque", "disponivel", "tem em")) return "estoque";
  if (tem(t, "serve", "compativel", "aplica", "carro", "veiculo", "motor", "ano ")) return "aplicacao";
  if (tem(t, "marca", "fabricante")) return "marca";
  if (tem(t, "codigo", "referencia", "oem", "original")) return "codigo";
  return "outra";
}

export const AJUDA_LOJISTA =
  "Posso responder sobre: resumo da loja, o que está pendente de aprovação, produtos incompletos, a taxonomia e a conexão com o Bling. " +
  "Para decidir um item, use os botões Aprovar/Rejeitar na fila.";

export interface ProdutoPublico {
  nome: string; sku: string | null; preco: number | null; estoque: number | null;
  marca_peca?: string | null; aplicacoes: string[]; codigos: string[];
}

/** Resposta ao cliente: só fatos aprovados; sem confirmação, diz que não tem e leva ao WhatsApp. Nunca inventa. */
export function responderCliente(i: IntencaoCliente, p: ProdutoPublico, whatsappUrl: string | null): string {
  const levar = whatsappUrl ? ` Para confirmar, fale com a loja: ${whatsappUrl}` : " Para confirmar, fale com a loja.";
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  switch (i) {
    case "preco": return p.preco != null ? `${p.nome}: ${brl(p.preco)}. O valor final é confirmado pela loja na compra.` : `Não tenho o preço confirmado.${levar}`;
    case "estoque": return p.estoque != null ? (p.estoque > 0 ? `Há ${p.estoque} em estoque no último dado sincronizado.${levar}` : `Sem estoque no último dado sincronizado.${levar}`) : `Não tenho o estoque confirmado.${levar}`;
    case "aplicacao": return p.aplicacoes.length ? `Aplicações confirmadas: ${p.aplicacoes.join("; ")}.${levar}` : `Ainda não tenho aplicação veicular confirmada para esta peça.${levar}`;
    case "marca": return p.marca_peca ? `Marca da peça: ${p.marca_peca}.` : `Ainda não tenho a marca confirmada.${levar}`;
    case "codigo": return p.codigos.length ? `Códigos confirmados: ${p.codigos.join(", ")}.` : `Ainda não tenho códigos de referência confirmados.${levar}`;
    case "comprar": return `Para comprar ${p.nome}, fale com a loja.${whatsappUrl ? ` ${whatsappUrl}` : ""}`;
    default: return `Posso informar preço, estoque, marca, códigos e aplicação confirmados de ${p.nome}.${levar}`;
  }
}
