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
