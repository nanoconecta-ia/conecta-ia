import motor from "../assets/vista-motor.svg?raw";
import suspensao from "../assets/vista-suspensao.svg?raw";
import freios from "../assets/vista-freios.svg?raw";
import embreagem from "../assets/vista-embreagem.svg?raw";
import { posicaoPct, type Vista } from "../lib/vistas.ts";

const DESENHOS: Record<Vista["arquivo"], string> = { motor, suspensao, freios, embreagem };

/** Vista explodida da área: o desenho (arquivo estático do repositório) com um botão sobre cada número.
 *  Tocar leva à subcategoria (slug). `ativo` destaca a peça escolhida. */
export function VistaExplodida({ vista, ativo, aoEscolher }: { vista: Vista; ativo?: string | null; aoEscolher: (slug: string, rotulo: string) => void }) {
  return (
    <figure className="vista" aria-label={`Vista explodida: ${vista.titulo}`}>
      <div className="vista-desenho" style={{ aspectRatio: `${vista.largura} / ${vista.altura}` }}>
        <div className="vista-svg" dangerouslySetInnerHTML={{ __html: DESENHOS[vista.arquivo] }} />
        {vista.pontos.map((p) => (
          <button key={p.n} type="button" className={`vista-ponto ${ativo === p.slug ? "ativo" : ""}`} style={posicaoPct(vista, p)} aria-label={`${p.n}. ${p.rotulo}`} aria-pressed={ativo === p.slug} title={p.rotulo} onClick={() => aoEscolher(p.slug, p.rotulo)} />
        ))}
      </div>
      <figcaption>{vista.titulo} · toque num número para ver a peça</figcaption>
    </figure>
  );
}
