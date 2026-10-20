import { useEffect, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import { Assistente } from "../paginas/Assistente.tsx";

// Agente lateral: o mesmo Assistente da loja (provedores, histórico e privacidade intactos), acessível de qualquer tela.
// Só monta na primeira abertura (nenhuma chamada ao servidor com o painel fechado); depois fica montado e apenas escondido, para não perder a conversa.
export function DockAgente({ loja, aberto, aoFechar }: { loja: Loja; aberto: boolean; aoFechar: () => void }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => { if (aberto) setMontado(true); }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, aoFechar]);
  if (!montado) return null;
  return (
    <aside className="dock-agente" data-aberto={aberto} aria-label="Agente" hidden={!aberto}>
      <div className="dock-topo"><strong>Agente</strong><span className="suave">{loja.nome}</span><button className="sec mini" onClick={aoFechar} aria-label="Fechar agente">Fechar</button></div>
      <div className="dock-corpo"><Assistente key={loja.id} loja={loja} /></div>
    </aside>
  );
}
