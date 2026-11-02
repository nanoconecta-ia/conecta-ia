// Recuperação quando o provedor de IA falha (cota, sobrecarga, indisponível): o Nano não fica mudo.
// O QUE PROVA: reconhece falha DO PROVEDOR (não erro de permissão/validação) e acha o SKU em foco no texto ou nas mensagens anteriores, para o painel
// mostrar a ficha direta do cadastro (ação sem IA `chat_ficha_produto`) e dizer o que ainda dá para fazer sem IA.
// O QUE NÃO PROVA: que a pergunta foi respondida (só a ficha do produto); não troca de LLM, não envia dados a outro provedor e não grava nada.
const FALHA_PROVEDOR = /(sobrecarregad|limite da chave|limite mensal|tente em instantes|provedor.*(indispon|n[aã]o configurad)|n[aã]o consegui concluir|limite tempor[aá]rio)/i;
export const falhaDoProvedor = (mensagem: string): boolean => FALHA_PROVEDOR.test(mensagem);

const CANDIDATO = /(?<![A-Za-z0-9])(?:[A-Za-z]{1,4}-?\d{3,10}|\d{4,9})(?![A-Za-z0-9])/g;
const ehAno = (s: string) => /^\d{4}$/.test(s) && Number(s) >= 1950 && Number(s) <= 2100;

/** Último SKU citado: primeiro no texto novo, depois nas mensagens anteriores (da mais recente para a mais antiga). Anos (1950–2100) não contam. */
export function skuEmFoco(texto: string, anteriores: string[]): string | null {
  for (const t of [texto, ...[...anteriores].reverse()]) {
    const achados = [...(t ?? "").matchAll(CANDIDATO)].map((m) => m[0]).filter((s) => !ehAno(s));
    if (achados.length) return achados[achados.length - 1];
  }
  return null;
}

export const DICA_SEM_IA = "O provedor de IA não respondeu agora. Sem IA você ainda pode: /ficha SKU (ficha do cadastro), /revisar SKU (checklist de revisão) ou abrir o produto no Catálogo e usar \"Corrigir o cadastro agora (sem IA)\". Nada foi enviado a outro provedor.";
export const PREFIXO_FICHA = "O provedor de IA não respondeu agora. Esta é a ficha direta do cadastro (sem IA), do último SKU citado:\n\n";
