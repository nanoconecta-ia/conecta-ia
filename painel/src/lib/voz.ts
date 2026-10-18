// Voz no navegador: microfone (reconhecimento de fala) e leitura em voz alta (síntese). Nada é gravado nem enviado por nós.
// No Chrome o reconhecimento é feito pelo serviço do navegador (o áudio pode ir ao fornecedor dele); a tela avisa isso.
import { useCallback, useEffect, useRef, useState } from "react";

/** Limpa o texto para ser lido em voz alta: sem links, símbolos de lista/negrito nem emoji. */
export function textoParaFala(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, " link ")
    .replace(/[*_`#>~|]/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ").trim().slice(0, 1200);
}

export const MENSAGENS_ERRO: Record<string, string> = {
  "not-allowed": "O navegador bloqueou o microfone. Permita o acesso e tente de novo.",
  "service-not-allowed": "O navegador bloqueou o reconhecimento de voz.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
  "audio-capture": "Nenhum microfone foi encontrado.",
  network: "O reconhecimento de voz precisa de internet.",
  aborted: "",
};

// deno-lint-ignore no-explicit-any
const ctor = (): any => (typeof window === "undefined" ? null : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);

export function useVoz(aoTexto: (texto: string, final: boolean) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const [falando, setFalando] = useState(false);
  const [erro, setErro] = useState("");
  // deno-lint-ignore no-explicit-any
  const rec = useRef<any>(null);
  const cb = useRef(aoTexto); cb.current = aoTexto;
  const suporteMic = !!ctor();
  const suporteFala = typeof window !== "undefined" && "speechSynthesis" in window;

  const parar = useCallback(() => { try { rec.current?.stop(); } catch { /* já parado */ } }, []);
  const ouvir = useCallback(() => {
    const C = ctor(); if (!C) return;
    setErro("");
    try { window.speechSynthesis?.cancel(); } catch { /* sem síntese */ }
    const r = new C();
    r.lang = "pt-BR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    // deno-lint-ignore no-explicit-any
    r.onresult = (e: any) => {
      let t = ""; let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
      cb.current(t.trim(), final);
    };
    // deno-lint-ignore no-explicit-any
    r.onerror = (e: any) => setErro(MENSAGENS_ERRO[e.error] ?? "Não foi possível usar o microfone.");
    r.onend = () => setOuvindo(false);
    r.onstart = () => setOuvindo(true);
    rec.current = r;
    try { r.start(); } catch { setErro("Não foi possível iniciar o microfone."); }
  }, []);

  const calar = useCallback(() => { try { window.speechSynthesis?.cancel(); } catch { /* sem síntese */ } setFalando(false); }, []);
  const falar = useCallback((texto: string) => {
    if (!suporteFala) return;
    const t = textoParaFala(texto); if (!t) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "pt-BR";
      const v = window.speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("pt-br")) ?? window.speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("pt"));
      if (v) u.voice = v;
      u.onstart = () => setFalando(true); u.onend = () => setFalando(false); u.onerror = () => setFalando(false);
      window.speechSynthesis.speak(u);
    } catch { setFalando(false); }
  }, [suporteFala]);

  useEffect(() => () => { try { rec.current?.abort(); window.speechSynthesis?.cancel(); } catch { /* limpeza */ } }, []);
  return { ouvindo, falando, erro, suporteMic, suporteFala, ouvir, parar, falar, calar };
}

/** Preferência "ler respostas em voz alta" (por navegador; o armazenamento pode estar bloqueado). */
export const lerPreferenciaFala = () => { try { return localStorage.getItem("conecta.falar") === "1"; } catch { return false; } };
export const gravarPreferenciaFala = (v: boolean) => { try { localStorage.setItem("conecta.falar", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
