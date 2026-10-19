import { useState } from "react";
import { ir } from "../lib/rota.ts";
import { URL_GATEWAY } from "../lib/pair.ts";
import { PASSOS_CONECTOR, PRE_AJUSTES, REGRAS_DO_AGENTE } from "../lib/meuAgente.ts";

/** Hub "Conectar meu agente": chat premium próprio (QR/conector) ou sistema integrado. Não guarda segredo: reaproveita Parear, Dispositivos e Integrações. */
export function MeuAgente() {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => { try { await navigator.clipboard.writeText(URL_GATEWAY); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); } };
  return (
    <div className="cartao">
      <h1>Conectar meu agente</h1>
      <p className="suave">Use o seu próprio chat, como no WhatsApp Business: você liga uma vez, ele consulta o Conecta e sugere melhorias, e você aprova.</p>

      <h2>1. Meu chat premium (conector / QR)</h2>
      <p className="suave">Sem chave de API: o chat usa a sua conta. A compatibilidade depende de o seu chat aceitar conectores personalizados; confira na conta dele antes de contar com isso.</p>
      <ol>{PASSOS_CONECTOR.map((p) => <li key={p}>{p}</li>)}</ol>
      <p className="suave">Endereço do gateway: <code>{URL_GATEWAY}</code></p>
      <div className="linha">
        <button className="sec" onClick={() => void copiar()}>{copiado ? "Copiado" : "Copiar endereço"}</button>
        <button onClick={() => ir("/parear")}>Parear com QR</button>
        <button className="sec" onClick={() => ir("/aprovacoes")}>Ver pedidos de acesso</button>
        <button className="sec" onClick={() => ir("/dispositivos")}>Agentes conectados</button>
      </div>

      <h2>2. Agente integrado da plataforma</h2>
      <p className="suave">Se você não tem chat premium, o agente convencional da plataforma faz o trabalho. Escolha o perfil de custo; o nome do modelo é gravado em Integrações de IA.</p>
      <div className="linha">
        {PRE_AJUSTES.map((p) => (
          <div key={p.id} className="cartao" style={{ margin: "8px 0" }}>
            <p><strong>{p.rotulo}</strong></p>
            <p className="suave">{p.descricao}</p>
            <p className="suave">Modelo sugerido: <code>{p.modelo}</code></p>
          </div>
        ))}
      </div>
      <div className="linha"><button className="sec" onClick={() => ir("/integracoes")}>Configurar em Integrações de IA</button></div>

      <h2>Regras que valem para qualquer agente</h2>
      <ul>{REGRAS_DO_AGENTE.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}
