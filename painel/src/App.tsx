import { useLojas, useSessao } from "./lib/dados.ts";
import { ir, useRota } from "./lib/rota.ts";
import { supabase } from "./supabase.ts";
import { Entrar, Recuperar, Redefinir } from "./paginas/Acesso.tsx";
import { VisaoGeral } from "./paginas/VisaoGeral.tsx";
import { Catalogo } from "./paginas/Catalogo.tsx";
import { Bling } from "./paginas/Bling.tsx";
import { Contador } from "./paginas/Contador.tsx";

const ITENS: [string, string][] = [
  ["/", "Visão geral"],
  ["/catalogo", "Catálogo"],
  ["/bling", "Bling"],
  ["/contador", "Contador"],
];

export function App() {
  const { sessao, recuperando, fimRecuperacao } = useSessao();
  const { caminho, query } = useRota();
  const lojas = useLojas(!!sessao);

  if (sessao === undefined) return <p className="entrar suave">Carregando…</p>;
  if (recuperando || caminho === "/redefinir") return <Redefinir aoConcluir={() => { fimRecuperacao(); void supabase.auth.signOut().then(() => ir("/entrar?aviso=senha")); }} />;
  if (!sessao) return caminho === "/recuperar" ? <Recuperar /> : <Entrar aviso={query.get("aviso")} />;

  const loja = lojas?.[0] ?? null;
  return (
    <>
      <header className="topo">
        <strong>Conecta.IA{loja ? ` · ${loja.nome}` : ""}</strong>
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
          : caminho === "/bling" ? <Bling loja={loja} query={query} />
          : caminho === "/contador" ? <Contador loja={loja} />
          : <VisaoGeral loja={loja} />}
      </main>
    </>
  );
}
