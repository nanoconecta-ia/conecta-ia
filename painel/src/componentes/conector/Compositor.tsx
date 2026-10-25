import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Visualizador } from "../Visualizador.tsx";
import { ACEITA, classificar, MAX_ANEXOS } from "../../lib/anexos.ts";
import type { Provedor } from "../../lib/chat.ts";
import type { Capacidade, ProvedorAtivo } from "../../lib/conectorDados.ts";
import { nomeModelo } from "./ui.tsx";

const ROTULO_CAP: Record<string, string> = { chat: "Conversa", tool_calling: "Chamada de ferramentas", streaming: "Streaming por token", visao: "Visão (ler imagens)", audio_entrada: "Áudio de entrada", geracao_imagem: "Geração de imagem" };

export interface VozMin { suporteMic: boolean; ouvindo: boolean; erro: string; ouvir(): void; parar(): void }

export function Compositor({ texto, aoTexto, enviando, aoEnviar, aoCancelar, anexos, aoAnexos, provedores, provedor, aoProvedor, capacidades, voz }: {
  texto: string; aoTexto: (t: string) => void; enviando: boolean; aoEnviar: () => void; aoCancelar: () => void;
  anexos: File[]; aoAnexos: (f: File[]) => void; provedores: ProvedorAtivo[] | null; provedor: Provedor | ""; aoProvedor: (p: Provedor) => void; capacidades: Capacidade[]; voz: VozMin;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [erroAnexo, setErroAnexo] = useState("");
  const [ampliada, setAmpliada] = useState<{ url: string; nome: string } | null>(null);
  const previas = useMemo(() => anexos.map((f) => ({ f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null })), [anexos]);
  useEffect(() => () => previas.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previas]);

  function escolher(lista: FileList | null) {
    if (!lista) return;
    const novos = [...anexos]; const erros: string[] = [];
    for (const f of lista) {
      const c = classificar(f);
      if (!c.ok) erros.push(c.erro); else if (novos.length >= MAX_ANEXOS) erros.push(`No máximo ${MAX_ANEXOS} anexos por mensagem.`); else novos.push(f);
    }
    setErroAnexo(erros.join(" ")); aoAnexos(novos);
    if (entrada.current) entrada.current.value = "";
  }
  const teclas = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); aoEnviar(); } };
  const caps = capacidades.filter((c) => c.provedor === provedor);
  const semProvedor = provedores !== null && provedores.length === 0;

  return (
    <form className="compositor" onSubmit={(e: FormEvent) => { e.preventDefault(); aoEnviar(); }}>
      {previas.length > 0 && (
        <ul className="anexos" aria-label="Anexos desta mensagem">
          {previas.map((p, i) => (
            <li key={i}>
              {p.url ? <button type="button" className="sec miniatura" onClick={() => setAmpliada({ url: p.url!, nome: p.f.name })} aria-label={`Ampliar ${p.f.name}`}><img src={p.url} alt="" /></button> : <span className="selo">{p.f.name}</span>}
              <span className="suave nome-anexo">{p.f.name}</span>
              <button type="button" className="sec mini" aria-label={`Remover ${p.f.name}`} onClick={() => aoAnexos(anexos.filter((_, k) => k !== i))}>✕</button>
            </li>))}
        </ul>
      )}
      {erroAnexo && <p className="msg-erro" role="alert">{erroAnexo}</p>}
      <div className="linha-comp">
        <label className="sr" htmlFor="msg-conector">Mensagem para o Nano.ia</label>
        <textarea id="msg-conector" rows={1} maxLength={4000} value={texto} onChange={(e) => aoTexto(e.target.value)} onKeyDown={teclas}
          placeholder="Peça algo ao Nano.ia…" disabled={semProvedor} />
        <div className="botoes-comp">
          <input ref={entrada} type="file" accept={ACEITA} multiple hidden onChange={(e) => escolher(e.target.files)} />
          <button type="button" className="sec ic" onClick={() => entrada.current?.click()} aria-label="Anexar imagem ou documento" disabled={enviando || semProvedor}>📎</button>
          {voz.suporteMic && <button type="button" className="sec ic mic" aria-pressed={voz.ouvindo} aria-label={voz.ouvindo ? "Parar de ouvir" : "Falar com o Nano.ia"} onClick={() => (voz.ouvindo ? voz.parar() : voz.ouvir())} disabled={enviando || semProvedor}>🎤</button>}
          {enviando ? <button type="button" className="perigo" onClick={aoCancelar}>Cancelar</button> : <button disabled={semProvedor || (!texto.trim() && anexos.length === 0)}>Enviar</button>}
        </div>
      </div>
      {voz.erro && <p className="msg-erro" role="alert">{voz.erro}</p>}
      <div className="linha modelo">
        <label>Modelo desta conversa
          <select value={provedor} onChange={(e) => aoProvedor(e.target.value as Provedor)} disabled={enviando || !provedores?.length}>
            {provedores === null && <option value="">Carregando…</option>}
            {semProvedor && <option value="">Nenhum provedor ativo</option>}
            {provedores?.map((p) => <option key={p.provedor} value={p.provedor}>{nomeModelo(p.provedor)}{p.modelo ? ` — ${p.modelo}` : ""}{p.principal ? " (principal)" : ""}</option>)}
          </select>
        </label>
        <details className="caps"><summary>Capacidades e voz</summary>
          <div className="caps-bloco">
            {caps.length === 0 ? <p className="suave">Sem informação de capacidades.</p> : (
              <ul>{caps.map((c) => <li key={c.capacidade}>{ROTULO_CAP[c.capacidade] ?? c.capacidade}: <strong>{c.situacao === "implementado" ? "disponível" : c.situacao === "nao_implementado" ? "não implementado" : "não verificado"}</strong></li>)}</ul>)}
            <p className="aviso-voz">Enter envia; Shift+Enter quebra a linha.{voz.suporteMic ? " A voz usa o reconhecimento do navegador; no Chrome o áudio é processado pelo Google. O Conecta.IA não grava sua voz." : ""}</p>
          </div>
        </details>
      </div>
      {semProvedor && <p className="aviso">Nenhum provedor de IA ativo. <a href="#/integracoes">Cadastre uma chave em Integrações de IA</a> para conversar com o Nano.ia.</p>}
      <Visualizador url={ampliada?.url ?? null} legenda={ampliada?.nome ?? ""} aoFechar={() => setAmpliada(null)} />
    </form>
  );
}
