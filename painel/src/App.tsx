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
import { Assistente } from "./paginas/Assistente.tsx";
import { Integracoes } from "./paginas/Integracoes.tsx";
import { ProdutoPublico } from "./paginas/ProdutoPublico.tsx";
import { CentralAgentes } from "./paginas/CentralAgentes.tsx";
import { Design } from "./paginas/Design.tsx";
import { Imagens } from "./paginas/Imagens.tsx";
import { VitrineDemo } from "./paginas/VitrineDemo.tsx";

const ITENS: [string, string][] = [
  ["/", "Visão geral"],
  ["/catalogo", "Catálogo"],
  ["/fila", "Fila de aprovação"],
  ["/taxonomia", "Taxonomia"],
  ["/assistente", "Assistente"],
  ["/integracoes", "Integrações de IA"],
  ["/agentes", "Central de Agentes"],
  ["/imagens", "Imagens e SEO"],
  ["/design", "Design System"],
  ["/bling", "Bling"],
  ["/contador", "Contador"],
];

export function App() {
  const { sessao, recuperando, fimRecuperacao } = useSessao();
  const { caminho, query } = useRota();
  const lojas = useLojas(!!sessao);

  const pub = caminho.match(/^\/p\/([a-z0-9-]+)\/(.+)$/);
  if (caminho === "/demo/vitrine") return <VitrineDemo />;
  if (pub) return <ProdutoPublico slug={pub[1]} sku={decodeURIComponent(pub[2])} />;
  if (sessao === undefined) return <p className="entrar suave">Carregando…</p>;
  if (recuperando || caminho === "/redefinir") return <Redefinir aoConcluir={() => { fimRecuperacao(); void supabase.auth.signOut().then(() => ir("/entrar?aviso=senha")); }} />;
  if (!sessao) return caminho === "/recuperar" ? <Recuperar /> : <Entrar aviso={query.get("aviso")} />;

  const loja = lojas?.[0] ?? null;
  return (
    <>
      <header className="topo">
        <div className="marca"><i>C</i><div>Conecta.IA<small>{loja ? loja.nome : "Painel do lojista"}</small></div></div>
        <button className="sec" onClick={() => void supabase.auth.signOut()}>Sair</button>
      </header>
      <nav className="menu">
        {ITENS.map(([c, t]) => (
          <a key={c} href={`#${c}`} className={caminho === c ? "ativo" : ""}>{t}</a>
        ))}
      </nav>
      <main>
        {lojas === null ? <p className="suave">Carregando…</p> : !loja ? (
          <div className="cartao"><h1>Sem loja vinculada</h1><p className="suave">Seu login ainda não está ligado a uma loja. Peça ao suporte para vincular.</p></div>
        ) : caminho === "/catalogo" ? <Catalogo loja={loja} />
          : caminho === "/fila" ? <Fila loja={loja} />
          : caminho === "/taxonomia" ? <Taxonomia loja={loja} />
          : caminho === "/assistente" ? <Assistente loja={loja} />
          : caminho === "/integracoes" ? <Integracoes loja={loja} />
          : caminho === "/agentes" ? <CentralAgentes />
          : caminho === "/imagens" ? <Imagens />
          : caminho === "/design" ? <Design />
          : caminho === "/bling" ? <Bling loja={loja} query={query} />
          : caminho === "/contador" ? <Contador loja={loja} />
          : <VisaoGeral loja={loja} />}
      </main>
    </>
  );
}
