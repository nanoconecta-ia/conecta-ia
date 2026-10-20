import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import { TIPOS_VEICULO } from "../lib/icones.ts";
import { VISTAS } from "../lib/vistas.ts";
import { VistaExplodida } from "../componentes/VistaExplodida.tsx";
import { iconeDaCategoria } from "../lib/icones.ts";

// DEMONSTRAÇÃO da loja pública com itens FICTÍCIOS (nenhum dado real da Mobis, nenhum preço real).
const ITENS = [
  { sku: "EXEMPLO-001", nome: "Peça de exemplo A", preco: "R$ 100,00", aplic: "Aplicação confirmada: exemplo" },
  { sku: "EXEMPLO-002", nome: "Peça de exemplo B", preco: "R$ 250,00", aplic: "Aplicação ainda não confirmada" },
  { sku: "EXEMPLO-003", nome: "Peça de exemplo C", preco: "R$ 75,00", aplic: "Aplicação confirmada: exemplo" },
];
const CATEGORIAS: [string, string][] = [["motor", "Motor"], ["suspensao-direcao", "Suspensão e direção"], ["freios", "Freios"], ["filtros", "Filtros"], ["eletrica-ignicao", "Elétrica e ignição"], ["arrefecimento", "Arrefecimento"],
  ["escapamento", "Escapamento"], ["embreagem-transmissao", "Embreagem e transmissão"], ["iluminacao", "Iluminação"], ["lubrificantes-fluidos", "Lubrificantes e fluidos"], ["carroceria-acabamento", "Carroceria"], ["alimentacao-injecao", "Alimentação e injeção"]];

export function VitrineDemo() {
  return (
    <div className="vitrine">
      <header className="v-topo"><span className="v-nome">Loja de exemplo</span><span className="selo atencao" style={{ justifySelf: "start" }}>demonstração</span></header>
      <section className="v-hero">
        <span className="v-hero-selo mono">catálogo técnico · aplicação comprovada</span>
        <h1>Encontre a peça correta</h1>
        <p>Itens fictícios para mostrar o visual da vitrine. Produto incompleto não é publicado.</p>
      </section>
      <nav className="v-tiles" aria-label="Categorias">
        <button className="v-tile ativo" aria-pressed="true"><IconePeca nome="todas" tamanho={52} /><span>Todas</span></button>
        {CATEGORIAS.map(([slug, nome]) => <button key={slug} className="v-tile" aria-pressed="false"><IconePeca nome={iconeDaCategoria(slug, nome)} tamanho={52} /><span>{nome}</span></button>)}
      </nav>
      <section className="v-cartao" aria-label="Tipo de veículo">
        <h2 className="v-caixa">Qual é o seu veículo?</h2>
        <div className="v-tipos">{TIPOS_VEICULO.map((t, i) => <button key={t.chave} className={`v-tipo ${i === 3 ? "ativo" : ""}`} aria-pressed={i === 3}><IconeVeiculo tipo={t} largura={120} /><span>{t.rotulo}</span></button>)}</div>
      </section>
      <section className="v-cartao v-vista" aria-label="Vista explodida da categoria">
        <h2 className="v-caixa">Escolha a peça</h2>
        <VistaExplodida vista={VISTAS[0]} aoEscolher={() => undefined} />
      </section>
      <div className="v-grade">{ITENS.map((i) => (
        <article key={i.sku} className="v-produto">
          <div className="v-foto">foto da peça</div>
          <h3>{i.nome}</h3>
          <p className="suave mono">{i.sku}</p>
          <p className="v-preco">{i.preco}</p>
          <p className="suave">{i.aplic}</p>
          <button className="sec">Falar no WhatsApp</button>
        </article>))}</div>
    </div>
  );
}
