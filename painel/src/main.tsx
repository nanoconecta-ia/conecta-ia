import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { SpriteIcones } from "./componentes/SpriteIcones.tsx";
import { aplicarTema, armazemLocal, lerPreferencia } from "./lib/tema.ts";
import { aplicarOrbe, lerOrbe } from "./lib/orbe.ts";
import { aplicarPerfil, lerPerfil } from "./lib/perfilCor.ts";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";

aplicarTema(lerPreferencia(armazemLocal())); // antes de pintar: sem piscar o tema errado
aplicarOrbe(lerOrbe(armazemLocal())); // modelo da esfera do Nano.IA escolhido neste aparelho
aplicarPerfil(lerPerfil(armazemLocal())); // perfil de cor: o painel e a esfera mudam juntos

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <SpriteIcones />
    <App />
  </StrictMode>,
);

// App instalável: registra o service worker só no build de produção (em desenvolvimento ele atrapalharia o recarregamento).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => { /* sem service worker o site continua funcionando; só não abre offline */ }); });
}
