// Mapa mestre versionado. Modelo lógico, não schema de banco nem declaração de deploy.
// O orquestrador futuro carrega evidências verificadas do servidor; agentes não
// atribuem status a si mesmos. O dashboard pode consumir esta definição tipada.
export const VERSAO_MATRIZ="1.0.0";
export const RAIZES=["erp","lifecycle","engineering","taxonomy","visual","commercial","supplier","radar","seo","vitrine","analytics","auditor"] as const;
export type Raiz=typeof RAIZES[number];
export interface Bloco {id:Raiz;nome:string;modelo:string;autoridade:string;depende:readonly Raiz[];indicadores:readonly string[];gates:readonly string[]}
export const BLOCOS:readonly Bloco[]=[
 {id:"erp",nome:"Identidade ERP",modelo:"IdentidadeFisica",autoridade:"Bling",depende:[],indicadores:["ativos","identidades_reconciliadas","duplicidades","ultima_sync"],gates:["identidade_unica","sync_verificada","campos_protegidos"]},
 {id:"lifecycle",nome:"Nano Lifecycle",modelo:"EventoVersaoTarefa",autoridade:"pipeline existente",depende:["erp"],indicadores:["fila","processados","falhas","pausados"],gates:["idempotencia","retomada","pausas","orcamento"]},
 {id:"engineering",nome:"Nano Engineering",modelo:"RelacaoTecnicaEvidencia",autoridade:"fontes autorizadas e aprovacao",depende:["lifecycle"],indicadores:["aplicacoes_aprovadas","candidatas","conflitos"],gates:["proveniencia","oem_por_aplicacao","periodo_mercado","sem_transitividade"]},
 {id:"taxonomy",nome:"Nano Taxonomy",modelo:"NoArestaVersao",autoridade:"matriz relacional",depende:["engineering"],indicadores:["nos_aprovados","orfãos","duplicidades"],gates:["identidade_no","relacoes_validas","eixos_distintos"]},
 {id:"visual",nome:"Nano Visual Studio",modelo:"MidiaLicencaVinculo",autoridade:"biblioteca aprovada",depende:["taxonomy"],indicadores:["midias_aprovadas","pendentes","sem_foto"],gates:["direitos","vinculo_correto","renderizacao_segura"]},
 {id:"supplier",nome:"Nano Supplier",modelo:"OfertaFornecedorObservacao",autoridade:"portal autorizado",depende:[],indicadores:["fontes_homologadas","cotacoes_validas","erros"],gates:["autorizacao_fonte","unidade_comparavel","privacidade","sem_compra_automatica"]},
 {id:"radar",nome:"Nano Radar",modelo:"ObservacaoMudanca",autoridade:"fonte autorizada",depende:["supplier"],indicadores:["novidades","alteracoes","candidatos"],gates:["proveniencia","deduplicacao","limites_fonte","sem_publicacao"]},
 {id:"commercial",nome:"Nano Commercial",modelo:"ConsultaCotacaoMinuta",autoridade:"lojista e ERP",depende:["supplier","engineering"],indicadores:["consultas","cotacoes","minutas","aprovacoes"],gates:["identidade_comercial","preco_autorizado","destinatario","sem_movimentacao_automatica"]},
 {id:"seo",nome:"Nano SEO",modelo:"PaginaAplicacaoIndexavel",autoridade:"aplicacao aprovada",depende:["engineering","taxonomy"],indicadores:["urls_indexaveis","canonicals","erros_404"],gates:["aplicacao_comprovada","html_rastreavel","canonical","sitemap","conteudo_distinto"]},
 {id:"vitrine",nome:"Vitrine Mobis",modelo:"ProjecaoPublicaSKUAplicacao",autoridade:"publicacao aprovada",depende:["erp","engineering","taxonomy","seo"],indicadores:["produtos_fisicos","aplicacoes_visiveis","buscas_sem_resultado"],gates:["mesma_aplicacao","sku_unico","sem_preco_privado","links_validos","mobile"]},
 {id:"analytics",nome:"Nano Analytics",modelo:"MetricaFonteJanela",autoridade:"eventos medidos",depende:["vitrine"],indicadores:["impressoes","cliques","consultas","conversoes"],gates:["fonte_metrica","janela","sem_zero_ficticio","privacidade"]},
 {id:"auditor",nome:"Nano Auditor",modelo:"ResultadoGateEvidencia",autoridade:"verificacao independente",depende:[],indicadores:["gates_conformes","bloqueios","regressoes"],gates:["separacao_privilegios","testes_negativos","auditoria","rollback"]},
];
export interface EvidenciaGate {bloco:Raiz;gate:string;versaoMatriz:string;revisao:string;resultado:"conforme"|"falhou"|"pendente";referencia:string;verificador:string;verificadoEm:string}
export function validarMapa(blocos:readonly Bloco[]=BLOCOS):string[]{
 const erros:string[]=[], porId=new Map(blocos.map(b=>[b.id,b]));
 if(porId.size!==blocos.length)erros.push("raiz_duplicada");
 if(new Set(blocos.map(b=>b.modelo)).size!==blocos.length)erros.push("modelo_duplicado");
 for(const id of RAIZES)if(!porId.has(id))erros.push("raiz_ausente:"+id);
 const visitar=(id:Raiz,caminho:Raiz[])=>{if(caminho.includes(id)){erros.push("ciclo:"+id);return}const b=porId.get(id);if(!b){erros.push("dependencia_ausente:"+id);return}for(const dep of b.depende)visitar(dep,[...caminho,id])};
 for(const b of blocos){if(!b.gates.length||new Set(b.gates).size!==b.gates.length||!b.indicadores.length)erros.push("contrato_incompleto:"+b.id);visitar(b.id,[])}
 return [...new Set(erros)];
}
// Aceite por revisão exata: nenhuma nota de confiança subjetiva libera produção.
// Evidências conflitantes/repetidas falham fechado. A validade e autenticidade
// do verificador/referência são responsabilidade do adaptador de auditoria.
export function avaliarBloco(id:Raiz,revisao:string,evidencias:readonly EvidenciaGate[]){
 const bloco=BLOCOS.find(b=>b.id===id);if(!bloco||!revisao.trim())throw Error("bloco ou revisao invalida");
 const gates=bloco.gates.map(gate=>{
   const es=evidencias.filter(e=>e.bloco===id&&e.gate===gate&&e.versaoMatriz===VERSAO_MATRIZ&&e.revisao===revisao);
   const e=es[0];
   const valido=es.length===1&&!!e.referencia.trim()&&!!e.verificador.trim()&&Number.isFinite(Date.parse(e.verificadoEm));
   return {gate,estado:!valido?"pendente":e.resultado};
 });
 const conformes=gates.filter(g=>g.estado==="conforme").length;
 return {id,revisao,gates,conformes,total:gates.length,aceiteLocal:conformes===gates.length,indiceConformidade:conformes/gates.length};
}
export function avaliarLiberacao(id:Raiz,revisao:string,evidencias:readonly EvidenciaGate[]){
 if(validarMapa().length)throw Error("matriz invalida");
 const ids=new Set<Raiz>(["auditor"]);
 const incluir=(x:Raiz)=>{if(ids.has(x))return;ids.add(x);for(const d of BLOCOS.find(b=>b.id===x)!.depende)incluir(d)};
 incluir(id);
 const resultados=[...ids].map(x=>avaliarBloco(x,revisao,evidencias));
 return {id,revisao,apto:resultados.every(x=>x.aceiteLocal),bloqueios:resultados.filter(x=>!x.aceiteLocal).map(x=>x.id),resultados};
}
