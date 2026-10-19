import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { FORMAS, ROTULO_SITUACAO, TIPOS_ENTREGA, faltaParaAprovarForma, faltaParaAprovarRegra, formatarCep, montarRegra, situacao, type FormRegra } from "../lib/condicoes.ts";

type Forma = { id: string; forma: string; rotulo: string | null; parcelas_max: number | null; status: "rascunho" | "aprovada"; visivel_no_site: boolean };
type Regra = { id: string; tipo: string; cep_inicio: string; cep_fim: string; prazo_dias_min: number | null; prazo_dias_max: number | null; valor_frete: number | null; frete_gratis_acima: number | null; fonte: string; status: "rascunho" | "aprovada"; visivel_no_site: boolean };
const rot = (lista: [string, string][], k: string) => lista.find(([c]) => c === k)?.[1] ?? k;
const REGRA_VAZIA: FormRegra = { tipo: "transportadora", cepInicio: "", cepFim: "", prazoMin: "", prazoMax: "", valorFrete: "", gratisAcima: "", fonte: "" };

/** Ações do item: aprovar (revisão carimbada pelo servidor), mostrar/ocultar no site e remover. O banco recusa quem não administra a loja. */
function Acoes({ item, bloqueio, aoMudar, aoRemover, ocupado }: { item: { status: "rascunho" | "aprovada"; visivel_no_site: boolean }; bloqueio: string | null; aoMudar: (c: Record<string, unknown>) => void; aoRemover: () => void; ocupado: boolean }) {
  const s = situacao(item);
  return (
    <div className="linha">
      <span className={s === "visivel" ? "msg-ok" : "suave"}>{ROTULO_SITUACAO[s]}</span>
      {s === "rascunho" && <button className="sec" disabled={ocupado || !!bloqueio} title={bloqueio ?? undefined} onClick={() => aoMudar({ status: "aprovada" })}>Aprovar</button>}
      {s === "aprovada_oculta" && <button disabled={ocupado} onClick={() => aoMudar({ visivel_no_site: true })}>Mostrar no site</button>}
      {s === "visivel" && <button className="sec" disabled={ocupado} onClick={() => aoMudar({ visivel_no_site: false })}>Ocultar do site</button>}
      {s !== "rascunho" && <button className="sec" disabled={ocupado} onClick={() => aoMudar({ status: "rascunho" })}>Voltar a rascunho</button>}
      <button className="perigo" disabled={ocupado} onClick={aoRemover}>Remover</button>
    </div>
  );
}

export function Condicoes({ loja }: { loja: Loja }) {
  const [formas, setFormas] = useState<Forma[] | null>(null);
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novaForma, setNovaForma] = useState({ forma: "pix", rotulo: "", parcelas: "" });
  const [nova, setNova] = useState<FormRegra>(REGRA_VAZIA);

  const carregar = useCallback(async () => {
    const [f, r] = await Promise.all([
      supabase.from("loja_formas_pagamento").select("id, forma, rotulo, parcelas_max, status, visivel_no_site").eq("loja_id", loja.id).order("forma"),
      supabase.from("loja_entrega_regras").select("id, tipo, cep_inicio, cep_fim, prazo_dias_min, prazo_dias_max, valor_frete, frete_gratis_acima, fonte, status, visivel_no_site").eq("loja_id", loja.id).order("cep_inicio"),
    ]);
    setFormas((f.data ?? []) as Forma[]); setRegras((r.data ?? []) as Regra[]);
  }, [loja.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function rodar(op: () => PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string) {
    setOcupado(true); setMsg(null);
    const { error } = await op();
    setOcupado(false);
    if (error) setMsg({ ok: false, texto: error.code === "42501" ? "Só quem administra a loja (lojista) pode aprovar ou mostrar no site." : "Não foi possível salvar. Confira os campos." });
    else { setMsg({ ok: true, texto: ok }); void carregar(); }
  }

  function adicionarForma(e: FormEvent) {
    e.preventDefault();
    const p = novaForma.parcelas.trim() === "" ? null : Number(novaForma.parcelas);
    if (p !== null && (!Number.isInteger(p) || p < 1 || p > 24)) { setMsg({ ok: false, texto: "Parcelas: inteiro de 1 a 24." }); return; }
    const erro = faltaParaAprovarForma({ forma: novaForma.forma, parcelas_max: p });
    if (erro) { setMsg({ ok: false, texto: erro }); return; }
    void rodar(() => supabase.from("loja_formas_pagamento").insert({ loja_id: loja.id, forma: novaForma.forma, rotulo: novaForma.rotulo.trim() || null, parcelas_max: p }), "Forma adicionada como rascunho. Ela só aparece no site depois de aprovada e mostrada.").then(() => setNovaForma({ forma: "pix", rotulo: "", parcelas: "" }));
  }
  function adicionarRegra(e: FormEvent) {
    e.preventDefault();
    const r = montarRegra(nova);
    if (!r.ok) { setMsg({ ok: false, texto: r.erro }); return; }
    void rodar(() => supabase.from("loja_entrega_regras").insert({ loja_id: loja.id, ...r.valor }), "Regra adicionada como rascunho. Ela só aparece no site depois de aprovada e mostrada.").then(() => setNova(REGRA_VAZIA));
  }

  return (
    <div className="cartao">
      <h1>Pagamento e entrega</h1>
      <p className="suave">Você decide o que o site e o agente podem dizer ao cliente. Tudo nasce como rascunho e <strong>oculto</strong>: só aparece depois que você aprova e clica em “Mostrar no site”. Você pode ocultar a qualquer momento. O sistema não inventa prazo, frete nem forma de pagamento.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}

      <h2>Formas de pagamento</h2>
      {formas === null ? <p className="suave">Carregando…</p> : formas.length === 0 ? <p className="suave">Nenhuma forma cadastrada. Sem cadastro, o agente não cita pagamento.</p> : (
        <ul className="lista-simples">{formas.map((f) => (
          <li key={f.id}>
            <strong>{rot(FORMAS, f.forma)}{f.rotulo ? ` — ${f.rotulo}` : ""}{f.parcelas_max ? ` (até ${f.parcelas_max}x)` : ""}</strong>
            <Acoes item={f} bloqueio={faltaParaAprovarForma(f)} ocupado={ocupado}
              aoMudar={(c) => void rodar(() => supabase.from("loja_formas_pagamento").update(c).eq("id", f.id), "Atualizado.")}
              aoRemover={() => void rodar(() => supabase.from("loja_formas_pagamento").delete().eq("id", f.id), "Removido.")} />
          </li>))}</ul>
      )}
      <form onSubmit={adicionarForma}>
        <div className="linha">
          <label>Forma<select value={novaForma.forma} onChange={(e) => setNovaForma({ ...novaForma, forma: e.target.value })}>{FORMAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label>Nome para o cliente (opcional)<input value={novaForma.rotulo} onChange={(e) => setNovaForma({ ...novaForma, rotulo: e.target.value })} maxLength={80} /></label>
          {novaForma.forma === "cartao_credito" && <label>Parcelas até<input inputMode="numeric" value={novaForma.parcelas} onChange={(e) => setNovaForma({ ...novaForma, parcelas: e.target.value })} /></label>}
        </div>
        <button disabled={ocupado}>Adicionar forma de pagamento</button>
      </form>

      <h2>Entrega por faixa de CEP</h2>
      {regras === null ? <p className="suave">Carregando…</p> : regras.length === 0 ? <p className="suave">Nenhuma regra cadastrada. Sem cadastro, o agente pede o CEP e oferece o atendente, sem prometer prazo.</p> : (
        <ul className="lista-simples">{regras.map((r) => (
          <li key={r.id}>
            <strong>{rot(TIPOS_ENTREGA, r.tipo)}: CEP {formatarCep(r.cep_inicio)} a {formatarCep(r.cep_fim)}</strong>
            <div className="suave">
              {r.prazo_dias_max != null ? `Prazo ${r.prazo_dias_min != null && r.prazo_dias_min !== r.prazo_dias_max ? `${r.prazo_dias_min} a ` : "até "}${r.prazo_dias_max} dias` : "Sem prazo máximo informado"} ·{" "}
              {r.valor_frete == null ? "frete a calcular" : r.valor_frete === 0 ? "frete sem custo" : `frete R$ ${r.valor_frete.toFixed(2).replace(".", ",")}`}
              {r.frete_gratis_acima ? ` · sem custo acima de R$ ${r.frete_gratis_acima.toFixed(2).replace(".", ",")}` : ""} · fonte: {r.fonte}
            </div>
            <Acoes item={r} bloqueio={faltaParaAprovarRegra(r)} ocupado={ocupado}
              aoMudar={(c) => void rodar(() => supabase.from("loja_entrega_regras").update(c).eq("id", r.id), "Atualizado.")}
              aoRemover={() => void rodar(() => supabase.from("loja_entrega_regras").delete().eq("id", r.id), "Removido.")} />
          </li>))}</ul>
      )}
      <form onSubmit={adicionarRegra}>
        <div className="linha">
          <label>Tipo<select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>{TIPOS_ENTREGA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label>CEP inicial<input inputMode="numeric" value={nova.cepInicio} onChange={(e) => setNova({ ...nova, cepInicio: e.target.value })} placeholder="01000-000" /></label>
          <label>CEP final<input inputMode="numeric" value={nova.cepFim} onChange={(e) => setNova({ ...nova, cepFim: e.target.value })} placeholder="01999-999" /></label>
        </div>
        <div className="linha">
          <label>Prazo mínimo (dias)<input inputMode="numeric" value={nova.prazoMin} onChange={(e) => setNova({ ...nova, prazoMin: e.target.value })} /></label>
          <label>Prazo máximo (dias)<input inputMode="numeric" value={nova.prazoMax} onChange={(e) => setNova({ ...nova, prazoMax: e.target.value })} /></label>
          <label>Frete (R$) — vazio = a calcular<input inputMode="decimal" value={nova.valorFrete} onChange={(e) => setNova({ ...nova, valorFrete: e.target.value })} /></label>
          <label>Sem custo acima de (R$)<input inputMode="decimal" value={nova.gratisAcima} onChange={(e) => setNova({ ...nova, gratisAcima: e.target.value })} /></label>
        </div>
        <label>Fonte da regra<input value={nova.fonte} onChange={(e) => setNova({ ...nova, fonte: e.target.value })} placeholder="tabela da transportadora, política da loja..." /></label>
        <button disabled={ocupado}>Adicionar regra de entrega</button>
      </form>
    </div>
  );
}
