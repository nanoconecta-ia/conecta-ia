// Comandos em linguagem natural do Nano.ia que o PRÓPRIO PAINEL executa (sem enviar nada a provedor de IA, sem custo, sem gravar nada):
// abrir telas em sequência, avaliar o layout da tela, dizer o que sabe fazer. Só entende o que existe no menu da loja (nunca inventa tela).
export type Item = [rota: string, titulo: string];
export type Comando =
  | { tipo: "navegar"; passos: Item[]; naoEntendido: string[] }
  | { tipo: "avaliar_layout" }
  | { tipo: "ajuda" }
  | { tipo: "nenhum" };

export const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9/ ,;.]/g, " ").replace(/\s+/g, " ").trim();

// Apelidos por rota (sem acento). A rota só vale se existir no menu recebido.
const APELIDOS: Record<string, string[]> = {
  "/": ["visao geral", "inicio", "pagina inicial", "home", "painel principal", "resumo geral"],
  "/catalogo": ["catalogo", "produtos", "lista de produtos", "pecas"],
  "/pesquisa": ["pesquisa web", "pesquisa tecnica", "pesquisa de pecas", "consultar fontes", "pesquisar catalogo"],
  "/taxonomia": ["taxonomia", "categorias", "arvore de categorias", "tags de busca", "tags", "filtros laterais", "filtros da vitrine", "filtros", "arvore"],
  "/fila": ["fila de aprovacao", "fila", "pendencias", "pendentes", "itens pendentes", "aprovacao de itens"],
  "/imagens": ["imagens e seo", "imagens", "fotos", "seo", "otimizacao para busca"],
  "/studio": ["studio de produtos", "studio", "estudio de produtos", "ficha de produto"],
  "/estudio": ["estudio do agente", "estudio", "configurar agente"],
  "/assistente": ["assistente", "chat completo"],
  "/aparencia": ["aparencia da loja", "aparencia", "tema da loja", "visual da loja"],
  "/banners": ["banners de oferta", "banners", "ofertas", "promocoes"],
  "/condicoes": ["pagamento e entrega", "pagamento", "entrega", "frete", "condicoes"],
  "/integracoes": ["integracoes de ia", "integracoes", "chaves de ia", "provedores"],
  "/gateway": ["gateway mcp", "gateway", "mcp"],
  "/design": ["design system", "design"],
  "/bling": ["bling", "conexao com o bling", "erp"],
  "/backup": ["backup do bling", "backup"],
  "/contador": ["contador", "fiscal", "area do contador"],
  "/central": ["central de inteligencia", "central"],
  "/indicadores": ["indicadores", "metricas", "numeros"],
  "/conector": ["nano ia", "conector"],
  "/meu-agente": ["conectar meu agente", "meu agente"],
  "/aprovacoes": ["aprovacoes", "central de aprovacoes"],
  "/dispositivos": ["dispositivos", "aparelhos"],
};
const VERBOS = /\b(abr[ae]r?|abra|abre|ir|va|vai|vamos|me leva|leva|levar|mostr[ae]r?|mostra|quero ver|ver|exib[ae]|exibir|navegue|navegar|acesse|acessar|entra|entrar|go)\b/;
const SEPARADOR = /\s*(?:,|;|\.|\be depois\b|\bdepois\b|\bem seguida\b|\bentao\b|\bsucessivamente\b|\be tambem\b|\be\b)\s*/;

/** Encontra a rota que o trecho cita: o apelido mais longo vence ("fila de aprovacao" antes de "fila"); só rotas do menu. */
export function acharRota(trecho: string, menu: Item[]): Item | null {
  const t = ` ${sem(trecho)} `;
  let melhor: { item: Item; tam: number } | null = null;
  for (const item of menu) {
    const nomes = [sem(item[1]), ...(APELIDOS[item[0]] ?? [])];
    for (const n of nomes) {
      if (n && t.includes(` ${n} `) && (!melhor || n.length > melhor.tam)) melhor = { item, tam: n.length };
    }
  }
  return melhor?.item ?? null;
}

export function interpretar(texto: string, menu: Item[]): Comando {
  const t = sem(texto);
  if (!t) return { tipo: "nenhum" };
  // Pedidos operacionais com produtos, Bling ou pesquisa técnica devem chegar ao agente,
  // mesmo quando citam "ferramentas", "imagens" ou "aprovação".
  if (/\b(ci\d{5,}|sku|gtin|ean|oem|ncm|nf e|nota fiscal|cadastro|cadastrar|produto|produtos|pesquise|consulte|pesquisar|consultar)\b/.test(t) && /\b(consulte|consultar|pesquise|pesquisar|cadastro|cadastrar|produto|produtos|sku|oem|gtin|ean)\b/.test(t)) return { tipo: "nenhum" };
  if (/\b(avali[ae]r?|avaliacao|revis[ae]r?|analis[ae]r?|audit[ae]r?)\b.*\b(layout|tela|pagina|design|visual|interface)\b/.test(t) || /\b(layout|interface)\b.*\b(como esta|esta bom|tem problema)\b/.test(t)) return { tipo: "avaliar_layout" };
  if (/\b(o que (voce )?(sabe|consegue|pode) fazer|quais (sao )?(as )?(suas )?(funcoes|funcionalidades|ferramentas|telas)|ajuda|como voce funciona|o que tem no sistema)\b/.test(t)) return { tipo: "ajuda" };
  if (!VERBOS.test(t)) return { tipo: "nenhum" };
  const partes = t.split(SEPARADOR).map((p) => p.trim()).filter(Boolean);
  const passos: Item[] = []; const naoEntendido: string[] = [];
  for (const p of partes) {
    const limpo = p.replace(VERBOS, " ").replace(/\b(o|a|os|as|para|pra|na|no|nas|nos|do|da|de|tela|pagina|por favor|favor|me|agora|primeiro|depois)\b/g, " ").replace(/\s+/g, " ").trim();
    if (!limpo) continue;
    const r = acharRota(limpo, menu);
    if (r) { if (passos.at(-1)?.[0] !== r[0]) passos.push(r); } else naoEntendido.push(limpo);
  }
  return passos.length ? { tipo: "navegar", passos, naoEntendido } : { tipo: "nenhum" };
}

/** Texto do "o que eu sei fazer": só o que está no menu desta loja. */
export function textoAjuda(menu: Item[]): string {
  const telas = menu.map((m) => m[1]).join(", ");
  return `Eu abro qualquer tela do painel quando você pedir, até em sequência ("abre o catálogo e depois a taxonomia e a fila de aprovação"), avalio o layout da tela em que você está ("avalie o layout"), resumo a loja e mostro o que está pendente. Telas disponíveis para você: ${telas}. Navegar e avaliar o layout acontece aqui no painel, sem enviar nada a um provedor de IA e sem alterar dados.`;
}
