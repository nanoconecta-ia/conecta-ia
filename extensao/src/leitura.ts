// Nano Guardião (issue #166): leitura da tela do ERP aberta no navegador do lojista. Puro (sem DOM): testável no Node.
// Regras: nada sai do navegador neste piloto; campo de senha/oculto nunca é lido; valores sensíveis (custo, fornecedor,
// dados fiscais) são mascarados ANTES de qualquer exibição ou exportação. A tela é lida, nunca alterada.

/** O que o leitor de DOM entrega por campo (acessibilidade primeiro: rótulo associado, aria-label, placeholder). */
export interface CampoBruto {
  rotulo: string;            // texto do <label for>, aria-label, aria-labelledby ou placeholder (o primeiro que existir)
  tipo: string;              // text, number, select, textarea, checkbox, password, hidden...
  valor: string;
  id?: string; nome?: string; // atributos id/name, quando existirem (ajudam a confirmar o mapa; não são confiáveis sozinhos)
  obrigatorio?: boolean;
  visivel: boolean;
}

export interface CampoLido { rotulo: string; chave: string; tipo: string; valor: string; mascarado: boolean; id?: string; nome?: string; obrigatorio: boolean }

/** Normaliza rótulo para comparação: sem acento, minúsculo, sem pontuação, espaços simples. */
export const chaveDe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Rótulos cujo VALOR nunca é exibido nem exportado (mesma política do registro: custo, fornecedor, fiscal, credenciais).
const SENSIVEIS = [/\bcusto\b/, /preco de compra/, /\bfornecedor/, /\bncm\b/, /\bcest\b/, /\bcfop\b/, /\bcst\b/, /tribut/, /\bicms\b/, /\bipi\b/, /\bpis\b/, /\bcofins\b/, /\bsenha\b/, /\btoken\b/, /\bchave\b/, /\bcpf\b/, /\bcnpj\b/];
export const ehSensivel = (rotulo: string) => SENSIVEIS.some((r) => r.test(chaveDe(rotulo)));

export function lerCampos(brutos: readonly CampoBruto[]): CampoLido[] {
  const vistos = new Set<string>();
  const saida: CampoLido[] = [];
  for (const b of brutos) {
    if (!b.visivel || b.tipo === "password" || b.tipo === "hidden" || b.tipo === "file") continue;
    const rotulo = b.rotulo.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!rotulo) continue;
    const chave = chaveDe(rotulo);
    const assinatura = `${chave}|${b.id ?? ""}|${b.nome ?? ""}`;
    if (vistos.has(assinatura)) continue;
    vistos.add(assinatura);
    const mascarado = ehSensivel(rotulo);
    saida.push({ rotulo, chave, tipo: b.tipo, valor: mascarado ? "" : b.valor.slice(0, 2000), mascarado, ...(b.id ? { id: b.id.slice(0, 80) } : {}), ...(b.nome ? { nome: b.nome.slice(0, 80) } : {}), obrigatorio: b.obrigatorio === true });
  }
  return saida.slice(0, 300);
}
