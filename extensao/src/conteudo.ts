// Script injetado na aba do ERP SOMENTE depois que o lojista concede permissão para aquele site (botão "Ler esta tela").
// Expõe uma função de leitura no mundo isolado da extensão; não altera a página nem conversa com servidor nenhum.
import { lerCampos } from "./leitura.ts";
import { lerCamposDoDocumento } from "./leitor-dom.ts";

declare global { interface Window { __nanoGuardiaoLer?: () => { origem: string; caminho: string; titulo: string; campos: ReturnType<typeof lerCampos> } } }

window.__nanoGuardiaoLer = () => ({
  origem: location.origin,
  caminho: location.pathname,   // sem query/hash: podem carregar ids e tokens
  titulo: document.title.slice(0, 160),
  campos: lerCampos(lerCamposDoDocumento(document)),
});
