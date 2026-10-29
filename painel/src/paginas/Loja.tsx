import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import { iconeDaCategoria, TIPOS_VEICULO } from "../lib/icones.ts";
import { vistaDaArea } from "../lib/vistas.ts";
import { VistaExplodida } from "../componentes/VistaExplodida.tsx";
import { chipsDeFiltro, removerFiltro, textoResultado } from "../lib/filtrosLoja.ts";

type Produto = { nome: string; sku: string; preco: number | null; em_estoque: boolean | null; marca: string | null; descricao: string | null; imagem: string | null; whatsapp: string | null; atualizado_em: string | null };
type Veiculo = { modelo: string; motor: string | null; de: number | null; ate: number | null };
type Tema = { variaveis: Record<string, string>; logo_url: string | null; icone_url: string | null };
type Resposta = { loja: { nome: string; slug: string; modo_venda: string }; tema: Tema; produtos: Produto[]; total: number; pagina: number; por_pagina: number; veiculos: Veiculo[]; tipos?: { tipo: string; total: number }[]; categorias: { nome: string; slug: string; total: number }[] };
type Filtros = { q: string; modelo: string; motor: string; ano: string; categoria: string; tipo: string; pagina: number };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const VAZIO: Filtros = { q: "", modelo: "", motor: "", ano: "", categoria: "", tipo: "", pagina: 1 };

/** Loja pública de um cliente: resolvida pelo servidor (nome na URL ou domínio do cliente). Só mostra produto publicado e dado real. */
export function Loja({ slug, host }: { slug?: string; host?: string }) {
  const [f, setF] = useState<Filtros>(VAZIO);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<Resposta | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "naoachada" | "erro" | "limite">("carregando");
  const [tentativa, setTentativa] = useState(0); // "Tentar de novo" refaz a consulta sem recarregar a página
  // as opções da busca por veículo vêm da 1ª resposta sem filtro, para a cascata não encolher ao escolher
  const [opcoes, setOpcoes] = useState<Veiculo[]>([]);
  const [categorias, setCategorias] = useState<Resposta["categorias"]>([]);
  const [tipos, setTipos] = useState<{ tipo: string; total: number }[]>([]);
  const [area, setArea] = useState(""); // área escolhida nos blocos: mantém a vista explodida aberta enquanto o cliente escolhe a peça

  useEffect(() => {
    let vivo = true;
    setEstado("carregando");
    fetch(`${SUPABASE_URL}/functions/v1/loja-publica`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL },
      body: JSON.stringify({ slug, host, q: f.q || undefined, modelo: f.modelo || undefined, motor: f.motor || undefined, ano: f.ano ? Number(f.ano) : undefined, categoria: f.categoria || undefined, tipo: f.tipo || undefined, pagina: f.pagina }),
    }).then(async (r) => {
      if (!vivo) return;
      if (r.status === 404) { setEstado("naoachada"); return; }
      if (r.status === 429 || r.status === 413) { setEstado("limite"); return; } // limite de consultas do servidor: mensagem e nova tentativa, nunca tela em branco
      if (!r.ok) { setEstado("erro"); return; }
      const j = (await r.json()) as Resposta;
      setDados(j); setEstado("ok");
      if (!f.modelo && !f.motor && !f.ano) setOpcoes(j.veiculos);
      if (!f.categoria) setCategorias(j.categorias);
      if (!f.tipo) setTipos(j.tipos ?? []);
    }).catch(() => vivo && setEstado("erro"));
    return () => { vivo = false; };
  }, [slug, host, f, tentativa]);

  // Tema da loja: variáveis CSS calculadas e validadas no servidor; o navegador só aceita nomes --x e valores sem ; { } < > url(.
  const estilo = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(dados?.tema?.variaveis ?? {})) if (/^--[a-z-]+$/.test(k) && typeof v === "string" && !/[;{}<>]|url\(/i.test(v)) out[k] = v;
    return out;
  }, [dados?.tema]);
  useEffect(() => {
    if (!dados) return;
    document.title = dados.loja.nome;
    const icone = dados.tema?.icone_url;
    if (icone && icone.startsWith("https://")) {
      let l = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
      l.href = icone;
    }
  }, [dados]);

  const modelos = useMemo(() => [...new Set(opcoes.map((v) => v.modelo))].sort(), [opcoes]);
  const motores = useMemo(() => [...new Set(opcoes.filter((v) => !f.modelo || v.modelo === f.modelo).map((v) => v.motor).filter(Boolean) as string[])].sort(), [opcoes, f.modelo]);
  const anos = useMemo(() => {
    const dentro = opcoes.filter((v) => (!f.modelo || v.modelo === f.modelo) && (!f.motor || v.motor === f.motor));
    const set = new Set<number>(); const ano = new Date().getFullYear();
    for (const v of dentro) for (let a = v.de ?? v.ate ?? 0; a && a <= (v.ate ?? ano); a++) set.add(a);
    return [...set].sort((a, b) => b - a);
  }, [opcoes, f.modelo, f.motor]);

  const chips = chipsDeFiltro(f, (k) => TIPOS_VEICULO.find((t) => t.chave === k)?.rotulo ?? null, (slug) => categorias.find((c) => c.slug === slug)?.nome ?? null);
  const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const buscar = (e: FormEvent) => { e.preventDefault(); setF({ ...f, q: busca.trim(), pagina: 1 }); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); };
  const mudar = (p: Partial<Filtros>) => setF((x) => ({ ...x, ...p, pagina: 1 }));

  if (estado === "naoachada") return <main className="vitrine"><div className="v-cartao"><h1>Loja não encontrada</h1><p className="suave">Confira o endereço.</p></div></main>;
  const ultima = dados?.produtos.map((p) => p.atualizado_em).filter(Boolean).sort().at(-1);
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.por_pagina)) : 1;

  return (
    <div className="vitrine" style={estilo}>
      <header className="v-topo">
        {dados?.tema?.logo_url?.startsWith("https://")
          ? <img className="v-logo" src={dados.tema.logo_url} alt={dados.loja.nome} />
          : <span className="v-nome">{dados?.loja.nome ?? "…"}</span>}
        <form onSubmit={buscar} role="search" className="v-busca">
          <label className="sr">Buscar por peça, código, veículo ou fabricante</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça, código ou veículo" maxLength={60} />
          <button className="verde">Buscar</button>
        </form>
      </header>

      <section className="v-hero">
        <span className="v-hero-selo mono">catálogo técnico · aplicação comprovada</span>
        <h1>Encontre a peça correta</h1>
        <p>Busca técnica com aplicação comprovada e catálogo organizado.</p>
        <a className="botao verde" href="#catalogo" onClick={(e) => { e.preventDefault(); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}>Explorar catálogo</a>
      </section>

      <nav className="v-guia" aria-label="Como encontrar sua peça">
        <p className="v-guia-titulo">Como encontrar sua peça em 3 passos</p>
        <ol>
          <li><button type="button" className="sec" onClick={() => irPara("passo-tipo")}><b>1</b><span>Escolha o tipo do seu veículo</span></button></li>
          <li><button type="button" className="sec" onClick={() => irPara("busca-veiculo")}><b>2</b><span>Informe modelo, motor e ano</span></button></li>
          <li><button type="button" className="sec" onClick={() => irPara("passo-categoria")}><b>3</b><span>Toque na categoria da peça</span></button></li>
        </ol>
        <p className="suave">Cada escolha reduz a lista abaixo. Os filtros ativos aparecem acima dos produtos e você remove com um toque.</p>
      </nav>

      {tipos.length > 0 && (
        <section className="v-cartao" id="passo-tipo" aria-labelledby="titulo-tipo">
          <h2 id="titulo-tipo" className="v-caixa"><b className="v-passo">1</b> Qual é o tipo do seu veículo?</h2>
          <div className="v-tipos">
            {TIPOS_VEICULO.filter((t) => tipos.some((x) => x.tipo === t.chave)).map((t) => (
              <button key={t.chave} className={`v-tipo ${f.tipo === t.chave ? "ativo" : ""}`} aria-pressed={f.tipo === t.chave} onClick={() => mudar({ tipo: f.tipo === t.chave ? "" : t.chave })}>
                <IconeVeiculo tipo={t} largura={120} /><span>{t.rotulo}</span><small className="mono">{tipos.find((x) => x.tipo === t.chave)?.total}</small>
              </button>))}
          </div>
        </section>
      )}

      {opcoes.length > 0 && (
        <section className="v-cartao" aria-labelledby="busca-veiculo">
          <h2 id="busca-veiculo" className="v-caixa"><b className="v-passo">2</b> Busca por veículo: modelo, motor e ano</h2>
          <div className="v-cascata">
            <label>Modelo<select value={f.modelo} onChange={(e) => mudar({ modelo: e.target.value, motor: "", ano: "" })}><option value="">Todos</option>{modelos.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label>Motor<select value={f.motor} disabled={!motores.length} onChange={(e) => mudar({ motor: e.target.value, ano: "" })}><option value="">Todos</option>{motores.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label>Ano<select value={f.ano} disabled={!anos.length} onChange={(e) => mudar({ ano: e.target.value })}><option value="">Todos</option>{anos.map((a) => <option key={a}>{a}</option>)}</select></label>
            {(f.modelo || f.motor || f.ano) && <button className="sec" onClick={() => mudar({ modelo: "", motor: "", ano: "" })}>Limpar</button>}
          </div>
          <p className="suave">Só aparecem veículos com aplicação confirmada pela loja.</p>
        </section>
      )}

      {categorias.length > 0 && (
        <section id="passo-categoria" aria-labelledby="titulo-categoria">
        <h2 id="titulo-categoria" className="v-caixa v-caixa-solto"><b className="v-passo">3</b> Qual peça você procura? Toque na categoria</h2>
        <nav className="v-tiles" aria-label="Categorias">
          <button className={`v-tile ${!f.categoria ? "ativo" : ""}`} aria-pressed={!f.categoria} onClick={() => { setArea(""); mudar({ categoria: "" }); }}>
            <IconePeca nome="todas" tamanho={52} /><span>Todas</span>
          </button>
          {categorias.map((c) => (
            <button key={c.slug} className={`v-tile ${f.categoria === c.slug ? "ativo" : ""}`} aria-pressed={f.categoria === c.slug} onClick={() => { setArea(c.slug); mudar({ categoria: c.slug }); }}>
              <IconePeca nome={iconeDaCategoria(c.slug, c.nome)} tamanho={52} /><span>{c.nome}</span><small className="mono">{c.total}</small>
            </button>
          ))}
        </nav>
        </section>
      )}

      {vistaDaArea(area) && (
        <section className="v-cartao v-vista" aria-label="Vista explodida da categoria">
          <h2 className="v-caixa">Escolha a peça</h2>
          <VistaExplodida vista={vistaDaArea(area)!} ativo={f.categoria} aoEscolher={(slug) => { mudar({ categoria: slug }); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }} />
        </section>
      )}

      <section id="catalogo" aria-live="polite">
        {dados && (
          <div className="v-ativos" role="status">
            <strong>{textoResultado(dados.total, chips.length)}</strong>
            {chips.length > 0 && (
              <ul aria-label="Filtros ativos">
                {chips.map((c) => <li key={c.chave}><button type="button" className="sec v-chip" onClick={() => { if (c.chave === "q") setBusca(""); if (c.chave === "categoria") setArea(""); mudar(removerFiltro(c.chave)); }} aria-label={`Remover filtro ${c.rotulo}: ${c.valor}`}><span>{c.rotulo}:</span> {c.valor} <i aria-hidden="true">✕</i></button></li>)}
                <li><button type="button" className="sec mini" onClick={() => { setBusca(""); setArea(""); setF(VAZIO); }}>Limpar tudo</button></li>
              </ul>
            )}
          </div>
        )}
        {estado === "carregando" && !dados && <p className="suave">Carregando catálogo…</p>}
        {estado === "erro" && <div className="v-cartao" role="alert"><p>Não foi possível carregar o catálogo agora. Tente de novo em instantes.</p><button type="button" className="sec" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></div>}
        {estado === "limite" && <div className="v-cartao" role="alert"><p>Muitas consultas seguidas. Aguarde alguns segundos e tente de novo.</p><button type="button" className="sec" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></div>}
        {dados && dados.produtos.length === 0 && (
          <div className="v-cartao"><h2>{f.q || f.modelo || f.categoria || f.tipo ? "Nenhuma peça encontrada" : "Catálogo em preparação"}</h2>
            <p className="suave">{f.q || f.modelo || f.categoria || f.tipo ? "Tente outros termos ou limpe os filtros." : "Esta loja ainda não publicou produtos. Volte em breve."}</p></div>
        )}
        <div className="v-grade">
          {dados?.produtos.map((p) => (
            <article key={p.sku} className="v-produto">
              <div className="v-foto">{p.imagem ? <img src={p.imagem} alt={p.nome} loading="lazy" /> : <span>Sem foto</span>}</div>
              <h3>{p.nome}</h3>
              <p className="suave"><span className="mono">{p.sku}</span>{p.marca ? ` · ${p.marca}` : ""}</p>
              {p.descricao && <p className="suave">{p.descricao}</p>}
              <p className="v-preco">{p.preco != null ? brl(p.preco) : "Consulte o preço"}</p>
              <p className={p.em_estoque ? "msg-ok" : "suave"}>{p.em_estoque == null ? "Estoque a confirmar" : p.em_estoque ? "Em estoque" : "Sem estoque no último dado"}</p>
              <div className="linha">
                <a className="botao" href={`#/p/${dados.loja.slug}/${encodeURIComponent(p.sku)}`}>Tirar dúvidas</a>
                {p.whatsapp && <a className="botao verde" href={p.whatsapp} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>}
              </div>
            </article>
          ))}
        </div>
        {dados && paginas > 1 && (
          <div className="linha" style={{ justifyContent: "center", marginTop: 16 }}>
            <button className="sec" disabled={f.pagina <= 1} onClick={() => setF({ ...f, pagina: f.pagina - 1 })}>Anterior</button>
            <span className="suave">Página {f.pagina} de {paginas}</span>
            <button className="sec" disabled={f.pagina >= paginas} onClick={() => setF({ ...f, pagina: f.pagina + 1 })}>Próxima</button>
          </div>
        )}
      </section>
      <footer className="v-rodape">Preços e estoque conforme a última sincronização{ultima ? ` (${new Date(ultima).toLocaleString("pt-BR")})` : ""}. Confirme com a loja antes de comprar.</footer>
    </div>
  );
}
