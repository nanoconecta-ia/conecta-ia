// Provedor GRATUITO (OpenRouter) como provedor de verdade, junto do Gemini: modos desligado | manual | automático.
// Regras de dados (decisão do dono): quando o gratuito responde, ele vê só dados da loja JÁ SANEADOS e SÓ LEITURA:
// nenhuma ferramenta de proposta/escrita, nenhuma pesquisa externa, nenhum anexo. Custo, fornecedor, dado fiscal e credenciais nunca chegam ao modelo
// (as ferramentas de leitura já os omitem). Módulo puro: sem rede, sem banco.
import { IaErro } from "../ia/claude.ts";
import { CONSULTAR_PRODUTO } from "./bling_consultar.ts";
import { FERRAMENTAS_CATALOGO } from "./catalogo_leitura.ts";
import { FALLBACK_FREE_URL, FALLBACK_FREE_MODELO } from "./fallback_free.ts";

export const PROVEDOR_FREE = "openrouter_free" as const;
export const URL_FREE = FALLBACK_FREE_URL;
export const MODELO_FREE_PADRAO = FALLBACK_FREE_MODELO;
/** Únicas ferramentas do gratuito: leitura do produto (Bling/espelho) e do catálogo espelhado (totais, lista, ficha). Nenhuma propõe, grava ou pesquisa fora. */
export const FERRAMENTAS_FREE: readonly string[] = [CONSULTAR_PRODUTO.name, ...FERRAMENTAS_CATALOGO];
/** Erros do provedor escolhido que justificam trocar para o gratuito: sobrecarga/limite, falha do provedor ou tempo esgotado (nunca chave recusada: isso é configuração). */
export const STATUS_TROCA: readonly number[] = [429, 502, 504];

export interface EntradaTroca {
  provedor: string; erro: unknown; iniciouChamadaProvedor: boolean; automatico: boolean;
  anexos: number; textoTransmitido: boolean; propostasCriadas: number;
}
/** Troca automática só quando é seguro refazer o turno: nada foi mostrado, nada foi proposto/gravado e não há anexo. */
export function podeTrocarParaFree(e: EntradaTroca): boolean {
  return e.automatico && e.provedor !== PROVEDOR_FREE && e.iniciouChamadaProvedor && e.anexos === 0 && !e.textoTransmitido && e.propostasCriadas === 0
    && e.erro instanceof IaErro && STATUS_TROCA.includes(e.erro.status);
}

// Sem "\n" no começo do literal: o empacotador do Supabase (deploy --use-api) tratou "\n…" como caminho de arquivo (ENAMETOOLONG).
// Quem usa acrescenta a quebra de linha.
export const SISTEMA_FREE = "MODO GRATUITO: você só CONSULTA (bling_consultar_produto, resumo_loja, listar_produtos e ver_produto). Não existe proposta, gravação nem pesquisa externa neste modo; se o lojista pedir uma alteração, diga que precisa do provedor principal. Nunca peça nem repita custo, fornecedor, dado fiscal ou credencial. Especificação técnica, código OEM e aplicação veicular só com o que uma ferramenta trouxe, com fonte; sem fonte verificada, diga que não tem e o que falta, e não liste códigos de memória.";

export function avisoTroca(de: string, status: number): string {
  const motivo = status === 429 ? "sobrecarregado ou no limite" : status === 504 ? "sem resposta a tempo" : "com falha";
  return `⚠ O provedor ${de} estava ${motivo}; respondi com o modelo gratuito (modo automático). Só consultas de leitura neste modo.`;
}
