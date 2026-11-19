import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";
import { RodapeMobisEnxuto } from "../componentes/RodapeMobisEnxuto.tsx";
import { selecionarRelacionados } from "../lib/relacionadosProduto.ts";
import type { PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import logoMobis from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";
import "./produto-publico-mobis.css";
import type { FichaProduto as ProdutoBase, FichaVeiculo } from "../lib/ficha.ts";

type Produto = ProdutoBase & {
  categoria?: string | null;
  referencias_aprovadas?: { tipo: string; valor: string }[];
  consulta_previa?: boolean;
  em_estoque?: boolean | null;
};
type PaginaVeiculo = { slug: string; titulo: string; modelo: string; status: string };
type RespostaLoja = {
  loja?: { slug: string; ambiente?: string; whatsapp?: string | null };
  produtos?: Produto[];
  ficha?: { veiculos?: FichaVeiculo[] } | null;
  politicas?: PoliticasLojaPublicas | null;
  paginas_aplicacao?: Record<string, PaginaVeiculo[]>;
};
type Aba = "informacoes" | "especificacoes" | "aplicacoes" | "relacionados";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "informacoes", rotulo: "Informações do produto" },
  { id: "especificacoes", rotulo: "Especificações e códigos" },
  { id: "aplicacoes", rotulo: "Aplicações por veículo" },
  { id: "relacionados", rotulo: "Outros produtos automotivos" },
];
const FAMILIAS = [
  { nome: "Motor", slug: "motor" },
  { nome: "Cabeçote", slug: "cabecote" },
  { nome: "Suspensão", slug: "suspensao" },
  { nome: "Transmissão", slug: "transmissao" },
  { nome: "Elétrica", slug: "eletrica" },
] as const;

function consultaPublica(dados: RespostaLoja, produto: Produto): Produto {
  // Uma ficha em prévia nunca pode vazar o preço do Bling. Sem estoque
  // confirmado, a página também não promete pronta entrega.
  return {
    ...produto,
    preco: !produto.consulta_previa && produto.em_estoque === true ? produto.preco : null,
  };
}
function rotaProduto(sku: string) {
  return "#/p/mobis/" + encodeURIComponent(sku);
}

/** Página completa da peça física. Só usa dados publicados ou exibidos em
 * prévia autorizada na API pública; NUNCA infere OEM nem compatibilidade.
 */
export function ProdutoPublico({ slug, sku }: { slug: string; sku: string }) {
  const mobis = slug === MOBIS.slug;
  const [ficha, setFicha] = useState<{ produto: Produto; veiculos: FichaVeiculo[] } | null>(null);
  const [paginasVeiculos, setPaginasVeiculos] = useState<PaginaVeiculo[]>([]);
  const [relacionados, setRelacionados] = useState<Produto[]>([]);
  const [politicasMobis, setPoliticasMobis] = useState<PoliticasLojaPublicas | null>(null);
  const [whatsappMobis, setWhatsappMobis] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("informacoes");
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();
    setEstado("carregando"); setFicha(null); setPaginasVeiculos([]); setRelacionados([]);
    setAba("informacoes");
    const consultar = (corpo: object) => fetch(SUPABASE_URL + "/functions/v1/loja-publica", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL },
      body: JSON.stringify(corpo), signal: controller.signal,
    }).then(async (r) => {
      if (!r.ok) throw new Error("Ficha indisponível");
      return await r.json() as RespostaLoja;
    });

    void consultar({ slug, sku, q: sku, referencia_exata: mobis }).then((j) => {
      if (!ativo || j.loja?.slug !== slug) throw new Error("Loja incorreta");
      const produto = j.produtos?.find((p) => p.sku === sku);
      if (!produto || (!j.ficha && !(mobis && produto.consulta_previa))) {
        throw new Error("Produto não liberado para consulta");
      }
      setFicha({ produto: consultaPublica(j, produto), veiculos: j.ficha?.veiculos ?? [] });
      setPoliticasMobis(j.politicas ?? null);
      setWhatsappMobis(j.loja?.whatsapp ?? null);
      setPaginasVeiculos((j.paginas_aplicacao?.[sku] ?? []).filter((p) => p.status === "aprovado"));
      setEstado("ok");
      // Produtos relacionados: somente os já expostos na vitrine pública.
      // Categoria semelhante NÃO comprova encaixe/intercambialidade.
      if (mobis) {
        void consultar({ slug, pagina: 1 }).then((lista) => {
          if (!ativo || lista.loja?.slug !== slug) return;
          setRelacionados(selecionarRelacionados(produto, lista.produtos ?? [], 6));
        }).catch(() => { /* a ficha principal continua disponível sem lista */ });
      }
    }).catch(() => { if (ativo) setEstado("erro"); });
    return () => { ativo = false; controller.abort(); };
  }, [slug, sku, mobis]);

  useEffect(() => {
    const tituloAnterior = document.title;
    if (ficha?.produto.nome) document.title = ficha.produto.nome + " | " + (mobis ? MOBIS.nome : "Loja");
    let meta: HTMLMetaElement | null = null;
    let criado = false;
    let anterior: string | null = null;
    if (ficha?.produto.consulta_previa) {
      meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      anterior = meta?.content ?? null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        document.head.appendChild(meta);
        criado = true;
      }
      meta.content = "noindex,nofollow";
    }
    return () => {
      document.title = tituloAnterior;
      if (criado) meta?.remove();
      else if (meta && anterior !== null) meta.content = anterior;
    };
  }, [ficha?.produto.nome, ficha?.produto.consulta_previa, mobis]);

  const produto = ficha?.produto;
  const referencias = produto?.referencias_aprovadas ?? [];
  const oems = referencias.filter((r) => r.tipo === "oem");
  const outrosCodigos = referencias.filter((r) => r.tipo !== "oem");

  return (
    <main className={mobis ? "produto-publico-mobis" : undefined}>
      {mobis && <header className="produto-publico-mobis-cab">
        <a href="#/loja/mobis" aria-label="Voltar à loja Mobis Autopeças">
          <img src={logoMobis} alt="MOBIS AUTOPEÇAS" /></a>
        <nav aria-label="Navegação da ficha"><a href="#/loja/mobis">← Catálogo MOBIS</a></nav>
      </header>}
      <div className={mobis ? "produto-publico-mobis-conteudo" : undefined}>
        {mobis && <nav className="produto-publico-mobis-breadcrumb" aria-label="Caminho">
          <a href="#/loja/mobis">Início</a><span aria-hidden="true">/</span>
          <a href="#/loja/mobis">Produtos</a><span aria-hidden="true">/</span>
          <span>SKU {sku}</span>
        </nav>}
        {estado === "carregando" && <section className="produto-publico-mobis-estado" role="status">
          <h1>Carregando ficha do produto…</h1><p>Consultando informações públicas da MOBIS.</p>
        </section>}
        {estado === "erro" && <section className="produto-publico-mobis-estado" role="alert">
          <h1>Ficha ainda indisponível</h1>
          <p>O cadastro não está liberado para consulta neste momento. Isso não indica falta de estoque.</p>
          <a href="#/loja/mobis">Voltar ao catálogo</a>
        </section>}
        {produto && ficha && <>
          {mobis && <div className="produto-publico-mobis-intro">
            <div>
              <p className="produto-publico-mobis-kicker">MOBIS AUTOPEÇAS · CATÁLOGO TÉCNICO</p>
              <h2>Ficha completa do produto</h2>
              <p>Referência <strong>{produto.sku}</strong> · {produto.marca || "Marca em confirmação"}</p>
            </div>
            <span className="produto-publico-mobis-selo">
              {produto.consulta_previa ? "Catálogo enriquecido · sem preço" : "Consulte preço e disponibilidade"}
            </span>
          </div>}
          <FichaProduto produto={produto} veiculos={ficha.veiculos} />
          {mobis && <>
            <section className="produto-publico-mobis-detalhes" aria-label="Detalhes técnicos e catálogo automotivo">
              <div className="produto-publico-mobis-abas" role="tablist" aria-label="Informações do produto">
                {ABAS.map((item) => <button key={item.id} type="button" role="tab"
                  id={"mobis-aba-" + item.id} aria-selected={aba === item.id}
                  aria-controls={"mobis-painel-" + item.id}
                  tabIndex={aba === item.id ? 0 : -1}
                  onClick={() => setAba(item.id)}>{item.rotulo}</button>)}
              </div>
              <div className="produto-publico-mobis-painel" role="tabpanel"
                id={"mobis-painel-" + aba} aria-labelledby={"mobis-aba-" + aba} tabIndex={0}>
                {aba === "informacoes" && <>
                  <h2>Informações do produto</h2>
                  <p>{produto.descricao || "Descrição técnica em enriquecimento. O código e a marca seguem o cadastro de origem."}</p>
                  <p>Este produto tem uma única referência física de estoque. As páginas de aplicação por veículo, quando aprovadas, apontam para o mesmo SKU.</p>
                  {!produto.imagem && <p className="produto-publico-mobis-nota">Foto real da peça em preparação. Não usamos imagens de outros produtos como substitutas.</p>}
                  {produto.consulta_previa && <p className="produto-publico-mobis-nota">Ficha informativa sem preço e sem venda online. Consulte nossa equipe para confirmar os detalhes da peça.</p>}
                </>}
                {aba === "especificacoes" && <>
                  <h2>Especificações e referências</h2>
                  <dl className="produto-publico-mobis-fatos">
                    <div><dt>Referência do produto</dt><dd>{produto.sku}</dd></div>
                    <div><dt>Marca</dt><dd>{produto.marca || "A confirmar"}</dd></div>
                    <div><dt>Categoria</dt><dd>{produto.categoria || "Classificação em enriquecimento"}</dd></div>
                    <div><dt>OEM homologado</dt><dd>{oems.length ? oems.map((r) => r.valor).join(" · ") : "Ainda não homologado"}</dd></div>
                    <div><dt>Outras referências aprovadas</dt><dd>{outrosCodigos.length
                      ? outrosCodigos.map((r) => r.tipo.toUpperCase() + ": " + r.valor).join(" · ")
                      : "Em conferência"}</dd></div>
                  </dl>
                  <p className="produto-publico-mobis-nota">Códigos OEM e intercambialidade só são exibidos após comprovação e aprovação. As informações de fábrica específicas de cada montadora ficam nas páginas por veículo homologadas.</p>
                </>}
                {aba === "aplicacoes" && <>
                  <h2>Aplicações por veículo</h2>
                  {paginasVeiculos.length ? <div className="produto-publico-mobis-grade">
                    {paginasVeiculos.map((p) => <a key={p.slug} href={"#/a/" + encodeURIComponent(p.slug)}>
                      <strong>{p.modelo}</strong><small>{p.titulo}</small>
                      <span>Ver ficha técnica por veículo →</span>
                    </a>)}
                  </div> : <p>As aplicações específicas ainda aguardam homologação técnica. A existência da família do motor em catálogos não confirma automaticamente a equivalência da peça física.</p>}
                  {ficha.veiculos.length > 0 && <ul className="produto-publico-mobis-veiculos">
                    {ficha.veiculos.map((v, i) => <li key={v.modelo + "-" + i}>
                      {v.modelo}{v.motor ? " · " + v.motor : ""}
                      {v.de ? " · desde " + v.de : ""}{v.ate ? " até " + v.ate : ""}
                    </li>)}
                  </ul>}
                  <p className="produto-publico-mobis-nota">Confirme a aplicação pelo ano, motor, sistema e chassi antes da compra.</p>
                </>}
                {aba === "relacionados" && <>
                  <h2>Outros produtos automotivos da MOBIS</h2>
                  <p>Explore outras peças já disponíveis no catálogo. Uma categoria semelhante não significa compatibilidade com o mesmo veículo.</p>
                  {relacionados.length ? <div className="produto-publico-mobis-relacionados">
                    {relacionados.map((p) => <a key={p.sku} className="produto-publico-mobis-relacionado" href={rotaProduto(p.sku)}>
                      <div className="produto-publico-mobis-relacionado-foto">
                        {p.imagem ? <img src={p.imagem} alt={"Foto aprovada do produto " + p.sku} loading="lazy" />
                          : <span>Imagem em atualização</span>}
                      </div>
                      <strong>{p.nome}</strong><small>SKU {p.sku}{p.marca ? " · " + p.marca : ""}</small>
                      <span>Ver ficha →</span>
                    </a>)}
                  </div> : <p>Os próximos produtos aparecerão aqui conforme suas fichas forem liberadas.</p>}
                  <nav className="produto-publico-mobis-familias" aria-label="Explorar famílias de peças">
                    {FAMILIAS.map((f) => <a href={"#/loja/mobis/sistema/" + f.slug} key={f.slug}>{f.nome}</a>)}
                    <a href="#/loja/mobis">Ver catálogo completo →</a>
                  </nav>
                </>}
              </div>
            </section>
            <section className="produto-publico-mobis-conexao">
              <div><h2>Encontre outras peças automotivas</h2>
                <p>Motores, cabeçotes, suspensão, transmissão e elétrica. Busque pelo código ou pelo veículo na loja.</p>
              </div>
              <a href="#/loja/mobis">Explorar catálogo MOBIS →</a>
            </section>
          </>}
        </>}
      </div>
      {mobis && <RodapeMobisEnxuto nome={MOBIS.nome} whatsapp={whatsappMobis} politicas={politicasMobis}/>}
      {!mobis && <div className="cartao"><a href={"#/loja/" + slug}>Voltar ao catálogo</a></div>}
    </main>
  );
}
