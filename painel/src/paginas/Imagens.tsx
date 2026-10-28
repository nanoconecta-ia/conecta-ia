import { useEffect, useRef, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import {
  CHECAGENS, CONFIG_PADRAO, FILTRO_MELHORADA, FORMATOS_BANNER, MODOS, RECURSOS, bannerLigado, comparadorLigado, gravarConfig, lerConfig,
  limitarZoom, podeAprovar, pontoDoClique, sha256Hex, validarArquivo, type Config, type Recurso,
} from "../lib/fidelidade.ts";

type Foto = { url: string; nome: string; tamanho: number; sha: string };

/** Nano Visual Fidelity. A foto escolhida fica SÓ no navegador (nada é enviado, salvo ou publicado); a "melhorada" é simulação de luz por CSS;
 *  o banner não escreve nada por cima da peça; aprovar é uso interno e exige as 3 checagens humanas. */
export function Imagens({ loja }: { loja: Loja }) {
  const [config, setConfig] = useState<Config>(() => lerConfig(localStorage));
  const [foto, setFoto] = useState<Foto | null>(null);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);

  const alterar = (c: Config) => { setConfig(c); gravarConfig(localStorage, c); };
  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    const problema = validarArquivo(arquivo);
    if (problema) { setErro(problema); return; }
    setErro("");
    const sha = await sha256Hex(await arquivo.arrayBuffer());
    setFoto({ url: URL.createObjectURL(arquivo), nome: arquivo.name, tamanho: arquivo.size, sha });
  }

  return (
    <>
      <div className="cartao">
        <h1>Nano Visual Fidelity <span className="selo atencao">demonstração local</span></h1>
        <p className="suave">Melhore a apresentação de uma fotografia <strong>sem alterar a peça</strong>. A foto escolhida fica só neste navegador: nada é enviado, salvo ou publicado. “Melhorada” é uma simulação de luz e enquadramento; não remove fundo e não redesenha nada.</p>
        <div className="linha">
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" disabled={config.modo === "desligado"} onClick={() => entrada.current?.click()}>Escolher fotografia da peça</button>
          {config.modo === "desligado" && <span className="suave">Modo desligado: nenhuma transformação de imagem.</span>}
        </div>
        {erro && <p className="msg-erro" role="alert">{erro}</p>}
      </div>

      {foto && comparadorLigado(config) && <Comparador key={foto.sha} foto={foto} />}
      {foto && bannerLigado(config) && <Banner foto={foto} loja={loja} />}
      {!foto && config.modo !== "desligado" && <p className="suave">Escolha uma fotografia para comparar o original com a versão melhorada e preparar o banner.</p>}

      <Configuracao config={config} alterar={alterar} />
    </>
  );
}

function Comparador({ foto }: { foto: Foto }) {
  const [zoom, setZoom] = useState(1);
  const [ponto, setPonto] = useState({ x: 50, y: 50 });
  const [marcadas, setMarcadas] = useState<boolean[]>(CHECAGENS.map(() => false));
  const [decisao, setDecisao] = useState<"" | "aprovada" | "mantida">("");
  const quadro = (filtro?: string) => ({ backgroundImage: `url(${foto.url})`, backgroundSize: `${zoom * 100}%`, backgroundPosition: `${ponto.x}% ${ponto.y}%`, backgroundRepeat: "no-repeat" as const, filter: filtro });
  const clicar = (e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setPonto(pontoDoClique(e.clientX - r.left, e.clientY - r.top, r.width, r.height)); };
  const liberado = podeAprovar(marcadas);
  return (
    <section className="cartao" aria-labelledby="fid-comp">
      <h2 id="fid-comp">Original × melhorada <span className="selo">simulação</span></h2>
      <p className="suave">Os dois lados mostram o <strong>mesmo recorte ampliado</strong>. Toque na foto para escolher o ponto de interesse (furos, bordas, inscrições).</p>
      <div className="fid-par">
        <figure><div className="fid-quadro" role="img" aria-label="Original, sem alteração" style={quadro()} onClick={clicar} /><figcaption><span className="selo ok">original (byte a byte intacto)</span></figcaption></figure>
        <figure><div className="fid-quadro" role="img" aria-label="Melhorada, simulação de luz" style={quadro(FILTRO_MELHORADA)} onClick={clicar} /><figcaption><span className="selo atencao">melhorada (simulação de luz)</span></figcaption></figure>
      </div>
      <label className="fid-zoom">Zoom <input type="range" min={1} max={4} step={0.25} value={zoom} onChange={(e) => setZoom(limitarZoom(Number(e.target.value)))} aria-valuetext={`${zoom} vezes`} /> <span className="mono">{zoom}×</span></label>
      <p className="suave mono fid-sha" title="SHA-256 do arquivo original">{foto.nome} · {(foto.tamanho / 1024).toFixed(0)} KB · SHA-256 {foto.sha}</p>

      <fieldset className="fid-checagem">
        <legend>Checagem humana dos detalhes (obrigatória)</legend>
        <p className="suave">O sistema não valida a geometria: quem valida é uma pessoa, olhando os dois lados no mesmo zoom.</p>
        {CHECAGENS.map((c, i) => (
          <label key={c} className="fid-opcao"><input type="checkbox" checked={marcadas[i]} disabled={decisao !== ""} onChange={(e) => setMarcadas((m) => m.map((v, k) => (k === i ? e.target.checked : v)))} /> {c}</label>
        ))}
        <div className="linha">
          <button type="button" disabled={!liberado || decisao !== ""} onClick={() => setDecisao("aprovada")}>Aprovar uso interno</button>
          <button type="button" className="sec" disabled={decisao !== ""} onClick={() => setDecisao("mantida")}>Manter original</button>
        </div>
        <p className="suave" role="status">
          {decisao === "aprovada" ? "Aprovada para uso interno nesta sessão. Isso não publica nada e não é gravado." : decisao === "mantida" ? "Original mantido. Nenhuma versão melhorada foi aprovada." : "Aprovar só libera depois das 3 checagens. Aprovar não publica."}
        </p>
      </fieldset>
    </section>
  );
}

function Banner({ foto, loja }: { foto: Foto; loja: Loja }) {
  const [titulo, setTitulo] = useState("");
  return (
    <section className="cartao" aria-labelledby="fid-banner">
      <h2 id="fid-banner">Banner demonstrativo <span className="selo">foto preservada</span></h2>
      <p className="suave">A foto fica livre: sem texto por cima, só enquadramento (recorte), sem alterar pixels. Sem preço, sem código e sem aplicação. Não publica.</p>
      <label className="fid-campo">Nome da peça no banner <input value={titulo} maxLength={40} placeholder="ex.: nome como no cadastro" onChange={(e) => setTitulo(e.target.value)} /></label>
      <div className="fid-banners">
        {FORMATOS_BANNER.map((f) => (
          <figure key={f.id} className="fid-banner" style={{ aspectRatio: `${f.w} / ${f.h}` }} data-formato={f.id}>
            <div className="fid-banner-texto"><small>{loja.nome}</small><strong>{titulo.trim() || "Nome da peça"}</strong><span className="fid-cta" aria-hidden="true">Ver peça</span></div>
            <div className="fid-banner-foto" role="img" aria-label={`Fotografia original recortada em ${f.rotulo}`} style={{ backgroundImage: `url(${foto.url})` }} />
            <figcaption className="selo">{f.rotulo}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Configuracao({ config, alterar }: { config: Config; alterar: (c: Config) => void }) {
  return (
    <section className="cartao" aria-labelledby="fid-config">
      <h2 id="fid-config">Configuração do Visual Fidelity</h2>
      <p className="suave">Vale só neste aparelho (nada é gravado no servidor).</p>
      <fieldset className="fid-modos">
        <legend>Modo de operação</legend>
        {MODOS.map((m) => (
          <label key={m.valor} className="fid-opcao">
            <input type="radio" name="fid-modo" checked={config.modo === m.valor} disabled={!m.disponivel} onChange={() => alterar({ ...config, modo: m.valor })} />
            <span><b>{m.rotulo}</b><small className="suave"> {m.descricao}{!m.disponivel && m.motivo ? ` Indisponível: ${m.motivo}` : ""}</small></span>
          </label>
        ))}
      </fieldset>
      <fieldset className="fid-modos">
        <legend>Funcionalidades</legend>
        {RECURSOS.map((r) => (
          <label key={r.chave} className="fid-opcao">
            <input type="checkbox" checked={config.recursos[r.chave as Recurso]} disabled={!r.disponivel || config.modo === "desligado"} onChange={(e) => alterar({ ...config, recursos: { ...config.recursos, [r.chave]: e.target.checked } })} />
            <span><b>{r.rotulo}</b>{!r.disponivel && r.motivo ? <small className="suave"> Indisponível: {r.motivo}</small> : null}</span>
          </label>
        ))}
      </fieldset>
      <div className="fid-protecao">
        <strong>Proteção contra alterações indevidas</strong>
        <ul>
          <li>Não altera a peça (geometria, conectores, inscrições).</li>
          <li>Usa somente a fotografia como base.</li>
          <li>Aprovação humana obrigatória; nada é publicado por esta tela.</li>
          <li>Registra nome, tamanho e SHA-256 do original.</li>
        </ul>
      </div>
      <button type="button" className="sec" onClick={() => alterar(CONFIG_PADRAO)}>Restaurar padrão</button>
    </section>
  );
}
