import { IconeVeiculo } from "./IconePeca.tsx";
import { TIPOS_VEICULO } from "../lib/icones.ts";
import { montarFicha, type FichaProduto as Produto, type FichaVeiculo } from "../lib/ficha.ts";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Ficha do produto montada sozinha a partir do cadastro e das aplicações aprovadas (padrão aprovado no desenho). */
export function FichaProduto({ produto, veiculos }: { produto: Produto; veiculos: FichaVeiculo[] }) {
  const f = montarFicha(produto, veiculos);
  return (
    <article className="ficha" aria-label={`Ficha de ${produto.nome}`}>
      <header className="ficha-topo">
        <span className="ficha-marca">{f.marca ?? ""}</span>
        <span className="ficha-codigo"><small>CÓDIGO</small><b className="mono">{f.codigo}</b></span>
      </header>
      <div className="ficha-corpo">
        <div className="ficha-foto">{produto.imagem ? <img src={produto.imagem} alt={produto.nome} /> : <span>Foto a confirmar</span>}</div>
        <div className="ficha-texto">
          <h1>{f.titulo}</h1>
          {f.veiculos && <p className="ficha-veiculo">{f.veiculos}</p>}
          {f.spec && <p className="ficha-spec mono">{f.spec}</p>}
          <h2>Compatível com</h2>
          {f.compativel.length ? <ul>{f.compativel.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="suave">Aplicação a confirmar com a loja.</p>}
          {f.tipos.length > 0 && <div className="ficha-tipos">{TIPOS_VEICULO.filter((t) => f.tipos.includes(t.chave)).map((t) => <IconeVeiculo key={t.chave} tipo={t} largura={88} />)}</div>}
          {produto.preco != null && <p className="v-preco">{brl(produto.preco)}</p>}
        </div>
      </div>
      {produto.whatsapp && <a className="ficha-wa" href={produto.whatsapp} target="_blank" rel="noopener noreferrer">Comprar pelo WhatsApp</a>}
    </article>
  );
}
