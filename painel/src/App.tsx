import { AutorizarAgente } from "./paginas/AutorizarAgente.tsx";
import { useEffect, useState } from "react";
import { BACKUP_ATIVO, BANNERS_ATIVO, CENTRAL_ATIVA, CONECTOR_ATIVO, PAIR_ATIVO, ROTAS_DA_CENTRAL, ROTAS_DO_CONECTOR } from "./lib/flags.ts";
import { montarMenu, rotaBloqueada, semRotasSemAceite } from "./lib/visibilidade.ts";
import { useLojas, useSessao } from "./lib/dados.ts";
import { ir, useRota } from "./lib/rota.ts";
import { supabase } from "./supabase.ts";
import { Entrar, Recuperar, Redefinir } from "./paginas/Acesso.tsx";
import { VisaoGeral } from "./paginas/VisaoGeral.tsx";
import { Banners } from "./paginas/Banners.tsx";
import { Catalogo } from "./paginas/Catalogo.tsx";
import { FerramentasCatalogo } from "./paginas/FerramentasCatalogo.tsx";
import { CatalogoAplicacao } from "./paginas/CatalogoAplicacao.tsx";
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
import { Videos } from "./paginas/Videos.tsx";
import { VitrineDemo } from "./paginas/VitrineDemo.tsx";
import { Loja } from "./paginas/Loja.tsx";
import { LojaMobisNova } from "./paginas/LojaMobisNova.tsx";
import { entradaAdministrativa, lojaMobisPorHost } from "./lib/lojaHost.ts";
import { Aparencia } from "./paginas/Aparencia.tsx";
import { PublicacaoLoja } from "./paginas/PublicacaoLoja.tsx";
import { Condicoes } from "./paginas/Condicoes.tsx";
import { DEMO } from "./lib/modo.ts";
import type { Loja as LojaTipo } from "./lib/dados.ts";
import { ParearAprovador, ParearSolicitante } from "./paginas/Parear.tsx";
import { Aprovacoes } from "./paginas/Aprovacoes.tsx";
import { Dispositivos } from "./paginas/Dispositivos.tsx";
import { MeuAgente } from "./paginas/MeuAgente.tsx";
import { Backup } from "./paginas/Backup.tsx";
import { PaletaComandos } from "./componentes/PaletaComandos.tsx";
import { AvisoVersao } from "./componentes/AvisoVersao.tsx";
import { Icone } from "./componentes/Icone.tsx";
import "./shell.css";
import { PainelAprovado } from "./componentes/PainelAprovado.tsx";
import { InicioAprovado } from "./paginas/InicioAprovado.tsx";
import { NanoWorkspace } from "./paginas/NanoWorkspace.tsx";

// Em domínio de cliente (fora do GitHub Pages/localhost) a raiz é a loja daquele domínio, resolvida pelo servidor.
const HOSTS_PAINEL = ["nanoconecta-ia.github.io", "localhost", "127.0.0.1"];
const hostCliente = typeof window !== "undefined" && !HOSTS_PAINEL.includes(window.location.hostname) && !entradaAdministrativa(window.location.pathname) ? window.location.hostname : null;

const ITENS_PAIR: [string, string][] = [["/meu-agente", "Conectar meu agente"], ["/aprovacoes", "Aprovações"], ["/dispositivos", "Dispositivos"]];
const ITENS: [string, string][] = [
  ["/", "Visão geral"],
  ["/catalogo-aplicacao", "Catálogo por aplicação"],
  ["/visao-geral", "Indicadores da operação"],
  ["/catalogo-espelho", "Espelho ERP · auditoria"],
  ["/ferramentas", "Indexar e enriquecer · Bling"],
  ["/conector", "Nano.IA (homologação)"],
  ["/central", "Central de Inteligência"],
  ["/indicadores", "Indicadores"],
  ["/studio", "Studio de produtos"],
  ["/estudio", "Estúdio do Nano"],
  ["/fila", "Fila de aprovação"],
  ["/taxonomia", "Taxonomia"],
  ["/aparencia", "Aparência da loja"],
  ["/publicacao", "Publicação da loja"],
  ["/condicoes", "Pagamento e entrega"],
  ["/integracoes", "Integrações de IA"],
  ["/gateway", "Gateway MCP/API"],
  ["/imagens", "Imagens e SEO"],
  ["/videos", "Nano Video Studio"],
  ["/design", "Design System"],
  ["/bling", "Bling"],
  ["/contador", "Contador"],
];
const MENU_BASE: [string, string][] = semRotasSemAceite(montarMenu(ITENS, ITENS_PAIR, { pairAtivo: PAIR_ATIVO, conectorAtivo: CONECTOR_ATIVO }, ROTAS_DO_CONECTOR), CENTRAL_ATIVA, ROTAS_DA_CENTRAL);
const MENU_BACKUP: [string, string][] = BACKUP_ATIVO ? MENU_BASE.flatMap((i) => (i[0] === "/bling" ? [i, ["/backup", "Backup do Bling"] as [string, string]] : [i])) : MENU_BASE;
const MENU: [string, string][] = BANNERS_ATIVO ? MENU_BACKUP.flatMap((i) => (i[0] === "/aparencia" ? [i, ["/banners", "Banners de oferta"] as [string, string]] : [i])) : MENU_BACKUP;

export function App() {
  const { sessao, recuperando, fimRecuperacao } = useSessao();
  const { caminho, query } = useRota();
  const demoAtivo = import.meta.env.DEV && DEMO;
  const lojas = useLojas(!!sessao && !demoAtivo);
  // O chat em tela cheia usa as alturas REAIS do cabeçalho e da barra de status (mudam com o tema e a janela), não um número fixo.
  useEffect(() => {
    const ajustar = () => {
      const raiz = document.documentElement.style;
      const cab = document.querySelector<HTMLElement>(".ap-topbar")?.offsetHeight, barra = document.querySelector<HTMLElement>(".barra-status")?.offsetHeight;
      if (cab) raiz.setProperty("--cab-altura", `${cab}px`);
      if (barra) raiz.setProperty("--barra-altura", `${barra}px`);
    };
    ajustar(); window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  });
  const [demo, setDemo] = useState<{ FAIXA: string; lojaDemo: LojaTipo } | null>(null);
  useEffect(() => { if (import.meta.env.DEV && DEMO) void import("./lib/demo.ts").then((m) => setDemo({ FAIXA: m.FAIXA, lojaDemo: m.lojaDemo })); }, []);
  useEffect(() => { // volta ao link do QR de pareamento depois do login com Google (o retorno do OAuth descarta o #)
    if (!sessao) return;
    try { const r = sessionStorage.getItem("conecta:retorno"); if (r && /^#\/(?:parear|autorizar-agente)(?:\?|$)/.test(r)) { sessionStorage.removeItem("conecta:retorno"); window.location.hash = r; } } catch { /* sem storage */ }
  }, [sessao]);

  const [paleta, setPaleta] = useState(false);
  const [menuMovel, setMenuMovel] = useState(false);
  useEffect(() => { setMenuMovel(false); }, [caminho]);
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem("conecta:menu:v2") === "recolhido"; } catch { return false; } });
  const alternarMenu = () => setRecolhido((r) => { try { localStorage.setItem("conecta:menu:v2", r ? "aberto" : "recolhido"); } catch { /* sem storage */ } return !r; });
  useEffect(() => { // Ctrl/⌘+K abre a paleta de comandos; Ctrl/⌘+J abre o agente lateral, em qualquer tela do painel
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuMovel(false); return; }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") { e.preventDefault(); setPaleta((p) => !p); }
      else if (k === "j") { e.preventDefault(); ir("/estudio"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const lojaSlug = caminho.match(/^\/loja\/([a-z0-9-]{2,63})$/);
  if (lojaSlug) return lojaSlug[1] === "mobis" ? <LojaMobisNova slug="mobis" /> : <Loja slug={lojaSlug[1]} />;
  if (hostCliente && !caminho.startsWith("/p/")) return lojaMobisPorHost(hostCliente) ? <LojaMobisNova slug="mobis" /> : <Loja host={hostCliente} />;
  const pub = caminho.match(/^\/p\/([a-z0-9-]+)\/(.+)$/);
  if (caminho === "/demo/vitrine" && import.meta.env.DEV && DEMO) return <VitrineDemo />;
  if (pub) return <ProdutoPublico slug={pub[1]} sku={decodeURIComponent(pub[2])} />;
  if (PAIR_ATIVO && caminho === "/parear" && !query.get("c")) return <ParearSolicitante />; // pública: o dispositivo que pede o pareamento ainda não tem login
  if (!demoAtivo && sessao === undefined) return <div className="entrada-aprovada ap-recuperacao"><p role="status">Carregando Conecta.IA…</p></div>;
  if (demoAtivo && !demo) return <div className="entrada-aprovada ap-recuperacao"><p role="status">Carregando Conecta.IA…</p></div>;
  if (!demoAtivo && (recuperando || caminho === "/redefinir")) return <div className="entrada-aprovada ap-recuperacao"><Redefinir aoConcluir={() => { fimRecuperacao(); void supabase.auth.signOut().then(() => ir("/entrar?aviso=senha")); }} /></div>;
  if (!demoAtivo && !sessao) return caminho === "/recuperar" ? <div className="entrada-aprovada ap-recuperacao"><Recuperar /></div> : <Entrar aviso={query.get("aviso")} />;

  if (!demoAtivo && sessao && PAIR_ATIVO && caminho === "/autorizar-agente") return <AutorizarAgente codigo={query.get("c") ?? ""} />;
  if (!demoAtivo && sessao && PAIR_ATIVO && caminho === "/parear") return <ParearAprovador codigo={query.get("c") ?? ""} email={sessao?.user.email ?? null} />;
  const loja = demoAtivo ? demo?.lojaDemo ?? null : lojas?.[0] ?? null;
  const bloqueada = rotaBloqueada(caminho, { conectorAtivo: CONECTOR_ATIVO, centralAtiva: CENTRAL_ATIVA }, ROTAS_DO_CONECTOR, ROTAS_DA_CENTRAL); // backend não publicado ou exige aceite
  const res = { esq: 0, dir: 0 };
  const filtroInd = caminho.match(/^\/indicadores\/([a-z_:]+)$/);
  return (
    <div className="conecta-aprovado-root">
      {demo && <div className="faixa-demo" role="status">{demo.FAIXA}</div>}
      <AvisoVersao />
      <PainelAprovado loja={loja} caminho={caminho} menu={MENU} menuMovel={menuMovel} recolhido={recolhido}
        aoMenu={() => setMenuMovel(v => !v)} aoRecolher={alternarMenu} aoBusca={() => setPaleta(true)}
        aoSair={() => { if (!demoAtivo) void supabase.auth.signOut(); }}
        aoAgente={() => ir("/estudio")} res={res}>
        {!demoAtivo && lojas === null ? <p className="suave">Carregando…</p> : !loja ? (
          <div className="cartao"><h1>Sem loja vinculada</h1><p className="suave">Seu login ainda não está ligado a uma loja. Peça ao suporte para vincular.</p></div>
        ) : bloqueada ? <VisaoGeral loja={loja} />
          : caminho === "/" ? <InicioAprovado loja={loja} />
          : caminho === "/catalogo-aplicacao" ? <CatalogoAplicacao loja={loja} />
          : caminho === "/visao-geral" ? <VisaoGeral loja={loja} />
          : caminho === "/catalogo-espelho" ? <Catalogo loja={loja} />
          : caminho === "/ferramentas" ? <FerramentasCatalogo loja={loja} query={query} />
          : caminho === "/estudio" ? <NanoWorkspace key={loja.id} loja={loja} menu={MENU} aoNavegar={ir} />
          : caminho === "/catalogo" ? <Catalogo loja={loja} />
          : caminho === "/fila" ? <Fila loja={loja} />
          : PAIR_ATIVO && caminho === "/aprovacoes" ? <Aprovacoes loja={loja} email={sessao?.user.email ?? null} />
          : PAIR_ATIVO && caminho === "/meu-agente" ? <MeuAgente loja={loja} />
          : PAIR_ATIVO && caminho === "/dispositivos" ? <Dispositivos loja={loja} />
          : caminho === "/taxonomia" ? <Taxonomia loja={loja} />
          : caminho === "/conector" ? <ConectorIA loja={loja} query={query} />
          : caminho === "/central" || caminho === "/agentes" ? <CentralInteligencia loja={loja} query={query} />
          : filtroInd ? <ListaDoIndicador loja={loja} filtro={filtroInd[1]} />
          : caminho === "/indicadores" ? <Indicadores loja={loja} />
          : caminho === "/studio" ? <Studio loja={loja} query={query} />
          : caminho === "/gateway" ? <GatewayMCP loja={loja} />
          : caminho === "/assistente" ? <NanoWorkspace key={loja.id} loja={loja} menu={MENU} aoNavegar={ir} />
          : caminho === "/aparencia" ? <Aparencia loja={loja} />
          : caminho === "/publicacao" ? <PublicacaoLoja loja={loja} />
          : BANNERS_ATIVO && caminho === "/banners" ? <Banners loja={loja} />
          : caminho === "/condicoes" ? <Condicoes loja={loja} />
          : caminho === "/integracoes" ? <Integracoes loja={loja} />
          : caminho === "/imagens" ? <Imagens loja={loja} />
          : caminho === "/videos" ? <Videos loja={loja} />
          : caminho === "/design" ? <Design />
          : BACKUP_ATIVO && caminho === "/backup" ? <Backup loja={loja} />
          : caminho === "/bling" ? <Bling loja={loja} query={query} />
          : caminho === "/contador" ? <Contador loja={loja} />
          : <VisaoGeral loja={loja} />}
      </PainelAprovado>
      <PaletaComandos itens={MENU} aberta={paleta} aoFechar={() => setPaleta(false)} />
    </div>
  );
}
