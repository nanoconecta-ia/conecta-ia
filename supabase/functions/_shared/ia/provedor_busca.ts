// Seleciona um unico ProvedorBusca por chamada. Prioridade: SearXNG privado do servidor, Firecrawl da loja (chave colada no painel), Google (legado).
// Nenhuma configuracao chega do frontend ou da entrada do LLM.
import type { ProvedorBusca } from "./busca.ts";
import { provedorGoogle } from "./google.ts";
import { provedorSearxng, type ConfigSearxng } from "./searxng.ts";
import { provedorFirecrawl, type ConfigFirecrawl } from "./firecrawl.ts";

export interface ConfiguracaoBusca {
  searxng?: ConfigSearxng | null;
  firecrawl?: ConfigFirecrawl | null;
  buscaImagem?: { chave: string; cx: string } | null;
  fetch?: typeof fetch;
}
export function escolherProvedorBusca(c: ConfiguracaoBusca): ProvedorBusca | null {
  if (c.searxng) return provedorSearxng(c.searxng, c.fetch);
  if (c.firecrawl) return provedorFirecrawl(c.firecrawl, c.fetch);
  if (c.buscaImagem) return provedorGoogle(c.buscaImagem.chave, c.buscaImagem.cx, c.fetch);
  return null;
}
