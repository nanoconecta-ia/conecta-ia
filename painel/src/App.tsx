import { useEffect, useState } from "react";
import { useLojas, useSessao } from "./lib/dados.ts";
import { ir, useRota } from "./lib/rota.ts";
import { supabase } from "./supabase.ts";
import { Entrar, Recuperar, Redefinir } from "./paginas/Acesso.tsx";
import { VisaoGeral } from "./paginas/VisaoGeral.tsx";
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
import { DEMO } from "./lib/modo.ts";
import type { Loja as LojaTipo } from "./lib/dados.ts";

// Em domínio de cliente (fora do GitHub Pages/localhost) a raiz é a loja daquele domínio, resolvida pelo servidor.
const HOSTS_PAINEL = ["nanoconecta-ia.github.io", "localhost", "127.0.0.1"];
const hostCliente = typeof window !== "undefined" && !HOSTS_PAINEL.includes(window.location.hostname) ? window.location.hostname : null;

const ITENS: [string, string][] = [
  ["/", "Visão geral"],
  ["/conector", "Conector IA"],
  ["/central", "Central de Inteligência"],
  ["/indicadores", "Indicadores"],
  ["/studio", "Studio de produtos"],
  ["/catalogo", "Catálogo"],
  ["/fila", "Fila de aprovação"],
  ["/taxonomia", "Taxonomia"],
  ["/aparencia", "Aparência da loja"],
  ["/integracoes", "Integrações de IA"],
  ["/gateway", "Gateway MCP/API"],
  ["/imagens", "Imagens e SEO"],
  ["/design", "Design System"],
  ["/bling", "Bling"],
  ["/contador", "Contador"],
];

export function App() {
  const { sessao, recuperando, fimRecuperacao } = useSessao();
  const { caminho, query } = useRota();
  const demoAtivo = import.meta.env.DEV && DEMO;
  const lojas = useLojas(!!sessao && !demoAtivo);
  const [demo, setDemo] = useState<{ FAIXA: string; lojaDemo: LojaTipo } | null>(null);
  useEffect(() => { if (import.meta.env.DEV && DEMO) void import("./lib/demo.ts").then((m) => setDemo({ FAIXA: m.FAIXA, lojaDemo: m.lojaDemo })); }, []);

  const lojaSlug = caminho.match(/^\/loja\/([a-z0-9-]{2,63})$/);
  if (lojaSlug) return <Loja slug={lojaSlug[1]} />;
  if (hostCliente && !caminho.startsWith("/p/")) return <Loja host={hostCliente} />;
  const pub = caminho.match(/^\/p\/([a-z0-9-]+)\/(.+)$/);
  if (caminho === "/demo/vitrine") return <VitrineDemo />;
  if (pub) return <ProdutoPublico slug={pub[1]} sku={decodeURIComponent(pub[2])} />;
  if (!demoAtivo && sessao === undefined) return <p className="entrar suave">Carregando…</p>;
  if (demoAtivo && !demo) return <p className="entrar suave">Carregando…</p>;
  if (!demoAtivo && (recuperando || caminho === "/redefinir")) return <Redefinir aoConcluir={() => { fimRecuperacao(); void supabase.auth.signOut().then(() => ir("/entrar?aviso=senha")); }} />;
  if (!demoAtivo && !sessao) return caminho === "/recuperar" ? <Recuperar /> : <Entrar aviso={query.get("aviso")} />;

  const loja = demoAtivo ? demo?.lojaDemo ?? null : lojas?.[0] ?? null;
  const larga = caminho === "/conector" || caminho === "/assistente";
  const filtroInd = caminho.match(/^\/indicadores\/([a-z_:]+)$/);
  return (
    <>
      {demo && <div className="faixa-demo" role="status">{demo.FAIXA}</div>}
      <header className="topo">
        <div className="marca"><i>C</i><div>Conecta.IA<small>{loja ? loja.nome : "Painel do lojista"}</small></div></div>
        <button className="sec" onClick={() => void supabase.auth.signOut()} disabled={demoAtivo}>Sair</button>
      </header>
      <div className={`layout ${larga ? "layout--larga" : ""}`}>
      <nav className="menu" aria-label="Menu principal">
        {ITENS.map(([c, t]) => (
          <a key={c} href={`#${c}`} className={caminho === c ? "ativo" : ""} aria-current={caminho === c ? "page" : undefined}>{t}</a>
        ))}
      </nav>
      <main>
        {!demoAtivo && lojas === null ? <p className="suave">Carregando…</p> : !loja ? (
          <div className="cartao"><h1>Sem loja vinculada</h1><p className="suave">Seu login ainda não está ligado a uma loja. Peça ao suporte para vincular.</p></div>
        ) : caminho === "/catalogo" ? <Catalogo loja={loja} />
          : caminho === "/fila" ? <Fila loja={loja} />
          : caminho === "/taxonomia" ? <Taxonomia loja={loja} />
          : caminho === "/conector" || caminho === "/assistente" ? <ConectorIA loja={loja} query={query} />
          : caminho === "/central" || caminho === "/agentes" ? <CentralInteligencia loja={loja} query={query} />
          : filtroInd ? <ListaDoIndicador loja={loja} filtro={filtroInd[1]} />
          : caminho === "/indicadores" ? <Indicadores loja={loja} />
          : caminho === "/studio" ? <Studio loja={loja} query={query} />
          : caminho === "/gateway" ? <GatewayMCP loja={loja} />
          : caminho === "/aparencia" ? <Aparencia loja={loja} />
          : caminho === "/integracoes" ? <Integracoes loja={loja} />
          : caminho === "/imagens" ? <Imagens />
          : caminho === "/design" ? <Design />
          : caminho === "/bling" ? <Bling loja={loja} query={query} />
          : caminho === "/contador" ? <Contador loja={loja} />
          : <VisaoGeral loja={loja} />}
      </main>
      </div>
    </>
  );
}
