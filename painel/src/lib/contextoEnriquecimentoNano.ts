// Integração do Catálogo com o chat do Nano: texto preparado, não ação executada.
// Produto é identificado pelo ID do espelho Bling; OEM e aplicações preservam status.
import type { DadosStudio } from "./conectorDados.ts";
export const LIMITE_ENRIQUECER_CHAT = 20;
export type ProdutoDoLote = { id: string; sku: string|null; nome: string|null; marca: string|null; gtin: string|null; taxonomia_no_id: string|null };
const resumir = (x: string|null|undefined, max=130) =>
  (x??"pendente").replace(/[\u0000-\u001f\u007f]+/g," ").trim().slice(0,max);
export function pedidoEnriquecimentoLote(produtos: readonly ProdutoDoLote[], ids: ReadonlySet<string>):
  {texto:string|null;erro:string|null} {
  const escolhidos = produtos.filter(p=>ids.has(p.id));
  if (!escolhidos.length) return {texto:null,erro:"Selecione ao menos um produto do lote carregado."};
  if (escolhidos.length>LIMITE_ENRIQUECER_CHAT)
    return {texto:null,erro:"Selecione até "+LIMITE_ENRIQUECER_CHAT+" produtos por rodada no chat; os demais continuam no catálogo."};
  const linhas=escolhidos.map((p,i)=>
    (i+1)+". ID="+p.id+"; SKU="+resumir(p.sku,60)+"; NOME="+resumir(p.nome)+"; MARCA="+resumir(p.marca,60)+"; GTIN="+resumir(p.gtin,20)+"; TAXONOMIA="+resumir(p.taxonomia_no_id,50));
  return {erro:null,texto:[
    "Nano, preparar enriquecimento técnico dos seguintes produtos REAIS do espelho Bling da loja autenticada.",
    "O ID é a referência principal; SKU vazio NÃO pode ser inventado. Uma peça física, vários vínculos de aplicação no Conecta.IA.",
    "Para cada item: conferir identidade, fabricante e código; pesquisar OEM/part-number, fonte e data; propor categoria na árvore existente, descrição técnica, compatibilidades por geração/motor/ano e contraindicações. NÃO inventar medidas, GTIN nem referências.",
    "Pesquisar apenas quando houver agente/ferramenta operacional. Fontes oficiais e evidências independentes; marketplace e outra IA não homologam.",
    "Imagens somente DEPOIS da ficha técnica; até 8 candidatas com origem, referência exata e direitos pendentes. Não alterar Bling nem publicar.",
    "Separar por campo os estados confirmado por fonte / a confirmar / divergente / ausente. Enviar propostas à Fila apenas quando a ferramenta autorizada estiver operacional.",
    "Produtos:",...linhas].join("\n")};
}
export function pedidoImagensPorFicha(s: DadosStudio): string {
  const p=s.produto;
  const aprovados=s.codigos.filter(c=>c.status==="aprovado").slice(0,10);
  const pendentes=s.codigos.filter(c=>c.status!=="aprovado").slice(0,8);
  const aplicacoes=s.aplicacoes.slice(0,8);
  return [
    "Nano, pesquisar até OITO fotografias REAIS candidatas desta peça e preparar propostas para aprovação visual. Não gerar fotos sintéticas.",
    "Identidade: produto_id="+p.id+"; SKU Bling="+resumir(p.sku,70)+"; nome="+resumir(p.nome,180)+"; marca="+resumir(p.marca)+"; GTIN="+resumir(p.gtin,18)+".",
    "Taxonomia: "+resumir(s.taxonomia)+"; categoria ERP: "+resumir(s.categoriaBling)+".",
    "Códigos COM APROVAÇÃO: "+(aprovados.map(c=>resumir(c.tipo,25)+":"+resumir(c.valor,70)).join("; ")||"nenhum")+".",
    "Códigos A CONFIRMAR (apenas pesquisa; não são equivalentes): "+(pendentes.map(c=>resumir(c.tipo,25)+":"+resumir(c.valor,70)).join("; ")||"nenhum")+".",
    "Aplicações e estados: "+(aplicacoes.map(a=>resumir(a.modelo,45)+" "+resumir(a.motorizacao,35)+" "+(a.ano_inicial??"?")+"–"+(a.ano_final??"?")+" ["+resumir(a.status,25)+"]").join("; ")||"nenhuma confirmada")+".",
    "Pesquisar peça exata, marca/fabricante, SKU, GTIN e OEM validado. Não buscar apenas por nome genérico ou aplicação pendente.",
    "Firecrawl/SearXNG somente se operacionais. Guardar fonte, data, código escrito na página, licença, resolução e URL. Se evidência ou direitos não forem suficientes, a confirmar.",
    "Não homologar foto por semelhança, remover marca d’água, presumir licença ou alterar imagem de estoque.",
    "Retornar candidatas no bloco de imagens do MESMO produto para escolha humana. Não alterar Bling nem publicar."
  ].join("\n");
}
export function rotaStudioDoProduto(id:string):string|null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? "#/estudio?produto="+id : null;
}