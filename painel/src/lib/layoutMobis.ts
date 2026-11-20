/** Contrato público auditável: nenhum dado fiscal, financeiro ou do fornecedor. */
export const BLOCOS_COMERCIAIS = ["banner","montadoras","taxonomia","catalogo","empresa"] as const;
export type BlocoComercial = typeof BLOCOS_COMERCIAIS[number];
export const PADRAO_LAYOUT = {
  blocos: [...BLOCOS_COMERCIAIS],
  intervalo_segundos: 6,
} as const;

/**
 * Três apresentações reais da MESMA loja. O seletor reutiliza a ordem de
 * blocos versionada/aprovada pelo lojista: não cria tabela, token nem mecanismo
 * de publicação paralelo. Sem ponteiro publicado, a Mobis usa o modelo Técnico.
 *
 * A identificação de modelo por ordem é deliberadamente limitada aos três
 * arranjos oficiais; ordens manuais continuam válidas e usam o estilo técnico.
 */
export const MODELOS_VISUAIS_MOBIS = [
  { id:"oficial", numero:"01", nome:"Oficial", descricao:"Gelo claro, vitrine institucional e navegação simples",
    blocos:["banner","taxonomia","montadoras","catalogo","empresa"] },
  { id:"tecnico", numero:"02", nome:"Técnico", descricao:"Bento industrial, sistemas, veículos e busca por referência",
    blocos:["banner","montadoras","taxonomia","catalogo","empresa"] },
  { id:"impacto", numero:"03", nome:"Impacto", descricao:"Destaques amplos, ofertas autorizadas e vitrine comercial",
    blocos:["banner","catalogo","montadoras","taxonomia","empresa"] },
] as const satisfies readonly {id:string;numero:string;nome:string;descricao:string;blocos:readonly BlocoComercial[]}[];
export type ModeloVisualMobis = (typeof MODELOS_VISUAIS_MOBIS)[number]["id"];
export function modeloVisualDaOrdem(valor:unknown):ModeloVisualMobis {
  const ordem = ordemPublica(valor);
  return MODELOS_VISUAIS_MOBIS.find(m=>m.blocos.join("|")===ordem.join("|"))?.id??"tecnico";
}

export const NOMES_BLOCOS: Record<BlocoComercial,string> = {
  banner:"Carrossel Flash / banner",
  montadoras:"Montadoras e veículos",
  taxonomia:"Sistemas e taxonomia",
  catalogo:"Busca e produtos",
  empresa:"Sobre a Mobis",
};
/** Somente os cinco blocos conhecidos podem entrar na loja. Nomes/strings não viram HTML. */
export function ordemPublica(valor:unknown):BlocoComercial[] {
  if (!Array.isArray(valor) || valor.length!==BLOCOS_COMERCIAIS.length) return [...BLOCOS_COMERCIAIS];
  const whitelist=new Set<string>(BLOCOS_COMERCIAIS);
  if (valor.some(x=>typeof x!=="string"||!whitelist.has(x))) return [...BLOCOS_COMERCIAIS];
  if (new Set(valor).size!==BLOCOS_COMERCIAIS.length) return [...BLOCOS_COMERCIAIS];
  return valor as BlocoComercial[];
}
export function intervaloPublico(valor:unknown):number{
  return Number.isInteger(valor)&&Number(valor)>=4&&Number(valor)<=15?Number(valor):6;
}
export function moverBloco(ordem:readonly BlocoComercial[],de:number,para:number):BlocoComercial[]{
  const copia=[...ordem];
  if(!Number.isInteger(de)||!Number.isInteger(para)||de<0||para<0||de>=copia.length||para>=copia.length)return copia;
  const [movido]=copia.splice(de,1);copia.splice(para,0,movido);return copia;
}
