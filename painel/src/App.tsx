import { AutorizarAgente } from "./paginas/AutorizarAgente.tsx";
import { useEffect, useRef, useState } from "react";
import { BACKUP_ATIVO, BANNERS_ATIVO, CENTRAL_ATIVA, CONECTOR_ATIVO, PAIR_ATIVO, ROTAS_DA_CENTRAL, ROTAS_DO_CONECTOR } from "./lib/flags.ts";
import { montarMenu, rotaBloqueada, semRotasSemAceite } from "./lib/visibilidade.ts";
import { Assistente } from "./paginas/Assistente.tsx";
import { useLojas, useSessao } from "./lib/dados.ts";
import { ir, useRota } from "./lib/rota.ts";
import { supabase } from "./supabase.ts";
import { Entrar, Recuperar, Redefinir } from "./paginas/Acesso.tsx";
import { EstudioAgente } from "./paginas/EstudioAgente.tsx";
import { VisaoGeral } from "./paginas/VisaoGeral.tsx";
import { Banners } from "./paginas/Banners.tsx";
import { Catalogo } from "./paginas/Catalogo.tsx";
import { Bling } from "./paginas/Bling.tsx";
import { Contador } from "./paginas/Contador.tsx";
import { Taxonomia } from "./paginas/Taxonomia.tsx";
import { Fila } from "./paginas/Fila.tsx";
import { Integracoes } from "./paginas/Integracoes.tsx";
import { ProdutoPublico } from "./paginas/ProdutoPublico.tsx";
import { ConectorIA } from "./paginas/ConectorIA.tsx";
import { CentralInteligencia } from "./paginas/CentralInteligencia.tsx";
import { Indicadores, ListaDoIndicador } from "./paginas/Indicadores.tsx";
import { Studio } from "./paginas/Studio.tsx";
import { GatewayMCP } from "./paginas/GatewayMCP.tsx";
import { Design } from "./paginas/Design.tsx";
import { Imagens } from "./paginas/Imagens.tsx";
import { VitrineDemo } from "./paginas/VitrineDemo.tsx";
import { Loja } from "./paginas/Loja.tsx";
import { Aparencia } from "./paginas/Aparencia.tsx";
import { Condicoes } from "./paginas/Condicoes.tsx";
import { DEMO } from "./lib/modo.ts";
import type { Loja as LojaTipo } from "./lib/dados.ts";
import { ParearAprovador, ParearSolicitante } from "./paginas/Parear.tsx";
import { Aprovacoes } from "./paginas/Aprovacoes.tsx";
import { Dispositivos } from "./paginas/Dispositivos.tsx";
import { MeuAgente } from "./paginas/MeuAgente.tsx";
import { Backup } from "./paginas/Backup.tsx";
import { agruparMenu, areasAoNavegar, grupoDaRota } from "./lib/navegacao.ts";
import { PaletaComandos } from "./componentes/PaletaComandos.tsx";
import { BarraStatus } from "./componentes/BarraStatus.tsx";
import { AvisoVersao } from "./componentes/AvisoVersao.tsx";
import { Icone } from "./componentes/Icone.tsx";
import { LogoConecta } from "./componentes/LogoConecta.tsx";
import { SeletorTema } from "./componentes/SeletorTema.tsx";
import { DockAgente } from "./componentes/DockAgente.tsx";
import { dividePagina, gravar as gravarPainel, ler as lerPainel, reserva, TELA_MIN_PARA_FIXO, type EstadoPainel } from "./lib/painelLateral.ts";
import { BalaoGenesis } from "./componentes/BalaoGenesis.tsx";
import "./shell.css";

// Em domínio de cliente (fora do GitHub Pages/localhost) a raiz é a loja daquele domínio, resolvida pelo servidor.
const HOSTS_PAINEL = ["nanoconecta-ia.github.io", "localhost", "127.0.0.1"];
const hostCliente = typeof window !== "undefined" && !HOSTS_PAINEL.includes(window.location.hostname) ? window.location.hostname : null;

const ICONES_ROTAS: Record<string, string> = {
  "/": "inicio", "/conector": "agentes", "/central": "escudo", "/indicadores": "grafico",
  "/studio": "caixas", "/estudio": "ajustes", "/assistente": "conversa", "/catalogo": "catalogo",
  "/fila": "fila", "/taxonomia": "arvore", "/aparencia": "paleta", "/condicoes": "cartao",
  "/integracoes": "conexoes", "/gateway": "rede", "/imagens": "imagem", "/design": "paleta",
  "/bling": "erp", "/backup": "arquivo", "/banners": "imagem", "/contador": "grafico",
  "/aprovacoes": "escudo", "/meu-agente": "agentes", "/dispositivos": "monitor"
};
// Um único Nano.IA (#166, B2): atalhos e esfera abrem sempre o chat canônico (edge `assistente`, implantada).
// /conector continua acessível pelo menu só em ambiente com VITE_CONECTOR_ATIVO, como homologação, até a paridade ser provada.
const ROTA_NANO = "/assistente";

const ITENS_PAIR: [string, string][] = [["/meu-agente", "Conectar meu agente"], ["/aprovacoes", "Aprovações"], ["/dispositivos", "Dispositivos"]];
const ITENS: [string, string][] = [
  ["/", "Visão geral"],
  ["/conector", "Nano.IA (homologação)"],
  ["/central", "Central de Inteligência"],
  ["/indicadores", "Indicadores"],
  ["/studio", "Studio de produtos"],
  ["/estudio", "Estúdio do agente"],
  ["/assistente", "Conversa com Nano.IA"],
  ["/catalogo", "Catálogo"],
  ["/fila", "Fila de aprovação"],
  ["/taxonomia", "Taxonomia"],
  ["/aparencia", "Aparência da loja"],
  ["/condicoes", "Pagamento e entrega"],
  ["/integracoes", "Integrações de IA"],
  ["/gateway", "Gateway MCP/API"],
  ["/imagens", "Imagens e SEO"],
  ["/design", "Design System"],
  ["/bling", "Bling"],
  ["/contador", "Contador"],
];
const MENU_BASE: [string, string][] = semRotasSemAceite(montarMenu(ITENS, ITENS_PAIR, { pairAtivo: PAIR_ATIVO, conectorAtivo: CONECTOR_ATIVO }, ROTAS_DO_CONECTOR), CENTRAL_ATIVA, ROTAS_DA_CENTRAL);
const MENU_BACKUP: [string, string][] = BACKUP_ATIVO ? MENU_BASE.flatMap((i) => (i[0] === "/bling" ? [i, ["/backup", "Backup do Bling"] as [string, string]] : [i])) : MENU_BASE;
const MENU: [string, string][] = BANNERS_ATIVO ? MENU_BACKUP.flatMap((i) => (i[0] === "/aparencia" ? [i, ["/banners", "Banners de oferta"] as [string, string]] : [i])) : MENU_BACKUP;
const GRUPOS_MENU = agruparMenu(MENU); // MENU é fixo por build (flags), então os grupos também

export function App() {
  const { sessao, recuperando, fimRecuperacao } = useSessao();
  const { caminho, query } = useRota();
  const demoAtivo = import.meta.env.DEV && DEMO;
  const lojas = useLojas(!!sessao && !demoAtivo);
  const [demo, setDemo] = useState<{ FAIXA: string; lojaDemo: LojaTipo } | null>(null);
  useEffect(() => { if (import.meta.env.DEV && DEMO) void import("./lib/demo.ts").then((m) => setDemo({ FAIXA: m.FAIXA, lojaDemo: m.lojaDemo })); }, []);
  useEffect(() => { // volta ao link do QR de pareamento depois do login com Google (o retorno do OAuth descarta o #)
    if (!sessao) return;
    try { const r = sessionStorage.getItem("conecta:retorno"); if (r && /^#\/(?:parear|autorizar-agente)(?:\?|$)/.test(r)) { sessionStorage.removeItem("conecta:retorno"); window.location.hash = r; } } catch { /* sem storage */ }
  }, [sessao]);

  const [paleta, setPaleta] = useState(false);
  const [menuMovel, setMenuMovel] = useState(false);
  useEffect(() => { setMenuMovel(false); }, [caminho]);
  // Áreas do menu abertas: controladas pelo React para que navegar sempre revele o item ativo,
  // mesmo que o usuário tenha recolhido a área da rota atual antes (issue #166).
  const areaAtual = grupoDaRota(GRUPOS_MENU, caminho);
  const [areasAbertas, setAreasAbertas] = useState<ReadonlySet<string>>(() => areasAoNavegar(new Set(), null, areaAtual));
  const areaAnterior = useRef(areaAtual);
  useEffect(() => { const ant = areaAnterior.current; areaAnterior.current = areaAtual; setAreasAbertas((a) => areasAoNavegar(a, ant, areaAtual)); }, [caminho, areaAtual]);
  const alternarArea = (id: string, aberta: boolean) => setAreasAbertas((a) => {
    if (a.has(id) === aberta) return a;
    const n = new Set(a); if (aberta) n.add(id); else n.delete(id); return n;
  });
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem("conecta:menu") === "recolhido"; } catch { return false; } });
  const alternarMenu = () => setRecolhido((r) => { try { localStorage.setItem("conecta:menu", r ? "aberto" : "recolhido"); } catch { /* sem storage */ } return !r; });
  const [agente, setAgente] = useState(false);
  const [telaW, setTelaW] = useState(() => window.innerWidth);
  const [painel, setPainelEstado] = useState<EstadoPainel>(() => lerPainel(window.innerWidth));
  useEffect(() => { const f = () => setTelaW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const mudarPainel = (p: EstadoPainel) => { setPainelEstado(p); gravarPainel(p); };
  useEffect(() => { // Ctrl/⌘+K abre a paleta de comandos; Ctrl/⌘+J abre o agente lateral, em qualquer tela do painel
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuMovel(false); return; }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") { e.preventDefault(); setPaleta((p) => !p); }
      else if (k === "j") { e.preventDefault(); setAgente((a) => !a); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const modoPainel = painel.modo === "fixo" && telaW >= TELA_MIN_PARA_FIXO ? "fixo" : "flutuante"; // só reflete a preferência; quem divide a tela de fato é dividePagina()
  useEffect(() => { document.documentElement.dataset.painel = modoPainel; }, [modoPainel]);

  const lojaSlug = caminho.match(/^\/loja\/([a-z0-9-]{2,63})$/);
  if (lojaSlug) return <Loja slug={lojaSlug[1]} />;
  if (hostCliente && !caminho.startsWith("/p/")) return <Loja host={hostCliente} />;
  const pub = caminho.match(/^\/p\/([a-z0-9-]+)\/(.+)$/);
  if (caminho === "/demo/vitrine") return <VitrineDemo />;
  if (pub) return <ProdutoPublico slug={pub[1]} sku={decodeURIComponent(pub[2])} />;
  if (PAIR_ATIVO && caminho === "/parear" && !query.get("c")) return <ParearSolicitante />; // pública: o dispositivo que pede o pareamento ainda não tem login
  if (!demoAtivo && sessao === undefined) return <p className="entrar suave">Carregando…</p>;
  if (demoAtivo && !demo) return <p className="entrar suave">Carregando…</p>;
  if (!demoAtivo && (recuperando || caminho === "/redefinir")) return <Redefinir aoConcluir={() => { fimRecuperacao(); void supabase.auth.signOut().then(() => ir("/entrar?aviso=senha")); }} />;
  if (!demoAtivo && !sessao) return caminho === "/recuperar" ? <Recuperar /> : <Entrar aviso={query.get("aviso")} />;

  if (!demoAtivo && sessao && PAIR_ATIVO && caminho === "/autorizar-agente") return <AutorizarAgente codigo={query.get("c") ?? ""} />;
  if (!demoAtivo && sessao && PAIR_ATIVO && caminho === "/parear") return <ParearAprovador codigo={query.get("c") ?? ""} email={sessao?.user.email ?? null} />;
  const loja = demoAtivo ? demo?.lojaDemo ?? null : lojas?.[0] ?? null;
  const bloqueada = rotaBloqueada(caminho, { conectorAtivo: CONECTOR_ATIVO, centralAtiva: CENTRAL_ATIVA }, ROTAS_DO_CONECTOR, ROTAS_DA_CENTRAL); // backend não publicado ou exige aceite
  const larga = caminho === "/conector" && !bloqueada;
  const paginaDeChat = caminho === "/assistente" || (caminho === "/conector" && !bloqueada); // já são o próprio chat: sem painel duplicado
  const dockAberto = agente && !!loja && !demoAtivo && !paginaDeChat;
  const dividindo = dividePagina(painel, telaW, dockAberto);
  const res = reserva(painel, telaW, dockAberto);
  const filtroInd = caminho.match(/^\/indicadores\/([a-z_:]+)$/);
  return (
    <>
      {demo && <div className="faixa-demo" role="status">{demo.FAIXA}</div>}
      <AvisoVersao />
      <header className="topo topo-premium">
        <button type="button" className="sec menu-movel-acionar" onClick={() => setMenuMovel((v) => !v)}
          aria-label={menuMovel ? "Fechar navegação" : "Abrir navegação"} aria-controls="menu-principal" aria-expanded={menuMovel}>
          <Icone nome={menuMovel ? "fechar" : "menu"} tamanho={20} />
        </button>
        <div className="marca"><LogoConecta tamanho={40} /><div className="marca-identidade">Conecta<span>.IA</span><small>{loja ? loja.nome : "Painel do lojista"}</small></div></div>
        <span className="topo-selo" aria-label="Ambiente administrativo">WORKSPACE <b>ADMIN</b></span>
        <button className="busca-topo" onClick={() => setPaleta(true)} aria-label="Abrir paleta de comandos"><Icone nome="busca" tamanho={16} /><span>Buscar módulos e ações…</span><kbd>Ctrl K</kbd></button>
        {!!loja && <a className="topo-atalho-nano" href={`#${ROTA_NANO}`}><Icone nome="agentes" tamanho={17} /><span>Nano.IA</span></a>}
        {!!loja && !demoAtivo && !paginaDeChat && <button className="sec agente-botao" onClick={() => setAgente((a) => !a)} aria-pressed={agente} aria-label="Agente lateral (Ctrl J)"><Icone nome="agentes" tamanho={16} /><span>Agente</span></button>}
        <SeletorTema />
        <button className="sec topo-sair" onClick={() => void supabase.auth.signOut()} disabled={demoAtivo}>Sair</button>
      </header>
      <PaletaComandos itens={MENU} aberta={paleta} aoFechar={() => setPaleta(false)} />
      <div className={`layout layout-premium ${larga ? "layout--larga" : ""} ${recolhido ? "layout--recolhido" : ""} ${dockAberto ? "layout--dock" : ""} ${menuMovel ? "layout--menu-movel-aberto" : ""}`} style={{ "--res-esq": `${res.esq}px`, "--res-dir": `${res.dir}px` } as React.CSSProperties}>
      {menuMovel && <button type="button" className="menu-escurecedor" aria-label="Fechar menu de navegação" onClick={() => setMenuMovel(false)} />}
      <nav id="menu-principal" className="menu menu-premium" aria-label="Menu principal">
        <div className="menu-destaque">
          <span className="menu-destaque-legenda">ASSISTENTE OPERACIONAL</span>
          <a href={`#${ROTA_NANO}`} className="menu-nano-iniciar" onClick={() => setMenuMovel(false)}><Icone nome="agentes" tamanho={20} /><span>Conversar com Nano.IA</span></a>
          <small>Consulta e propostas com aprovação humana</small>
        </div>
        {GRUPOS_MENU.map((g) => (
          <details key={g.id} className="menu-grupo" open={areasAbertas.has(g.id)} onToggle={(e) => alternarArea(g.id, e.currentTarget.open)}>
            <summary className="menu-titulo" title={g.titulo}>
              <Icone nome={g.id} tamanho={16} /><b>{g.titulo}</b>
            </summary>
            <div className="menu-grupo-itens">
              {g.itens.map(([c, t]) => (
                <a key={c} href={`#${c}`} title={t} className={caminho === c ? "ativo" : ""} aria-current={caminho === c ? "page" : undefined} onClick={() => setMenuMovel(false)}>
                  <Icone nome={ICONES_ROTAS[c] ?? g.id} tamanho={18} /><span>{t}</span>
                </a>
              ))}
            </div>
          </details>
        ))}
        <button className="sec menu-sair" disabled={demoAtivo} onClick={() => void supabase.auth.signOut()}><Icone nome="fechar" tamanho={18} /><span>Sair da conta</span></button>
        <button className="sec menu-recolher" onClick={alternarMenu} aria-pressed={recolhido} aria-label={recolhido ? "Expandir menu" : "Recolher menu"}><Icone nome="recolher" tamanho={16} /></button>
      </nav>
      <main>
        {!demoAtivo && lojas === null ? <p className="suave">Carregando…</p> : !loja ? (
          <div className="cartao"><h1>Sem loja vinculada</h1><p className="suave">Seu login ainda não está ligado a uma loja. Peça ao suporte para vincular.</p></div>
        ) : bloqueada ? <VisaoGeral loja={loja} />
          : caminho === "/estudio" ? <EstudioAgente key={loja.id} loja={loja} />
          : caminho === "/catalogo" ? <Catalogo loja={loja} />
          : caminho === "/fila" ? <Fila loja={loja} />
          : PAIR_ATIVO && caminho === "/aprovacoes" ? <Aprovacoes loja={loja} email={sessao?.user.email ?? null} />
          : PAIR_ATIVO && caminho === "/meu-agente" ? <MeuAgente />
          : PAIR_ATIVO && caminho === "/dispositivos" ? <Dispositivos loja={loja} />
          : caminho === "/taxonomia" ? <Taxonomia loja={loja} />
          : caminho === "/conector" ? <ConectorIA loja={loja} query={query} />
          : caminho === "/central" || caminho === "/agentes" ? <CentralInteligencia loja={loja} query={query} />
          : filtroInd ? <ListaDoIndicador loja={loja} filtro={filtroInd[1]} />
          : caminho === "/indicadores" ? <Indicadores loja={loja} />
          : caminho === "/studio" ? <Studio loja={loja} query={query} />
          : caminho === "/gateway" ? <GatewayMCP loja={loja} />
          : caminho === "/assistente" ? <Assistente key={loja.id} loja={loja} menu={MENU} aoNavegar={ir} />
          : caminho === "/aparencia" ? <Aparencia loja={loja} />
          : BANNERS_ATIVO && caminho === "/banners" ? <Banners loja={loja} />
          : caminho === "/condicoes" ? <Condicoes loja={loja} />
          : caminho === "/integracoes" ? <Integracoes loja={loja} />
          : caminho === "/imagens" ? <Imagens loja={loja} />
          : caminho === "/design" ? <Design />
          : BACKUP_ATIVO && caminho === "/backup" ? <Backup loja={loja} />
          : caminho === "/bling" ? <Bling loja={loja} query={query} />
          : caminho === "/contador" ? <Contador loja={loja} />
          : <VisaoGeral loja={loja} />}
      </main>
      </div>
      {loja && !demoAtivo && !paginaDeChat && <DockAgente loja={loja} aberto={dockAberto} aoFechar={() => setAgente(false)} menu={MENU} aoNavegar={ir} painel={painel} aoMudarPainel={mudarPainel} dividindo={dividindo} telaW={telaW} />}
      {loja && !demoAtivo && !paginaDeChat && <BalaoGenesis aberto={dockAberto} aoAlternar={() => setAgente((a) => !a)} />}
      <BarraStatus loja={loja ? loja.nome : null} tela={MENU.find((i) => i[0] === caminho)?.[1] ?? "Visão geral"} demo={demoAtivo} />
    </>
  );
}
