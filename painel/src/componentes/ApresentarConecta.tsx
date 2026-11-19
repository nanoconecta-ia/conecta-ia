import { useState } from "react";
import { arquivosDeDescoberta, textoParaApresentar } from "../lib/apresentarConecta.ts";

export function ApresentarConecta() {
  const [mensagem, setMensagem] = useState("");
  const urlAtual = typeof window === "undefined" ? "https://nanoconecta-ia.github.io/conecta-ia/" : window.location.href;
  const recursos = arquivosDeDescoberta(urlAtual);

  async function copiar(conteudo: string, descricao: string) {
    try {
      await navigator.clipboard.writeText(conteudo);
      setMensagem(descricao + " copiado. Nenhuma credencial foi incluída.");
    } catch {
      setMensagem("A cópia automática não está disponível neste navegador. Abra o documento abaixo e copie o endereço.");
    }
  }

  return <section className="cartao" aria-labelledby="apresentar-conecta-titulo">
    <h2 id="apresentar-conecta-titulo">Apresentar Conecta.IA a outro agente</h2>
    <p className="suave">Use a mesma apresentação com ChatGPT, Claude, DeepSeek, Qwen ou outro modelo. Ela informa o que o aplicativo faz; o acesso operacional depende de ferramentas externas e autorização.</p>
    <div className="grade tres">
      <div>
        <h3>1. Copiar apresentação</h3>
        <p className="suave">Para colar em qualquer conversa, mesmo quando o chat não aceita MCP.</p>
        <button type="button" onClick={() => void copiar(textoParaApresentar(urlAtual), "Apresentação")}>Copiar apresentação</button>
      </div>
      <div>
        <h3>2. Conector MCP</h3>
        <p className="suave">Para clientes com conexão remota MCP ou HTTP JSON-RPC.</p>
        <button type="button" className="sec" onClick={() => void copiar(recursos.mcp, "Endereço MCP")}>Copiar endereço MCP</button>
      </div>
      <div>
        <h3>3. API para agentes</h3>
        <p className="suave">Documentação pública da interface HTTP existente; não cria novo endpoint de escrita.</p>
        <p><a href={recursos.openapi} target="_blank" rel="noopener noreferrer">Abrir OpenAPI (JSON)</a></p>
        <p><a href={recursos.manifesto} target="_blank" rel="noopener noreferrer">Abrir manifesto de capacidades</a></p>
      </div>
    </div>
    {mensagem && <p role="status" className="suave">{mensagem}</p>}
    <p className="suave"><strong>Limite atual:</strong> A2A é uma etapa futura; não há endpoint A2A funcional anunciado. Chats sem ferramentas podem ler a apresentação, mas não executar comandos. Não envie tokens no chat; configure a autenticação somente no cliente autorizado.</p>
  </section>;
}
