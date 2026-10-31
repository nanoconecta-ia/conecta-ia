import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VitrineDemo } from "./paginas/VitrineDemo.tsx";
import "@fontsource-variable/inter";
import "./styles.css";

// Ponto de entrada exclusivo da homologação Cloudflare.
// NÃO importar App, supabase, autenticação ou ferramentas do Bling.
// A VitrineDemo usa apenas itens fictícios, definidos localmente.
createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <div role="status" style={{ background: "#182437", color: "#fff", padding: "12px 20px", fontWeight: 700, textAlign: "center" }}>
      AMBIENTE DE HOMOLOGAÇÃO · DADOS FICTÍCIOS · SEM ACESSO AO BLING/SUPABASE · NÃO REALIZAR VENDAS
    </div>
    <VitrineDemo />
  </StrictMode>,
);
