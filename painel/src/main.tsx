import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { SpriteIcones } from "./componentes/SpriteIcones.tsx";
import { aplicarTema, armazemLocal, lerPreferencia } from "./lib/tema.ts";
import "@fontsource-variable/inter";
import "./styles.css";

aplicarTema(lerPreferencia(armazemLocal())); // antes de pintar: sem piscar o tema errado

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
