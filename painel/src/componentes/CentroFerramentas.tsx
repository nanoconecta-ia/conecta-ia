import { useEffect, useMemo, useRef, useState } from "react";
import { agruparMenu, type Item } from "../lib/navegacao.ts";
import { buscarFerramentas, lerFavoritos } from "../lib/workspaceFerramentas.ts";
import { Icone } from "./Icone.tsx";

const STORAGE = "conecta:workspace:favoritos-v1";
const ICONE: Record<string, string> = {
  "/": "inicio", "/assistente": "conversa", "/conector": "agentes",
  "/catalogo": "catalogo", "/taxonomia": "arvore", "/fila": "fila",
  "/bling": "erp", "/imagens": "imagem", "/estudio": "ajustes",
  "/studio": "caixas", "/integracoes": "conexoes", "/aprovacoes": "escudo",
  "/dispositivos": "monitor", "/backup": "arquivo", "/gateway": "rede",
  "/indicadores": "grafico", "/central": "escudo", "/design": "paleta",
};

/** Launcher global: mostra apenas módulos realmente liberados para este build e para a loja. */
export function CentroFerramentas({ aberta, aoFechar, itens, aoNavegar, aoAbrirAgente, rotaNano }: {
  aberta: boolean; aoFechar: () => void; itens: Item[];
  aoNavegar: (rota: string) => void; aoAbrirAgente: () => void; rotaNano: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try { return lerFavoritos(localStorage.getItem(STORAGE), itens.map(([rota]) => rota)); }
    catch { return lerFavoritos(null, itens.map(([rota]) => rota)); }
  });
  const habilitados = useMemo(() => new Set(itens.map(([rota]) => rota)), [itens]);
  const filtrados = useMemo(() => buscarFerramentas(itens, busca), [itens, busca]);
  const grupos = useMemo(() => agruparMenu(filtrados), [filtrados]);
  const preferidos = favoritos.filter((rota) => habilitados.has(rota));
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (aberta && !el.open) { setBusca(""); el.showModal(); campo.current?.focus(); }
    if (!aberta && el.open) el.close();
  }, [aberta]);
  function favoritar(rota: string) {
    const novos = favoritos.includes(rota) ? favoritos.filter((x) => x !== rota) : [...favoritos, rota].slice(0, 12);
    setFavoritos(novos);
    try { localStorage.setItem(STORAGE, JSON.stringify(novos)); } catch { /* preferência opcional */ }
  }
  function abrir(rota: string) { aoFechar(); aoNavegar(rota); }
  return (
    <dialog className="centro-ferramentas" ref={dialog} onClose={aoFechar} onClick={(e) => { if (e.target === dialog.current) aoFechar(); }} aria-labelledby="centro-titulo">
      <div className="centro-superficie">
        <header className="centro-cabecalho">
          <div><span className="centro-eyebrow">CON​​ECTA.IA / WORKSPACE</span><h2 id="centro-titulo">Central de ferramentas</h2><p>Abra um módulo autorizado sem perder o contexto de trabalho.</p></div>
          <button type="button" className="sec centro-fechar" onClick={aoFechar} aria-label="Fechar central de ferramentas"><Icone nome="fechar" tamanho={20}/></button>
        </header>
        <div className="centro-pesquisa"><Icone nome="busca" tamanho={20}/><input ref={campo} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar catálogo, Bling, aprovações..." aria-label="Buscar ferramentas"/></div>
        <div className="centro-atalhos">
          <button type="button" onClick={() => abrir(rotaNano)}><Icone nome="conversa" tamanho={20}/><span><b>Chat completo</b><small>Histórico, modelo e privacidade</small></span></button>
          {globalDisponivel && <button type="button" onClick={() => { aoFechar(); aoAbrirAgente(); }}><Icone nome="agentes" tamanho={20}/><span><b>Chat global</b><small>Converse sem sair da tela</small></span></button>}
        </div>
        <div className="centro-lista">
          {!busca && preferidos.length > 0 && <section aria-label="Ferramentas favoritas" className="centro-grupo">
            <h3>Favoritos</h3><div className="centro-grade">
              {itens.filter(([rota]) => preferidos.includes(rota)).map(([rota,titulo]) =>
                <div className="centro-tile" key={"fav:"+rota}><button type="button" onClick={() => abrir(rota)}><Icone nome={ICONE[rota] ?? "caixas"} tamanho={20}/><span>{titulo}</span></button><button type="button" className="centro-estrela" onClick={() => favoritar(rota)} aria-label={"Remover "+titulo+" dos favoritos"} title="Remover favorito">★</button></div>
              )}
            </div>
          </section>}
          {grupos.map((grupo) => <section key={grupo.id} aria-label={grupo.titulo} className="centro-grupo">
            <h3>{grupo.titulo}</h3><div className="centro-grade">
              {grupo.itens.map(([rota,titulo]) => <div className="centro-tile" key={rota}>
                <button type="button" onClick={() => abrir(rota)}><Icone nome={ICONE[rota] ?? grupo.id} tamanho={20}/><span>{titulo}</span></button>
                <button type="button" className="centro-estrela" onClick={() => favoritar(rota)}
                  aria-label={(favoritos.includes(rota) ? "Remover " : "Favoritar ")+titulo}
                  aria-pressed={favoritos.includes(rota)} title={favoritos.includes(rota) ? "Remover favorito" : "Adicionar favorito"}>{favoritos.includes(rota) ? "★" : "☆"}</button>
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
