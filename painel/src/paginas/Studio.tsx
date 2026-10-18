import { useEffect, useState } from "react";
import { Visualizador } from "../componentes/Visualizador.tsx";
import type { DadosStudio, ProdutoResumo } from "../lib/conectorDados.ts";
import type { Loja } from "../lib/dados.ts";
import { ir } from "../lib/rota.ts";
import { dadosPublicos, previaSeo, prontidao, ROTULO_IMAGEM } from "../lib/studio.ts";
import { useFonte } from "../lib/useFonte.ts";

const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

function PaginaPublica({ s, largura }: { s: DadosStudio; largura: "desktop" | "mobile" }) {
  const p = dadosPublicos(s);
  const anos = (a: { ano_inicial: number | null; ano_final: number | null }) => (a.ano_inicial ? `${a.ano_inicial}${a.ano_final ? `–${a.ano_final}` : "+"}` : "");
  return (
    <div className={`previa-pagina ${largura}`} aria-label={`Prévia da página pública (${largura})`}>
      <div className="pp-corpo">
        <div className="pp-foto">
          {p.principal ? (<><img src={p.principal.url} alt={p.principal.alt_texto ?? s.produto.nome ?? "Produto"} />{p.principal.tipo !== "real" && <span className="pp-tag">{p.principal.tipo === "gerada_ia" ? "Imagem gerada por IA" : "Imagem ilustrativa"}</span>}</>) : <span className="suave">Sem foto aprovada</span>}
        </div>
        <div className="pp-info">
          <h3>{s.produto.nome ?? "Sem nome"}</h3>
          <p className="suave" style={{ margin: 0 }}>{s.produto.marca ? `${s.produto.marca} · ` : ""}Código <span className="mono">{s.produto.sku ?? "—"}</span></p>
          <p className="pp-preco">{brl(s.produto.preco)}</p>
          {s.produto.descricao_curta && <p>{s.produto.descricao_curta}</p>}
          {p.descricaoLonga && <p className="suave">{p.descricaoLonga}</p>}
          {p.codigos.length > 0 && <p className="suave"><strong>Referências:</strong> {p.codigos.map((c) => `${c.tipo.toUpperCase()} ${c.valor}`).join(" · ")}</p>}
          {p.aplicacoes.length > 0 && <p className="suave"><strong>Aplicações:</strong> {p.aplicacoes.map((a) => [a.modelo, a.motorizacao, anos(a)].filter(Boolean).join(" ")).join(" · ")}</p>}
          <span className="botao verde">Pedir pelo WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

/** Studio de produtos e banners: tudo que o agente prepara para UM produto, e como a página pública fica só com dado aprovado. */
export function Studio({ loja, query }: { loja: Loja; query: URLSearchParams }) {
  const fonte = useFonte();
  const produtoId = query.get("produto");
  const [busca, setBusca] = useState(""); const [achados, setAchados] = useState<ProdutoResumo[]>([]);
  const [s, setS] = useState<DadosStudio | null | undefined>(undefined);
  const [modo, setModo] = useState<"desktop" | "mobile">("desktop");
  const [ampliada, setAmpliada] = useState<{ url: string; nome: string } | null>(null);

  useEffect(() => { if (!fonte) return; const t = setTimeout(() => { void fonte.buscarProdutos(loja.id, busca).then(setAchados).catch(() => setAchados([])); }, 250); return () => clearTimeout(t); }, [fonte, busca, loja.id]);
  useEffect(() => { if (!fonte || !produtoId) { setS(undefined); return; } setS(undefined); void fonte.studio(loja.id, produtoId).then(setS).catch(() => setS(null)); }, [fonte, produtoId, loja.id]);
  if (!fonte) return <p className="suave">Carregando…</p>;

  return (
    <>
      <div className="cartao">
        <h1>Studio de produtos e banners</h1>
        <p className="suave">A área de trabalho do Conector IA para um produto. O cadastro vem do Bling e não é editado aqui; a prévia da página pública usa <strong>somente dados aprovados</strong>.</p>
        <label>Produto<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou SKU" /></label>
        <ul className="fontes achados" aria-label="Resultados">{achados.slice(0, 8).map((p) => <li key={p.id}><button className={`sec mini-texto ${p.id === produtoId ? "sel" : ""}`} onClick={() => ir(`/studio?produto=${p.id}`)}><span className="mono">{p.sku ?? "sem SKU"}</span> {p.nome}</button></li>)}</ul>
      </div>
      {!produtoId ? <div className="cartao"><p className="suave">Escolha um produto acima.</p></div>
        : s === undefined ? <p className="suave">Carregando…</p>
        : s === null ? <div className="cartao"><p className="msg-erro" role="alert">Não foi possível carregar este produto.</p></div> : (() => {
          const pub = dadosPublicos(s), seo = previaSeo(s), prot = prontidao(s);
          const pendentes = s.imagens.filter((i) => !i.aprovada);
          return (
            <>
              <div className="cartao">
                <h2 style={{ marginTop: 0 }}>{s.produto.nome}</h2>
                <p className="suave" style={{ margin: 0 }}><span className="mono">{s.produto.sku ?? "sem SKU"}</span> · {s.produto.publicado ? <span className="selo ok">publicado</span> : <span className="selo atencao">não publicado</span>} · <a href={`#/conector?produto=${s.produto.id}`}>conversar sobre este produto</a></p>
                <h3>Prontidão para publicar</h3>
                <ul className="checks">{prot.map((c) => <li key={c.chave} className={c.ok ? "ok" : "falta"}><span aria-hidden="true">{c.ok ? "✓" : "✗"}</span> {c.rotulo}<span className="sr">{c.ok ? " — ok" : " — falta"}</span></li>)}</ul>
              </div>

              <div className="grade dois">
                <div className="cartao">
                  <h2>Original (Bling)</h2>
                  <dl className="dados dados-largo">
                    <dt>Nome</dt><dd>{s.produto.nome ?? "—"}</dd><dt>Marca</dt><dd>{s.produto.marca ?? "—"}</dd><dt>GTIN</dt><dd className="mono">{s.produto.gtin ?? "—"}</dd>
                    <dt>Preço</dt><dd>{brl(s.produto.preco)}</dd><dt>Estoque</dt><dd>{s.produto.estoque ?? "—"}</dd><dt>Unidade</dt><dd>{s.produto.unidade ?? "—"}</dd>
                    <dt>Peso</dt><dd>{s.produto.peso_kg != null ? `${s.produto.peso_kg} kg` : "—"}</dd>
                    <dt>Dimensões (L×A×P)</dt><dd>{[s.produto.largura_cm, s.produto.altura_cm, s.produto.profundidade_cm].some((v) => v != null) ? `${s.produto.largura_cm ?? "—"} × ${s.produto.altura_cm ?? "—"} × ${s.produto.profundidade_cm ?? "—"} cm` : "—"}</dd>
                    <dt>Categoria Bling</dt><dd>{s.categoriaBling ?? "—"}</dd><dt>Taxonomia</dt><dd>{s.taxonomia ?? "Sem nó ligado"}</dd>
                  </dl>
                  <h3>Descrição curta</h3><p>{s.produto.descricao_curta ?? <span className="suave">Vazia no Bling.</span>}</p>
                  <h3>Descrição longa</h3>
                  {pub.descricaoLonga ? <p>{pub.descricaoLonga}</p> : <p className="suave">Nenhuma descrição longa aprovada.</p>}
                  {s.enriquecimento.filter((e) => e.campo === "descricao_longa" && e.status !== "aprovado").map((e, i) => <p key={i} className="suave"><span className="selo atencao">a confirmar</span> {String(e.valor)}</p>)}
                </div>
                <div className="cartao">
                  <h2>SEO (prévia)</h2>
                  <div className="serp"><span className="serp-url">www.sualoja.com.br › produto</span><span className="serp-titulo">{seo.titulo || "—"}</span><span className="serp-desc">{seo.descricao || "—"}</span></div>
                  {seo.avisos.length > 0 && <ul className="fontes">{seo.avisos.map((a) => <li key={a} className="msg-erro">{a}</li>)}</ul>}
                  <p className="suave">Derivado dos dados reais do produto. Sitemap, canonical e dados estruturados são gerados pela vitrine.</p>
                  <h3>Referências OEM e aplicações</h3>
                  {s.codigos.length + s.aplicacoes.length === 0 ? <p className="suave">Nada cadastrado ainda.</p> : (
                    <ul className="fontes">
                      {s.codigos.map((c, i) => <li key={`c${i}`}><span className="mono">{c.tipo.toUpperCase()} {c.valor}</span> <span className={`selo ${c.status === "aprovado" ? "ok" : "atencao"}`}>{c.status === "aprovado" ? "aprovado" : "a confirmar"}</span></li>)}
                      {s.aplicacoes.map((a, i) => <li key={`a${i}`}>{[a.modelo, a.motorizacao, a.ano_inicial].filter(Boolean).join(" ")} <span className={`selo ${a.status === "aprovado" ? "ok" : "atencao"}`}>{a.status === "aprovado" ? "aprovado" : "a confirmar"}</span></li>)}
                    </ul>)}
                </div>
              </div>

              <div className="cartao">
                <h2>Imagens</h2>
                <p className="suave">Aprovadas: {pub.imagens.length} · Aguardando decisão: {pendentes.length}. A origem de terceiros fica só no banco; aqui e na loja só aparece a imagem tratada.</p>
                {s.imagens.length === 0 ? <p className="suave">Este produto ainda não tem imagens.</p> : (
                  <div className="grade">{s.imagens.map((i) => (
                    <figure key={i.id} className="figura">
                      <button className="sec miniatura-g" onClick={() => setAmpliada({ url: i.url, nome: ROTULO_IMAGEM[i.tipo] })} aria-label={`Ampliar imagem: ${ROTULO_IMAGEM[i.tipo]}`}><img src={i.url} alt={i.alt_texto ?? ""} /></button>
                      <figcaption><span className={`selo ${i.aprovada ? "ok" : "atencao"}`}>{i.aprovada ? "aprovada" : "pendente"}</span> {i.principal && <span className="selo">principal</span>}<br /><span className="suave">{ROTULO_IMAGEM[i.tipo]}</span></figcaption>
                    </figure>))}
                  </div>)}
                <p className="aviso">Geração de imagens: <strong>serviço não configurado</strong>. É uma capacidade independente (não faz parte de nenhum modelo de texto) e só será usada depois de configurada e autorizada. Imagem sintética nunca substitui a foto real.</p>
              </div>

              <div className="grade dois">
                <div className="cartao"><h2>Banner de fabricante</h2>
                  <div className="banner fab"><span className="banner-sup">{s.produto.marca ? "Linha" : "Marca não informada"}</span><strong>{s.produto.marca ?? "—"}</strong><span>{s.produto.nome}</span></div>
                  <p className="suave">Prévia em CSS com dados reais do Bling. A arte final depende do serviço de imagens, ainda não configurado.</p></div>
                <div className="cartao"><h2>Banner promocional</h2>
                  <div className="banner promo"><span className="banner-sup">Oferta</span><strong>{s.produto.nome}</strong><span className="banner-preco">{brl(s.produto.preco)}</span></div>
                  <p className="suave">Usa o preço atual do Bling. Nenhum desconto é inventado: só entra uma regra promocional que você definir.</p></div>
              </div>

              <div className="cartao">
                <div className="linha" style={{ justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0 }}>Prévia da página pública</h2>
                  <div className="linha" role="group" aria-label="Largura da prévia"><button className={modo === "desktop" ? "" : "sec"} aria-pressed={modo === "desktop"} onClick={() => setModo("desktop")}>Desktop</button><button className={modo === "mobile" ? "" : "sec"} aria-pressed={modo === "mobile"} onClick={() => setModo("mobile")}>Celular</button></div>
                </div>
                <p className="suave">Só dados aprovados. Produto incompleto não é publicado.</p>
                <PaginaPublica s={s} largura={modo} />
              </div>
              <Visualizador url={ampliada?.url ?? null} legenda={ampliada?.nome ?? ""} aoFechar={() => setAmpliada(null)} />
            </>
          );
        })()}
    </>
  );
}
