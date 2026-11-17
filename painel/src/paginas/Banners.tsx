import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import "./banners-flash.css";
import { ehFlash, erroBanner, isoDeLocal, LIMITE_ATIVOS, linkEnvioWhatsapp, mensagemParaCliente, nosDoMotor, ROTULO_SITUACAO, situacao, validarFormulario, type Banner, type Estilo, type Situacao } from "../lib/banners.ts";

type Produto = { id: string; sku: string | null; nome: string | null; preco: number | null; taxonomia_no_id: string | null };
type Foto = { id: string; produto_id: string; url: string; alt_texto: string | null; principal: boolean; licenca_tipo: string | null; direitos_confirmados_em: string | null };
function localDeIso(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (!Number.isFinite(data.getTime())) return "";
  const z = (n: number) => String(n).padStart(2, "0");
  return [data.getFullYear(), z(data.getMonth() + 1), z(data.getDate())].join("-") + "T" + z(data.getHours()) + ":" + z(data.getMinutes());
}
const brl = (v: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const COR: Record<Situacao, string> = { "no-ar": "ok", agendado: "atencao", rascunho: "", encerrado: "erro" };
const VAZIO = { produto: "", estilo: "auto" as Estilo, chamada: "", inicio: "", fim: "", imagem_id: "", ordem: 0 };

export function Banners({ loja }: { loja: Loja }) {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [motor, setMotor] = useState<Set<string>>(new Set());
  const [f, setF] = useState(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("loja_banners").select("id, produto_id, chamada, estilo, inicio, fim, ativo, imagem_id, ordem").eq("loja_id", loja.id).order("ordem", { ascending: true }).order("criado_em", { ascending: false });
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

  useEffect(() => {
    let vivo = true;
    setFotos([]);
    if (!f.produto) return () => { vivo = false; };
    void (async () => {
      const { data, error } = await supabase.from("produto_imagens")
        .select("id,produto_id,url,alt_texto,principal,licenca_tipo,direitos_confirmados_em")
        .eq("loja_id", loja.id).eq("produto_id", f.produto)
        .eq("aprovada", true).is("removida_em", null)
        .order("principal", { ascending: false }).order("ordem", { ascending: true }).limit(40);
      if (vivo && !error) setFotos(((data ?? []) as Foto[]).filter(i =>
        !!i.direitos_confirmados_em || i.licenca_tipo === "propria" || i.licenca_tipo === "licenciada"));
    })();
    return () => { vivo = false; };
  }, [f.produto, loja.id]);
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const escolhido = porId.get(f.produto);
  const flashPrevia = escolhido ? ehFlash(f.estilo, escolhido.taxonomia_no_id, motor) : false;
  const fotoPrevia = fotos.find(i => i.id === f.imagem_id) ?? fotos[0] ?? null;
  const noArOuAgendado = (banners ?? []).filter((b) => b.ativo).length;

  async function salvar(publicar: boolean) {
    const erro = validarFormulario(f);
    if (erro) { setMsg({ ok: false, texto: erro }); return; }
    setOcupado(true); setMsg(null);
    if (f.imagem_id && !fotos.some(i => i.id === f.imagem_id)) {
      setOcupado(false); setMsg({ ok: false, texto: "A imagem escolhida não está mais autorizada. Selecione outra." }); return;
    }
    const payload = {
      loja_id: loja.id, produto_id: f.produto, estilo: f.estilo, chamada: f.chamada.trim() || null,
      inicio: isoDeLocal(f.inicio) ?? new Date().toISOString(), fim: isoDeLocal(f.fim),
      imagem_id: f.imagem_id || null, ordem: f.ordem, ativo: publicar,
    };
    const operacao = editando
      ? supabase.from("loja_banners").update(payload).eq("loja_id", loja.id).eq("id", editando)
      : supabase.from("loja_banners").insert(payload);
    const { error } = await operacao;
    setOcupado(false);
    if (error) setMsg({ ok: false, texto: erroBanner(error.code, error.message) });
    else {
      setMsg({ ok: true, texto: publicar ? "Campanha publicada e vinculada à página do produto." : "Rascunho salvo no Conecta.IA." });
      setF(VAZIO); setEditando(null); void carregar();
    }
  }
  function editar(b: Banner) {
    setEditando(b.id);
    setF({produto:b.produto_id,estilo:b.estilo,chamada:b.chamada ?? "",
      inicio:localDeIso(b.inicio),fim:localDeIso(b.fim),imagem_id:b.imagem_id ?? "",ordem:b.ordem ?? 0});
    setMsg(null);
    document.getElementById("conecta-editor-flash")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function cancelarEdicao() { setEditando(null); setF(VAZIO); setMsg(null); }
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
      <h1>Campanhas Flash · banners de produtos</h1>
      <p className="suave">Um banner aponta para <strong>um produto físico (SKU)</strong>. A ficha completa permanece individual e cada aplicação aprovada possui sua própria página por veículo, sem duplicar o estoque. Texto, imagem autorizada, estilo, posição e datas são editáveis aqui; preços e saldo não são alterados. Máximo de {LIMITE_ATIVOS} campanhas ativas ({noArOuAgendado} agora).</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"} role="status">{msg.texto}</p>}

      <section id="conecta-editor-flash" aria-label="Editor de banners Flash">
        <h2>{editando ? "Editar campanha" : "Novo banner Flash"}</h2>
        <div className="grade-form">
          <label>1 · Produto
            <select value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value, imagem_id: "" })}>
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
          <label>4 · Chamada (até 80 caracteres)<input maxLength={80} value={f.chamada} onChange={(e) => setF({ ...f, chamada: e.target.value })} placeholder="Ex.: Consulte o motor D4CB para HR e Bongo" /></label>
          <label>5 · Foto do produto autorizada
            <select value={f.imagem_id} onChange={e => setF({...f, imagem_id:e.target.value})}>
              <option value="">Usar imagem principal autorizada do produto</option>
              {fotos.map((i,idx)=><option value={i.id} key={i.id}>Foto {idx+1}{i.principal?" · principal":""} {i.alt_texto?.slice(0,55) ?? ""}</option>)}
            </select>
          </label>
          <label>6 · Posição na vitrine<input type="number" min={0} max={99} value={f.ordem} onChange={e=>setF({...f,ordem:Math.max(0,Math.min(99,Number(e.target.value)||0))})}/></label>
        </div>
        {escolhido && <div className="flash-editor-previa" aria-label="Prévia do banner">
          <div className="flash-editor-foto">{fotoPrevia ? <img src={fotoPrevia.url} alt={fotoPrevia.alt_texto || escolhido.nome || "Foto do produto"} /> : <span>Sem fotografia autorizada para campanha. A publicação deve aguardar a confirmação dos direitos.</span>}</div>
          <div><small>{flashPrevia?"FLASH · DESTAQUE":"BANNER · PADRÃO"}</small>
            <strong>{f.chamada.trim() || escolhido.nome}</strong>
            <span>SKU {escolhido.sku} · {brl(escolhido.preco)} (valor do Bling)</span>
            <small>O cliente abrirá a ficha nesta loja e poderá acessar as páginas individuais dos veículos com aplicação aprovada.</small>
          </div>
        </div>}
        <div className="linha">
          <button disabled={ocupado} onClick={() => void salvar(true)}>{editando?"Salvar e publicar":"Publicar"}</button>
          <button className="sec" disabled={ocupado} onClick={() => void salvar(false)}>{editando?"Salvar como rascunho":"Salvar rascunho"}</button>
          {editando && <button type="button" className="sec" onClick={cancelarEdicao}>Cancelar edição</button>}
        </div>
      </section>

      <h2>Banners</h2>
      {banners === null ? <p className="suave">Carregando…</p> : banners.length === 0 ? <p className="suave">Nenhum banner ainda.</p> : (
        <div className="rolagem">
          <table>
            <thead><tr><th>Produto</th><th>Estilo</th><th>Ordem</th><th>Período</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>{banners.map((b) => {
              const p = porId.get(b.produto_id); const s = situacao(b); const flash = p ? ehFlash(b.estilo, p.taxonomia_no_id, motor) : b.estilo === "flash";
              const texto = p?.nome && p.sku ? mensagemParaCliente(p.nome, p.sku, flash) : null;
              return (
                <tr key={b.id}>
                  <td><span className="mono">{p?.sku ?? "—"}</span> {p?.nome ?? "produto oculto"}</td>
                  <td>{flash ? "Flash" : "Padrão"}</td>
                  <td>{b.ordem ?? 0}</td>
                  <td className="mono">{new Date(b.inicio).toLocaleDateString("pt-BR")}{b.fim ? ` a ${new Date(b.fim).toLocaleDateString("pt-BR")}` : ""}</td>
                  <td><span className={`selo ${COR[s]}`}>{ROTULO_SITUACAO[s]}</span></td>
                  <td className="linha">
                    <button className="sec" onClick={() => editar(b)}>Editar</button>
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

