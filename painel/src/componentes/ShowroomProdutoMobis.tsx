import { useState, type CSSProperties } from "react";
import { montarFicha, type FichaProduto, type FichaVeiculo } from "../lib/ficha.ts";
import { acentoMontadora, faixasPublicasPorAplicacao, identidadeDaMontadora,
  rotuloOemConjunto, type AplicacaoBanner } from "../lib/showroomMobis.ts";
import { MarcaMobisOficial } from "./MarcaMobisOficial.tsx";
import "./showroom-mobis.css";
import "./showroom-catalogo-referencia.css";

const emReais = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

/** Um bloco visual por aplicação. A cor muda conforme a montadora;
 *  a marca Mobis, o SKU físico e o contrato de compatibilidade NÃO mudam.
 */
export function FaixaAplicacaoShowroomMobis({
  modelo, titulo, sku, motor, destino, homologada,
}: {
  modelo: string;
  titulo: string;
  sku: string;
  motor?: string | null;
  destino?: string;
  homologada: boolean;
}) {
  const tipo = identidadeDaMontadora(modelo);
  const estilo = { "--sm-montadora": acentoMontadora(tipo) } as CSSProperties;
  const etiqueta = tipo === "hyundai" ? "LINHA HYUNDAI" : tipo === "kia" ? "LINHA KIA" : "LINHA DE VEÍCULOS";
  const conteudo = <>
    <span className="sm-faixa-montadora">{etiqueta}</span>
    <span className="sm-faixa-destaque">{modelo}</span>
    <span className="sm-faixa-desc">{titulo}</span>
    <span className="sm-faixa-fatos">
      <strong>SKU {sku}</strong>
      <small>{motor || "Motor conforme cadastro aprovado"}</small>
    </span>
    <span className="sm-faixa-situacao">{homologada ? "Ver aplicação e ficha técnica" : "Compatibilidade em validação"}</span>
  </>;
  return destino && homologada
    ? <a className="sm-faixa sm-faixa-link" style={estilo} href={destino} aria-label={"Abrir página de aplicação aprovada "+modelo}>{conteudo}</a>
    : <div className="sm-faixa" style={estilo} aria-label={"Consulta de veículo "+modelo}>{conteudo}</div>;
}

/** Página comercial completa do SKU: showroom geral + aplicações INDIVIDUAIS aprovadas.
 * Um produto, uma foto real aprovada, um estoque e N perfis de consulta, sem
 *  OEM do conjunto ou equivalência inferidos a partir de peças internas.
 */

type AbaShowroom = "composicao" | "ficha" | "indice" | "aplicacoes" | "logistica" | "bula";
type ComponentePublico = {
  nome: string;
  quantidade?: number | null;
  codigo_oem?: string | null;
  sku_avulso?: string | null;
  fonte?: string | null;
  status: "aprovado" | "a_confirmar" | string;
  /** Não confundir candidato EPC com peça incluída no conjunto comercial. */
  inclusao_no_conjunto?: "confirmada" | "a_confirmar" | string;
};
type ProdutoComProvasPublicas = FichaProduto & {
  /** Campos futuros da API pública — não existem na resposta atual. */
  componentes_publicos_aprovados?: ComponentePublico[];
  fotos_publicas_aprovadas?: string[];
  dados_logisticos_publicos?: { peso_kg?: number | null; altura_cm?: number | null; largura_cm?: number | null; profundidade_cm?: number | null };
  bula_tecnica_publica_aprovada?: { descricao: string; fonte: string };
};
const ABAS_SHOWROOM: { id: AbaShowroom; nome: string }[] = [
  { id: "composicao", nome: "O que acompanha" },
  { id: "ficha", nome: "Ficha técnica" },
  { id: "indice", nome: "Índice OEM / SKU" },
  { id: "aplicacoes", nome: "Aplicações" },
  { id: "logistica", nome: "Dados logísticos" },
  { id: "bula", nome: "Bula técnica" },
];
const semProva = "Informação em validação documental. Nenhum código ou aplicação foi homologado por esta página.";
const placeholder = <p className="sm-ref-pendente" role="status">{semProva}</p>;

/**
 * Reprodução estrutural do layout de showroom informado pelo lojista.
 * O original é referência VISUAL, não base documental de OEM/SKUs fabricados.
 * Informações pendentes jamais aparecem com selos de homologação.
 */
export function ShowroomProdutoMobis({
  produto, veiculos, aplicacoes,
}: {
  produto: FichaProduto;
  veiculos: FichaVeiculo[];
  aplicacoes: readonly AplicacaoBanner[];
}) {
  const [aba, setAba] = useState<AbaShowroom>("composicao");
  const ficha = montarFicha(produto, veiculos);
  const faixas = faixasPublicasPorAplicacao(aplicacoes);
  const informacoes = produto as ProdutoComProvasPublicas;
  const componentes = (Array.isArray(informacoes.componentes_publicos_aprovados)
    ? informacoes.componentes_publicos_aprovados : []).filter(
    c => c && c.status === "aprovado" && c.inclusao_no_conjunto === "confirmada" && !!c.nome?.trim() && !!c.fonte?.trim());
  const codigosAprovados = componentes.filter(c => !!c.codigo_oem?.trim() && !!c.fonte?.trim());
  const fotos = [produto.imagem, ...(informacoes.fotos_publicas_aprovadas ?? [])]
    .filter((v): v is string => typeof v === "string" && /^https:\/\//.test(v))
    .filter((v, i, todas) => todas.indexOf(v) === i).slice(0, 3);
  const peso = informacoes.dados_logisticos_publicos;
  const bula = informacoes.bula_tecnica_publica_aprovada;

  const quadroComposicao = <section className="sm-ref-painel" aria-label="Composição aprovada do conjunto">
    <h2>O que acompanha — composição do conjunto</h2>
    {componentes.length > 0
      ? <ul className="sm-ref-lista-composicao">{componentes.map((c, i) =>
          <li key={c.nome+"-"+i}><span aria-hidden="true">✓</span><span>{c.nome}{typeof c.quantidade === "number" ? ` · ${c.quantidade} un.` : ""}</span></li>)}</ul>
      : <p className="sm-ref-pendente" role="status">Composição do motor parcial a conferir com a lista de embalagem do fabricante. Os itens informados na arte de referência não são tratados como comprovados.</p>}
  </section>;
  const quadroIndice = <section className="sm-ref-painel sm-ref-indice" aria-label="Índice técnico de componentes">
    <h2>Índice técnico — OEM e SKU por componente</h2>
    {codigosAprovados.length > 0
      ? <div className="sm-ref-tabela-rolagem"><table>
          <thead><tr><th>Item</th><th>Componente</th><th>Referência OEM</th><th>SKU avulso</th></tr></thead>
          <tbody>{codigosAprovados.map((c,i)=><tr key={c.nome+"-"+i}>
            <td>{i+1}</td><td>{c.nome}</td><td>{c.codigo_oem}</td><td>{c.sku_avulso || "Não vinculado"}</td>
          </tr>)}</tbody></table></div>
      : <p className="sm-ref-pendente" role="status">Índice em preparação. Os códigos e SKUs mostrados no modelo visual ainda não possuem vínculo individual aprovado no catálogo.</p>}
    <p className="sm-ref-nota">O OEM do componente não representa o código OEM do motor parcial completo. SKU avulso, quando houver, possui estoque próprio.</p>
  </section>;
  const quadroAplicacoes = <section className="sm-ref-painel sm-ref-painel-aplicacoes" aria-label="Aplicações por veículo">
    <h2>Aplicações por geração de fábrica</h2>
    {faixas.length
      ? <div className="sm-ref-aplicacoes">{faixas.map(f =>
          <FaixaAplicacaoShowroomMobis key={f.id} modelo={f.titulo} titulo={f.subtitulo}
            sku={produto.sku} destino={f.destino} homologada />)}</div>
      : <p className="sm-ref-pendente" role="status">Hyundai HR e Kia Bongo K2500: aplicações em validação por geração, motorização, período e VIN. Sem compatibilidade comercial aprovada.</p>}
    <div className="sm-ref-proveniencia">
      <h3>Rastreabilidade e fontes</h3>
      <p>SKU físico: <strong>{produto.sku}</strong></p>
      <p>Identidade do conjunto, OEM e aplicações devem ser comprovados com documentação do fabricante e referência EPC para a versão brasileira.</p>
    </div>
  </section>;

  return <article className="sm-showroom sm-ref-showroom" aria-label={"Showroom Mobis Autopeças do produto "+produto.sku}>
    <header className="sm-showroom-topo sm-ref-topo">
      <MarcaMobisOficial complemento="Peças e componentes por aplicação" />
      <nav aria-label="Menu do catálogo Mobis" className="sm-ref-menu">
        <a href="#/loja/mobis">Veículos</a>
        <a href="#/loja/mobis">Produtos</a>
        <a href="#/loja/mobis">Catálogo</a>
        <button type="button" onClick={() => setAba("bula")}>Bula técnica</button>
        <a href="#/loja/mobis">Buscar</a>
      </nav>
    </header>
    <nav className="sm-ref-migalhas" aria-label="Trilha de navegação">
      <a href="#/loja/mobis">Home</a><span aria-hidden="true">›</span>
      <a href="#/loja/mobis">Catálogo</a><span aria-hidden="true">›</span>
      <span>Motor parcial</span><span aria-hidden="true">›</span>
      <strong>{produto.sku}</strong>
    </nav>
    <section className="sm-ref-hero" aria-label="Identificação e fotografia do produto">
      <div className="sm-ref-galeria">
        <div className="sm-ref-fotos">
          {[0,1,2].map(i => <div className="sm-ref-foto" key={i}>
            {fotos[i]
              ? <img src={fotos[i]} alt={`Fotografia cadastrada do produto SKU ${produto.sku}, vista ${i+1}`}
                  loading={i ? "lazy" : "eager"} decoding="async" />
              : <span className="sm-ref-sem-foto">{i===0 ? "Foto real da peça em preparação" : `Vista ${i+1} pendente de foto real`}</span>}
          </div>)}
        </div>
        <div className="sm-ref-foto-etiqueta">{fotos.length ? "Fotos do cadastro do SKU " : "Fotografias reais pendentes — SKU "}<strong>{produto.sku}</strong></div>
      </div>
      <div className="sm-ref-resumo">
        <h1>{ficha.titulo}</h1>
        <div className="sm-ref-sku-marca"><span>SKU <strong>{produto.sku}</strong></span><span>Marca da peça <strong>{produto.marca || "A confirmar"}</strong></span></div>
        <p className="sm-ref-avisos"><strong>Catálogo técnico informativo</strong><span>Compatibilidade por versão em validação</span></p>
        <div className="sm-ref-fatos">
          <div><span>Conjunto</span><strong>Motor parcial</strong></div>
          <div><span>Montagem</span><strong>A conferir</strong></div>
          <div><span>Marca</span><strong>{produto.marca || "Pendente"}</strong></div>
          <div><span>OEM do conjunto</span><strong>{rotuloOemConjunto(null, false)}</strong></div>
        </div>
        <p className="sm-ref-revendedor">A Mobis Autopeças é revendedora independente. A montadora do veículo não é a fabricante do motor importado.</p>
        {produto.preco !== null && <p className="sm-showroom-preco">{emReais(produto.preco)}</p>}
        {produto.preco === null && <p className="sm-showroom-preco-consulta">Preço sob consulta</p>}
      </div>
    </section>
    <div className="sm-ref-abas" role="tablist" aria-label="Seções técnicas do motor parcial">
      {ABAS_SHOWROOM.map(t => <button type="button" role="tab" id={"sm-aba-"+t.id}
        aria-selected={aba===t.id} aria-controls={"sm-painel-"+t.id}
        key={t.id} className={aba===t.id ? "ativo" : ""} onClick={() => setAba(t.id)}>
        {t.nome}</button>)}
    </div>
    <div className="sm-ref-conteudo" id={"sm-painel-"+aba} role="tabpanel" aria-labelledby={"sm-aba-"+aba}>
      {aba==="composicao" && <div className="sm-ref-grade">{quadroComposicao}{quadroIndice}{quadroAplicacoes}</div>}
      {aba==="ficha" && <section className="sm-ref-painel sm-ref-painel-expandido">
        <h2>Ficha técnica do produto</h2>
        <dl className="sm-ref-dados"><div><dt>SKU físico</dt><dd>{produto.sku}</dd></div>
          <div><dt>Marca da peça</dt><dd>{produto.marca || "A confirmar"}</dd></div>
          <div><dt>Denominação</dt><dd>{ficha.titulo}</dd></div>
          <div><dt>OEM do conjunto</dt><dd>{rotuloOemConjunto(null, false)}</dd></div>
        </dl>
        <p>{produto.descricao || "Descrição técnica e confirmação de composição pendentes."}</p>
        <p className="sm-ref-nota">O conjunto deve ser confrontado com a versão/geração de fábrica; compartilhar código de motor não comprova intercambialidade.</p>
      </section>}
      {aba==="indice" && <div className="sm-ref-painel-expandido">{quadroIndice}</div>}
      {aba==="aplicacoes" && <div className="sm-ref-painel-expandido">{quadroAplicacoes}</div>}
      {aba==="logistica" && <section className="sm-ref-painel sm-ref-painel-expandido">
        <h2>Dados logísticos aprovados</h2>
        {peso && Object.values(peso).some(v => typeof v === "number")
          ? <dl className="sm-ref-dados">
              {typeof peso.peso_kg==="number"&&<div><dt>Peso</dt><dd>{peso.peso_kg} kg</dd></div>}
              {typeof peso.altura_cm==="number"&&<div><dt>Altura</dt><dd>{peso.altura_cm} cm</dd></div>}
              {typeof peso.largura_cm==="number"&&<div><dt>Largura</dt><dd>{peso.largura_cm} cm</dd></div>}
              {typeof peso.profundidade_cm==="number"&&<div><dt>Profundidade</dt><dd>{peso.profundidade_cm} cm</dd></div>}
            </dl> : placeholder}
      </section>}
      {aba==="bula" && <section className="sm-ref-painel sm-ref-painel-expandido">
        <h2>Bula técnica e recomendações</h2>
        {bula?.descricao && bula?.fonte
          ? <><p>{bula.descricao}</p><p className="sm-ref-nota">Fonte técnica: {bula.fonte}</p></>
          : <p className="sm-ref-pendente" role="status">Bula técnica ainda não homologada. Não apresentar medidas de montagem ou contraindicações como fatos confirmados.</p>}
      </section>}
    </div>
    <footer className="sm-ref-rodape">
      <div><strong>SKU {produto.sku}</strong><span>Catálogo técnico informativo</span><span>Rastreabilidade por componente</span><span>Aplicações por geração</span></div>
      {produto.whatsapp
        ? <a href={produto.whatsapp} className="sm-showroom-cta" target="_blank" rel="noopener noreferrer">Consultar especificações</a>
        : <a href="#/loja/mobis" className="sm-showroom-cta">Consultar catálogo</a>}
    </footer>
  </article>;
}
