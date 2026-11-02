import { ir } from "../lib/rota.ts";
import { REGRAS_DO_AGENTE } from "../lib/meuAgente.ts";

/** Hub "Conectar meu agente": mostra só o que é real e publicado (Gateway MCP). QR e agente integrado ocultos até verificação; sem nome de modelo de IA na tela do lojista. */
export function MeuAgente() {
  return (
    <div className="cartao">
      <h1>Conectar meu agente</h1>
      <p className="suave">Use o seu próprio chat, como no WhatsApp Business: você liga uma vez, ele consulta o Conecta e sugere melhorias, e você aprova.</p>

      <h2>Conexão real disponível</h2>
      <p className="suave">Por enquanto, a única conexão de agente externo que está publicada e pode ser usada é a do <strong>Gateway MCP</strong>, com chave exclusiva da loja, só consulta (ou consulta e propostas) e escrita no Bling bloqueada.</p>
      <div className="linha"><button onClick={() => ir("/gateway")}>Abrir Gateway MCP</button><button className="sec" onClick={() => ir("/dispositivos")}>Agentes conectados</button></div>
      <p className="suave">O pareamento por QR e o agente integrado com perfis de custo ficam ocultos até serem verificados na prática.</p>

      <h2>Regras que valem para qualquer agente</h2>
      <ul>{REGRAS_DO_AGENTE.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}
