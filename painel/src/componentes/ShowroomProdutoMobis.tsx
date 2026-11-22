import type { CSSProperties } from "react";
import { montarFicha, type FichaProduto, type FichaVeiculo } from "../lib/ficha.ts";
import { acentoMontadora, faixasPublicasPorAplicacao, identidadeDaMontadora,
  rotuloOemConjunto, type AplicacaoBanner } from "../lib/showroomMobis.ts";
import { MarcaMobisOficial } from "./MarcaMobisOficial.tsx";
import "./showroom-mobis.css";

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
export function ShowroomProdutoMobis({
  produto, veiculos, aplicacoes,
}: {
  produto: FichaProduto;
  veiculos: FichaVeiculo[];
  aplicacoes: readonly AplicacaoBanner[];
}) {
  const ficha = montarFicha(produto, veiculos);
  const faixas = faixasPublicasPorAplicacao(aplicacoes);
  return <article className="sm-showroom" aria-label={"Showroom Mobis Autopeças do produto "+produto.sku}>
    <header className="sm-showroom-topo">
      <MarcaMobisOficial complemento="Showroom técnico de produto" />
      <div className="sm-showroom-topo-nota">PICAPES · VANS · UTILITÁRIOS</div>
    </header>
    <section className="sm-showroom-principal" aria-label="Identificação e fotografia do produto físico">
      <div className="sm-showroom-foto">
        {produto.imagem
          ? <img src={produto.imagem} alt={"Fotografia aprovada do produto físico SKU "+produto.sku}
            loading="eager" decoding="async" />
          : <div role="status" className="sm-showroom-foto-pendente">
              <strong>Foto real da peça em preparação</strong>
              <span>Fundo branco · sem imagem ilustrativa substituindo o produto</span>
            </div>}
      </div>
      <div className="sm-showroom-detalhes">
        <span className="sm-showroom-selo">SHOWROOM · PEÇA AUTOMOTIVA</span>
        <h1>{ficha.titulo}</h1>
        <div className="sm-showroom-atributos">
          <div><small>SKU interno Mobis</small><strong>{produto.sku}</strong></div>
          <div><small>Marca da peça</small><strong>{produto.marca || "A confirmar"}</strong></div>
          <div><small>Referências OEM do conjunto</small><span>{rotuloOemConjunto(null, false)}</span></div>
        </div>
        <p className="sm-showroom-papel">A <strong>Mobis Autopeças</strong> comercializa a peça como revendedora independente. A marca da peça e as montadoras dos veículos são identificações distintas.</p>
        {ficha.spec&&<p className="sm-showroom-resumo">{ficha.spec}</p>}
        {produto.preco !== null && <p className="sm-showroom-preco">{emReais(produto.preco)}</p>}
        {produto.preco === null && <p className="sm-showroom-preco-consulta">Preço sob consulta</p>}
        {produto.whatsapp && <a className="sm-showroom-cta" href={produto.whatsapp} target="_blank" rel="noopener noreferrer">
          Consultar produto e disponibilidade <span aria-hidden="true">↗</span>
        </a>}
      </div>
    </section>
    <section className="sm-showroom-aplicacoes" aria-label="Banners individuais por aplicação homologada">
      <div className="sm-showroom-secao-cab">
        <h2>Aplicações por veículo</h2>
        <p>O mesmo SKU físico atende somente às versões cuja compatibilidade esteja aprovada na ficha técnica.</p>
      </div>
      {faixas.length
        ? <div className="sm-showroom-faixas">{faixas.map(f =>
            <FaixaAplicacaoShowroomMobis key={f.id} modelo={f.titulo} titulo={f.subtitulo}
              sku={produto.sku} destino={f.destino} homologada />)}</div>
        : <p className="sm-showroom-aviso" role="status">As aplicações individuais estão em análise. Nenhuma compatibilidade não homologada foi anunciada.</p>}
    </section>
    <section className="sm-showroom-especificacoes" aria-label="Descrição e dados técnicos aprovados">
      <h2>Descrição e ficha técnica</h2>
      {produto.descricao
        ? <p>{produto.descricao}</p>
        : <p>Descrição técnica em preparação. A equipe confirma os componentes e a versão antes de fechar a compra.</p>}
      {ficha.compativel.length>0&&<>
        <h3>Versões homologadas no cadastro</h3>
        <ul>{ficha.compativel.map(v=><li key={v}>{v}</li>)}</ul>
      </>}
      <p className="sm-showroom-rodape-nota">Código OEM de um componente interno não identifica automaticamente o conjunto completo; cruzamentos técnicos só são divulgados após aprovação individual.</p>
    </section>
  </article>;
}
