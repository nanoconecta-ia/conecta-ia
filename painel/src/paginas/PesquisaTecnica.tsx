import { useMemo, useState, type FormEvent } from "react";
import type { Loja } from "../lib/dados.ts";
import { supabase } from "../supabase.ts";
import { Icone } from "../componentes/Icone.tsx";
import "./pesquisa-tecnica.css";

type Fonte = { titulo: string; dominio: string; url: string };
type Pesquisa = { resumo: string; fontes: Fonte[]; consultas: string[]; modelo: string; fundamentada: boolean };
const DESTINOS = [
  { nome: "Tecfil · catálogo", url: "https://catalogo.tecfil.com.br/", tipo: "Catálogo técnico público" },
  { nome: "PartSouq · catálogo", url: "https://partsouq.com/", tipo: "Referências e diagramas; acesso próprio" },
];
const permitido = (url: string) => {
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password; }
  catch { return false; }
};
export function PesquisaTecnica({ loja }: { loja: Loja }) {
  const [consulta, setConsulta] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState<Pesquisa | null>(null);
  const [erro, setErro] = useState("");
  const urlGoogle = useMemo(() => "https://www.google.com/search?q=" + encodeURIComponent(consulta.trim()), [consulta]);
  async function pesquisar(e: FormEvent) {
    e.preventDefault();
    if (!consentiu || consulta.trim().length < 3 || ocupado) return;
    setOcupado(true);setErro("");setResposta(null);
    try {
      const { data, error } = await supabase.functions.invoke("assistente", {body:{
        loja_id:loja.id, acao:"pesquisar_web", consulta:consulta.trim(), consentimento_web:true,
      }});
      if (error) throw new Error("Não foi possível concluir a consulta no servidor. Confira se a pesquisa está habilitada e a cota disponível.");
      if (data?.erro) throw new Error(data.erro);
      if (!data || !Array.isArray(data.fontes)) throw new Error("O servidor retornou uma pesquisa incompleta.");
      setResposta({resumo:String(data.resumo||""),fontes:data.fontes.filter((f:Fonte)=>f && permitido(f.url)).slice(0,8),
        consultas:Array.isArray(data.consultas)?data.consultas:[],modelo:String(data.modelo||"Gemini"),fundamentada:data.fundamentada===true});
    } catch(e) { setErro(e instanceof Error ? e.message : "Pesquisa indisponível."); }
    finally { setOcupado(false); }
  }
  return <div className="navegador-ia" aria-label="Pesquisa técnica na web e nos fornecedores">
    <header className="navegador-topo">
      <div className="navegador-aba"><Icone nome="busca" tamanho={16}/><strong>Pesquisa técnica</strong><span>●</span></div>
      <div className="navegador-identidade"><span className="navegador-status">WEB PÚBLICA</span><span>Conecta.IA · {loja.nome}</span></div>
    </header>
    <div className="navegador-navegacao"><div className="navegador-trilha" aria-label="Área atual"><Icone nome="escudo" tamanho={16}/> Pesquisa autorizada / Sem gravações no ERP</div>
      <form className="navegador-barra-busca" onSubmit={(e)=>void pesquisar(e)}>
        <Icone nome="busca" tamanho={21}/>
        <input value={consulta} onChange={e=>setConsulta(e.target.value)} placeholder="SKU, OEM, motor, aplicação ou medida..." aria-label="Pesquisar referência técnica" autoComplete="off" maxLength={180} required/>
        {consulta && <button type="button" className="sec navegador-limpar" onClick={()=>{setConsulta("");setResposta(null);setErro("");}} aria-label="Limpar pesquisa"><Icone nome="fechar" tamanho={16}/></button>}
        <button type="submit" disabled={!consentiu||ocupado||consulta.trim().length<3} className="navegador-pesquisar">{ocupado?"Pesquisando...":"Pesquisar"}</button>
      </form>
    </div>
    <div className="navegador-etapas" aria-label="Etapas de enriquecimento"><span data-ativo>1. Pesquisar</span><span>2. Conferir fontes</span><span>3. Preparar ficha</span><span>4. Aprovar gravação</span></div>
    <div className="navegador-conteudo">
      <section className="navegador-painel">
        <div className="navegador-destaque"><span>RESEARCH WORKSPACE / NANO.IA</span><h1>Encontre a fonte. Depois valide a aplicação.</h1>
          <p>Uma pesquisa técnica precisa mostrar de onde vieram os dados, e não apenas uma resposta de IA. O sistema não confirma equivalências nem grava cadastros sem documentação e aprovação.</p></div>
        <label className="navegador-consentimento"><input type="checkbox" checked={consentiu} onChange={e=>setConsentiu(e.target.checked)}/><span>Autorizo enviar <b>somente a consulta técnica digitada</b> ao Google Gemini Search. Não incluir dados de clientes, preços de custo, fornecedores privados ou credenciais.</span></label>
        {erro && <div className="navegador-erro" role="alert">{erro}</div>}
        {resposta && <div className="navegador-resultado" aria-live="polite">
          <div className="navegador-resultado-topo"><h2>Resultado fundamentado</h2><span>{resposta.modelo}</span></div>
          {!resposta.fundamentada && <p className="navegador-erro">Sem fontes verificáveis. Não use como prova de compatibilidade.</p>}
          <div className="navegador-texto">{resposta.resumo}</div>
          <h3>Fontes para conferência ({resposta.fontes.length})</h3>
          <div className="navegador-fontes">{resposta.fontes.length ? resposta.fontes.map((f,i)=><article key={f.url}><span>{String(i+1).padStart(2,"0")} · {f.dominio}</span><a href={f.url} target="_blank" rel="noopener noreferrer">{f.titulo||f.dominio} ↗</a><small>Abra o catálogo e confirme código, ano, versão do motor e medidas.</small></article>) : <p>Nenhum link confiável foi retornado pelo provedor.</p>}</div>
          <p className="navegador-rodape-fonte">Resultados são candidatos de pesquisa, não homologação OEM nem equivalência técnica automática.</p>
        </div>}
        {!resposta && !ocupado && <div className="navegador-orientacao"><h2>Exemplos de consultas</h2><div className="navegador-exemplos">
          {["Valeo 833333 embreagem 254mm","4D56 8V HPE pino 32 mm","Tecfil OC1224 conversões"].map(s=><button type="button" key={s} onClick={()=>setConsulta(s)}>{s}<span>↗</span></button>)}
        </div></div>}
        {ocupado && <p className="navegador-carregando" role="status">Consultando o Gemini com Pesquisa Google. A operação pode consumir cota do provedor.</p>}
      </section>
      <aside className="navegador-fontes-lateral" aria-label="Catálogos e fornecedores">
        <h2>Catálogos e B2B</h2><p>Abra a fonte no navegador real. Suas sessões e credenciais de fornecedor permanecem no site de origem.</p>
        {DESTINOS.map(d=><a href={d.url} key={d.url} target="_blank" rel="noopener noreferrer" className="navegador-fornecedor"><strong>{d.nome}</strong><span>{d.tipo}</span><small>Abrir página ↗</small></a>)}
        {consulta.trim() && <a href={urlGoogle} target="_blank" rel="noopener noreferrer" className="navegador-fornecedor"><strong>Pesquisar diretamente no Google</strong><span>Resultados públicos no navegador, sem usar a chave Gemini.</span><small>Abrir busca ↗</small></a>}
        <div className="navegador-limite"><strong>Acesso B2B autenticado</strong><p>O Nano.IA não captura cookies, senhas ou preços de portais privados. A automação desses portais requer conector próprio, autorização e trilha de auditoria.</p></div>
      </aside>
    </div>
  </div>;
}
