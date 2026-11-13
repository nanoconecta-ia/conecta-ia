import type { CSSProperties, ReactNode } from "react";
import type { Loja } from "../lib/dados.ts";
import { AtivoAprovado } from "./AtivoAprovado.tsx";
import { Icone } from "./Icone.tsx";
import { VERSAO_LOCAL, rotuloVersao } from "../lib/versao.ts";
import "../workspace-aprovado.css";
import marcaMobis from "../assets/mobis-identidade-aprovada.jpg";

const PRINCIPAIS=[
 ["/","Conecta.IA","inicio"],["/estudio","Estúdio do Nano","nano"],
 ["/catalogo-aplicacao","Catálogo inteligente","catalogo"],["/taxonomia","Matriz e taxonomia","matriz"],
 ["/catalogo-espelho","Espelho do ERP","contexto"],["/fila","Fila de revisão","revisao"],
 ["/ferramentas","Indexar e enriquecer","taxonomia"],
] as const;
export function PainelAprovado({loja,caminho,menu,children,menuMovel,recolhido,aoMenu,aoRecolher,aoBusca,aoSair,aoAgente,res}:{
 loja:Loja|null;caminho:string;menu:[string,string][];children:ReactNode;menuMovel:boolean;recolhido:boolean;
 aoMenu:()=>void;aoRecolher:()=>void;aoBusca:()=>void;aoSair:()=>void;aoAgente:()=>void;res:{esq:number;dir:number};
}){
 const titulo=caminho==="/"?"Espelhamento":caminho==="/estudio"||caminho==="/assistente"?"Estúdio do Nano":menu.find(x=>x[0]===caminho)?.[1]??"Área de trabalho";
 const nano=caminho==="/estudio"||caminho==="/assistente";
 return <div className={`conecta-aprovado ${menuMovel?"ap-menu-aberto":""} ${recolhido?"ap-recolhido":""}`} data-conecta-layout="aprovado-v2" data-area={nano?"nano":"painel"} style={{"--res-esq":res.esq+"px","--res-dir":res.dir+"px"} as CSSProperties}>
  {menuMovel&&<button className="ap-menu-fundo" aria-label="Fechar menu de navegação" onClick={aoMenu}/>}
  <aside className="ap-sidebar menu" id="menu-principal" aria-label="Menu principal">
   <a className="ap-identidade" href="#/"><strong>Conecta<span>.IA</span></strong><small>ENRIQUECIMENTO DE CATÁLOGOS</small></a>
   <div className="ap-loja-marca">{loja?.slug==="mobis"?<span className="ap-marca-window"><img src={marcaMobis} alt="Mobis Autopeças"/></span>:<strong>{loja?.nome??"Seu ambiente"}</strong>}<small>{loja?.slug==="mobis"?"LOJA PILOTO":"AMBIENTE INTERNO"}</small></div>
   <span className="ap-nav-label">ESPELHAMENTO</span>
   <nav>{PRINCIPAIS.filter(([r])=>r==="/estudio"||r==="/"||menu.some(x=>x[0]===r)).map(([r,t,ic])=><a key={r} title={t} aria-label={t} href={`#${r}`} aria-current={caminho===r||(r==="/estudio"&&caminho==="/assistente")?"page":undefined} className={caminho===r||(r==="/estudio"&&caminho==="/assistente")?"ativo":""} onClick={()=>{if(menuMovel)aoMenu();}}><AtivoAprovado nome={ic}/><span>{t}</span></a>)}</nav>
   {loja&&<a className="ap-loja-link" href={`#/loja/${encodeURIComponent(loja.slug)}`} target="_blank" rel="noopener noreferrer"><AtivoAprovado nome="inicio"/><span>Loja virtual ↗</span></a>}
   <details className="ap-modulos"><summary>Todos os módulos <span>+</span></summary><nav>{menu.filter(x=>!PRINCIPAIS.some(p=>p[0]===x[0])).map(([r,t])=><a key={r} title={t} aria-label={t} href={`#${r}`} onClick={()=>{if(menuMovel)aoMenu();}} aria-current={caminho===r?"page":undefined}><Icone nome="caixas" tamanho={16}/><span>{t}</span></a>)}</nav></details>
   <div className="ap-sidebar-fim"><div className="ap-protecao"><strong>Origem física preservada</strong><span>Bling · estoque e dados fiscais<br/>Conecta.IA · aplicações e revisão</span></div><button onClick={aoSair} className="ap-perfil"><span className="ap-avatar">{loja?.nome.slice(0,2).toUpperCase()??"IA"}</span><span><strong>{loja?.nome??"Minha conta"}</strong><small>Sair da conta</small></span></button><button className="ap-recolher" onClick={aoRecolher} aria-label={recolhido?"Expandir menu":"Recolher menu"}><Icone nome="recolher" tamanho={16}/></button></div>
  </aside>
  <div className="ap-corpo layout">
   <header className="ap-topbar topo"><button className="ap-menu-abrir" aria-label={menuMovel?"Fechar navegação":"Abrir navegação"} aria-expanded={menuMovel} onClick={aoMenu}><Icone nome="menu" tamanho={20}/></button><div className="ap-caminho">Conecta.IA <span>/</span> <b>{titulo}</b></div><button className="ap-busca" onClick={aoBusca} aria-label="Abrir paleta de comandos"><Icone nome="busca" tamanho={16}/><span>Buscar módulos e ações</span><kbd>Ctrl K</kbd></button><span className="ap-ambiente">{loja?.ambiente==="producao"?"Ambiente interno":"Ambiente de teste"}</span><button className="ap-estudio-abrir" onClick={aoAgente}><AtivoAprovado nome="nano" tamanho={28}/><span>{nano?"Nano.IA":"Estúdio Nano"}</span></button></header>
   <main className="ap-content">{children}</main>
   <footer className="ap-ledger"><span>CONECTA.IA · {loja?.nome??"Ambiente autenticado"}</span><span>Interface aprovada · v{rotuloVersao(VERSAO_LOCAL)}</span></footer>
  </div>
 </div>;
}
