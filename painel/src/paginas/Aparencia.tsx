import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";

async function mensagem(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}
// Os mesmos perfis do servidor (_shared/loja/tema.ts); o servidor é quem valida o contraste e grava.
const PERFIS: Record<string, { nome: string; primaria: string; destaque: string; bloco: string }> = {
  azul_conecta: { nome: "Azul Conecta (padrão)", primaria: "#0864a0", destaque: "#04a88d", bloco: "#102335" },
  grafite_laranja: { nome: "Grafite e laranja", primaria: "#b34700", destaque: "#ff8a1f", bloco: "#1f2933" },
  verde_floresta: { nome: "Verde floresta", primaria: "#1b6b3a", destaque: "#f2b01e", bloco: "#0f2a1a" },
  vinho: { nome: "Vinho", primaria: "#8e1b3a", destaque: "#e0a526", bloco: "#2a0f18" },
};
const FONTES: [string, string][] = [["inter", "Inter (padrão)"], ["sistema", "Fonte do sistema do cliente"], ["serifada", "Serifada (Georgia)"]];
type Tema = { perfil: string; cor_primaria: string; cor_destaque: string; cor_bloco: string; fonte: string; logo_url: string | null; icone_url: string | null };

function lerComoBase64(f: File): Promise<string> {
  return new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(new Error("leitura")); r.readAsDataURL(f); });
}

export function Aparencia({ loja }: { loja: Loja }) {
  const [tema, setTema] = useState<Tema | null>(null);
  const [perfil, setPerfil] = useState("azul_conecta");
  const [cores, setCores] = useState({ primaria: "#0864a0", destaque: "#04a88d", bloco: "#102335" });
  const [fonte, setFonte] = useState("inter");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null); const iconeRef = useRef<HTMLInputElement>(null);

  const carregar = () => supabase.from("loja_tema").select("perfil, cor_primaria, cor_destaque, cor_bloco, fonte, logo_url, icone_url").eq("loja_id", loja.id).maybeSingle().then(({ data }) => {
    const t = data as Tema | null; setTema(t);
    if (t) { setPerfil(t.perfil); setFonte(t.fonte); setCores({ primaria: t.cor_primaria, destaque: t.cor_destaque, bloco: t.cor_bloco }); }
  });
  useEffect(() => { void carregar(); }, [loja.id]);

  async function chamar(corpo: Record<string, unknown>, ok: string) {
    setOcupado(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("loja-tema", { body: { loja_id: loja.id, ...corpo } });
    setOcupado(false);
    if (error) { setMsg({ ok: false, texto: await mensagem(error, "Não foi possível concluir.") }); return false; }
    setMsg({ ok: true, texto: (data as { mensagem?: string })?.mensagem ?? ok }); void carregar(); return true;
  }
  const escolherPerfil = (p: string) => { setPerfil(p); if (p in PERFIS) setCores({ primaria: PERFIS[p].primaria, destaque: PERFIS[p].destaque, bloco: PERFIS[p].bloco }); };
  const salvar = (e: FormEvent) => { e.preventDefault(); void chamar({ acao: "salvar", perfil, fonte, ...cores }, "Aparência salva."); };
  async function enviar(tipo: "logo" | "icone", arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > 512 * 1024) { setMsg({ ok: false, texto: "A imagem tem mais de 512 KB." }); return; }
    void chamar({ acao: "enviar_imagem", tipo, dados: await lerComoBase64(arquivo) }, tipo === "logo" ? "Logo enviado." : "Ícone enviado.");
  }
  const campoCor = (k: keyof typeof cores, rotulo: string) => (
    <label>{rotulo}<span className="linha"><input type="color" value={cores[k]} disabled={perfil !== "personalizado"} onChange={(e) => setCores({ ...cores, [k]: e.target.value })} style={{ width: 56, padding: 2 }} aria-label={rotulo} /><code>{cores[k]}</code></span></label>
  );
  const vars = { ["--marca" as string]: cores.primaria, ["--verde" as string]: cores.destaque, ["--grafite" as string]: cores.bloco };

  return (
    <div className="cartao">
      <h1>Aparência da loja</h1>
      <p className="suave">Só a loja pública muda. O painel mantém a identidade Conecta.IA. O sistema recusa cores com pouco contraste para o texto continuar legível.</p>
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"}>{msg.texto}</p>}
      <form onSubmit={salvar}>
        <label>Perfil de cores<select value={perfil} onChange={(e) => escolherPerfil(e.target.value)}>{Object.entries(PERFIS).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}<option value="personalizado">Personalizado</option></select></label>
        {campoCor("primaria", "Cor primária (botões e títulos)")}
        {campoCor("destaque", "Cor de destaque (WhatsApp e busca)")}
        {campoCor("bloco", "Cor do bloco de abertura")}
        <label>Fonte<select value={fonte} onChange={(e) => setFonte(e.target.value)}>{FONTES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <div className="linha"><button disabled={ocupado}>Salvar aparência</button><a className="botao sec" href={`#/loja/${loja.slug}`} target="_blank" rel="noopener noreferrer" style={{ background: "transparent", color: "var(--texto)", border: "1px solid var(--borda)" }}>Ver a loja</a></div>
      </form>

      <div className="v-hero" style={{ ...vars, marginTop: 12, fontFamily: fonte === "serifada" ? "Georgia,serif" : fonte === "sistema" ? "system-ui,sans-serif" : undefined }}>
        <strong style={{ fontSize: "1.2rem" }}>Prévia</strong>
        <span>Encontre a peça correta</span>
        <span className="linha"><button type="button" style={{ background: cores.primaria, color: "#fff" }}>Botão primário</button><button type="button" className="verde" style={{ background: cores.destaque }}>Falar no WhatsApp</button></span>
      </div>

      <h2>Logo e ícone</h2>
      <p className="suave">PNG, WebP ou JPEG de até 512 KB (SVG não é aceito por segurança). O logo aparece no cabeçalho da loja; o ícone aparece na aba do navegador (use imagem quadrada).</p>
      <div className="grade">
        {([["logo", "Logo", tema?.logo_url, logoRef], ["icone", "Ícone", tema?.icone_url, iconeRef]] as const).map(([tipo, nome, url, ref]) => (
          <div key={tipo} className="cartao">
            <strong>{nome}</strong>
            <div style={{ minHeight: 64, display: "grid", placeItems: "center", background: "var(--realce)", borderRadius: 10, margin: "8px 0" }}>{url ? <img src={url} alt={nome} style={{ maxHeight: 64, maxWidth: "100%" }} /> : <span className="suave">Sem {nome.toLowerCase()}</span>}</div>
            <input ref={ref} type="file" accept="image/png,image/webp,image/jpeg" className="sr" onChange={(e) => { void enviar(tipo, e.target.files?.[0]); e.target.value = ""; }} aria-label={`Enviar ${nome.toLowerCase()}`} />
            <div className="linha"><button type="button" className="sec" disabled={ocupado} onClick={() => ref.current?.click()}>{url ? "Trocar" : "Enviar"}</button>{url && <button type="button" className="sec" disabled={ocupado} onClick={() => void chamar({ acao: "remover_imagem", tipo }, `${nome} removido.`)}>Remover</button>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
