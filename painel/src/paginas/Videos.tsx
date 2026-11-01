import { useEffect, useRef, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import { FORMATOS_VIDEO, montarPlanoVideo, nomePlanoVideo, type FotoVideo, type FormatoVideo } from "../lib/videoPlano.ts";
import { Icone } from "../componentes/Icone.tsx";
import "./videos.css";

type Entrada = FotoVideo & { url: string };
const maxFotos = 4;
async function sha256(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function ehImagem(buf: Uint8Array): boolean {
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && [0x50, 0x4e, 0x47].every((v, i) => buf[i+1] === v);
  const webp = String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP";
  return jpg || png || webp;
}
/** Studio isolado, indexado no grid principal e no menu do Nano. Nao consulta ou altera Bling. */
export function Videos({ loja }: { loja: Loja }) {
  const [sku, setSku] = useState("");
  const [titulo, setTitulo] = useState("");
  const [marca, setMarca] = useState("");
  const [formato, setFormato] = useState<FormatoVideo>("reels");
  const [segundos, setSegundos] = useState(3);
  const [fotos, setFotos] = useState<Entrada[]>([]);
  const [erro, setErro] = useState("");
  const [arquivoPronto, setArquivoPronto] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.url)), [fotos]);
  async function selecionar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro(""); setArquivoPronto(false);
    const selecionados = [...arquivos].slice(0, maxFotos);
    if (arquivos.length > maxFotos) { setErro("Selecione no máximo 4 fotos reais por vídeo."); return; }
    const novas: Entrada[] = [];
    for (const a of selecionados) {
      if (a.size < 100 || a.size > 20_000_000 || !/\.(?:jpg|jpeg|png|webp)$/i.test(a.name)) {
        setErro("Use JPG, PNG ou WebP de até 20 MB, com nome simples."); return;
      }
      const assinatura = new Uint8Array(await a.slice(0, 12).arrayBuffer());
      if (!ehImagem(assinatura) || /[/\\:\x00-\x1f<>|"*?]/.test(a.name) || a.name.startsWith(".")) {
        setErro("Arquivo de imagem ou nome inválido."); return;
      }
      novas.push({ nome: a.name, bytes: a.size, sha256: await sha256(a), url: URL.createObjectURL(a) });
    }
    if (new Set(novas.map(f => f.nome.toLowerCase())).size !== novas.length) {
      novas.forEach(f => URL.revokeObjectURL(f.url)); setErro("As fotos precisam ter nomes diferentes."); return;
    }
    setFotos(novas);
  }
  function baixarPlano() {
    setErro("");
    const r = montarPlanoVideo({ loja_id: loja.id, sku: sku.trim(), titulo: titulo.trim(), marca: marca.trim(), formato, segundos_por_foto: segundos,
      fotos: fotos.map(({ nome, sha256, bytes }) => ({ nome, sha256, bytes })) });
    if (!r.ok) { setErro(r.erro); return; }
    const json = JSON.stringify(r.plano, null, 2) + "\n";
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = nomePlanoVideo(sku.trim()); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setArquivoPronto(true);
  }
  return <div className="videos-estudio">
    <section className="cartao videos-cabecalho">
      <div><span className="selo">Nano Visual Studio · vídeo local</span><h1>Editor de vídeos <span className="suave">para produtos</span></h1>
        <p className="suave">Monte um roteiro com até quatro fotografias reais. O plano só fica no navegador e é exportado para renderização local com FFmpeg. O Concat MCP é opcional para a edição posterior. Nenhum vídeo é publicado automaticamente.</p></div>
      <div className="videos-status"><Icone nome="video" tamanho={28}/><strong>Sem cobrança por API de edição</strong><small>FFmpeg e Concat precisam ser instalados e homologados no dispositivo.</small></div>
    </section>
    <section className="cartao" aria-label="Dados técnicos do vídeo">
      <h2>1. Identificação do produto</h2>
      <div className="videos-campos">
        <label>SKU do Bling <input value={sku} maxLength={60} placeholder="Ex.: CI000016" onChange={e => { setSku(e.target.value); setArquivoPronto(false); }} /></label>
        <label>Título conferido <input value={titulo} maxLength={120} placeholder="Ex.: Bomba d'água HR 8V" onChange={e => { setTitulo(e.target.value); setArquivoPronto(false); }} /></label>
        <label>Marca confirmada (se houver) <input value={marca} maxLength={80} placeholder="Sem inventar fabricante" onChange={e => { setMarca(e.target.value); setArquivoPronto(false); }} /></label>
      </div>
      <p className="suave">Informe apenas dados já verificados. Referências, fabricante e aplicação não são deduzidos das fotos. Não inclua preço de custo, fornecedor ou informações fiscais.</p>
    </section>
    <section className="cartao" aria-label="Fotografias do vídeo">
      <h2>2. Fotografias originais</h2>
      <input type="file" ref={entrada} accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { void selecionar(e.target.files); e.target.value = ""; }} />
      <button type="button" className="sec" onClick={() => entrada.current?.click()}><Icone nome="imagem" tamanho={18}/> Escolher 1 a 4 fotografias</button>
      <div className="videos-grid">
        {fotos.map((f, i) => <figure key={f.sha256+i} className="videos-foto"><img src={f.url} alt={"Foto original " + (i+1)} />
          <figcaption><strong>{i+1}. {f.nome}</strong><small>SHA-256: {f.sha256.slice(0,12)}…</small></figcaption></figure>)}
        {!fotos.length && <div className="videos-vazio"><Icone nome="imagem" tamanho={32}/><strong>Nenhuma fotografia selecionada</strong><span>As imagens serão preservadas: nada é gerado ou redesenhado.</span></div>}
      </div>
    </section>
    <section className="cartao" aria-label="Enquadramento e montagem">
      <h2>3. Montagem</h2>
      <div className="videos-formatos">
        {FORMATOS_VIDEO.map(f => <label key={f.id} className="videos-formato"><input type="radio" name="video-formato" checked={formato===f.id} onChange={() => {setFormato(f.id);setArquivoPronto(false);}} /> <span><strong>{f.rotulo}</strong><small>{f.largura} × {f.altura} · H.264</small></span></label>)}
      </div>
      <label className="videos-duracao">Segundos por foto: <strong>{segundos}s</strong>
        <input type="range" min="2" max="5" step="1" value={segundos} onChange={e => {setSegundos(Number(e.target.value));setArquivoPronto(false);}} /></label>
      <p className="suave">Vídeo silencioso, sem música de terceiros, legendas ou afirmações inventadas. Duração total: {segundos * fotos.length} segundos.</p>
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      <div className="linha"><button type="button" onClick={baixarPlano}><Icone nome="arquivo" tamanho={18}/> Baixar plano técnico JSON</button>
        {arquivoPronto && <span className="selo ok">Plano gerado · renderização não executada</span>}</div>
    </section>
    <section className="cartao videos-execucao" aria-label="Homologação local Nano IA">
      <h2>4. Execução supervisionada no NanoShell</h2>
      <p>Copie as fotografias originais para uma pasta local e coloque o JSON exportado em outra. Na versão do código desta PR, o script <code>scripts/video-local/render.mjs</code> valida todos os hashes e permite renderizar o MP4 com FFmpeg após aprovação explícita.</p>
      <pre>{'node --experimental-strip-types scripts/video-local/render.mjs --manifest "C:\\\\teste\\\\nano-video-CI000016.json" --media "C:\\\\teste\\\\fotos" --output "C:\\\\teste\\\\saida" --dry-run'}</pre>
      <p className="suave">Para renderizar, troque <code>--dry-run</code> por <code>--approve</code>. Confira os caminhos antes de executar. O script não envia arquivos a nuvem. O Concat pode ler o MP4 e tem servidor MCP nativo, mas a edição automatizada dentro dele depende da homologação do binário.</p>
      <a href="https://github.com/jub0t/Concat/blob/main/docs/MCP.md" target="_blank" rel="noopener noreferrer">Documentação oficial do Concat MCP</a>
    </section>
    <section className="cartao"><h2>Critérios de liberação</h2><p className="suave">Fotos originais verificadas por SKU e fonte; autorização de uso das imagens; conferência do MP4 final; aprovação humana para publicação. Dados do Bling não são alterados e nenhuma postagem é enviada ao Instagram/WhatsApp automaticamente.</p></section>
  </div>;
}
