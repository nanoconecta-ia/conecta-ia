import { useEffect, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import { Assistente } from "../paginas/Assistente.tsx";
import type { Item } from "../lib/comandosNL.ts";

// Agente lateral: o mesmo Assistente da loja (provedores, histórico e privacidade intactos), acessível de qualquer tela.
// Só monta na primeira abertura (nenhuma chamada ao servidor com o painel fechado); depois fica montado e apenas escondido, para não perder a conversa.
export function DockAgente({ loja, aberto, aoFechar, menu, aoNavegar }: { loja: Loja; aberto: boolean; aoFechar: () => void; menu?: Item[]; aoNavegar?: (rota: string) => void }) {
  const [montado, setMontado] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  useEffect(() => { if (aberto) setMontado(true); }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, aoFechar]);
  if (!montado) return null;
  return (
    <aside id="dock-agente" className="dock-agente" data-aberto={aberto} data-ampliado={ampliado} aria-label="Nano.ia" hidden={!aberto}>
      <div className="dock-topo"><strong>Nano.ia</strong><span className="suave">{loja.nome}</span><button className="sec mini" onClick={() => setAmpliado((v) => !v)} aria-pressed={ampliado} aria-label={ampliado ? "Reduzir a janela do Nano.ia" : "Ampliar a janela do Nano.ia"}>{ampliado ? "Reduzir" : "Ampliar"}</button><button className="sec mini" onClick={aoFechar} aria-label="Fechar o Nano.ia">Fechar</button></div>
      <div className="dock-corpo"><Assistente key={loja.id} loja={loja} menu={menu} aoNavegar={aoNavegar} /></div>
    </aside>
  );
}
