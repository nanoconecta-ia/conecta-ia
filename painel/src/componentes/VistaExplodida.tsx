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
      {/* Os rótulos dentro do desenho encolhem no celular (~6 px); esta lista repete os mesmos pontos em texto legível e com alvo de toque grande. */}
      <ol className="vista-lista" aria-label={`Peças de ${vista.titulo}`}>
        {vista.pontos.map((p) => (
          <li key={p.n}><button type="button" className={`vista-item ${ativo === p.slug ? "ativo" : ""}`} aria-pressed={ativo === p.slug} onClick={() => aoEscolher(p.slug, p.rotulo)}><span className="mono">{p.n}</span> {p.rotulo}</button></li>
        ))}
      </ol>
      <figcaption>{vista.titulo} · toque num número ou na lista para ver a peça</figcaption>
    </figure>
  );
}
