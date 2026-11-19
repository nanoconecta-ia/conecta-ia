import { useState } from "react";
import { gerarPromptCadastro, validarCadastroExterno, type ResultadoCadastro } from "../lib/cadastroExterno.ts";

/** Etapa de entrada SOMENTE LOCAL. Nunca envia texto ao backend, ERP ou serviços externos. */
export function CadastroImportado() {
  const [sku, setSku] = useState("");
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoCadastro | null>(null);
  const [aviso, setAviso] = useState("");

  async function copiar(valor: string, nome: string) {
    try { await navigator.clipboard.writeText(valor); setAviso(nome + " copiado."); }
    catch { setAviso("Cópia automática indisponível. Selecione o texto na caixa correspondente."); }
  }

  return <section className="cartao" aria-labelledby="titulo-importar-cadastro">
    <h2 id="titulo-importar-cadastro">Colar cadastro preparado por outra IA</h2>
    <p className="suave">Etapa de teste: o Conecta.IA lê o JSON somente neste navegador, verifica campos permitidos e monta uma prévia. <strong>Nada é gravado no Conecta.IA, no Bling ou na loja.</strong></p>
    <details>
      <summary>1. Pedir ao outro agente para preparar a ficha</summary>
      <label htmlFor="sku-importacao-ia">SKU que será pesquisado</label>
      <input id="sku-importacao-ia" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={80} placeholder="Ex.: CI003696" />
      <p><button type="button" onClick={() => void copiar(gerarPromptCadastro(sku), "Instrução para o agente")}>Copiar instruções para outra IA</button></p>
      <label htmlFor="prompt-cadastro-externo">Instruções para copiar manualmente</label>
      <textarea id="prompt-cadastro-externo" readOnly value={gerarPromptCadastro(sku)} rows={6} style={{width:"100%",resize:"vertical"}} onFocus={(e)=>e.currentTarget.select()} />
    </details>
    <label htmlFor="json-cadastro-externo"><strong>2. Cole aqui a ficha JSON devolvida pelo agente</strong></label>
    <textarea
      id="json-cadastro-externo"
      value={texto}
      onChange={(e) => { setTexto(e.target.value); setResultado(null); setAviso(""); }}
      maxLength={30000}
      rows={7}
      style={{width:"100%",resize:"vertical"}}
      placeholder={'{"formato":"conecta-cadastro-v1","sku":"CI003696", ...}'}
      spellCheck={false}
    />
    <div className="linha" style={{flexWrap:"wrap",gap:10}}>
      <button type="button" disabled={!texto.trim()} onClick={() => { setResultado(validarCadastroExterno(texto)); setAviso(""); }}>Validar e visualizar</button>
      <button type="button" className="sec" onClick={() => { setTexto(""); setResultado(null); setAviso(""); }}>Limpar</button>
    </div>
    {aviso && <p role="status" className="suave">{aviso}</p>}
    {resultado?.ok === false && <div role="alert" className="msg-erro">
      <strong>Corrija o cadastro antes de utilizar:</strong>
      <ul>{resultado.erros.map((erro,i) => <li key={i}>{erro}</li>)}</ul>
    </div>}
    {resultado?.ok === true && <div className="cartao" role="region" aria-label="Prévia do cadastro importado">
      <h3>3. Prévia da proposta — não gravada</h3>
      <p><strong>SKU físico:</strong> {resultado.pacote.sku} · <strong>ERP declarado:</strong> {resultado.pacote.erp_origem}</p>
      <p><strong>Descrição:</strong> {resultado.pacote.produto.descricao ?? "Não informada"}</p>
      <p><strong>Marca:</strong> {resultado.pacote.produto.marca ?? "Não informada"}</p>
      <p><strong>Informações:</strong> {resultado.pacote.produto.especificacoes.length} especificações; {resultado.pacote.referencias_oem.length} códigos OEM candidatos; {resultado.pacote.aplicacoes_veiculares.length} aplicações candidatas; {resultado.pacote.fontes.length} fontes</p>
      {!!resultado.pacote.aplicacoes_veiculares.length && <div>
        <h4>Aplicações por veículo (todas a confirmar)</h4>
        <ul>{resultado.pacote.aplicacoes_veiculares.map((a,i) => <li key={i}>{a.montadora} {a.modelo} {a.versao ?? ""} — {a.motor ?? "motor pendente"}</li>)}</ul>
      </div>}
      {!!resultado.pacote.referencias_oem.length && <div>
        <h4>Referências OEM (não homologadas)</h4>
        <ul>{resultado.pacote.referencias_oem.map((o,i) => <li key={i}>{o.montadora}: {o.codigo} — a confirmar</li>)}</ul>
      </div>}
      {!!resultado.pacote.pendencias.length && <div>
        <h4>Pendências indicadas</h4>
        <ul>{resultado.pacote.pendencias.map((item,i)=><li key={i}>{item}</li>)}</ul>
      </div>}
      {!!resultado.alertas.length && <div role="status" className="suave">
        <strong>Alertas de conferência:</strong>
        <ul>{resultado.alertas.map((alerta,i)=><li key={i}>{alerta}</li>)}</ul>
      </div>}
      <button type="button" className="sec" onClick={() => void copiar(JSON.stringify(resultado.pacote,null,2), "Proposta revisável")}>Copiar proposta validada (sem gravar)</button>
      <p className="suave">Esta validação confere apenas a estrutura; <strong>não comprova OEM, equivalência, ano nem identidade real do SKU</strong>. O Bling continua sendo a fonte fiscal e de estoque. A gravação depende de um fluxo de aprovação específico, ainda não implementado nesta tela.</p>
    </div>}
  </section>;
}
