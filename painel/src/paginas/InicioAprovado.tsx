import { useState } from "react";
import { BLOCOS, VERSAO_MATRIZ, validarMapa, type Raiz } from "../../../supabase/functions/_shared/nano_lifecycle/matriz_mestra.ts";
import type { Loja } from "../lib/dados.ts";
import { useWorkspaceDados } from "../lib/workspaceDados.ts";
import { AtivoAprovado } from "../componentes/AtivoAprovado.tsx";
import { IconeMA } from "../componentes/IconeMA.tsx";
import { iconeDaRaiz, VERSAO_BIBLIOTECA_MA } from "../lib/maIcones.ts";
import { IndicadoresInicio } from "./IndicadoresInicio.tsx";
import { urlLojaPublica } from "../lib/lojaHost.ts";
const numero=(n:number|null|undefined)=>n==null?"—":n.toLocaleString("pt-BR");
export function InicioAprovado({loja}:{loja:Loja}){
 const {dados,recarregar}=useWorkspaceDados(loja.id);
 return <section className="ap-inicio" data-inicio-layout="aprovado-v2">
  <div className="ap-heading"><div><span className="ap-eyebrow">CONECTA.IA · PLATAFORMA DE ENRIQUECIMENTO</span><h1>Hoje no catálogo</h1><p>{loja.nome} · o Nano.IA organiza o catálogo, as evidências e as próximas decisões.</p></div><AtivoAprovado nome="robo" tamanho={116}/></div>
  <IndicadoresInicio fila={dados?.fila} erro={dados?.erro}/>
  {loja.slug==="mobis"&&<MapaOperacionalMobis dados={dados}/>}

  <div className="ap-kicker"><span>Origem, inteligência e experiência comercial</span><b>Dados da loja autenticada · {loja.ambiente==="producao"?"ambiente interno":"ambiente de teste"}</b></div>
  {dados?.erro&&<p role="alert" className="ap-alerta">{dados.erro} <button onClick={recarregar}>Tentar novamente</button></p>}
  <div className="ap-niveis">
   <article><span className="ap-eyebrow">NÍVEL 01 / ORIGEM</span><AtivoAprovado nome="inicio" tamanho={62}/><h2>ERP Bling</h2><p>Cadastro físico e fiscal, SKU, saldo e preço na origem. A estrutura nativa é reconhecida e espelhada para a plataforma.</p><strong>{numero(dados?.total)} produtos no espelho</strong><small>Consulta atual. Nenhum saldo é criado ou somado pelas aplicações.</small><a href="#/catalogo-espelho">Conferir retrato da origem →</a></article>
   <article className="ap-nivel-central"><span className="ap-eyebrow">NÍVEL 02 / INTELIGÊNCIA</span><AtivoAprovado nome="matriz" tamanho={62}/><h2>Conecta.IA + Nano.IA</h2><p>Enriquecimento, taxonomia própria, aliases, aplicações e propostas. Uma tarefa, seu contexto e evidências conferíveis.</p><strong>{numero(dados?.aprovadas)} aplicações homologadas</strong><small>{numero(dados?.fila)} propostas aguardando revisão. A aprovação de um campo não publica o produto.</small><a href="#/estudio">Abrir Estúdio do Nano →</a></article>
   <article><span className="ap-eyebrow">NÍVEL 03 / EXPERIÊNCIA</span><AtivoAprovado nome="catalogo" tamanho={62}/><h2>Loja virtual</h2><p>A taxonomia vira busca por veículo, sistema e peça. O cliente recebe somente a projeção comercial dos dados liberados.</p><strong>{numero(dados?.publicados)} produtos publicados</strong><small>{loja.ambiente==="teste"?"Loja em teste. Sem checkout ou recebimento de pagamentos.":"Condições comerciais e disponibilidade sujeitas à confirmação."}</small><a href={urlLojaPublica(loja.slug, window.location.href)} target="_blank" rel="noopener noreferrer">Conferir loja pública em outra aba ↗</a></article>
  </div>
  <section className="ap-audiencias"><span className="ap-eyebrow">A MESMA INTELIGÊNCIA, DUAS EXPERIÊNCIAS</span><h2>O que cada pessoa encontra.</h2><div className="ap-tablewrap"><table><thead><tr><th>Estrutura interna · lojista e Nano</th><th>Experiência comercial · cliente da loja</th></tr></thead><tbody>{[
   ["Taxonomia, montadoras, famílias, gerações e motores","Escolher meu veículo e procurar a peça"],
   ["Aliases e códigos com fonte e aprovação","Encontrar por nome, código e referências liberadas"],
   ["Produto físico e projeções por aplicação","A mesma peça em buscas compatíveis, com uma origem de saldo"],
   ["Conflitos, aplicações incompletas e revisão humana","Informações confirmadas e atendimento"],
   ["Estúdio, Torre, evidências e comparação","Ficha da peça e consulta pelo WhatsApp"],
  ].map(([a,b])=><tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table></div></section>
  <div className="ap-origem-regras"><article><h3>Projeção comercial não cria saldo.</h3><p>Uma aplicação aponta para a peça física. Vínculos pai/filha existentes exigem conferência do comportamento real de estoque.</p><a href="#/taxonomia">Conferir matriz e taxonomia →</a></article><article><h3>Publicação é uma etapa própria.</h3><p>Sincronizar ou aprovar um campo não publica um produto. Conteúdo, imagens e aplicações seguem a fila de revisão.</p><a href="#/fila">Abrir revisão interna →</a></article></div>
 </section>;
}

// Interface de leitura: o contrato canônico permanece na Matriz Mestra compartilhada.
// A existência de uma rota não prova que a raiz operacional está homologada.
// Não oferece ações novas, não autoriza navegação, não cria indicadores fictícios.
const ROTAS_MAPA:Partial<Record<Raiz,{href:string;rotulo:string}>>={
 erp:{href:"#/catalogo-espelho",rotulo:"Consultar espelho existente"},
 lifecycle:{href:"#/estudio",rotulo:"Abrir Estúdio existente"},
 engineering:{href:"#/catalogo-aplicacao",rotulo:"Consultar aplicações existentes"},
 taxonomy:{href:"#/taxonomia",rotulo:"Consultar taxonomia existente"},
};
type DadosMapa=ReturnType<typeof useWorkspaceDados>["dados"];
function MapaOperacionalMobis({dados}:{dados:DadosMapa}){
 const [ativa,setAtiva]=useState<Raiz|null>(null);
 const erros=validarMapa();
 if(erros.length)return <section className="ap-workspace" data-mapa-operacional="invalido" role="alert">Matriz operacional indisponível: contrato inválido. Nenhum módulo liberado pelo mapa.</section>;
 // Contagens já obtidas pelo hook autenticado; não equivalem aos gates canônicos.
 const leitura:Partial<Record<Raiz,{rotulo:string;valor:number|null|undefined}>>={
  erp:{rotulo:"Registros no espelho",valor:dados?.total},
  engineering:{rotulo:"Aplicações com status aprovado na base",valor:dados?.aprovadas},
  vitrine:{rotulo:"Registros marcados como publicados",valor:dados?.publicados},
 };
 const blocoAtivo=ativa?BLOCOS.find(b=>b.id===ativa)??null:null;
 const depsAtivas=new Set<Raiz>(blocoAtivo?.depende??[]);
 const dependentesAtivos=new Set<Raiz>(ativa?BLOCOS.filter(b=>b.depende.includes(ativa)).map(b=>b.id):[]);
 return <section className="ap-workspace ma-mapa-operacional" data-mapa-operacional={VERSAO_MATRIZ} data-ma-biblioteca={VERSAO_BIBLIOTECA_MA} aria-labelledby="ma-mapa-titulo">
  <header className="ap-heading"><div><span className="ap-eyebrow">MA DISPLAY · MATRIZ MESTRA {VERSAO_MATRIZ} · 12 RAÍZES</span><h2 id="ma-mapa-titulo">Mapa mental navegável Nano Ecosystem</h2><p>Dependências canônicas, módulos existentes e leituras da loja autenticada. Selecione uma raiz para destacar origem e impacto.</p></div></header>
  <nav className="ma-mapa-barra" aria-label="Navegação das 12 raízes">
   <button type="button" className={`ma-raiz-chip ${ativa===null?"ativo":""}`} onClick={()=>setAtiva(null)} aria-pressed={ativa===null}>Todas (12)</button>
   {BLOCOS.map(b=>{
    const rel=ativa===b.id?"ativo":depsAtivas.has(b.id)?"origem":dependentesAtivos.has(b.id)?"impacto":"";
    return <button key={b.id} type="button" className={`ma-raiz-chip ${rel}`} data-raiz-chip={b.id} onClick={()=>setAtiva(ativa===b.id?null:b.id)} aria-pressed={ativa===b.id}><IconeMA id={iconeDaRaiz(b.id)} tamanho={20} variante={ativa===b.id?"vermelho":"aco"}/><span>{b.nome}</span></button>;
   })}
  </nav>
  <div className="ma-mapa-grade">
   {BLOCOS.map(b=>{
    const rota=ROTAS_MAPA[b.id],medida=leitura[b.id];
    const rel=ativa===b.id?"ativo":depsAtivas.has(b.id)?"origem":dependentesAtivos.has(b.id)?"impacto":ativa?"secundario":"";
    return <article key={b.id} data-raiz-operacional={b.id} data-raiz-relacao={rel||"padrao"} className={`ma-raiz-card ${rel}`}>
     <div className="ma-raiz-topo"><IconeMA id={iconeDaRaiz(b.id)} tamanho={30} variante={ativa===b.id?"vermelho":depsAtivas.has(b.id)?"azul":"aco"}/><div><h3>{b.nome}</h3><small>Autoridade: {b.autoridade}</small></div></div>
     <p>Depende de: {b.depende.length?b.depende.map(id=>BLOCOS.find(x=>x.id===id)?.nome??id).join(" · "):"Nenhuma raiz anterior"}</p>
     {medida&&<p>{medida.rotulo}: <strong>{numero(medida.valor)}</strong></p>}
     <details><summary>Critérios de aceite ({b.gates.length})</summary><ul>{b.gates.map(g=><li key={g}>{g} — não medido</li>)}</ul></details>
     <p>{rota?<a href={rota.href}>{rota.rotulo} →</a>:<small>Sem atalho operacional homologado neste mapa.</small>}</p>
    </article>;
   })}
  </div>
 </section>;
}
