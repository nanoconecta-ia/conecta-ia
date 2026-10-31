import { useEffect, useMemo, useRef, useState } from "react";
import { agruparMenu, type Item } from "../lib/navegacao.ts";
import { buscarFerramentas } from "../lib/workspaceFerramentas.ts";
import { Icone } from "./Icone.tsx";

const ICONE: Record<string, string> = {
  "/": "inicio", "/assistente": "conversa", "/conector": "agentes",
  "/catalogo": "catalogo", "/taxonomia": "arvore", "/fila": "fila",
  "/bling": "erp", "/imagens": "imagem", "/estudio": "ajustes",
  "/studio": "caixas", "/integracoes": "conexoes", "/aprovacoes": "escudo",
  "/dispositivos": "monitor", "/backup": "arquivo", "/gateway": "rede",
  "/indicadores": "grafico", "/central": "escudo", "/design": "paleta",
};

/** Launcher global: mostra apenas módulos realmente liberados para este build e para a loja. */
export function CentroFerramentas({ aberta, aoFechar, itens, aoNavegar }: {
  aberta: boolean; aoFechar: () => void; itens: Item[];
  aoNavegar: (rota: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => buscarFerramentas(itens, busca), [itens, busca]);
  const grupos = useMemo(() => agruparMenu(filtrados), [filtrados]);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (aberta && !el.open) { setBusca(""); el.showModal(); campo.current?.focus(); }
    if (!aberta && el.open) el.close();
  }, [aberta]);
  function abrir(rota: string) { aoFechar(); aoNavegar(rota); }
  return (
    <dialog className="centro-ferramentas" ref={dialog} onClose={aoFechar} onClick={(e) => { if (e.target === dialog.current) aoFechar(); }} aria-labelledby="centro-titulo">
      <div className="centro-superficie">
        <header className="centro-cabecalho">
          <div><span className="centro-eyebrow">CON​​ECTA.IA / WORKSPACE</span><h2 id="centro-titulo">Módulos</h2><p>Escolha apenas a função necessária para o seu trabalho.</p></div>
          <button type="button" className="sec centro-fechar" onClick={aoFechar} aria-label="Fechar central de ferramentas"><Icone nome="fechar" tamanho={20}/></button>
        </header>
        <div className="centro-pesquisa"><Icone nome="busca" tamanho={20}/><input ref={campo} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar catálogo, Bling, aprovações..." aria-label="Buscar ferramentas"/></div>
        <div className="centro-lista">
          {grupos.map((grupo) => <section key={grupo.id} aria-label={grupo.titulo} className="centro-grupo">
            <h3>{grupo.titulo}</h3><div className="centro-grade">
              {grupo.itens.map(([rota,titulo]) => <div className="centro-tile" key={rota}>
                <button type="button" onClick={() => abrir(rota)}><Icone nome={ICONE[rota] ?? grupo.id} tamanho={20}/><span>{titulo}</span></button>
              </div>)}
            </div>
          </section>)}
          {!filtrados.length && <p className="centro-vazio" role="status">Nenhum módulo liberado corresponde à busca.</p>}
        </div>
        <footer className="centro-rodape"><Icone nome="escudo" tamanho={16}/> Consulta, proposta e execução são etapas separadas. Ações no Bling exigem autorização.</footer>
      </div>
    </dialog>
  );
}
