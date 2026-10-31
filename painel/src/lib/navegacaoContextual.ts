import type { Item } from "./comandosNL.ts";
/** Guidance only: routes are an allowlist, not evidence of external tool availability. */
type Acao = { rota: string; rotulo: string; descricao: string };
export type Orientacao = { titulo: string; descricao: string; acoes: Acao[] };
const CONTEUDO: Record<string, Orientacao> = {
  "/": { titulo: "Visão geral", descricao: "Veja o que ainda precisa de revisão antes de publicar ou operar.", acoes: [
    {rota:"/catalogo",rotulo:"Conferir produtos",descricao:"Cadastros espelhados do Bling"},
    {rota:"/fila",rotulo:"Revisar propostas",descricao:"Alterações aguardando decisão"},
    {rota:"/taxonomia",rotulo:"Explorar sistemas",descricao:"Montadoras, categorias e motores"}
  ] },
  "/taxonomia": { titulo: "Taxonomia visual", descricao: "Selecione uma categoria, montadora ou motor. Dados sem fonte ficam a confirmar.", acoes: [
    {rota:"/pesquisa",rotulo:"Conferir fontes OEM",descricao:"Pesquisa técnica em homologação"},
    {rota:"/studio",rotulo:"Abrir ficha de produto",descricao:"Veja evidências e requisitos do cadastro"},
    {rota:"/fila",rotulo:"Revisar aplicações",descricao:"Nenhuma gravação sem aprovação"}
  ] },
  "/catalogo": { titulo: "Catálogo", descricao: "Encontre um SKU existente e confira lacunas antes de enriquecer.", acoes: [
    {rota:"/taxonomia",rotulo:"Ver categorias e veículos",descricao:"Navegação visual da taxonomia"},
    {rota:"/pesquisa",rotulo:"Pesquisar referência",descricao:"Fontes públicas, sem preços privados"},
    {rota:"/studio",rotulo:"Revisar ficha",descricao:"Dados reais e comprovação"}
  ] },
  "/pesquisa": { titulo: "Pesquisa técnica", descricao: "Comece por um código público. Confira cada documento antes de propor a descrição.", acoes: [
    {rota:"/taxonomia",rotulo:"Comparar motor e categoria",descricao:"Referências técnicas locais"},
    {rota:"/catalogo",rotulo:"Identificar SKU cadastrado",descricao:"Produto que receberá a proposta"},
    {rota:"/fila",rotulo:"Abrir propostas pendentes",descricao:"Aprovação humana"}
  ] },
  "/fila": { titulo: "Fila de aprovação", descricao: "Compare proposta, fonte e cadastro atual. Nada é aprovado automaticamente.", acoes: [
    {rota:"/studio",rotulo:"Revisar ficha técnica",descricao:"Detalhes do produto"},
    {rota:"/pesquisa",rotulo:"Conferir fonte",descricao:"Pesquisa pública controlada"}
  ] },
  "/studio": { titulo: "Studio de produtos", descricao: "Revise fotos, códigos, descrições e aplicações antes de publicar.", acoes: [
    {rota:"/taxonomia",rotulo:"Consultar taxonomia",descricao:"Categoria e motorização"},
    {rota:"/imagens",rotulo:"Inspecionar fotografias",descricao:"Origem e direitos de imagem"},
    {rota:"/fila",rotulo:"Ver aprovações",descricao:"Propostas e pendências"}
  ] },
  "/imagens": { titulo: "Imagens e SEO", descricao: "Confirme que a fotografia representa a peça real e que existe autorização de uso.", acoes: [
    {rota:"/taxonomia",rotulo:"Rever categorias",descricao:"Montadoras e aplicações"},
    {rota:"/studio",rotulo:"Inspecionar ficha",descricao:"Imagem, SEO e dados do produto"}
  ] },
  "/bling": { titulo: "Bling", descricao: "Consulte o cadastro do ERP. Não execute alterações sem revisão e autorização.", acoes: [
    {rota:"/catalogo",rotulo:"Ver espelho do catálogo",descricao:"Dados disponíveis no Conecta.IA"},
    {rota:"/fila",rotulo:"Conferir propostas",descricao:"Aprovações separadas da escrita"}
  ] },
};
const PADRAO: Orientacao = { titulo: "Área de trabalho", descricao: "Estou nesta tela com você. Podemos abrir outra área sem perder a sessão do painel.", acoes: [
  {rota:"/pesquisa",rotulo:"Pesquisar referências",descricao:"Fontes públicas"},
  {rota:"/taxonomia",rotulo:"Explorar catálogo visual",descricao:"Categorias e motores"}
] };
export function orientarPagina(rota: string, menu: Item[]): Orientacao {
  const permitidas = new Set(menu.map(x=>x[0]));
  const entrada = CONTEUDO[rota] ?? PADRAO;
  return {...entrada,acoes:entrada.acoes.filter(a=>permitidas.has(a.rota))};
}
