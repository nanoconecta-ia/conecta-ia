// Ponte pura de provas para o SEO existente. Somente servidor, sem rede/DML.
// O adaptador AUTENTICADO deve carregar revisão e homologação vigentes da
// autoridade independente. Não aceitar este contrato vindo do agente/cliente.
// Conferência histórica de procedência NÃO é homologação, nem autorização.
import {aplicacaoIndexavel,type AplicacaoSeo} from "../seo/aplicacao.ts";
import type {ProdutoSeo} from "../seo/dados.ts";
import {validarAplicacao,fonteForte,type PropostaAplicacao,type ProdutoTecnico} from "../aplicacoes/regras_aplicacao.ts";
import {projetarPaginaProduto,type Produto,type ContextoVisualAplicacao,type RegistroVisualNo} from "./projecoes.ts";

export interface HomologacaoSeoVigente {
 loja_id:string;produto_id:string;aplicacao_id:string;geracao_id:string;montadora_id:string;motor_id:string;
 estado:"homologada"|"procedencia_conferida"|"revogada";revisao:string;
 produtor:string;aprovador:string;referencia:string;
 proposta:PropostaAplicacao;produtoTecnico:ProdutoTecnico;
 // Prova e texto previamente aprovados, não gerados pelo SEO.
 pagina:AplicacaoSeo;
}
const exato=(s:unknown):s is string=>typeof s==="string"&&!!s.trim()&&s===s.trim();
const camposPagina=["slug","sku","titulo","descricao","modelo","motor","inicio","fim","oem","restricao","contraindicacao","status","visivel","modeloId","fonte","coletadoEm"] as const;
export function reconciliarProvaSeo(loja:string,produtos:Produto[],produtoId:string,aplicacaoId:string,revisaoAtual:string,contextos:readonly ContextoVisualAplicacao[],manifesto:readonly RegistroVisualNo[],pagina:AplicacaoSeo,paisSeo:ProdutoSeo[],homologacoes:readonly HomologacaoSeoVigente[],hoje:string):AplicacaoSeo{
 // Nunca confiar na prova pré-existente enviada junto à página.
 const semProva:AplicacaoSeo={slug:pagina.slug,sku:pagina.sku,titulo:pagina.titulo,descricao:pagina.descricao,modelo:pagina.modelo,motor:pagina.motor,inicio:pagina.inicio,fim:pagina.fim,oem:pagina.oem,restricao:pagina.restricao,contraindicacao:pagina.contraindicacao,status:pagina.status,visivel:pagina.visivel,modeloId:pagina.modeloId,fonte:pagina.fonte,coletadoEm:pagina.coletadoEm};
 if(![loja,produtoId,aplicacaoId,revisaoAtual].every(exato)||!/^\d{4}-\d{2}-\d{2}$/.test(hoje)||!Number.isFinite(Date.parse(hoje))||new Date(hoje).toISOString().slice(0,10)!==hoje)throw Error("escopo SEO inválido");
 if(homologacoes.some(h=>h.loja_id!==loja||h.produto_id!==produtoId||h.aplicacao_id!==aplicacaoId))throw Error("homologação SEO fora do escopo");
 const ficha=projetarPaginaProduto(loja,produtos,produtoId,contextos,manifesto);
 if(!ficha||homologacoes.length!==1)return semProva;
 const h=homologacoes[0],p=produtos.find(x=>x.produto_id===produtoId)!,a=p.aplicacoes.find(x=>x.id===aplicacaoId);
 const f=ficha.aplicacoes.find(x=>x.id===aplicacaoId);
 if(!a||!f||!f.geracao_id||h.geracao_id!==f.geracao_id||h.montadora_id!==a.montadora.id||h.motor_id!==a.motor.id)return semProva;
 if(h.estado!=="homologada"||h.revisao!==revisaoAtual||![h.produtor,h.aprovador,h.referencia].every(exato)||h.produtor===h.aprovador)return semProva;
 if(!camposPagina.every(k=>h.pagina[k]===semProva[k]))return semProva;
 const pr=h.pagina.prova,v=h.proposta.veiculo;
 if(!pr||pr.revisao!==revisaoAtual||pr.referencia!==h.referencia||pr.mercado!=="BR"||f.mercado!=="BR"||semProva.sku!==ficha.sku||semProva.modeloId!==a.modelo.id||semProva.modelo!==a.modelo.rotulo||semProva.motor!==a.motor.rotulo||semProva.inicio!==a.inicio||semProva.fim!==a.fim||!semProva.oem||!f.oems.includes(semProva.oem))return semProva;
 if(h.proposta.loja_id!==loja||h.proposta.sku!==ficha.sku||h.produtoTecnico.loja_id!==loja||h.produtoTecnico.sku!==ficha.sku||!h.produtoTecnico.oem.includes(semProva.oem)||v.marca!==a.montadora.rotulo||v.modelo!==a.modelo.rotulo||v.motor!==a.motor.rotulo||v.ano_inicial!==a.inicio||v.ano_final!==a.fim||v.versao!==contextos.find(c=>c.aplicacao_id===aplicacaoId)?.geracao.rotulo||!["ano_modelo_crlv","fabricacao","comercializacao_brasil","importacao_brasil"].includes(v.tipo_ano??""))return semProva;
 if(!h.proposta.fontes.some(s=>["catalogo_fabricante","manual_montadora"].includes(s.tipo)&&s.codigo_conferido===semProva.oem&&fonteForte(s,h.produtoTecnico,hoje)))return semProva;
 const valida=validarAplicacao(h.proposta,h.produtoTecnico,{acao:"publicar",ator:"usuario",hoje});
 if(!valida.ok||valida.nivel!=="confirmavel")return semProva;
 // Projeta apenas campos do contrato existente. Nenhuma autorização de publicação.
 const candidata:AplicacaoSeo={...semProva,prova:{revisao:pr.revisao,referencia:pr.referencia,aplicacaoSlug:pr.aplicacaoSlug,sku:pr.sku,modeloId:pr.modeloId,motor:pr.motor,inicio:pr.inicio,fim:pr.fim,oem:pr.oem,mercado:pr.mercado,validada:pr.validada}};
 return aplicacaoIndexavel(candidata,paisSeo)?candidata:semProva;
}
