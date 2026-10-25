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

/** Fala natural: valores, unidades e siglas lidos como uma pessoa leria (o texto da tela não muda). */
export function textoParaFalaNatural(s: string): string {
  return textoParaFala(s)
    .replace(/R\$\s*(\d[\d.]*)(?:,(\d{2}))?/g, (_m, i: string, c?: string) => `${i} reais${c && c !== "00" ? ` e ${Number(c)} centavos` : ""}`)
    .replace(/(\d)\s*%/g, "$1 por cento")
    .replace(/(\d)\s*mm\b/gi, "$1 milímetros")
    .replace(/(\d)\s*kg\b/gi, "$1 quilos")
    .replace(/\bNCM\b/g, "N C M").replace(/\bGTIN\b/g, "gêtin").replace(/\bSKU\b/g, "S K U")
    .replace(/\s+/g, " ").trim();
}

/** Quebra em frases curtas: o navegador respira entre elas (soa como pessoa) e não corta falas longas. */
export function dividirParaFala(texto: string, max = 180): string[] {
  const frases = texto.match(/[^.!?;:\n]+[.!?;:]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [];
  const saida: string[] = [];
  for (const f of frases) {
    if (f.length <= max) { saida.push(f); continue; }
    let resto = f;
    while (resto.length > max) { const corte = resto.lastIndexOf(" ", max); const i = corte > 40 ? corte : max; saida.push(resto.slice(0, i).trim()); resto = resto.slice(i).trim(); }
    if (resto) saida.push(resto);
  }
  return saida;
}

export interface VozInfo { name: string; lang: string; localService?: boolean; voiceURI?: string }
/** Nota de naturalidade: vozes neurais/online e as do próprio sistema moderno ganham das vozes sintéticas "compactas". */
export function notaDaVoz(v: VozInfo): number {
  const n = v.name.toLowerCase(); const l = (v.lang ?? "").toLowerCase().replace("_", "-");
  if (!l.startsWith("pt")) return -1000;
  let nota = l === "pt-br" ? 100 : 20;
  if (/natural|neural|online|premium|enhanced|aprimorad/.test(n)) nota += 80;
  if (/google/.test(n)) nota += 40;
  if (/francisca|antonio|thalita|luciana|felipe|fernanda|joana|giovanna|vit[oó]ria|ricardo/.test(n)) nota += 30;
  if (/espeak|compact|mbrola|festival/.test(n)) nota -= 90;
  return nota;
}
export function escolherVoz<T extends VozInfo>(vozes: T[], preferida?: string | null): T | undefined {
  const por = preferida ? vozes.find((v) => (v.voiceURI ?? v.name) === preferida) : undefined;
  if (por && notaDaVoz(por) > -1000) return por;
  return [...vozes].filter((v) => notaDaVoz(v) > -1000).sort((a, b) => notaDaVoz(b) - notaDaVoz(a))[0];
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
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([]);
  const [vozEscolhida, setVozEscolhida] = useState<string | null>(lerVozPreferida);
  useEffect(() => {
    if (!suporteFala) return;
    const ler = () => setVozes(window.speechSynthesis.getVoices().filter((v) => notaDaVoz(v) > -1000));
    ler(); window.speechSynthesis.addEventListener?.("voiceschanged", ler);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", ler);
  }, [suporteFala]);
  const escolherVozPreferida = useCallback((id: string | null) => { setVozEscolhida(id); gravarVozPreferida(id); }, []);

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
    const frases = dividirParaFala(textoParaFalaNatural(texto)); if (!frases.length) return;
    try {
      window.speechSynthesis.cancel();
      const v = escolherVoz(window.speechSynthesis.getVoices(), vozEscolhida);
      frases.forEach((f, i) => {
        const u = new SpeechSynthesisUtterance(f);
        u.lang = v?.lang ?? "pt-BR"; if (v) u.voice = v;
        u.rate = 1; u.pitch = 1;
        if (i === 0) u.onstart = () => setFalando(true);
        if (i === frases.length - 1) u.onend = () => setFalando(false);
        u.onerror = () => setFalando(false);
        window.speechSynthesis.speak(u);
      });
    } catch { setFalando(false); }
  }, [suporteFala, vozEscolhida]);

  useEffect(() => () => { try { rec.current?.abort(); window.speechSynthesis?.cancel(); } catch { /* limpeza */ } }, []);
  return { ouvindo, falando, erro, suporteMic, suporteFala, ouvir, parar, falar, calar, vozes, vozEscolhida, escolherVozPreferida };
}

/** Preferência "ler respostas em voz alta" (por navegador; o armazenamento pode estar bloqueado). */
export const lerPreferenciaFala = () => { try { return localStorage.getItem("conecta.falar") === "1"; } catch { return false; } };
export const gravarPreferenciaFala = (v: boolean) => { try { localStorage.setItem("conecta.falar", v ? "1" : "0"); } catch { /* sem armazenamento */ } };

/** Voz escolhida pelo usuário (por navegador). */
export function lerVozPreferida(): string | null { try { return localStorage.getItem("conecta.voz"); } catch { return null; } }
export function gravarVozPreferida(v: string | null) { try { if (v) localStorage.setItem("conecta.voz", v); else localStorage.removeItem("conecta.voz"); } catch { /* sem armazenamento */ } }
