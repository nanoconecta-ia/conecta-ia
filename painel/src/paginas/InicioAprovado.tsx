import type { Loja } from "../lib/dados.ts";
import { useWorkspaceDados } from "../lib/workspaceDados.ts";
import { AtivoAprovado } from "../componentes/AtivoAprovado.tsx";
const numero=(n:number|null|undefined)=>n==null?"—":n.toLocaleString("pt-BR");
export function InicioAprovado({loja}:{loja:Loja}){
 const {dados,recarregar}=useWorkspaceDados(loja.id);
 return <section className="ap-inicio" data-inicio-layout="aprovado-v2">
  <div className="ap-heading"><div><span className="ap-eyebrow">CONECTA.IA · PLATAFORMA DE ENRIQUECIMENTO</span><h1>Três níveis.<br/>Uma origem física.</h1><p>{loja.nome} · o Nano.IA organiza o catálogo, as evidências e as próximas decisões.</p></div><AtivoAprovado nome="robo" tamanho={116}/></div>
  <div className="ap-kicker"><span>Origem, inteligência e experiência comercial</span><b>Dados da loja autenticada · {loja.ambiente==="producao"?"ambiente interno":"ambiente de teste"}</b></div>
  {dados?.erro&&<p role="alert" className="ap-alerta">{dados.erro} <button onClick={recarregar}>Tentar novamente</button></p>}
  <div className="ap-niveis">
   <article><span className="ap-eyebrow">NÍVEL 01 / ORIGEM</span><AtivoAprovado nome="inicio" tamanho={62}/><h2>ERP Bling</h2><p>Cadastro físico e fiscal, SKU, saldo e preço na origem. A estrutura nativa é reconhecida e espelhada para a plataforma.</p><strong>{numero(dados?.total)} produtos no espelho</strong><small>Consulta atual. Nenhum saldo é criado ou somado pelas aplicações.</small><a href="#/catalogo-espelho">Conferir retrato da origem →</a></article>
   <article className="ap-nivel-central"><span className="ap-eyebrow">NÍVEL 02 / INTELIGÊNCIA</span><AtivoAprovado nome="matriz" tamanho={62}/><h2>Conecta.IA + Nano.IA</h2><p>Enriquecimento, taxonomia própria, aliases, aplicações e propostas. Uma tarefa, seu contexto e evidências conferíveis.</p><strong>{numero(dados?.aprovadas)} aplicações homologadas</strong><small>{numero(dados?.fila)} propostas aguardando revisão. A aprovação de um campo não publica o produto.</small><a href="#/estudio">Abrir Estúdio do Nano →</a></article>
   <article><span className="ap-eyebrow">NÍVEL 03 / EXPERIÊNCIA</span><AtivoAprovado nome="catalogo" tamanho={62}/><h2>Loja virtual</h2><p>A taxonomia vira busca por veículo, sistema e peça. O cliente recebe somente a projeção comercial dos dados liberados.</p><strong>{numero(dados?.publicados)} produtos publicados</strong><small>{loja.ambiente==="teste"?"Loja em teste. Sem checkout ou recebimento de pagamentos.":"Condições comerciais e disponibilidade sujeitas à confirmação."}</small><a href={`#/loja/${encodeURIComponent(loja.slug)}`} target="_blank" rel="noopener noreferrer">Abrir loja em outra aba ↗</a></article>
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
