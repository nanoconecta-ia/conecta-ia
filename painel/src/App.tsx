import { AutorizarAgente } from "./paginas/AutorizarAgente.tsx";
import { useEffect } from "react";
import { PAIR_ATIVO } from "./lib/flags.ts";
import { useLojas, useSessao } from "./lib/dados.ts";
import { ir, useRota } from "./lib/rota.ts";
import { supabase } from "./supabase.ts";
import { Entrar, Recuperar, Redefinir } from "./paginas/Acesso.tsx";
import { EstudioAgente } from "./paginas/EstudioAgente.tsx";
import { VisaoGeral } from "./paginas/VisaoGeral.tsx";
import { Catalogo } from "./paginas/Catalogo.tsx";
import { Bling } from "./paginas/Bling.tsx";
import { Contador } from "./paginas/Contador.tsx";
import { Taxonomia } from "./paginas/Taxonomia.tsx";
import { Fila } from "./paginas/Fila.tsx";
import { Assistente } from "./paginas/Assistente.tsx";
import { Integracoes } from "./paginas/Integracoes.tsx";
import { ProdutoPublico } from "./paginas/ProdutoPublico.tsx";
import { CentralAgentes } from "./paginas/CentralAgentes.tsx";
import { Design } from "./paginas/Design.tsx";
import { Imagens } from "./paginas/Imagens.tsx";
import { VitrineDemo } from "./paginas/VitrineDemo.tsx";
import { Loja } from "./paginas/Loja.tsx";
import { Aparencia } from "./paginas/Aparencia.tsx";
import { ParearAprovador, ParearSolicitante } from "./paginas/Parear.tsx";
import { Aprovacoes } from "./paginas/Aprovacoes.tsx";
import { Dispositivos } from "./paginas/Dispositivos.tsx";

// Em domínio de cliente (fora do GitHub Pages/localhost) a raiz é a loja daquele domínio, resolvida pelo servidor.
const HOSTS_PAINEL = ["nanoconecta-ia.github.io", "localhost", "127.0.0.1"];
const hostCliente = typeof window !== "undefined" && !HOSTS_PAINEL.includes(window.location.hostname) ? window.location.hostname : null;

const ITENS_PAIR: [string, string][] = [["/aprovacoes", "Aprovações"], ["/dispositivos", "Dispositivos"]];
const ITENS: [string, string][] = [
  ["/", "Visão geral"],
  ["/estudio", "Estúdio do agente"],
  ["/catalogo", "Catálogo"],
  ["/fila", "Fila de aprovação"],
  ["/taxonomia", "Taxonomia"],
  ["/assistente", "Assistente"],
  ["/aparencia", "Aparência da loja"],
  ["/integracoes", "Integrações de IA"],
  ["/agentes", "Central de Agentes"],
  ["/imagens", "Imagens e SEO"],
  ["/design", "Design System"],
  ["/bling", "Bling"],
  ["/contador", "Contador"],
];
const MENU: [string, string][] = PAIR_ATIVO ? [...ITENS.slice(0, 3), ...ITENS_PAIR, ...ITENS.slice(3)] : ITENS;

export function App() {
  const { sessao, recuperando, fimRecuperacao } = useSessao();
  const { caminho, query } = useRota();
  const lojas = useLojas(!!sessao);
  useEffect(() => { // volta ao link do QR de pareamento depois do login com Google (o retorno do OAuth descarta o #)
    if (!sessao) return;
    try { const r = sessionStorage.getItem("conecta:retorno"); if (r && /^#\/(?:parear|autorizar-agente)(?:\?|$)/.test(r)) { sessionStorage.removeItem("conecta:retorno"); window.location.hash = r; } } catch { /* sem storage */ }
  }, [sessao]);

  const lojaSlug = caminho.match(/^\/loja\/([a-z0-9-]{2,63})$/);
  if (lojaSlug) return <Loja slug={lojaSlug[1]} />;
  if (hostCliente && !caminho.startsWith("/p/")) return <Loja host={hostCliente} />;
  const pub = caminho.match(/^\/p\/([a-z0-9-]+)\/(.+)$/);
  if (caminho === "/demo/vitrine") return <VitrineDemo />;
  if (pub) return <ProdutoPublico slug={pub[1]} sku={decodeURIComponent(pub[2])} />;
  if (PAIR_ATIVO && caminho === "/parear" && !query.get("c")) return <ParearSolicitante />; // pública: o dispositivo que pede o pareamento ainda não tem login
  if (sessao === undefined) return <p className="entrar suave">Carregando…</p>;
  if (recuperando || caminho === "/redefinir") return <Redefinir aoConcluir={() => { fimRecuperacao(); void supabase.auth.signOut().then(() => ir("/entrar?aviso=senha")); }} />;
  if (!sessao) return caminho === "/recuperar" ? <Recuperar /> : <Entrar aviso={query.get("aviso")} />;

  if (PAIR_ATIVO && caminho === "/autorizar-agente") return <AutorizarAgente codigo={query.get("c") ?? ""} />;
  if (PAIR_ATIVO && caminho === "/parear") return <ParearAprovador codigo={query.get("c") ?? ""} email={sessao.user.email ?? null} />;
  const loja = lojas?.[0] ?? null;
  return (
    <>
      <header className="topo">
        <div className="marca"><i>C</i><div>Conecta.IA<small>{loja ? loja.nome : "Painel do lojista"}</small></div></div>
        <button className="sec" onClick={() => void supabase.auth.signOut()}>Sair</button>
      </header>
      <div className="layout">
      <nav className="menu" aria-label="Menu principal">
        {MENU.map(([c, t]) => (
          <a key={c} href={`#${c}`} className={caminho === c ? "ativo" : ""} aria-current={caminho === c ? "page" : undefined}>{t}</a>
        ))}
      </nav>
      <main>
        {lojas === null ? <p className="suave">Carregando…</p> : !loja ? (
          <div className="cartao"><h1>Sem loja vinculada</h1><p className="suave">Seu login ainda não está ligado a uma loja. Peça ao suporte para vincular.</p></div>
        ) : caminho === "/estudio" ? <EstudioAgente key={loja.id} loja={loja} />
          : caminho === "/catalogo" ? <Catalogo loja={loja} />
          : caminho === "/fila" ? <Fila loja={loja} />
          : PAIR_ATIVO && caminho === "/aprovacoes" ? <Aprovacoes loja={loja} email={sessao.user.email ?? null} />
          : PAIR_ATIVO && caminho === "/dispositivos" ? <Dispositivos loja={loja} />
          : caminho === "/taxonomia" ? <Taxonomia loja={loja} />
          : caminho === "/assistente" ? <Assistente key={loja.id} loja={loja} />
          : caminho === "/aparencia" ? <Aparencia loja={loja} />
          : caminho === "/integracoes" ? <Integracoes loja={loja} />
          : caminho === "/agentes" ? <CentralAgentes />
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
