import { useEffect, useRef, useState, type FormEvent } from "react";
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICAVEL } from "../config.ts";
import { useVoz } from "../lib/voz.ts";
import { MOBIS } from "../lib/publicoLoja.ts";
import { FichaProduto } from "../componentes/FichaProduto.tsx";
import { RodapeLoja, type PoliticasLojaPublicas } from "../componentes/RodapeLoja.tsx";
import type { FichaProduto as Produto, FichaVeiculo } from "../lib/ficha.ts";

/** Página pública do produto (#/p/<loja>/<sku>) com o assistente para o cliente (texto ou voz). Só lê dado aprovado e publicado. */
export function ProdutoPublico({ slug, sku }: { slug: string; sku: string }) {
  const [msgs, setMsgs] = useState<{ de: "eu" | "ia"; texto: string }[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lerAlto, setLerAlto] = useState(false);
  const lerRef = useRef(lerAlto); lerRef.current = lerAlto;
  const [ficha, setFicha] = useState<{ produto: Produto; veiculos: FichaVeiculo[] } | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [cabecalho, setCabecalho] = useState<{ nome:string; whatsapp:string | null; politicas: PoliticasLojaPublicas | null; fase:string } | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`${SUPABASE_URL}/functions/v1/loja-publica`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL }, body: JSON.stringify({ slug, sku, q: sku }),
    }).then((r) => r.json()).then((j) => {
      const produto = (j?.produtos ?? []).find((p: Produto) => p.sku === sku);
      if (vivo && j?.loja?.slug === slug) setCabecalho({
        nome: j.loja.nome ?? slug,
        whatsapp: typeof j.loja.whatsapp === "string" ? j.loja.whatsapp : null,
        politicas: j.politicas ?? null,
        fase: j.loja.ambiente ?? "teste",
      });
      if (!vivo) return;
      if (produto && j?.ficha) setFicha({ produto, veiculos: j.ficha.veiculos ?? [] });
      setWhatsapp(typeof produto?.whatsapp === "string" && /^https:\/\/wa\.me\/55\d{10,11}\?text=/.test(produto.whatsapp) ? produto.whatsapp : null);
    }).catch(() => undefined); // sem ficha, a página segue só com o assistente
    return () => { vivo = false; };
  }, [slug, sku]);

  async function perguntar(t: string) {
    t = t.trim(); if (!t || ocupado) return;
    setMsgs((m) => [...m, { de: "eu", texto: t }]); setTexto(""); setOcupado(true);
    let resposta = "Não consegui responder agora.";
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/vitrine-assistente`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CHAVE_PUBLICAVEL },
        body: JSON.stringify({ slug, sku, pergunta: t }),
      });
      const j = await r.json().catch(() => ({}));
      resposta = r.status === 429 ? "Muitas perguntas seguidas. Aguarde um instante e pergunte de novo." : String(j.resposta ?? resposta);
    } catch { /* mantém a mensagem padrão */ }
    setMsgs((m) => [...m, { de: "ia", texto: resposta }]); setOcupado(false);
    if (lerRef.current) voz.falar(resposta);
  }
  const voz = useVoz((t, final) => { setTexto(t); if (final && t) void perguntar(t); });
  const enviar = (e: FormEvent) => { e.preventDefault(); void perguntar(texto); };

  return (
    <>
    <main className="v-produto-detalhe">
      <nav aria-label="Voltar à loja e privacidade" className="v-produto-nav">
        <a href={"#/loja/" + encodeURIComponent(slug)}>Voltar ao catálogo</a>
        <button type="button" onClick={() => document.getElementById("rodape-privacidade")?.scrollIntoView({behavior:"smooth"})}>Privacidade e políticas</button>
      </nav>
      {ficha ? <FichaProduto produto={ficha.produto} veiculos={ficha.veiculos} /> :
        <p className="suave">Ficha comercial não disponível. Produtos e aplicações só aparecem depois de aprovados e publicados.</p>}
      <div className="cartao">
        <div className="agente"><div><h1 style={{ margin: 0 }}>Atendimento da loja — tire suas dúvidas sobre esta peça</h1>
          <p className="suave" style={{ margin: 0 }}>Código <span className="mono">{sku}</span>. O assistente só informa dados confirmados pela loja.</p></div></div>
        <div className="chat" aria-live="polite">{msgs.map((m, i) => <div key={i} className={`bolha ${m.de}`}>{m.texto}</div>)}</div>
        <form onSubmit={enviar} style={{ maxWidth: "none" }}>
          <div className="linha-voz">
            <label>Sua pergunta<input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} placeholder="Ex.: serve no meu veículo? quanto custa?" /></label>
            {voz.suporteMic && <button type="button" className="sec mic" aria-pressed={voz.ouvindo} aria-label={voz.ouvindo ? "Parar de ouvir" : "Perguntar por voz"} onClick={() => (voz.ouvindo ? voz.parar() : voz.ouvir())} disabled={ocupado}>🎤</button>}
            <button disabled={ocupado}>Perguntar</button>
          </div>
          {voz.erro && <p className="msg-erro">{voz.erro}</p>}
          {voz.suporteFala && <label className="linha" style={{ display: "flex" }}><input type="checkbox" style={{ width: "auto", minHeight: "auto" }} checked={lerAlto} onChange={(e) => { setLerAlto(e.target.checked); if (!e.target.checked) voz.calar(); }} /> Ler a resposta em voz alta</label>}
          {voz.suporteMic && <p className="aviso-voz">O reconhecimento de voz depende do navegador e pode usar serviços externos. Não envie dados pessoais ou informações de pagamento. O atendimento desta página não emite pedidos.</p>}
        </form>
        <p className="suave">Este chat utiliza informações do catálogo publicado. Para confirmar compatibilidade, preço e disponibilidade, fale com a equipe.</p>
        {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="ficha-wa">Conversar com vendedor no WhatsApp</a>}
        {slug === MOBIS.slug && <p className="suave"><a href={MOBIS.site}>mobisautopecas.com.br — site oficial</a></p>}
      </div>
    </main>
    <RodapeLoja nome={cabecalho?.nome ?? (slug === MOBIS.slug ? MOBIS.nome : slug)} slug={slug}
      whatsapp={cabecalho?.whatsapp} politicas={cabecalho?.politicas ?? null} paginaProduto />
    </>
  );
}
