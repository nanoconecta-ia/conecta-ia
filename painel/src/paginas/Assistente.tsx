import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { gravarPreferenciaFala, lerPreferenciaFala, useVoz } from "../lib/voz.ts";
import { Esfera, type EstadoEsfera } from "../componentes/Esfera.tsx";

type Msg = { de: "eu" | "ia"; texto: string };
const SUGESTOES = ["Resumo da loja", "O que está pendente?", "Produtos incompletos", "Bling conectado?"];

export function Assistente({ loja }: { loja: Loja }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "ia", texto: "Olá! Posso resumir a loja, mostrar o que aguarda aprovação e o que falta para publicar. Para conversar com IA e usar plugins, configure um provedor em Integrações de IA." }]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lerAlto, setLerAlto] = useState(lerPreferenciaFala);
  const fim = useRef<HTMLDivElement>(null);
  const msgsRef = useRef(msgs); msgsRef.current = msgs;
  const lerAltoRef = useRef(lerAlto); lerAltoRef.current = lerAlto;

  async function enviar(t: string) {
    if (!t.trim() || ocupado) return;
    const historico = msgsRef.current.slice(1); // a saudação inicial não faz parte da conversa
    setMsgs((m) => [...m, { de: "eu", texto: t }]); setTexto(""); setOcupado(true);
    const { data, error } = await supabase.functions.invoke("assistente", { body: { loja_id: loja.id, acao: "perguntar", texto: t, historico } });
    setOcupado(false);
    const resposta = error ? "Não consegui responder agora." : String(data?.resposta ?? "");
    setMsgs((m) => [...m, { de: "ia", texto: resposta }]);
    if (lerAltoRef.current) voz.falar(resposta);
  }
  // microfone: o texto vai aparecendo no campo; quando a fala termina, envia sozinho
  const voz = useVoz((t, final) => { setTexto(t); if (final && t) void enviar(t); });
  useEffect(() => { fim.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs.length]);

  const estado: EstadoEsfera = voz.ouvindo ? "ouvindo" : ocupado ? "pensando" : voz.falando ? "falando" : "parado";
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void enviar(texto); };
  const alternarFala = () => { const v = !lerAlto; setLerAlto(v); gravarPreferenciaFala(v); if (!v) voz.calar(); };

  return (
    <div className="cartao">
      <div className="agente"><Esfera estado={estado} /><div><h1 style={{ margin: 0 }}>Assistente</h1><span className="estado" aria-live="polite">{{ parado: "Pronto para ajudar", ouvindo: "Ouvindo você…", pensando: "Pensando…", falando: "Falando…" }[estado]}</span></div></div>
      <div className="chat" aria-live="polite">{msgs.map((m, i) => <div key={i} className={`bolha ${m.de}`}>{m.texto}</div>)}<div ref={fim} /></div>
      <p className="linha">{SUGESTOES.map((s) => <button key={s} className="sec" disabled={ocupado} onClick={() => void enviar(s)}>{s}</button>)}</p>
      <form onSubmit={onSubmit} style={{ maxWidth: "none" }}>
        <div className="linha-voz">
          <label>Pergunte<input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} /></label>
          {voz.suporteMic && <button type="button" className="sec mic" aria-pressed={voz.ouvindo} aria-label={voz.ouvindo ? "Parar de ouvir" : "Falar com o assistente"} onClick={() => (voz.ouvindo ? voz.parar() : voz.ouvir())} disabled={ocupado}>🎤</button>}
          <button disabled={ocupado}>Enviar</button>
        </div>
        {voz.erro && <p className="msg-erro">{voz.erro}</p>}
        {voz.suporteFala && <label className="linha" style={{ display: "flex" }}><input type="checkbox" style={{ width: "auto", minHeight: "auto" }} checked={lerAlto} onChange={alternarFala} /> Ler as respostas em voz alta</label>}
        {(voz.suporteMic || voz.suporteFala) && <p className="aviso-voz">A voz usa o reconhecimento do próprio navegador; no Chrome o áudio é processado pelo Google. Nada é gravado pelo Conecta.IA.</p>}
        {!voz.suporteMic && <p className="aviso-voz">Este navegador não oferece microfone para sites. Use o campo de texto.</p>}
      </form>
    </div>
  );
}
