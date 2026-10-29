import { useEffect, useRef, useState } from "react";
import type { LinhaPlanilha } from "../lib/planilha.ts";
import { supabase } from "../supabase.ts";
import { codigoDaLeitura, campoCsvSeguro } from "../lib/leitorEstoque.ts";

type Leitura = { codigo: string; quantidade: number; produto: string; situacao: string };
type Detector = { detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

export function LeitorEstoque({ produtos, lojaId }: { produtos: LinhaPlanilha[]; lojaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [erro, setErro] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const ultimo = useRef({ codigo: "", instante: 0 });
  const produtosRef = useRef(produtos);
  produtosRef.current = produtos;

  function adicionar(valor: string) {
    const c = codigoDaLeitura(valor);
    if (!c) { setErro("Código não reconhecido. Informe GTIN/EAN ou SKU válido."); return; }
    const encontrado = produtosRef.current.find(p => p.gtin === c || p.sku === c);
    setLeituras(atual => {
      const pos = atual.findIndex(x => x.codigo === c);
      if (pos >= 0) return atual.map((x, i) => i === pos ? { ...x, quantidade: x.quantidade + 1 } : x);
      return [...atual, { codigo: c, quantidade: 1, produto: encontrado?.nome ?? "", situacao: encontrado ? "Encontrado no lote carregado" : "Pendente de conferência no catálogo completo" }];
    });
    setCodigo("");
  }
  useEffect(() => {
    if (!aberto || !ativo) return;
    let encerrado = false;
    let frame = 0;
    let camera: MediaStream | null = null;
    let pararFallback: (() => void) | undefined;
    const iniciar = async () => {
      try {
        const Ctor = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

        if (!navigator.mediaDevices?.getUserMedia) throw Error("Câmera indisponível. Abra o site em HTTPS e autorize a câmera.");
        const detector = Ctor ? new Ctor({ formats: ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "data_matrix"] }) : null;
        camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (encerrado) { camera.getTracks().forEach(t => t.stop()); return; }
        stream.current = camera;
        if (video.current) { video.current.srcObject = camera; await video.current.play(); }
        if (!detector) {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (encerrado || !video.current) return;
          const leitor = new BrowserMultiFormatReader();
          const controles = await leitor.decodeFromVideoElement(video.current, (resultado) => {
            const c = resultado?.getText()?.trim();
            if (c && (c !== ultimo.current.codigo || Date.now() - ultimo.current.instante > 1800)) {
              ultimo.current = { codigo: c, instante: Date.now() };
              adicionar(c);
            }
          });
          pararFallback = () => controles.stop();
          if (encerrado) pararFallback();
          return;
        }
        const procurar = async () => {
          if (encerrado) return;
          if (video.current?.readyState === 4) {
            try {
              const achados = await detector.detect(video.current);
              const c = achados[0]?.rawValue?.trim();
              if (c && (c !== ultimo.current.codigo || Date.now() - ultimo.current.instante > 1800)) {
                ultimo.current = { codigo: c, instante: Date.now() };
                adicionar(c);
              }
            } catch { /* frame inválido; continuar */ }
          }
          if (!encerrado) frame = window.setTimeout(procurar, 220);
        };
        void procurar();
      } catch (e) { if (!encerrado) { setErro(e instanceof Error ? e.message : "Falha ao iniciar câmera"); setAtivo(false); } }
    };
    void iniciar();
    return () => { encerrado = true; window.clearTimeout(frame); pararFallback?.(); camera?.getTracks().forEach(t => t.stop()); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  }, [aberto, ativo]);

  async function conferirCatalogo() {
    setErro("");
    const codigos = leituras.map(l => l.codigo);
    if (!codigos.length) return;
    const [gtin, sku] = await Promise.all([
      supabase.from("produtos").select("id, nome, gtin, sku").eq("loja_id", lojaId).in("gtin", codigos).limit(500),
      supabase.from("produtos").select("id, nome, gtin, sku").eq("loja_id", lojaId).in("sku", codigos).limit(500),
    ]);
    if (gtin.error || sku.error) { setErro("Falha ao conferir catálogo completo. Nenhuma alteração realizada."); return; }
    const encontrados = [...(gtin.data ?? []), ...(sku.data ?? [])];
    setLeituras(atual => atual.map(l => {
      const p = encontrados.find(p => p.gtin === l.codigo || p.sku === l.codigo);
      return { ...l, produto: p?.nome ?? "", situacao: p ? "Encontrado no espelho da loja" : "Não encontrado no espelho; revisão necessária" };
    }));
  }
  function exportar() {
    const campos = [["codigo", "quantidade", "produto", "situacao", "fornecedor_informado"], ...leituras.map(l => [l.codigo, String(l.quantidade), l.produto, l.situacao, fornecedor])];
    const csv = "\uFEFF" + campos.map(l => l.map(campoCsvSeguro).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "conecta-ia-conferencia-estoque.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="leitor-estoque" aria-label="Leitura de códigos e conferência de estoque">
    <button type="button" onClick={() => { setAberto(!aberto); setAtivo(false); }}> {aberto ? "Fechar leitor" : "Escanear QR / GTIN · Conferir lote"} </button>
    {aberto && <div className="leitor-conteudo">
      <p>Leia um produto ou vários. Os códigos ficam somente nesta sessão até você exportar a conferência. Nenhum estoque, produto ou fornecedor será gravado automaticamente.</p>
      <label>Fornecedor informado pelo lojista <input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor (opcional)" /></label>
      <div className="leitor-controles"><button type="button" onClick={() => { setErro(""); setAtivo(!ativo); }}>{ativo ? "Desligar câmera" : "Ligar câmera"}</button>
      <form onSubmit={e => { e.preventDefault(); adicionar(codigo); }}><input aria-label="Código GTIN, SKU ou QR" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="GTIN, SKU ou QR" /><button type="submit">Adicionar</button></form></div>
      {ativo && <video ref={video} playsInline muted aria-label="Visualização da câmera" style={{ width: "100%", maxHeight: 260, background: "#111" }} />}
      {erro && <p role="alert">{erro}</p>}
      <p><strong>{leituras.length}</strong> códigos diferentes · <strong>{leituras.reduce((n, l) => n + l.quantidade, 0)}</strong> unidades lidas</p>
      <div className="leitor-lista">{leituras.map(l => <div key={l.codigo} className="leitor-linha"><div><strong>{l.codigo}</strong><small>{l.produto || l.situacao}</small></div><label>Qtd. <input type="number" min="1" value={l.quantidade} onChange={e => setLeituras(a => a.map(x => x.codigo === l.codigo ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x))} /></label><button type="button" onClick={() => setLeituras(a => a.filter(x => x.codigo !== l.codigo))}>Remover</button></div>)}</div>
      {leituras.length > 0 && <button type="button" onClick={() => void conferirCatalogo()}>Conferir códigos no catálogo completo</button>}
      {leituras.length > 0 && <button type="button" onClick={exportar}>Exportar conferência CSV (sem gravar no ERP)</button>}
    </div>}
  </section>;
}
