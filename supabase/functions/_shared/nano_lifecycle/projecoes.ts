// Projeções puras da matriz de nós: SEM rede, escrita no ERP ou publicação.
// O adaptador servidor deve fornecer somente dados da loja autorizada, com aprovação
// e evidência verificadas no banco. Flags recebidas de um agente externo não são prova.
export interface Fato { aprovado: boolean; fonte: string; consultado_em: string }
export interface No extends Fato { id: string; rotulo: string; icone?: { url: string; direitos: boolean; aprovado: boolean } }
export interface Aplicacao extends Fato { id: string; montadora: No; modelo: No; motor: No; cilindrada?: string; inicio: number; fim: number | null; mercado: string; oems: (Fato & { codigo: string })[]; restricoes?: string }
export interface Produto { loja_id: string; produto_id: string; bling_id: string; sku: string; nome: string; ativo: boolean; publicado: boolean; marca?: No; fabricante?: No; categoria: No[]; mpn?: Fato & {codigo:string}; aplicacoes: Aplicacao[] }
export interface Filtro { montadora?: string; modelo?: string; motor?: string; ano?: number; cilindrada?: string; categoria?: string; marca?: string; fabricante?: string; busca?: string }
const valido=(f: Fato)=>f.aprovado===true && !!f.fonte?.trim() && !!f.consultado_em && Number.isFinite(Date.parse(f.consultado_em));
const noOk=(n:No)=>valido(n)&&!!n.id?.trim()&&!!n.rotulo?.trim();
const cod=(x:string)=>x.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const texto=(x:string)=>x.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const esc=(x:string)=>x.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const aplica=(a:Aplicacao)=>valido(a)&&!!a.id&&noOk(a.montadora)&&noOk(a.modelo)&&noOk(a.motor)&&a.mercado==="BR"&&Number.isInteger(a.inicio)&&a.inicio>=1900&&(a.fim===null||Number.isInteger(a.fim)&&a.fim>=a.inicio);
const refs=(a:Aplicacao)=>a.oems.filter(x=>valido(x)&&!!cod(x.codigo)).map(x=>x.codigo);
const id=(p:Produto)=>JSON.stringify([p.loja_id,p.produto_id]);
function elegiveis(loja:string,ps:Produto[],publico:boolean):Produto[]{
  if(!loja||ps.some(p=>p.loja_id!==loja))throw new Error("escopo de loja inválido");
  const vistos=new Set<string>(), skuIds=new Map<string,Set<string>>(), blingIds=new Map<string,Set<string>>();
  for(const p of ps){if(!p.sku?.trim()||!p.bling_id||!p.produto_id)continue; for(const [map,k] of [[skuIds,p.sku.trim().toUpperCase()],[blingIds,p.bling_id]] as const){const s=map.get(k)??new Set<string>();s.add(p.produto_id);map.set(k,s)}}
  return ps.filter(p=>{if(!p.ativo||publico&&!p.publicado||!p.sku?.trim()||!p.nome?.trim()||!p.produto_id||!/^\d+$/.test(p.bling_id)||vistos.has(id(p))||(skuIds.get(p.sku.trim().toUpperCase())?.size??0)>1||(blingIds.get(p.bling_id)?.size??0)>1)return false; vistos.add(id(p));return true});
}
function corresponde(a:Aplicacao,f:Filtro){
  return (!f.montadora||a.montadora.id===f.montadora)&&(!f.modelo||a.modelo.id===f.modelo)&&(!f.motor||a.motor.id===f.motor)&&(!f.cilindrada||a.cilindrada===f.cilindrada)&&(!f.ano||Number.isInteger(f.ano)&&a.inicio<=f.ano&&(a.fim!==null?f.ano<=a.fim:f.ano===a.inicio));
}
function buscaProduto(p:Produto,a:Aplicacao|undefined,q:string){
  const palavras=texto(q).split(" ").filter(Boolean);
  const base=[p.nome,p.sku,p.marca&&noOk(p.marca)?p.marca.rotulo:"",p.fabricante&&noOk(p.fabricante)?p.fabricante.rotulo:"",p.mpn&&valido(p.mpn)?p.mpn.codigo:"",...p.categoria.filter(noOk).map(n=>n.rotulo)];
  if(a)base.push(a.montadora.rotulo,a.modelo.rotulo,a.motor.rotulo,a.cilindrada??"",...refs(a));
  return palavras.length===0||palavras.every(w=>texto(base.join(" ")).includes(w))||base.some(v=>cod(v)===cod(q)&&!!cod(q));
}
export function filtrarProdutos(loja:string,ps:Produto[],f:Filtro={},publico=true){
  const porVeiculo=!!(f.montadora||f.modelo||f.motor||f.ano||f.cilindrada);
  return elegiveis(loja,ps,publico).flatMap(p=>{
    if(f.marca&&(!p.marca||!noOk(p.marca)||p.marca.id!==f.marca)||f.fabricante&&(!p.fabricante||!noOk(p.fabricante)||p.fabricante.id!==f.fabricante)||f.categoria&&!p.categoria.some(n=>noOk(n)&&n.id===f.categoria))return [];
    const aps=p.aplicacoes.filter(aplica).filter(a=>corresponde(a,f)&&buscaProduto(p,a,f.busca??""));
    if(!aps.length&&(porVeiculo||!buscaProduto(p,undefined,f.busca??"")))return [];
    // Projeção explícita; não devolver objeto de origem com preço/custo/estoque.
    return [{produto_id:p.produto_id,sku:p.sku,nome:p.nome,marca:p.marca&&noOk(p.marca)?p.marca.rotulo:null,fabricante:p.fabricante&&noOk(p.fabricante)?p.fabricante.rotulo:null,categoria:p.categoria.filter(noOk).map(n=>({id:n.id,rotulo:n.rotulo})),aplicacoes:aps.map(a=>({id:a.id,montadora:a.montadora.rotulo,modelo:a.modelo.rotulo,motor:a.motor.rotulo,inicio:a.inicio,fim:a.fim,cilindrada:a.cilindrada??null,oems:refs(a),restricoes:a.restricoes??null}))}];
  });
}
// Blocos de fabricante × categoria: contar produtos físicos, não aplicações.
export function blocosFabricante(loja:string,ps:Produto[],publico=true){
  const grupos=new Map<string,{fabricante_id:string;fabricante:string;categoria_id:string;categoria:string;produtos:Set<string>}>();
  for(const p of elegiveis(loja,ps,publico)){if(!p.fabricante||!noOk(p.fabricante))continue;for(const n of p.categoria.filter(noOk)){const k=JSON.stringify([p.fabricante.id,n.id]);const g=grupos.get(k)??{fabricante_id:p.fabricante.id,fabricante:p.fabricante.rotulo,categoria_id:n.id,categoria:n.rotulo,produtos:new Set<string>()};g.produtos.add(p.produto_id);grupos.set(k,g)}}
  return [...grupos.values()].map(({produtos,...g})=>({...g,total:produtos.size}));
}
// Ícones somente de biblioteca aprovada, hospedagem HTTPS exata e caminho de mídia
// permitido pelo servidor. Sem SVG ativo, HTML arbitrário, CSS remoto ou JS.
function img(n:No,origem:string,prefixo:string){
  const i=n.icone;if(!i?.aprovado||!i.direitos)return "";
  try{const u=new URL(i.url);if(u.protocol!=="https:"||u.origin!==origem||u.username||u.password||u.search||u.hash||!u.pathname.startsWith(prefixo)||! /\.(png|webp|jpe?g)$/i.test(u.pathname))return "";return '<img src="'+esc(u.href)+'" alt="'+esc(n.rotulo)+'" width="40" height="30"> ';}catch{return ""}
}
export function previaBling(loja:string,p:Produto,opts:{htmlHomologado:boolean;origemMidia:string;prefixoMidia:string;pausado:boolean}){
  if(opts.pausado||!elegiveis(loja,[p],false).length)throw new Error("produto inelegível");
  const aps=p.aplicacoes.filter(aplica),marca=p.marca&&noOk(p.marca)?p.marca.rotulo:"",mpn=p.mpn&&valido(p.mpn)?p.mpn.codigo:"";
  const curto=[p.nome,marca,mpn].filter(Boolean).join(" | ");
  const linhas=aps.map(a=>[a.montadora.rotulo,a.modelo.rotulo,a.motor.rotulo,a.cilindrada,a.fim===null?"Ano inicial: "+a.inicio+"; final não confirmado":a.inicio+"–"+a.fim,refs(a).length?"OEM: "+refs(a).join(", "):"",a.restricoes?"Restrições: "+a.restricoes:""].filter(Boolean).join(" · "));
  const cat=p.categoria.filter(noOk).map(n=>n.rotulo).join(" > ");
  const longo=[curto,cat,...linhas].filter(Boolean).join("\n");
  const midiaOk=opts.htmlHomologado&&/^https:\/\/[^/]+$/.test(opts.origemMidia)&&/^\/[a-zA-Z0-9_/-]+\/$/.test(opts.prefixoMidia);
  const html="<p>"+esc(curto)+"</p>"+(cat?"<p>"+esc(cat)+"</p>":"")+aps.map((a,i)=>"<p>"+(midiaOk?img(a.montadora,opts.origemMidia,opts.prefixoMidia)+img(a.modelo,opts.origemMidia,opts.prefixoMidia):"")+esc(linhas[i])+"</p>").join("");
  return {modo:"previa" as const,produto_id:p.produto_id,bling_id:p.bling_id,sku:p.sku,campos:{descricaoCurta:curto,descricaoComplementar:midiaOk?html:longo},textoAlternativo:longo,pendencias:["Revalidar unicidade no catálogo completo e dados atuais do Bling","Preservar descrição manual; diff e aprovação por campo","Verificar retorno, renderização e exportações do ERP"]};
}


// Projeção visual pura: a identidade do nó existente é autoridade, não a imagem.
// Entradas devem vir de um adaptador confiável que já verificou fatos, direitos e escopo.
export type NivelVisualNo = "compacto" | "3d" | "epc";
export type TipoVisualNo = "montadora" | "modelo" | "geracao" | "carroceria" | "motor" | "tracao" | "combustivel" | "propulsao" | "sistema" | "componente" | "categoria";
export interface ReferenciaVisualNo extends Fato {
  loja_id: string;
  no_id: string;
  tipo: TipoVisualNo;
  nivel: NivelVisualNo;
  ativo_id: string;
  revisao: number;
  direitos: boolean;
  origem: "fabricante" | "epc" | "derivacao_autorizada";
}
export interface SelecaoVisualNo {
  no_id: string;
  tipo: TipoVisualNo;
  rotulo: string;
  nivel: NivelVisualNo;
  ativo_id: string | null;
  revisao: number | null;
  estado: "referencia" | "texto";
}
// Nunca procura por rótulo, imagem semelhante, marca vizinha ou família genérica.
// Colisão é pendência; nenhuma seleção arbitrária de versão.
export function resolverRepresentacaoNo(loja:string,n:No,tipo:TipoVisualNo,nivel:NivelVisualNo,acervo:readonly ReferenciaVisualNo[]):SelecaoVisualNo {
  if(!loja?.trim()||acervo.some(r=>r.loja_id!==loja))throw new Error("escopo visual de loja inválido");
  if(!noOk(n))throw new Error("nó sem evidência aprovada");
  const candidatos=acervo.filter(r=>r.no_id===n.id&&r.tipo===tipo&&r.nivel===nivel&&valido(r)&&r.direitos===true&&["fabricante","epc","derivacao_autorizada"].includes(r.origem)&&!!r.ativo_id?.trim()&&Number.isSafeInteger(r.revisao)&&r.revisao>0);
  const base={no_id:n.id,tipo,rotulo:n.rotulo,nivel};
  if(candidatos.length!==1)return {...base,ativo_id:null,revisao:null,estado:"texto"};
  const r=candidatos[0];
  return {...base,ativo_id:r.ativo_id,revisao:r.revisao,estado:"referencia"};
}


// Registro versionado da mesma projeção, não uma taxonomia paralela nem uma escrita.
// O adaptador autorizado confirma o hash dos bytes, licença, aprovação e revisão;
// esta função só verifica a coerência do manifesto já recebido.
export interface RegistroVisualNo extends ReferenciaVisualNo {
  icon_id: string;
  sha256: string;
  descricao_acessivel: string;
  estado: "vigente" | "historico" | "revogado";
}
const tiposVisuais:readonly TipoVisualNo[]=["montadora","modelo","geracao","carroceria","motor","tracao","combustivel","propulsao","sistema","componente","categoria"];
const niveisVisuais:readonly NivelVisualNo[]=["compacto","3d","epc"];
export function validarBibliotecaVisual(loja:string,registros:readonly RegistroVisualNo[]):ReferenciaVisualNo[]{
  if(!loja?.trim()||registros.some(r=>r.loja_id!==loja))throw new Error("escopo visual de loja inválido");
  const porIcone=new Map<string,string>(),porNo=new Map<string,string>(),porAtivo=new Map<string,string>();
  const revisoes=new Set<string>(),vigentes=new Set<string>();
  const saida:ReferenciaVisualNo[]=[];
  for(const r of registros){
    if(!r.icon_id?.trim()||r.icon_id!==r.icon_id.trim()||!r.no_id?.trim()||r.no_id!==r.no_id.trim()||!r.ativo_id?.trim()||r.ativo_id!==r.ativo_id.trim()||!r.descricao_acessivel?.trim()||!/^[0-9a-f]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.revisao)||r.revisao<1||!tiposVisuais.includes(r.tipo)||!niveisVisuais.includes(r.nivel)||!["vigente","historico","revogado"].includes(r.estado)||!["fabricante","epc","derivacao_autorizada"].includes(r.origem)||!r.fonte?.trim()||!Number.isFinite(Date.parse(r.consultado_em)))throw new Error("registro visual inválido");
    const chave=JSON.stringify([r.no_id,r.tipo,r.nivel]),rev=JSON.stringify([r.icon_id,r.revisao]);
    if((porIcone.has(r.icon_id)&&porIcone.get(r.icon_id)!==chave)||(porNo.has(chave)&&porNo.get(chave)!==r.icon_id))throw new Error("identidade visual divergente");
    if(porAtivo.has(r.ativo_id)&&porAtivo.get(r.ativo_id)!==r.sha256)throw new Error("ativo com hash divergente");
    if(revisoes.has(rev))throw new Error("revisão visual duplicada");
    porIcone.set(r.icon_id,chave);porNo.set(chave,r.icon_id);porAtivo.set(r.ativo_id,r.sha256);revisoes.add(rev);
    if(r.estado!=="vigente")continue;
    if(!valido(r)||r.direitos!==true||vigentes.has(chave))throw new Error("referência vigente sem autoridade única");
    vigentes.add(chave);
    // Projeção explícita: não transportar campos internos de licença ou auditoria.
    saida.push({loja_id:r.loja_id,no_id:r.no_id,tipo:r.tipo,nivel:r.nivel,ativo_id:r.ativo_id,revisao:r.revisao,direitos:r.direitos,origem:r.origem,aprovado:r.aprovado,fonte:r.fonte,consultado_em:r.consultado_em});
  }
  return saida;
}
