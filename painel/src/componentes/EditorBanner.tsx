import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import type { Loja } from "../lib/dados.ts";
import {
  FORMATOS, PASSO_PX, TEXTO_RASCUNHO, aplicarTransformacaoFoto, ajustarContain, camada, definirEscala, definirTexto, deslocarFoto, documentoInicial,
  faixasDe, gravarRascunho, lerRascunho, chaveRascunho, moverCamada, type Formato,
} from "../lib/editorBanner.ts";
import {
  CHECAGENS_HUMANAS, hashComposicao, validarFidelidadeVisual, type Ativo, type Autorizacoes, type Contexto, type Documento, type Produto,
} from "../lib/fidelidadeVisual.ts";
import { BloqueioFidelidade } from "./BloqueioFidelidade.tsx";

export type FotoEscolhida = { url: string; nome: string; tamanho: number; sha: string };

// Cores do ARTE do banner (conteúdo exportado, igual em qualquer tema do painel), não da interface.
const ARTE = { fundo: "#f6f2ea", texto: "#1d1b18", chamada: "#ad4c29", chamadaTexto: "#ffffff", suave: "#6b645a" } as const;

/** Editor de banner (Konva). A foto da peça fica numa camada protegida: só mover e redimensionar com escala uniforme, sem recorte, espelho,
 *  rotação nem edição. Cada mudança passa pelo validador de fidelidade (o mesmo do servidor). Tudo é local: a foto não sai do navegador, o
 *  rascunho guarda só a composição, e nada vai ao Bling, ao site, ao Drive ou à Meta. A aprovação daqui vale só para baixar o arquivo. */
export default function EditorBanner({ foto, loja }: { foto: FotoEscolhida; loja: Loja }) {
  const [sku, setSku] = useState("");
  const [titulo, setTitulo] = useState("");
  const [formatoId, setFormatoId] = useState(FORMATOS[0].id);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [doc, setDoc] = useState<Documento | null>(null);
  const [hashAtual, setHashAtual] = useState<string | null>(null);
  const [codigo, setCodigo] = useState(""); const [oem, setOem] = useState(""); const [evidencia, setEvidencia] = useState(""); const [data, setData] = useState("");
  const [identidadeOk, setIdentidadeOk] = useState(false); const [direitosOk, setDireitosOk] = useState(false);
  const [checagens, setChecagens] = useState<boolean[]>(CHECAGENS_HUMANAS.map(() => false));
  const [aviso, setAviso] = useState("");
  const [palcoPronto, setPalcoPronto] = useState(0);
  const formato: Formato = FORMATOS.find((f) => f.id === formatoId) ?? FORMATOS[0];

  const caixa = useRef<HTMLDivElement>(null);
  const palco = useRef<Konva.Stage | null>(null);
  const nos = useRef<{ foto?: Konva.Image; transformer?: Konva.Transformer; grupos: Map<string, Konva.Group>; marca?: Konva.Text }>({ grupos: new Map() });
  const imagem = useRef<HTMLImageElement | null>(null);
  const docRef = useRef<Documento | null>(null); docRef.current = doc;

  // Carrega a foto só para saber o tamanho natural (a imagem não é alterada nem enviada).
  useEffect(() => {
    const img = new Image(); img.onload = () => { imagem.current = img; setNatural({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => setAviso("Não foi possível abrir esta imagem."); img.src = foto.url;
  }, [foto.url]);

  // Documento: rascunho guardado (mesma loja, SKU e foto) ou o enquadramento 'contain' inicial.
  const criarDocumento = useCallback((skuAtual: string, f: Formato) => {
    if (!natural || !skuAtual.trim()) return null;
    const salvo = lerRascunho(localStorage.getItem(chaveRascunho(loja.id, skuAtual.trim())), { loja_id: loja.id, sku: skuAtual.trim(), sha256: foto.sha });
    if (salvo && salvo.formato.w === f.w && salvo.formato.h === f.h) return salvo;
    return documentoInicial({ lojaId: loja.id, sku: skuAtual.trim(), formato: f, foto: { assetId: foto.sha.slice(0, 16), sha256: foto.sha, w: natural.w, h: natural.h }, titulo: titulo.trim() || "Nome da peça", lojaNome: loja.nome });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, loja.id, loja.nome, foto.sha]);
  useEffect(() => { setDoc(criarDocumento(sku, formato)); setChecagens(CHECAGENS_HUMANAS.map(() => false)); }, [sku, formatoId, natural]); // eslint-disable-line react-hooks/exhaustive-deps

  const editar = useCallback((f: (d: Documento) => Documento) => setDoc((d) => (d ? f(d) : d)), []);

  // Hash da composição atual; se mudou depois da aprovação, a aprovação cai e o rascunho volta ao início.
  useEffect(() => {
    if (!doc) { setHashAtual(null); return; }
    let vivo = true;
    void hashComposicao(doc).then((h) => {
      if (!vivo) return;
      setHashAtual(h);
      if (doc.hash_aprovado && doc.hash_aprovado !== h) { setDoc({ ...doc, status: "rascunho", hash_aprovado: null }); setAviso("O banner mudou depois da aprovação: é preciso aprovar de novo."); }
    });
    return () => { vivo = false; };
  }, [doc]);
  useEffect(() => { if (doc) gravarRascunho(localStorage, doc); }, [doc]);

  // Validação: o mesmo validador do servidor.
  const ativo: Ativo = useMemo(() => ({
    asset_id: foto.sha.slice(0, 16), loja_id: loja.id, sha256_original: foto.sha, tipo: "real", origem: "foto_do_lojista_neste_navegador", licenca_confirmada: direitosOk, url_terceiro: null,
    identidade: { codigo_fabricante: codigo.trim() || null, oem: oem.trim() || null, evidencias: evidencia.trim() && data ? [{ documento: evidencia.trim(), data }] : [] },
  }), [foto.sha, loja.id, direitosOk, codigo, oem, evidencia, data]);
  const produto: Produto = useMemo(() => ({ loja_id: loja.id, sku: sku.trim(), fatos: {} }), [loja.id, sku]);
  const aut: Autorizacoes = { identidade_aprovada: identidadeOk, direitos_aprovados: direitosOk };
  const ctxRascunho: Contexto = { acao: "salvar", ator: "usuario" };
  const resultado = useMemo(() => (doc ? validarFidelidadeVisual(doc, ativo, produto, aut, ctxRascunho) : null), [doc, ativo, produto, identidadeOk, direitosOk]); // eslint-disable-line react-hooks/exhaustive-deps
  const autorizar = useMemo(() => (doc ? validarFidelidadeVisual(doc, ativo, produto, aut, { acao: "autorizar", ator: "usuario", checagens_humanas: checagens }) : null), [doc, ativo, produto, identidadeOk, direitosOk, checagens]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportar = useMemo(() => (doc ? validarFidelidadeVisual(doc, ativo, produto, aut, { acao: "exportar", ator: "usuario", destino: "download", hash_atual: hashAtual, checagens_humanas: checagens }) : null), [doc, ativo, produto, identidadeOk, direitosOk, checagens, hashAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Palco Konva: criado uma vez por formato/foto; os nós são sincronizados a partir do documento.
  useEffect(() => {
    if (!doc || !caixa.current || !imagem.current || palco.current) return;
    const largura = caixa.current.clientWidth || 600;
    const stage = new Konva.Stage({ container: caixa.current, width: largura, height: (largura * formato.h) / formato.w });
    stage.scale({ x: largura / formato.w, y: largura / formato.w });
    const camadaK = new Konva.Layer(); stage.add(camadaK);
    camadaK.add(new Konva.Rect({ name: "fundo", x: 0, y: 0, width: formato.w, height: formato.h, fill: ARTE.fundo }));
    const fotoNo = new Konva.Image({ name: "foto", image: imagem.current, draggable: true, width: imagem.current.naturalWidth, height: imagem.current.naturalHeight });
    camadaK.add(fotoNo);
    const tr = new Konva.Transformer({ nodes: [fotoNo], rotateEnabled: false, keepRatio: true, flipEnabled: false, enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"], borderStroke: ARTE.chamada, anchorStroke: ARTE.chamada, anchorSize: 18, boundBoxFunc: (a, b) => (b.width < 24 || b.height < 24 ? a : b) });
    camadaK.add(tr);
    fotoNo.on("dragend", () => editar((d) => aplicarTransformacaoFoto(d, fotoNo.x(), fotoNo.y(), d.foto.transform.scaleX, d.foto.transform.scaleY)));
    fotoNo.on("transformend", () => editar((d) => aplicarTransformacaoFoto(d, fotoNo.x(), fotoNo.y(), fotoNo.scaleX(), fotoNo.scaleY())));
    const texto = (id: string, c: { rotulo?: string }) => {
      const g = new Konva.Group({ name: id, draggable: true });
      g.add(new Konva.Rect({ name: "caixa" })); g.add(new Konva.Text({ name: "texto", wrap: "none", ellipsis: true, verticalAlign: "middle" }));
      g.on("dragend", () => editar((d) => moverCamada(d, id, g.x(), g.y()))); camadaK.add(g); nos.current.grupos.set(id, g); void c;
    };
    for (const id of ["titulo", "loja", "cta"]) texto(id, {});
    const marca = new Konva.Text({ name: "marca", text: TEXTO_RASCUNHO, fontSize: 28, fill: ARTE.suave, visible: false }); camadaK.add(marca);
    palco.current = stage; nos.current.foto = fotoNo; nos.current.transformer = tr; nos.current.marca = marca; setPalcoPronto((v) => v + 1);
    return () => { stage.destroy(); palco.current = null; nos.current = { grupos: new Map() }; };
  }, [natural, formatoId, !!doc, editar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza os nós com o documento (fonte única da verdade).
  useEffect(() => {
    const stage = palco.current, n = nos.current; if (!doc || !stage || !n.foto) return;
    const p = doc.foto;
    n.foto.position({ x: p.posicao.x, y: p.posicao.y }); n.foto.scale({ x: p.transform.scaleX, y: p.transform.scaleY });
    for (const [id, g] of n.grupos) {
      const c = camada(doc, id); if (!c) continue;
      const cta = c.tipo === "cta";
      g.position({ x: c.retangulo.x, y: c.retangulo.y });
      const caixaK = g.findOne<Konva.Rect>(".caixa")!, t = g.findOne<Konva.Text>(".texto")!;
      caixaK.setAttrs({ width: c.retangulo.w, height: c.retangulo.h, fill: cta ? ARTE.chamada : "transparent", cornerRadius: cta ? 12 : 0 });
      t.setAttrs({ text: c.texto ?? "", width: c.retangulo.w, height: c.retangulo.h, align: cta ? "center" : id === "loja" ? "left" : "center", fontStyle: id === "titulo" || cta ? "bold" : "normal",
        fontSize: Math.max(14, Math.round(c.retangulo.h * (id === "titulo" ? 0.5 : 0.42))), fill: cta ? ARTE.chamadaTexto : id === "loja" ? ARTE.suave : ARTE.texto, fontFamily: "IBM Plex Sans, system-ui, sans-serif" });
    }
    n.transformer?.forceUpdate(); stage.batchDraw();
  }, [doc, palcoPronto]);

  // Redimensiona o palco com a largura da tela (a composição continua nas medidas do formato).
  useEffect(() => {
    const el = caixa.current; if (!el || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(() => {
      const s = palco.current; if (!s || !el.clientWidth) return;
      const k = el.clientWidth / formato.w; s.width(el.clientWidth); s.height(formato.h * k); s.scale({ x: k, y: k }); s.batchDraw();
    });
    o.observe(el); return () => o.disconnect();
  }, [formato.w, formato.h, !!doc]); // eslint-disable-line react-hooks/exhaustive-deps

  function baixar(comMarca: boolean) {
    const s = palco.current, n = nos.current; if (!s || !n.foto || !n.marca) return;
    const { base } = faixasDe(formato);
    n.transformer?.visible(false);
    n.marca.setAttrs({ visible: comMarca, x: base.x, y: base.y - 44, width: base.w, align: "center" });
    s.batchDraw();
    const url = s.toDataURL({ pixelRatio: formato.w / s.width() });
    n.marca.visible(false); n.transformer?.visible(true); s.batchDraw();
    const a = document.createElement("a"); a.href = url; a.download = `banner-${sku.trim()}-${formato.id.replace(":", "x")}${comMarca ? "-rascunho" : ""}.png`; a.click();
  }
  async function aprovar() {
    if (!doc || !autorizar?.ok) return;
    const h = await hashComposicao(doc);
    setDoc({ ...doc, status: "aprovado_para_destino", hash_aprovado: h }); setAviso("");
  }

  const t = doc?.foto.transform.scaleX ?? 1;
  const conteudo = (
    <section className="cartao editor-banner" aria-labelledby="eb-titulo">
      <h2 id="eb-titulo">Editor de banner <span className="selo">foto preservada</span></h2>
      <p className="suave">A foto da peça só pode ser <strong>movida e redimensionada na mesma proporção</strong>. Não há recorte, giro, espelho nem edição. Tudo fica neste navegador; nada é enviado ao Bling, ao site, ao Drive nem a redes sociais.</p>
      <p className="suave">Original preservado: <code title="SHA-256 do arquivo original">{foto.sha.slice(0, 12)}…{foto.sha.slice(-6)}</code></p>

      <div className="eb-campos">
        <label className="fid-campo">SKU do cadastro <input value={sku} maxLength={40} placeholder="ex.: o SKU como está no Bling" onChange={(e) => setSku(e.target.value)} /></label>
        <label className="fid-campo">Formato
          <select value={formatoId} onChange={(e) => setFormatoId(e.target.value)}>{FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}</select>
        </label>
      </div>
      {!sku.trim() && <p className="suave" role="status">Informe o SKU para abrir o editor. Sem SKU, o banner não pode ser vinculado a um produto.</p>}

      {doc && (<>
        <div className="eb-palco" ref={caixa} aria-label={`Banner ${formato.rotulo}: a peça aparece inteira`} role="img" data-formato={formato.id} />

        <div className="eb-controles" role="group" aria-label="Controles da foto da peça (alternativa ao arrastar)">
          <label>Tamanho da peça: {Math.round(t * 100)} %
            <input type="range" min={5} max={400} step={1} value={Math.round(t * 100)} onChange={(e) => editar((d) => definirEscala(d, Number(e.target.value) / 100))} aria-label="Tamanho da peça, proporcional" />
          </label>
          <div className="linha">
            <button type="button" className="sec icone-btn" aria-label="Mover a peça para a esquerda" onClick={() => editar((d) => deslocarFoto(d, -PASSO_PX, 0))}>←</button>
            <button type="button" className="sec icone-btn" aria-label="Mover a peça para cima" onClick={() => editar((d) => deslocarFoto(d, 0, -PASSO_PX))}>↑</button>
            <button type="button" className="sec icone-btn" aria-label="Mover a peça para baixo" onClick={() => editar((d) => deslocarFoto(d, 0, PASSO_PX))}>↓</button>
            <button type="button" className="sec icone-btn" aria-label="Mover a peça para a direita" onClick={() => editar((d) => deslocarFoto(d, PASSO_PX, 0))}>→</button>
            <button type="button" className="sec" onClick={() => editar((d) => ajustarContain(d, formato))}>Ajustar para caber inteira</button>
          </div>
        </div>

        <div className="eb-textos">
          {(["titulo", "loja", "cta"] as const).map((id) => (
            <label key={id} className="fid-campo">{id === "titulo" ? "Título (nome como no cadastro)" : id === "loja" ? "Loja" : "Chamada"}
              <input value={camada(doc, id)?.texto ?? ""} maxLength={80} onChange={(e) => { const v = e.target.value; if (id === "titulo") setTitulo(v); editar((d) => definirTexto(d, id, v)); }} />
            </label>
          ))}
          <p className="suave">Preço, garantia e medidas não são oferecidos aqui: só entram quando vierem de um dado confirmado do cadastro.</p>
        </div>

        {resultado && <BloqueioFidelidade bloqueios={resultado.bloqueios} />}
        {resultado?.ok && <p className="eb-ok" role="status">Composição válida: peça inteira, proporcional e sem nada por cima.</p>}
        {resultado?.avisos.map((a) => <p key={a} className="suave" role="note">{a}</p>)}
        {aviso && <p className="msg-erro" role="alert">{aviso}</p>}

        <div className="linha">
          <button type="button" className="sec" disabled={!resultado?.ok} onClick={() => baixar(true)}>Baixar prévia (rascunho)</button>
          <span className="suave">A prévia leva a marca “{TEXTO_RASCUNHO}”.</span>
        </div>

        <details className="eb-aprovacao">
          <summary>Aprovar para baixar o arquivo final (uso interno)</summary>
          <p className="suave">Esta aprovação vale <strong>só para baixar o arquivo</strong>. Ela não publica no Bling, no site nem na Meta, e não substitui a prova de direitos e de identidade da peça.</p>
          <div className="eb-campos">
            <label className="fid-campo">Código do fabricante <input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label>
            <label className="fid-campo">Código OEM <input value={oem} onChange={(e) => setOem(e.target.value)} /></label>
            <label className="fid-campo">Evidência (URL ou documento) <input value={evidencia} onChange={(e) => setEvidencia(e.target.value)} /></label>
            <label className="fid-campo">Data da evidência <input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
          </div>
          <label className="marcar-linha"><input type="checkbox" checked={identidadeOk} onChange={(e) => setIdentidadeOk(e.target.checked)} /> Confirmo que esta foto é desta peça (código conferido na peça ou no catálogo do fabricante)</label>
          <label className="marcar-linha"><input type="checkbox" checked={direitosOk} onChange={(e) => setDireitosOk(e.target.checked)} /> Tenho o direito de usar esta foto (própria ou autorizada)</label>
          {CHECAGENS_HUMANAS.map((c, i) => (
            <label key={c} className="marcar-linha"><input type="checkbox" checked={checagens[i]} onChange={(e) => setChecagens((m) => m.map((v, k) => (k === i ? e.target.checked : v)))} /> {c}</label>
          ))}
          {autorizar && !autorizar.ok && <BloqueioFidelidade bloqueios={autorizar.bloqueios} />}
          <div className="linha">
            <button type="button" disabled={!autorizar?.ok || doc.status === "aprovado_para_destino"} onClick={() => void aprovar()}>{doc.status === "aprovado_para_destino" ? "Versão aprovada" : "Aprovar esta versão"}</button>
            <button type="button" disabled={!exportar?.ok} onClick={() => baixar(false)}>Baixar PNG final</button>
          </div>
          {doc.status === "aprovado_para_destino" && exportar && !exportar.ok && <BloqueioFidelidade bloqueios={exportar.bloqueios} />}
        </details>
        <p className="suave">{resultado?.manuais[0]}</p>
      </>)}
    </section>
  );
  return conteudo;
}
