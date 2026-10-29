import { useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

type Produto = { id: string; nome?: string | null; codigo?: string | null; sku?: string | null };
export function HomologacaoNano({ loja }: { loja: Loja }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [etapa, setEtapa] = useState<"inicio" | "consulta" | "simulada">("inicio");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function consultar() {
    setErro(""); setResultados([]); setSelecionado(null); setEtapa("inicio");
    const busca = termo.trim();
    if (busca.length < 2 || busca.length > 80) { setErro("Informe pelo menos 2 caracteres (máximo 80)."); return; }
    setOcupado(true);
    try {
      // Consulta somente leitura, restrita à loja pelo filtro e RLS.
      const { data, error } = await supabase.from("produtos").select("id,nome,codigo").eq("loja_id", loja.id).ilike("nome", `%${busca.replace(/[%_,()]/g, "")}%`).limit(15);
      if (error) throw error;
      setResultados((data ?? []) as Produto[]);
      setEtapa("consulta");
    } catch { setErro("Consulta indisponível ou sem permissão. Nenhum dado foi alterado."); }
    finally { setOcupado(false); }
  }
  function simular() {
    if (!selecionado) return;
    setEtapa("simulada");
  }
  return <section className="cartao" style={{ maxWidth: 800 }}>
    <h1>Nano.IA — Homologação segura</h1>
    <p>Ambiente de demonstração: consulta somente leitura ao catálogo da loja e aprovação <strong>simulada no navegador</strong>. Nenhuma proposta é gravada na fila ou no Bling.</p>
    <p><strong>Etapa 1 — Consultar produto</strong></p>
    <label htmlFor="nano-homologacao-busca">Nome da peça</label>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input id="nano-homologacao-busca" value={termo} onChange={e => setTermo(e.target.value)} placeholder="Ex.: bomba de água" maxLength={80} />
      <button type="button" disabled={ocupado} onClick={() => void consultar()}>{ocupado ? "Consultando..." : "Consultar"}</button>
    </div>
    {erro && <p role="alert">{erro}</p>}
    {etapa !== "inicio" && <div><h2>Resultado da consulta</h2>
      {resultados.length === 0 ? <p>Nenhum produto encontrado nesta consulta. Isso não comprova ausência no Bling.</p> :
      <ul>{resultados.map(p => <li key={p.id}><label><input type="radio" name="nano-produto" checked={selecionado?.id === p.id} onChange={() => { setSelecionado(p); setEtapa("consulta"); }} /> {p.nome || p.codigo || p.id}</label></li>)}</ul>}
      <h2>Etapa 2 — Aprovação simulada</h2>
      <button type="button" disabled={!selecionado || etapa === "simulada"} onClick={simular}>Simular aprovação</button>
      {etapa === "simulada" && <p role="status"><strong>Simulação concluída.</strong> Produto selecionado: {selecionado?.nome || selecionado?.codigo}. Nenhuma alteração persistida; nenhuma autorização real concedida.</p>}
    </div>}
    <p><small>Não é um teste de criação de proposta real nem de execução. A fila de aprovação real será integrada em etapa posterior, no servidor, com autenticação e controles de permissão.</small></p>
  </section>;
}
