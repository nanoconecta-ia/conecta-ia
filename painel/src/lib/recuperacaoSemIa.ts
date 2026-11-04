// Recuperação quando o provedor de IA falha (cota, sobrecarga, indisponível): o Nano não fica mudo.
// O QUE PROVA: reconhece falha DO PROVEDOR (não erro de permissão/validação) e acha o SKU em foco no texto ou nas mensagens anteriores, para o painel
// mostrar a ficha direta do cadastro (ação sem IA `chat_ficha_produto`) e dizer o que ainda dá para fazer sem IA.
// O QUE NÃO PROVA: que a pergunta foi respondida (só a ficha do produto); não troca de LLM, não envia dados a outro provedor e não grava nada.
const FALHA_PROVEDOR = /(sobrecarregad|limite da chave|limite mensal|tente em instantes|provedor.*(indispon|n[aã]o configurad)|n[aã]o consegui concluir|limite tempor[aá]rio)/i;
export const falhaDoProvedor = (mensagem: string): boolean => FALHA_PROVEDOR.test(mensagem);

// Captura tokens inteiros; nunca corta um SKU com vários hífens.
const CANDIDATO = /(?<![A-Za-z0-9_.\/-])[A-Za-z0-9]+(?:[-_.\/][A-Za-z0-9]+)*(?![A-Za-z0-9_.\/-])/g;
const ehAno = (s: string) => /^\d{4}$/.test(s) && Number(s) >= 1950 && Number(s) <= 2100;
const plausivel = (s: string) => s.length <= 60 && /\d{3}/.test(s) && !ehAno(s);
const unicos = (v: string[]) => [...new Set(v)];

/** SKU explícito tem prioridade. Ambiguidade no turno atual bloqueia a consulta, inclusive ao histórico. */
export function skuEmFoco(texto: string, anteriores: string[]): string | null {
  for (const t of [texto, ...[...anteriores].reverse()]) {
    const explicitos = unicos([...t.matchAll(/(?:\bSKU(?:\s*[:=]\s*|\s+)|\/(?:ficha|revisar)\s+)([A-Za-z0-9]+(?:[-_.\/][A-Za-z0-9]+)*)/gi)]
      .map(m => m[1]));
    if (explicitos.length) return explicitos.length === 1 && explicitos[0].length <= 60 ? explicitos[0] : null;
    const achados = unicos([...t.matchAll(CANDIDATO)].map(m => m[0]).filter(plausivel));
    if (achados.length) return achados.length === 1 ? achados[0] : null;
  }
  return null;
}

export function erroDoChat(corpo: Record<string, unknown>): Error {
  return Object.assign(new Error(String(corpo.erro ?? corpo.resposta ?? "Não foi possível concluir.")), {
    categoria_erro: corpo.categoria_erro, origem_erro: corpo.origem_erro, request_id: corpo.request_id,
  });
}
export function deveRecuperarSemIa(erro: unknown): boolean {
  const e = erro as { categoria_erro?: unknown; origem_erro?: unknown };
  if (e?.origem_erro && e.origem_erro !== "provedor") return false;
  if (typeof e?.categoria_erro === "string") return ["limite", "indisponivel", "tempo_esgotado", "configuracao", "nao_configurado"].includes(e.categoria_erro);
  // Compatibilidade com servidores anteriores ao diagnóstico estruturado.
  return falhaDoProvedor(erro instanceof Error ? erro.message : String(erro));
}
export function mensagemFalhaFicha(erro: unknown): string {
  return (erro as { categoria_erro?: unknown })?.categoria_erro === "sku_nao_encontrado"
    ? "SKU não encontrado na consulta exata. Confira o código; nenhum outro produto foi selecionado."
    : "Erro de ferramenta: não foi possível confirmar a ficha do SKU solicitado. Tente /ficha SKU novamente.";
}

export const DICA_SEM_IA = "O provedor de IA não respondeu agora. Informe um único SKU explicitamente para consultar sua ficha. Sem IA você ainda pode: /ficha SKU (ficha do cadastro), /revisar SKU (checklist de revisão) ou abrir o produto no Catálogo e usar \"Corrigir o cadastro agora (sem IA)\". Nada foi enviado a outro provedor.";
export const PREFIXO_FICHA = "O provedor de IA não respondeu agora. Esta é a ficha direta do cadastro (sem IA), do SKU solicitado:\n\n";
