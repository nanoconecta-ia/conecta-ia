// Gate experimental, sem rede, DML ou aprovação. A porta de leitura confiável
// deverá ser implementada por autoridade independente, não pelo agente produtor.
export type FatoAplicacao={oem:string;montadora:string;modelo:string;geracao:string;motor:string;emissao:string;mercado:"BR";tipo_ano:"ano_modelo_crlv"|"fabricacao"|"comercializacao_brasil"|"importacao_brasil";ano_inicio:number;ano_fim:number};
export type Escopo={loja:string;produto:string;sku:string;revisao:string;checkpoint:string;hashExtracao:string;produtor:string};
export type Candidato={escopo:Escopo;fato:FatoAplicacao;fonteId:string;documentoId:string;localizador:string};
export type FonteAutorizada={id:string;loja:string;tipo:"catalogo_fabricante"|"manual_montadora"|"catalogo_distribuidor";autorizada:boolean;emissor:string};
export type Documento={id:string;fonteId:string;loja:string;conteudo:string;sha256:string;consultadoEm:string};
export type LeituraIndependente={id:string;escopo:Escopo;fonteId:string;documentoId:string;sha256:string;localizador:string;fato:FatoAplicacao;verificador:string;verificadoEm:string;resultado:"confere"|"diverge"};
export interface PortaAuditoria {
 fonte(loja:string,id:string):Promise<FonteAutorizada|null>;
 documento(loja:string,id:string):Promise<Documento|null>;
 leituras(loja:string,documento:string,localizador:string):Promise<readonly LeituraIndependente[]>;
 // Deve consultar identidade e autorização verificadas no servidor, nunca texto fornecido pelo produtor.
 verificadorAutorizado(loja:string,id:string):Promise<boolean>;
}
const texto=(x:unknown):x is string=>typeof x==="string"&&x.trim().length>0&&x===x.trim();
const hash=(x:unknown):x is string=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const instante=(x:unknown)=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const ano=(x:unknown):x is number=>typeof x==="number"&&Number.isInteger(x)&&x>=1950&&x<=2100;
const fatos=["oem","montadora","modelo","geracao","motor","emissao","mercado","tipo_ano","ano_inicio","ano_fim"] as const;
const escopos=["loja","produto","sku","revisao","checkpoint","hashExtracao","produtor"] as const;
const exato=(x:object,ks:readonly string[])=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
const mesmoFato=(a:FatoAplicacao,b:FatoAplicacao)=>exato(b,fatos)&&fatos.every(k=>a[k]===b[k]);
const mesmoEscopo=(a:Escopo,b:Escopo)=>exato(b,escopos)&&escopos.every(k=>a[k]===b[k]);
async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,"0")).join("");}
export async function conferirProcedencia(c:Candidato,porta:PortaAuditoria,agora:string){
 const negar=(motivo:string)=>({estado:"retida" as const,motivo,homologada:false as const});
 const s=c.escopo,f=c.fato;
 if(!instante(agora)||!exato(s,escopos)||!escopos.every(k=>texto(s[k]))||!hash(s.hashExtracao)||!exato(f,fatos)||!fatos.slice(0,8).every(k=>texto(f[k]))||f.mercado!=="BR"||!["ano_modelo_crlv","fabricacao","comercializacao_brasil","importacao_brasil"].includes(f.tipo_ano)||!ano(f.ano_inicio)||!ano(f.ano_fim)||f.ano_fim<f.ano_inicio||f.ano_fim>new Date(agora).getUTCFullYear()+1||!texto(c.fonteId)||!texto(c.documentoId)||!texto(c.localizador))return negar("escopo_incompleto");
 // Igualdade exata deliberada; nenhum casamento por similaridade, expansão de ano ou transitividade.
 try{
  const fonte=await porta.fonte(s.loja,c.fonteId);
  if(!fonte||fonte.id!==c.fonteId||fonte.loja!==s.loja||fonte.autorizada!==true||!texto(fonte.emissor)||!["catalogo_fabricante","manual_montadora"].includes(fonte.tipo))return negar("fonte_nao_autorizada_ou_fraca");
  const d=await porta.documento(s.loja,c.documentoId);
  if(!d||d.id!==c.documentoId||d.loja!==s.loja||d.fonteId!==fonte.id||!texto(d.conteudo)||!hash(d.sha256)||!instante(d.consultadoEm)||Date.parse(d.consultadoEm)>Date.parse(agora))return negar("documento_invalido");
  if(await digest(d.conteudo)!==d.sha256)return negar("documento_divergente");
  const leituras=await porta.leituras(s.loja,d.id,c.localizador);
  if(!Array.isArray(leituras)||leituras.length!==1)return negar("leitura_ausente_ou_ambigua");
  const l=leituras[0];
  if(!texto(l.id)||!texto(l.verificador)||l.verificador===s.produtor||!mesmoEscopo(s,l.escopo)||l.fonteId!==fonte.id||l.documentoId!==d.id||l.sha256!==d.sha256||l.localizador!==c.localizador||!instante(l.verificadoEm)||Date.parse(l.verificadoEm)<Date.parse(d.consultadoEm)||Date.parse(l.verificadoEm)>Date.parse(agora))return negar("leitura_sem_vinculo_independente");
  if(!(await porta.verificadorAutorizado(s.loja,l.verificador)))return negar("verificador_nao_autorizado");
  if(l.resultado!=="confere"||!mesmoFato(f,l.fato))return negar("fato_divergente");
  // Não afirma compatibilidade física: apenas procedência conferida pelo adaptador.
  return {estado:"procedencia_conferida" as const,leituraId:l.id,sha256:d.sha256,homologada:false as const};
 }catch{return negar("leitura_nao_confirmada");}
}
