import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { PAIR_ATIVO } from "../lib/flags.ts";
import { Taxonomia } from "./Taxonomia.tsx";
import "./estudio-agente.css";

type Area = "produto" | "taxonomia" | "imagens" | "seo";
type Sistema = "conecta" | "bling" | "site";
type Produto = { id: string; nome: string | null; sku: string; marca: string | null; descricao: string | null; gtin: string | null; preco: number | null; estoque: number | null; sincronizado_em: string; publicado: boolean };
type Foto = { id: string; url: string; tipo: string; origem: string | null; direitos: string | null };
const AREAS: { id: Area; icone: string; nome: string; descricao: string }[] = [
  { id: "produto", icone: "◫", nome: "Produto", descricao: "Cadastro e dados de origem" },
  { id: "taxonomia", icone: "⑂", nome: "Taxonomia", descricao: "Classificação e vínculo com o ERP" },
  { id: "imagens", icone: "▧", nome: "Imagens", descricao: "Foto técnica e composição comercial" },
  { id: "seo", icone: "⌕", nome: "SEO técnico", descricao: "Conteúdo, metadados e publicação" },
];
const TAREFAS: Record<Area, string> = {
  produto: "Conferir o cadastro e apontar informações ausentes, com fonte e data.",
  taxonomia: "Propor classificação no perfil da loja e mapear a categoria do ERP, preservando a origem.",
  imagens: "Conferir fotos e direitos de uso. Preparar propostas separadas para o site e o Bling, com aprovação por produto.",
  seo: "Revisar título, descrição, canonical e dados estruturados somente com fatos confirmados.",
};
const dinheiro = (n: number | null) => n == null ? "Não informado" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EstudioAgente({ loja }: { loja: Loja }) {
  const [area, setArea] = useState<Area>("produto");
  const [sistema, setSistema] = useState<Sistema>("conecta");
  const [modo, setModo] = useState<"integrada" | "browser">("integrada");
  const [posicao, setPosicao] = useState<"lateral" | "flutuante">("lateral");
  const [torre, setTorre] = useState(false);
  const [entrada, setEntrada] = useState(loja.slug === "mobis" ? "80692" : "");
  const [sku, setSku] = useState(entrada);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [aviso, setAviso] = useState("");
  const botaoTorre = useRef<HTMLButtonElement>(null);
  const tarefa = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let ativo = true;
    setProduto(null); setFotos([]); setErro(""); setRascunho(""); setAviso("");
    if (!sku) { setCarregando(false); return () => { ativo = false; }; }
    setCarregando(true);
    async function ler() {
      try {
        const { data, error } = await supabase.from("produtos").select("id, nome, sku, marca, descricao, gtin, preco, estoque, sincronizado_em, publicado").eq("loja_id", loja.id).eq("sku", sku).maybeSingle();
        if (!ativo) return;
        if (error) { setErro("Não foi possível consultar o produto desta loja."); return; }
        if (!data) { setErro("SKU não encontrado nesta loja."); return; }
        setProduto(data as Produto);
        const imagens = await supabase.from("produto_imagens").select("id, url, tipo, origem, direitos").eq("loja_id", loja.id).eq("produto_id", data.id).eq("aprovada", true).order("ordem").limit(12);
        if (!ativo) return;
        if (imagens.error) setErro("Produto carregado; não foi possível verificar as imagens aprovadas.");
        else setFotos((imagens.data ?? []).filter(f => { try { return new URL(f.url).protocol === "https:"; } catch { return false; } }) as Foto[]);
      } catch { if (ativo) setErro("Consulta indisponível. Tente novamente."); }
      finally { if (ativo) setCarregando(false); }
    }
    void ler();
    return () => { ativo = false; };
  }, [loja.id, sku]);
  useEffect(() => {
    if (!torre) return;
    function teclado(e: KeyboardEvent) { if (e.key === "Escape") { setTorre(false); botaoTorre.current?.focus(); } }
    window.addEventListener("keydown", teclado);
    tarefa.current?.focus();
    return () => window.removeEventListener("keydown", teclado);
  }, [torre]);
  function buscar(e: FormEvent) { e.preventDefault(); setSku(entrada.trim()); }
  function preparar() {
    if (!produto) return;
    setRascunho(`Loja: ${loja.nome}\nProduto: SKU ${produto.sku}\nAmbiente: ${sistema === "bling" ? "Bling" : sistema === "site" ? "Site da loja" : "Conecta.IA"}\nTarefa: ${TAREFAS[area]}\nRespeitar o escopo da loja. Antes de gravar ou publicar, apresentar as alterações e solicitar aprovação por produto.`);
    setTorre(true); setAviso("Rascunho local preparado. Nenhuma tarefa foi enviada ou executada.");
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(rascunho); setAviso("Tarefa copiada. Cole no chat do agente para revisar o pedido."); }
    catch { setAviso("Não foi possível copiar. Selecione o texto da tarefa e copie manualmente."); }
  }
  const atual = AREAS.find(a => a.id === area)!;
  const foto = fotos.find(f => f.tipo === "real");
  return <section className={`estudio-agente torre-${posicao}${torre ? " torre-aberta" : ""}`} aria-label="Estúdio do agente">
    <header className="ea-cabecalho"><div><p className="ea-sobretitulo">ESPAÇO DE TRABALHO · {loja.nome}</p><h1>Estúdio do agente <span className="ea-versao">Interface 0.1 · prévia</span></h1><p>Um produto, seus ambientes e as próximas decisões.</p></div><button ref={botaoTorre} className="ea-abrir" aria-expanded={torre} aria-controls="torre-agente" onClick={() => setTorre(!torre)}>{torre ? "Recolher agente →" : "Abrir agente ✦"}</button></header>
    <div className="ea-aviso"><span aria-hidden="true">◉</span><span>Área integrada em prévia. Browser remoto e agente deste chat ainda não pareados. Dados carregados vêm do espelho da loja.</span></div>
    <div className="ea-modos" role="group" aria-label="Modo de navegação"><span>Navegação</span><button aria-pressed={modo === "integrada"} onClick={() => setModo("integrada")}>Área integrada</button><button aria-pressed={modo === "browser"} onClick={() => setModo("browser")}>Browser remoto <small>Conexão pendente</small></button></div>
    <div className="ea-mesa">
      <div className="ea-trabalho">
        <div className="ea-browser"><div className="ea-pontos" aria-hidden="true"><i/><i/><i/></div><nav aria-label="Ambientes de trabalho">{([['conecta','Conecta.IA'],['bling','Bling'],['site','Site da loja']] as const).map(([id,nome]) => <button key={id} aria-pressed={sistema === id} onClick={() => setSistema(id)}>{nome}</button>)}</nav><span className="ea-conexao">{modo === "integrada" ? "Área integrada" : "Browser não conectado"}</span></div>
        <div className="ea-endereco"><span aria-hidden="true">⌁</span><span>{sistema === "conecta" ? `conecta.ia / ${loja.slug} / ${atual.nome.toLowerCase()}` : sistema === "bling" ? "Bling · cadastro original e conexão OAuth" : `site / ${loja.slug} / produto / ${sku || "selecionar"}`}</span></div>
        {modo === "browser" ? <div className="ea-remoto"><span aria-hidden="true">▣</span><h2>Sessão de browser ainda não conectada</h2><p>Aqui ficará a tela do navegador operado pelo agente, com a página atual, indicação de sessão e botão de interrupção.</p><p>É necessário parear o agente e disponibilizar um navegador isolado por loja. O acesso ao Bling mantém o login e o OAuth oficiais.</p><button className="sec" onClick={() => setModo("integrada")}>Voltar à área integrada</button></div> : <div className="ea-corpo">
          <div className="ea-contexto"><div><span className="ea-sobretitulo">CONTEXTO ATIVO</span><strong>{produto?.nome || (carregando ? "Carregando produto…" : "Selecione um produto")}</strong><span className="ea-origem">Espelho do Bling{produto ? ` · ${new Date(produto.sincronizado_em).toLocaleString("pt-BR")}` : ""}</span></div><form onSubmit={buscar}><label htmlFor="ea-sku">SKU</label><div><input id="ea-sku" value={entrada} maxLength={80} onChange={e => setEntrada(e.target.value)} /><button className="sec" disabled={carregando || !entrada.trim()}>Abrir</button></div></form></div>
          {erro && <p role="alert" className="ea-erro">{erro}</p>}
          <nav className="ea-etapas" aria-label="Ferramentas do produto">{AREAS.map(a => <button key={a.id} aria-pressed={area === a.id} onClick={() => setArea(a.id)}><span aria-hidden="true">{a.icone}</span>{a.nome}</button>)}</nav>
          {sistema === "bling" && <div className="ea-nota"><strong>Origem ERP preservada</strong><p>Esta área mostra o espelho. O acesso ao Bling original exige uma sessão autorizada. O envio de imagens ao ERP ainda está indisponível nesta prévia.</p><a href="#/bling">Ver conexão Bling ↗</a></div>}
          {sistema === "site" && <div className="ea-nota"><strong>Revisão antes de publicar</strong><p>Compare dados e propostas com o que está disponível na vitrine.</p><a href={`#/loja/${encodeURIComponent(loja.slug)}`} target="_blank" rel="noopener noreferrer">Abrir site da loja ↗</a>{produto?.publicado && <a href={`#/p/${encodeURIComponent(loja.slug)}/${encodeURIComponent(produto.sku)}`} target="_blank" rel="noopener noreferrer">Abrir produto publicado ↗</a>}</div>}
          {area === "produto" && <div className="ea-produto"><div className="ea-foto">{foto ? <img src={foto.url} alt={`Foto técnica aprovada de ${produto?.nome || produto?.sku}`} referrerPolicy="no-referrer"/> : <div><span aria-hidden="true">▧</span><strong>Sem foto técnica aprovada</strong><small>A imagem precisa corresponder à peça.</small></div>}</div><div className="ea-ficha"><span className="ea-sobretitulo">DADOS DO ESPELHO</span><h2>{produto?.nome || "Produto não selecionado"}</h2><span className="ea-sku">SKU {produto?.sku || "—"}</span><dl><div><dt>Preço de origem</dt><dd>{dinheiro(produto?.preco ?? null)}</dd></div><div><dt>Estoque de origem</dt><dd>{produto?.estoque ?? "Não informado"}</dd></div><div><dt>Marca</dt><dd>{produto?.marca || "Não informada"}</dd></div><div><dt>GTIN</dt><dd>{produto?.gtin || "Não informado"}</dd></div></dl><span className="ea-estado">{produto ? produto.publicado ? "Publicado no catálogo" : "Ainda não publicado" : "Aguardando consulta"}</span></div></div>}
          {area === "taxonomia" && <div className="ea-painel"><div className="ea-nota"><strong>Perfil da loja: {loja.perfil_ramo}</strong><p>A taxonomia da loja e a categoria do ERP têm vínculos próprios. Propor uma classificação não altera automaticamente o cadastro original.</p></div><Taxonomia loja={loja}/></div>}
          {area === "imagens" && <div className="ea-painel"><h2>Imagens com origem e destino</h2><p>Foto técnica, imagem comercial e aprovação permanecem identificadas.</p><div className="ea-galeria">{fotos.map(f => <figure key={f.id}><img src={f.url} alt={`Imagem aprovada · ${f.tipo === "gerada_ia" ? "sintética" : f.tipo}`} loading="lazy" referrerPolicy="no-referrer"/><figcaption>{f.tipo === "gerada_ia" ? "Sintética" : f.tipo === "real" ? "Foto real" : "Ilustrativa"} · {f.origem || "Origem não informada"}</figcaption></figure>)}</div>{!fotos.length && <p className="ea-vazio">Nenhuma imagem aprovada disponível para este produto.</p>}<div className="ea-destinos"><div><strong>Site da loja</strong><p>Preparar proposta, conferir direitos e aprovar a publicação.</p></div><div><strong>Repositório no Bling</strong><p>Envio ao Bling ainda indisponível. Exige aprovação para este produto e confirmação do resultado.</p></div></div></div>}
          {area === "seo" && <div className="ea-painel"><h2>SEO técnico do produto</h2><p>Prévia editorial local; nenhum metadado foi gravado ou auditado no site.</p><div className="ea-seo"><small>{loja.nome} · SKU {produto?.sku || "—"}</small><h3>{produto?.nome || "Selecione um produto"} | {loja.nome}</h3><p>{produto?.descricao ? produto.descricao.replace(/<[^>]*>/g, " ").slice(0, 160) : "Descrição confirmada ainda não disponível."}</p></div><ul className="ea-checks"><li>Título e descrição baseados no cadastro confirmado</li><li>Canonical, sitemap e indexação: verificar no site publicado</li><li>Dados Product/Offer: somente com preço e disponibilidade confirmados</li><li>Fotos reais e sintéticas com identificação e texto alternativo</li></ul></div>}
          <footer className="ea-rodape"><span>{atual.descricao}</span><button disabled={!produto || carregando} onClick={preparar}>Preparar tarefa <span aria-hidden="true">↗</span></button></footer>
        </div>}
      </div>
      <aside id="torre-agente" className="ea-torre" aria-label="Torre do agente" hidden={!torre}>
        <div className="ea-torre-topo"><div><span className="ea-sobretitulo">SEU AGENTE</span><h2>Trabalho com contexto</h2></div><button className="sec" aria-label="Recolher torre do agente" onClick={() => { setTorre(false); botaoTorre.current?.focus(); }}>×</button></div>
        <div className="ea-posicao" role="group" aria-label="Posição da torre"><button aria-pressed={posicao === "lateral"} onClick={() => setPosicao("lateral")}>Lateral</button><button aria-pressed={posicao === "flutuante"} onClick={() => setPosicao("flutuante")}>Flutuante</button></div>
        <div className="ea-agente"><span className="ea-orbe" aria-hidden="true">✦</span><strong>Agente deste chat</strong><span className="ea-estado">Pareamento pendente</span><p>O agente terá acesso aos ambientes pelos escopos que você autorizar.</p></div>
        <div className="ea-conectar"><strong>Conectar com QR Code</strong><p>{PAIR_ATIVO ? "Abra o pareamento e aprove a loja, o escopo e a duração." : "O pareamento por QR ainda está indisponível nesta prévia. A conexão precisa ser ativada para o agente acessar seus sistemas."}</p>{PAIR_ATIVO ? <a className="botao" href="#/parear">Abrir pareamento</a> : <button disabled>Pareamento ainda indisponível</button>}</div>
        <label className="ea-tarefa">Tarefa para o agente<textarea ref={tarefa} value={rascunho} onChange={e => setRascunho(e.target.value)} rows={8} placeholder="Abra um produto e prepare uma tarefa com contexto." maxLength={3000}/></label>
        <button className="sec" disabled={!rascunho.trim()} onClick={() => void copiar()}>Copiar tarefa para o chat</button>
        <p className="ea-aviso-local" role="status">{aviso || "Rascunho somente nesta tela. Nenhuma execução ou gravação no ERP."}</p>
        <a href="#/assistente">Abrir assistente interno ↗</a>
      </aside>
    </div>
  </section>;
}
