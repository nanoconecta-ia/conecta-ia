import type { ReactNode } from "react";
import { markdown, type Bloco, type Inline } from "../lib/markdown.ts";

function Linha({ itens }: { itens: Inline[] }): ReactNode {
  return <>{itens.map((x, i) => {
    switch (x.t) {
      case "texto": return x.v;
      case "negrito": return <strong key={i}><Linha itens={x.c} /></strong>;
      case "italico": return <em key={i}><Linha itens={x.c} /></em>;
      case "codigo": return <code key={i}>{x.v}</code>;
      case "link": return <a key={i} href={x.href} target="_blank" rel="noreferrer noopener nofollow"><Linha itens={x.c} /></a>;
    }
  })}</>;
}

function B({ b }: { b: Bloco }) {
  switch (b.t) {
    case "p": return <p><Linha itens={b.c} /></p>;
    case "h": { const H = (`h${Math.min(b.n + 1, 4)}`) as "h2" | "h3" | "h4"; return <H><Linha itens={b.c} /></H>; }
    case "ul": return <ul>{b.itens.map((it, i) => <li key={i}><Linha itens={it} /></li>)}</ul>;
    case "ol": return <ol>{b.itens.map((it, i) => <li key={i}><Linha itens={it} /></li>)}</ol>;
    case "codigo": return <pre className="mono"><code>{b.v}</code></pre>;
    case "citacao": return <blockquote><Linha itens={b.c} /></blockquote>;
    case "hr": return <hr />;
    case "tabela": return (
      <div className="rolagem"><table>
        <thead><tr>{b.cab.map((c, i) => <th key={i} scope="col"><Linha itens={c} /></th>)}</tr></thead>
        <tbody>{b.linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j}><Linha itens={c} /></td>)}</tr>)}</tbody>
      </table></div>
    );
  }
}

/** Renderiza a resposta do agente como elementos React (nunca HTML cru). */
export function Markdown({ texto }: { texto: string }) {
  return <div className="md">{markdown(texto).map((b, i) => <B key={i} b={b} />)}</div>;
}
