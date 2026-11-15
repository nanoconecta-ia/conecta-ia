import { useCallback, useEffect, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import type { Item } from "../lib/comandosNL.ts";
import { Assistente } from "./Assistente.tsx";
import { supabase } from "../supabase.ts";
import { ir } from "../lib/rota.ts";
import "./nanogpt.css";
type Candidata = { titulo: string; url: string; pagina: string };
type Imagem = { id: string; url: string; aprovada: boolean; direitos_confirmados_em: string | null };
type Preparo = { imagem_id: string; sku: string; nome: string; sha256: string; url: string; largura_px: number; altura_px: number };
export function NanoGPT({ loja, menu }: { loja: Loja; menu: Item[] }) {
  const [aba, setAba] = useState("chat");
  const [estado, setEstado] = useState<Record<string, unknown> | null>(null);
  const [erro, setErro] = useState(""); const [aviso, setAviso] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [sku, setSku] = useState(""); const [consulta, setConsulta] = useState("");
  const [url, setUrl] = useState(""); const [pagina, setPagina] = useState("");
  const [candidatas, setCandidatas] = useState<Candidata[]>([]); const [imagens, setImagens] = useState<Imagem[]>([]);
  const [preparo, setPreparo] = useState<Preparo | null>(null); const [confirmar, setConfirmar] = useState(false);
  const [recibo, setRecibo] = useState<Record<string, unknown> | null>(null);
  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("nanogpt-midia", { body: { ...body, loja_id: loja.id } });
    if (error) {
      const d = await error.context?.json?.().catch(() => null);
      if (d?.recibo) setRecibo(d.recibo);
      throw new Error(d?.erro ?? "Serviço de imagens indisponível. Verifique se foi implantado.");
    }
    if (data?.erro) throw new Error(data.erro);
    return data;
  }, [loja.id]);
  const atualizar = useCallback(async () => { setErro(""); try { setEstado(await chamar({ acao: "status" })); } catch(e) { setEstado(null); setErro((e as Error).message); } }, [chamar]);
  useEffect(() => { void atualizar(); }, [atualizar]);
  async function executar(fn: () => Promise<void>) { setOcupado(true); setErro(""); setAviso(""); try { await fn(); } catch(e) { setErro((e as Error).message); } finally { setOcupado(false); } }
  async function carregarImagens() {
    setPreparo(null); setConfirmar(false); setImagens([]);
    const p = await supabase.from("produtos").select("id").eq("loja_id", loja.id).eq("sku", sku.trim()).maybeSingle();
    if (p.error || !p.data) throw new Error("SKU não encontrado de forma única nesta loja.");
    const r = await supabase.from("produto_imagens").select("id,url,aprovada,direitos_confirmados_em").eq("loja_id", loja.id).eq("produto_id", p.data.id).is("removida_em", null).order("ordem");
    if (r.error) throw new Error("Não foi possível carregar a galeria.");
    setImagens(r.data ?? []); if (!r.data?.length) setAviso("Nenhuma imagem registrada para este SKU.");
  }
  return <section className="nanogpt">
    <header className="ng-header"><div><small>CONECTA.IA / CENTRAL DE TRABALHO</small><h1>NanoGPT</h1><p>Peça, confira as fontes e aprove o cadastro.</p></div><a href="#/nanogpt" target="_blank" rel="noopener noreferrer">Abrir em nova janela ↗</a></header>
    <div className="ng-status" aria-label="Conexões"><span>Inteligência: selecione no chat</span><span>Bling: {String(estado?.bling ?? "não verificado")}</span><span>Drive: {String(estado?.drive ?? "não verificado")}</span><span>Busca: {estado ? String(estado.busca ?? "não configurada") : "não verificada"}</span><button onClick={() => void atualizar()}>Atualizar</button></div>
    <nav className="ng-tabs" aria-label="Área de trabalho"><button aria-pressed={aba === "chat"} onClick={() => setAba("chat")}>01 · Conversar e cadastrar</button><button aria-pressed={aba === "imagens"} onClick={() => setAba("imagens")}>02 · Buscar e copiar imagens</button><button onClick={() => ir("/fila")}>03 · Revisar propostas ↗</button></nav>
    {erro && <p role="alert" className="ng-error">{erro}</p>}{aviso && <p role="status">{aviso}</p>}
    <div hidden={aba !== "chat"} className="ng-chat"><Assistente loja={loja} menu={menu} aoNavegar={ir} identidadeCompacta /></div>
    {aba === "imagens" && <div className="ng-images">
      <aside><h2>Produto em trabalho</h2><label>SKU no Bling<input value={sku} disabled={ocupado} onChange={e => { setSku(e.target.value); setPreparo(null); setImagens([]); setConfirmar(false); }} placeholder="Código exato do produto" /></label><button disabled={!sku.trim() || ocupado} onClick={() => void executar(carregarImagens)}>Carregar imagens do produto</button><p>Busca encontra candidatas. Aprovação confirma a peça e os direitos de uso. A cópia preserva o arquivo original.</p><button onClick={() => ir("/integracoes")}>Configurar inteligência e busca</button><button onClick={() => ir("/fila")}>Revisar imagens e direitos</button></aside>
      <main><h2>Encontrar imagens reais</h2><form onSubmit={e => { e.preventDefault(); void executar(async () => { setCandidatas([]); const r = await chamar({ acao: "buscar", consulta }); setCandidatas(r.candidatas); if (!r.candidatas.length) setAviso("Nenhuma candidata encontrada."); }); }}><label>Referência + fabricante<input value={consulta} onChange={e => setConsulta(e.target.value)} maxLength={160} placeholder="SKU, marca e nome da peça" /></label><button disabled={ocupado || consulta.trim().length < 3}>Buscar na web</button></form>
      <div className="ng-gallery">{candidatas.map(c => <article key={c.url}><img src={c.url} alt={c.titulo} loading="lazy" referrerPolicy="no-referrer" /><p>{c.titulo}</p><a href={c.pagina} target="_blank" rel="noopener noreferrer">Ver fonte ↗</a><button disabled={ocupado} onClick={() => { setUrl(c.url); setPagina(c.pagina); }}>Usar como proposta</button></article>)}</div>
      <details open={!estado?.busca}><summary>Adicionar imagem por URL e fonte</summary><label>URL HTTPS da imagem<input value={url} onChange={e => setUrl(e.target.value)} /></label><label>Página de origem<input value={pagina} onChange={e => setPagina(e.target.value)} /></label><button disabled={ocupado || !sku.trim() || !url || !pagina} onClick={() => void executar(async () => { await chamar({ acao: "propor", sku: sku.trim(), url, pagina }); setAviso("Imagem registrada na fila para aprovação. Ainda não enviada ao Bling ou Drive."); await carregarImagens(); })}>Registrar proposta de imagem</button></details>
      <h2>Galeria e cópias</h2><div className="ng-gallery">{imagens.map(i => <article key={i.id}><img src={i.url} alt={`Imagem do SKU ${sku}`} loading="lazy" referrerPolicy="no-referrer" /><p>{!i.aprovada ? "Aguardando aprovação" : !i.direitos_confirmados_em ? "Direitos pendentes" : "Aprovada • direitos confirmados"}</p><button disabled={ocupado || !i.aprovada || !i.direitos_confirmados_em} onClick={() => void executar(async () => { setPreparo(null); setConfirmar(false); setPreparo(await chamar({ acao: "preparar", imagem_id: i.id })); })}>Revisar cópia nos três destinos</button></article>)}</div>
      {preparo && <section className="ng-review"><h3>Confirmar cópia · {preparo.sku}</h3><p>{preparo.nome} · {preparo.largura_px} × {preparo.altura_px}px</p><img src={preparo.url} alt="Imagem selecionada para copiar" referrerPolicy="no-referrer" /><p>Conecta.IA: arquivo original. Drive: cópia privada. Bling: URL da cópia do Conecta.IA, preservando as imagens externas atuais.</p><label><input type="checkbox" checked={confirmar} onChange={e => setConfirmar(e.target.checked)} /> Confirmo esta imagem e autorizo a cópia nos três destinos.</label><button disabled={ocupado || !confirmar || estado?.exportacao !== true} onClick={() => void executar(async () => { const r = await chamar({ acao: "exportar", imagem_id: preparo.imagem_id, sha256: preparo.sha256, confirmar: true }); setRecibo(r.recibo); setPreparo(null); setAviso("Cópias confirmadas nos três destinos."); await carregarImagens(); })}>{ocupado ? "Processando…" : "Copiar imagem aprovada"}</button>{estado?.exportacao !== true && <p>Exportação ainda não habilitada no servidor.</p>}</section>}
      {recibo && <section aria-live="polite"><h3>Recibo da operação</h3><p>Estado: {String(recibo.estado)}</p><p>Identificador: {String(recibo.request_id)}</p>{typeof recibo.conecta_url === "string" && <a href={recibo.conecta_url} target="_blank" rel="noopener noreferrer">Conferir endereço no Conecta.IA ↗</a>}<p>Em caso de falha parcial, confira este recibo antes de repetir.</p></section>}
      </main></div>}
  </section>;
}
