// Seleciona um unico ProvedorBusca por chamada. SearXNG privado tem prioridade; Google e legado.
// Nenhuma configuracao chega do frontend ou da entrada do LLM.
import type { ProvedorBusca } from "./busca.ts";
import { provedorGoogle } from "./google.ts";
import { provedorSearxng, type ConfigSearxng } from "./searxng.ts";

export interface ConfiguracaoBusca {
  searxng?: ConfigSearxng | null;
  buscaImagem?: { chave: string; cx: string } | null;
  fetch?: typeof fetch;
}
export function escolherProvedorBusca(c: ConfiguracaoBusca): ProvedorBusca | null {
  if (c.searxng) return provedorSearxng(c.searxng, c.fetch);
  if (c.buscaImagem) return provedorGoogle(c.buscaImagem.chave, c.buscaImagem.cx, c.fetch);
  return null;
}
