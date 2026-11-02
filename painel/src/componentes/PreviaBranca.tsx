import { useEffect, useState } from "react";
import { nomeDaCopia, prepararCopiaBranca, type CopiaBranca } from "../lib/fundoBranco.ts";

type Estado = { url: string; copia: CopiaBranca };
/** Prévia LOCAL compartilhada por Imagens e chat. A fonte original é preservada; exportação apenas após toque explícito. */
export function PreviaBranca({ arquivo }: { arquivo: File }) {
  const [preparada, setPreparada] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [calculando, setCalculando] = useState(true);
  const [origemUrl, setOrigemUrl] = useState("");
  useEffect(() => {
    let ativo = true;
    let urlDerivada: string | null = null;
    const urlOriginal = URL.createObjectURL(arquivo);
    setOrigemUrl(urlOriginal); setPreparada(null); setErro(""); setCalculando(true);
    prepararCopiaBranca(arquivo).then((copia) => {
      if (!ativo) return;
      urlDerivada = URL.createObjectURL(copia.arquivo);
      setPreparada({ url: urlDerivada, copia });
    }).catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Falha no preparo local."); })
      .finally(() => { if (ativo) setCalculando(false); });
    return () => {
      ativo = false;
      URL.revokeObjectURL(urlOriginal);
      if (urlDerivada) URL.revokeObjectURL(urlDerivada);
    };
  }, [arquivo]);
  return (
    <section className="vf-preparador" aria-label="Preparação não destrutiva de fotografia">
      <div className="vf-preparador-topo">
        <strong>Estúdio branco · 1200 × 1200 px</strong>
        <span className="selo ok">Somente prévia local</span>
      </div>
      <p className="suave vf-preparador-info">Amplia o <strong>fundo branco</strong>, centraliza a fotografia e preserva proporções, encaixes e inscrições. Não aumenta os pixels originais nem remove um fundo que já esteja fotografado.</p>
      <div className="vf-comparacao">
        <figure className="vf-foto-bloco">
          <div className="vf-foto-quadro">{origemUrl && <img src={origemUrl} alt="Fotografia original, inalterada" />}</div>
          <figcaption>Original — preservado</figcaption>
        </figure>
        <figure className="vf-foto-bloco">
          <div className="vf-foto-quadro">{preparada ? <img src={preparada.url} alt="Cópia centralizada com bordas brancas, sem alteração da peça" /> : <span className="suave">{calculando ? "Preparando cópia…" : "Prévia não disponível"}</span>}</div>
          <figcaption>Cópia JPG — 1200 × 1200</figcaption>
        </figure>
      </div>
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      {preparada && <div className="vf-preparador-rodape">
        <small className="suave">Peça mantida em {preparada.copia.quadro.largura} × {preparada.copia.quadro.altura} px, originalmente {preparada.copia.larguraOriginal} × {preparada.copia.alturaOriginal} px. Fundo até 1200 × 1200.</small>
        <a className="vf-baixar" href={preparada.url} download={nomeDaCopia(arquivo.name)} aria-label="Baixar somente a cópia com fundo branco">Baixar cópia JPG</a>
      </div>}
      <p className="suave vf-preparador-aviso">Sem envio ao Bling, catálogo ou IA externa. Para aplicar a foto em um produto, exige revisão e aprovação separadas.</p>
    </section>
  );
}
