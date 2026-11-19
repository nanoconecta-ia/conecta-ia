import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { destinoPainel, entradaAdministrativa } from "./lib/lojaHost.ts";
import { SpriteIcones } from "./componentes/SpriteIcones.tsx";
import { aplicarTema, armazemLocal, lerPreferencia } from "./lib/tema.ts";
import { aplicarOrbe, lerOrbe } from "./lib/orbe.ts";
import { aplicarPerfil, lerPerfil } from "./lib/perfilCor.ts";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";

// Entrada da loja (index.html) com rota do painel: vai para conecta.html antes de pintar, para o app Mobis e o app Conecta.IA não se misturarem.
const paraPainel = destinoPainel(window.location.hostname, window.location.pathname, window.location.hash, window.location.search);
if (paraPainel) window.location.replace(paraPainel);

// Preferências internas são exclusivas do painel. No localhost, a raiz é a entrada
// administrativa legada dos testes; rotas públicas de demonstração continuam independentes.
const raizAdminLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && !/^#\/(?:loja|a|p|demo)(?:\/|$)/.test(window.location.hash);
if (entradaAdministrativa(window.location.pathname) || raizAdminLocal) {
  aplicarTema(lerPreferencia(armazemLocal()));
  aplicarOrbe(lerOrbe(armazemLocal()));
  aplicarPerfil(lerPerfil(armazemLocal()));
}

if (!paraPainel) createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <SpriteIcones />
    <App />
  </StrictMode>,
);

// App instalável: registra o service worker só no build de produção (em desenvolvimento ele atrapalharia o recarregamento).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Cada app tem seu próprio registro e escopo; /conecta.html nunca usa a casca da vitrine.
    const painel = entradaAdministrativa(window.location.pathname);
    const script = painel ? "./sw-conecta.js" : "./sw.js";
    const scope = painel ? "./conecta.html" : "./";
    navigator.serviceWorker.register(script, { scope }).catch(() => {
      /* sem service worker a página continua funcionando; não força cache ou alteração de sessão */
    });
  });
}
