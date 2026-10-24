import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { ehFlash, erroBanner, isoDeLocal, LIMITE_ATIVOS, linkEnvioWhatsapp, mensagemParaCliente, nosDoMotor, ROTULO_SITUACAO, situacao, validarFormulario, type Banner, type Estilo, type Situacao } from "../lib/banners.ts";

type Produto = { id: string; sku: string | null; nome: string | null; preco: number | null; taxonomia_no_id: string | null };
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const COR: Record<Situacao, string> = { "no-ar": "ok", agendado: "atencao", rascunho: "", encerrado: "erro" };
const VAZIO = { produto: "", estilo: "auto" as Estilo, chamada: "", inicio: "", fim: "" };

export function Banners({ loja }: { loja: Loja }) {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [motor, setMotor] = useState<Set<string>>(new Set());
  const [f, setF] = useState(VAZIO);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("loja_banners").select("id, produto_id, chamada, estilo, inicio, fim, ativo").eq("loja_id", loja.id).order("criado_em", { ascending: false });
    setBanners((data ?? []) as Banner[]);
  }, [loja.id]);
  useEffect(() => {
    void carregar();
    void (async () => {
      const { data } = await supabase.from("produtos").select("id, sku, nome, preco, taxonomia_no_id").eq("loja_id", loja.id).eq("publicado", true).order("nome").limit(300);
      setProdutos((data ?? []) as Produto[]);
      const { data: nos } = await supabase.from("taxonomia_nos").select("id, pai_id, slug");
      setMotor(nosDoMotor((nos ?? []) as { id: string; pai_id: string | null; slug: string }[]));
    })();
  }, [carregar, loja.id]);

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const escolhido = porId.get(f.produto);
  const flashPrevia = escolhido ? ehFlash(f.estilo, escolhido.taxonomia_no_id, motor) : false;
  const noArOuAgendado = (banners ?? []).filter((b) => b.ativo).length;

  async function salvar(publicar: boolean) {
    const erro = validarFormulario(f);
    if (erro) { setMsg({ ok: false, texto: erro }); return; }
    setOcupado(true); setMsg(null);
    const { error } = await supabase.from("loja_banners").insert({
      loja_id: loja.id, produto_id: f.produto, estilo: f.estilo, chamada: f.chamada.trim() || null,
      inicio: isoDeLocal(f.inicio) ?? new Date().toISOString(), fim: isoDeLocal(f.fim), ativo: publicar,
    });
    setOcupado(false);
    if (error) setMsg({ ok: false, texto: erroBanner(error.code, error.message) });
    else { setMsg({ ok: true, texto: publicar ? "Banner publicado." : "Rascunho salvo." }); setF(VAZIO); void carregar(); }
  }
  async function alternar(b: Banner) {
    setMsg(null);
    const { error } = await supabase.from("loja_banners").update({ ativo: !b.ativo }).eq("id", b.id);
    if (error) setMsg({ ok: false, texto: erroBanner(error.code, error.message) }); else void carregar();
  }
  async function excluir(b: Banner) {
    setMsg(null);
    const { error } = await supabase.from("loja_banners").delete().eq("id", b.id);
    if (error) setMsg({ ok: false, texto: erroBanner(error.code, error.message) }); else void carregar();
  }

  return (
    <div className="cartao">
      <h1>Banners de oferta</h1>
      <p className="suave">Escolha um produto <strong>publicado</strong> e a chamada. Nome, foto e preço vêm do Bling, nada é digitado. Produto da área <strong>Motor</strong> sai como <strong>oferta relâmpago</strong> (destaque animado) no modo automático. Máximo de {LIMITE_ATIVOS} banners no ar ou agendados ({noArOuAgendado} agora).</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}

      <section aria-label="Novo banner">
        <h2>Novo banner</h2>
        <div className="grade-form">
          <label>1 · Produto
            <select value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value })}>
              <option value="">Escolha…</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.nome}</option>)}
            </select>
          </label>
          <label>2 · Estilo
            <select value={f.estilo} onChange={(e) => setF({ ...f, estilo: e.target.value as Estilo })}>
              <option value="auto">Automático (flash para Motor)</option>
              <option value="padrao">Padrão</option>
              <option value="flash">Flash (oferta relâmpago)</option>
            </select>
          </label>
          <label>3 · Início<input type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></label>
          <label>3 · Fim (opcional)<input type="datetime-local" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></label>
          <label>4 · Chamada (opcional, até 80)<input maxLength={80} value={f.chamada} onChange={(e) => setF({ ...f, chamada: e.target.value })} placeholder="Ex.: Só esta semana" /></label>
        </div>
        {escolhido && <p className="suave">Prévia: <strong>{escolhido.nome}</strong> · {brl(escolhido.preco)} (valor do Bling) · {flashPrevia ? "oferta relâmpago" : "banner padrão"}</p>}
        <div className="linha">
          <button disabled={ocupado} onClick={() => void salvar(true)}>Publicar</button>
          <button className="sec" disabled={ocupado} onClick={() => void salvar(false)}>Salvar rascunho</button>
        </div>
      </section>

      <h2>Banners</h2>
      {banners === null ? <p className="suave">Carregando…</p> : banners.length === 0 ? <p className="suave">Nenhum banner ainda.</p> : (
        <div className="rolagem">
          <table>
            <thead><tr><th>Produto</th><th>Estilo</th><th>Período</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>{banners.map((b) => {
              const p = porId.get(b.produto_id); const s = situacao(b); const flash = p ? ehFlash(b.estilo, p.taxonomia_no_id, motor) : b.estilo === "flash";
              const texto = p?.nome && p.sku ? mensagemParaCliente(p.nome, p.sku, flash) : null;
              return (
                <tr key={b.id}>
                  <td><span className="mono">{p?.sku ?? "—"}</span> {p?.nome ?? "produto oculto"}</td>
                  <td>{flash ? "Flash" : "Padrão"}</td>
                  <td className="mono">{new Date(b.inicio).toLocaleDateString("pt-BR")}{b.fim ? ` a ${new Date(b.fim).toLocaleDateString("pt-BR")}` : ""}</td>
                  <td><span className={`selo ${COR[s]}`}>{ROTULO_SITUACAO[s]}</span></td>
                  <td className="linha">
                    <button className="sec" onClick={() => void alternar(b)}>{b.ativo ? "Pausar" : "Publicar"}</button>
                    {texto && <a className="sec botao-link" href={linkEnvioWhatsapp(texto)} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>}
                    <button className="sec perigo" onClick={() => void excluir(b)}>Excluir</button>
                  </td>
                </tr>);
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
