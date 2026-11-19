import { useState } from "react";
import { arquivosDeDescoberta, textoParaApresentar } from "../lib/apresentarConecta.ts";

/** Apresentação para colar num chat. Não gera chave nem solicita credencial. */
export function ApresentarConecta() {
  const [mensagem, setMensagem] = useState("");
  const urlAtual = typeof window === "undefined" ? "https://nanoconecta-ia.github.io/conecta-ia/" : window.location.href;
  const recursos = arquivosDeDescoberta(urlAtual);
  const apresentacao = textoParaApresentar(urlAtual);

  async function copiar(conteudo: string, descricao: string) {
    try {
      await navigator.clipboard.writeText(conteudo);
      setMensagem(descricao + " copiado. Cole no outro chat.");
    } catch {
      setMensagem("A cópia automática foi bloqueada. Selecione e copie o texto na caixa abaixo.");
    }
  }

  return <section className="cartao" aria-labelledby="apresentar-conecta-titulo">
    <h2 id="apresentar-conecta-titulo">Apresentar Conecta.IA para outra IA</h2>
    <p>Quer testar com DeepSeek, Qwen, Claude ou ChatGPT? Toque no botão e cole a mensagem no chat escolhido. <strong>Não é necessário abrir o OpenAPI.</strong></p>
    <button type="button" onClick={() => void copiar(apresentacao, "Apresentação")} aria-label="Copiar apresentação do Conecta.IA para outro chat">Copiar para outro chat</button>
    {mensagem && <p role="status" className="suave">{mensagem}</p>}
    <details style={{ marginTop: 14 }}>
      <summary>Ver o texto para copiar manualmente</summary>
      <label htmlFor="conecta-texto-apresentacao">Mensagem de apresentação (sem senhas ou tokens)</label>
      <textarea id="conecta-texto-apresentacao" readOnly value={apresentacao} rows={9} style={{ width: "100%", maxWidth: "100%", resize: "vertical" }} onFocus={(e) => e.currentTarget.select()} />
    </details>
    <details style={{ marginTop: 12 }}>
      <summary>Conexão técnica MCP e OpenAPI (opcional)</summary>
      <p className="suave">Esses links abrem documentos técnicos JSON; eles não são a mensagem para colar no chat.</p>
      <button type="button" className="sec" onClick={() => void copiar(recursos.mcp, "Endereço MCP")}>Copiar endereço MCP</button>
      <p><a href={recursos.openapi} target="_blank" rel="noopener noreferrer">Abrir descrição OpenAPI (JSON)</a></p>
      <p><a href={recursos.manifesto} target="_blank" rel="noopener noreferrer">Abrir manifesto de capacidades (JSON)</a></p>
    </details>
    <p className="suave">Importante: colar a mensagem não conecta automaticamente a IA. Acesso operacional exige suporte do outro chat e autorização por loja. Não compartilhe chaves aqui.</p>
  </section>;
}
