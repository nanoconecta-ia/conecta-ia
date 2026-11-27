// Inventário patrimonial de contratos: NÃO é catálogo de execução.
// Usa as definições existentes; sem rede, sem chamada de ferramenta, sem dados reais.
import {FERRAMENTAS_CONECTOR,ferramentasVisiveis,nomeParaLlm,idDoNomeLlm} from "../conector/registro.ts";
import {ALIASES_ASSISTENTE,ALIASES_PAIR} from "../conector/aliases.ts";
import {CAPACIDADES_LOCAIS} from "../exec_local/capacidades.ts";
import {ferramentasLocaisMcp} from "../exec_local/catalogo_mcp.ts";
import type {Permissao} from "../conector/tipos.ts";
export function inventariarContratosMcp(){
 const registro=FERRAMENTAS_CONECTOR.map(f=>({...f,nomeMcp:nomeParaLlm(f.id)}));
 const locais=CAPACIDADES_LOCAIS.map(c=>({id:c.id,executor:c.executor,camada:c.camada,risco:c.risco,estado:c.estado,timeoutMs:c.timeoutMs,parametros:Object.fromEntries(Object.entries(c.parametros).map(([k,v])=>[k,{pattern:v.source,flags:v.flags}]))}));
 const ids=[...registro.map(f=>f.id),...locais.map(c=>c.id)];
 const nomes=ids.map(nomeParaLlm);
 if(new Set(ids).size!==ids.length||new Set(nomes).size!==nomes.length||ids.some(id=>idDoNomeLlm(nomeParaLlm(id))!==id))throw Error("identidade de ferramenta ambígua");
 for(const id of [...Object.values(ALIASES_ASSISTENTE),...Object.values(ALIASES_PAIR)])if(id!==null&&!registro.some(f=>f.id===id))throw Error("alias sem destino");
 return {registro,locais,aliasesAssistente:{...ALIASES_ASSISTENTE},aliasesPair:{...ALIASES_PAIR},pairSemContrato:Object.entries(ALIASES_PAIR).filter(([,id])=>id===null).map(([nome])=>nome),homologacaoOperacional:false as const};
}
export function inventariarExposicaoMcp(escopos:readonly Permissao[],dispositivoAtivo:boolean){
 const central=ferramentasVisiveis("gateway_mcp",escopos).map(f=>({name:nomeParaLlm(f.id),inputSchema:f.entrada}));
 const local=dispositivoAtivo?ferramentasLocaisMcp(escopos.flatMap(e=>e==="leitura"?["consulta"]:e==="propor"?["proposta"]:[]),["windows"]).map(f=>({name:f.name,inputSchema:f.inputSchema})):[];
 const lista=[...central,...local];
 if(new Set(lista.map(f=>f.name)).size!==lista.length)throw Error("nome MCP duplicado");
 return lista;
}
