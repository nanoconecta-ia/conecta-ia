import { useEffect, useState } from "react";
import { criarCopiaFundoBranco, LADO_CATALOGO } from "../lib/fundoBranco.ts";

type Resultado = { url: string; bytes: number };
/** Só trabalha com a fotografia que o lojista escolheu. Cópia PNG separada, sem upload e sem recorte da peça. */
export function FundoBrancoPreview({ arquivo, original, nome }: { arquivo: File; original: string; nome: string }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(true);
  useEffect(() => {
    let ativo = true, url: string | null = null;
    setResultado(null); setErro(""); setOcupado(true);
    void criarCopiaFundoBranco(arquivo).then(blob => {
      if (!ativo) return;
      url = URL.createObjectURL(blob);
      setResultado({ url, bytes: blob.size });
    }).catch(() => { if (ativo) setErro("Não foi possível gerar a cópia local. O original continua disponível."); })
      .finally(() => { if (ativo) setOcupado(false); });
    return () => { ativo = false; if (url) URL.revokeObjectURL(url); };
  }, [arquivo]);
  const baixar = () => {
    if (!resultado) return;
    const link = document.createElement("a");
    link.href = resultado.url;
    const nomeSeguro = nome.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-_]/gi, "-").slice(0,80) || "produto";
    link.download = `${nomeSeguro}-fundo-branco-${LADO_CATALOGO}.png`;
    link.click();
  };
  return <section className="nano-foto-card" aria-labelledby="nano-foto-titulo">
    <div className="nano-foto-card-cab"><div><span className="nano-foto-sobretitulo">PADRONIZAÇÃO NÃO DESTRUTIVA</span><h2 id="nano-foto-titulo">Fundo branco · {LADO_CATALOGO} × {LADO_CATALOGO}</h2>
      <p>Uma nova cópia quadrada: bordas brancas, foto centralizada e proporções preservadas.</p></div>
      <span className="nano-foto-chip">Somente neste aparelho</span></div>
    <div className="nano-foto-quadros">
      <figure className="nano-foto-lado"><div className="nano-foto-midia"><img src={original} alt="Fotografia original, sem enquadramento" /></div><figcaption>Original · intacto</figcaption></figure>
      <figure className="nano-foto-lado nano-foto-lado-pronto">
        <div className="nano-foto-midia nano-foto-midia-branca">
          {resultado ? <img src={resultado.url} alt="Cópia PNG 1200 × 1200, foto centralizada com margens brancas" />
            : <p role="status">{ocupado ? "Preparando a prévia local…" : erro || "Nenhuma prévia disponível."}</p>}
        </div><figcaption>Cópia · fundo branco ampliado</figcaption>
      </figure>
    </div>
    <div className="nano-foto-acoes">
      <button type="button" onClick={baixar} disabled={!resultado || ocupado}>Baixar cópia PNG 1200 × 1200</button>
      {resultado && <span className="nano-foto-sinal" role="status">Cópia pronta · {(resultado.bytes / 1024).toFixed(0)} KB</span>}
    </div>
    <p className="nano-foto-ressalva">Não remove o fundo da fotografia, não recupera detalhes perdidos por desfoque e não modifica a geometria, inscrições ou cores da peça. Não envia nem grava imagens no Bling ou no catálogo.</p>
  </section>;
}
