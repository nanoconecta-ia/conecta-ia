import { IconePeca, IconeVeiculo } from "./IconePeca.tsx";
import { TIPOS_VEICULO, iconeDaCategoria } from "../lib/icones.ts";
import { montarFicha, type FichaProduto as Produto, type FichaVeiculo } from "../lib/ficha.ts";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Ficha do produto montada sozinha a partir do cadastro e das aplicações aprovadas (padrão aprovado no desenho). */
type ReferenciaAprovada = { tipo: string; valor: string };
type ProdutoComReferencias = Produto & { referencias_aprovadas?: ReferenciaAprovada[] };

export function FichaProduto({ produto, veiculos, mostrarDetalhes = false }: { produto: ProdutoComReferencias; veiculos: FichaVeiculo[]; mostrarDetalhes?: boolean }) {
  const f = montarFicha(produto, veiculos);
  const referenciasOem = (produto.referencias_aprovadas ?? []).filter((r) => r.tipo === "oem" && typeof r.valor === "string" && r.valor.trim());
  return (
    <article className="ficha" aria-label={`Ficha de ${produto.nome}`}>
      <header className="ficha-topo">
        <span className="ficha-marca"><IconePeca nome={iconeDaCategoria(null, produto.nome)} tamanho={40} /> {f.marca ?? ""}</span>
        <span className="ficha-codigo"><small>CÓDIGO</small><b className="mono">{f.codigo}</b></span>
      </header>
      <div className="ficha-corpo">
        <div className="ficha-foto">{produto.imagem ? <img src={produto.imagem} alt={"Foto real aprovada da peça física "+f.codigo} /> : <span>Foto real da peça em preparação</span>}</div>
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
      {mostrarDetalhes && <><section className="ficha-tecnica" aria-label="Ficha técnica">
        <h2>Ficha técnica</h2>
        <dl className="ficha-tecnica-grade">
          <div><dt>Código</dt><dd>{f.codigo}</dd></div>
          {f.marca && <div><dt>Marca</dt><dd>{f.marca}</dd></div>}
          <div><dt>Produto</dt><dd>{f.titulo}</dd></div>
          <div><dt>Aplicação</dt><dd>{f.compativel.length ? "Consulte os veículos listados" : "Em validação"}</dd></div>
        </dl>
      </section>
      <section className="ficha-oem" aria-label="Códigos OEM de referência">
        <h2>Códigos OEM de referência</h2>
        {referenciasOem.length ? <ul>{referenciasOem.map((r, i) => <li key={`${r.valor}-${i}`}>{r.valor}</li>)}</ul> : <p>Referências em validação.</p>}
        <p>Confirme o código e o chassi antes de comprar ou montar.</p>
      </section>
      </>}
      {produto.whatsapp && <a className="ficha-wa" href={produto.whatsapp} target="_blank" rel="noopener noreferrer">Consultar com vendedor no WhatsApp</a>}
    </article>
  );
}
