import { useState } from "react";
import { Dialogo } from "../Dialogo.tsx";
import type { FonteDados } from "../../lib/conectorDados.ts";
import { corpoDecisao, exigeConfirmacao, itensAprovaveis, podeDecidir, ROTULO_RISCO, type ItemProposta, type Proposta } from "../../lib/propostas.ts";
import { hashCurto } from "./ui.tsx";

/** Aprovar / rejeitar / pedir revisão. A aprovação vale só para a versão e o hash mostrados; qualquer mudança exige nova decisão. */
export function DecisaoProposta({ proposta, itens, selecionados, fonte, lojaId, aoConcluir }: {
  proposta: Proposta; itens: ItemProposta[]; selecionados: Set<string> | null; fonte: FonteDados; lojaId: string; aoConcluir: (mensagem: string) => void;
}) {
  const [dialogo, setDialogo] = useState<null | "aprovada" | "rejeitada">(null);
  const [confirmou, setConfirmou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const pode = podeDecidir(proposta, itens);
  const aprovaveis = itensAprovaveis(itens);
  const escolhidos = selecionados ? aprovaveis.filter((i) => selecionados.has(i.id)) : aprovaveis;
  const produtos = new Set(escolhidos.map((i) => i.produto_id).filter(Boolean)).size;
  const alto = exigeConfirmacao(proposta.risco);

  async function decidir(d: "aprovada" | "rejeitada") {
    setOcupado(true); setErro("");
    try {
      const corpo = corpoDecisao(proposta, d, selecionados ? escolhidos.map((i) => i.id) : null, confirmou);
      const r = await fonte.chamar("conector-aprovacoes", { ...corpo, loja_id: lojaId });
      if (!r.ok) { setErro(r.erro ?? "Não foi possível registrar a decisão."); return; }
      setDialogo(null); setConfirmou(false);
      aoConcluir(d === "aprovada" ? "Proposta aprovada. A execução desta fase é simulada: nada foi gravado no Bling real." : "Proposta rejeitada.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível registrar a decisão."); }
    finally { setOcupado(false); }
  }
  async function revisar() {
    setOcupado(true); setErro("");
    const r = await fonte.chamar("conector-aprovacoes", { loja_id: lojaId, acao: "revisar", proposta_id: proposta.id });
    setOcupado(false);
    if (!r.ok) setErro(r.erro ?? "Não foi possível pedir a revisão."); else aoConcluir("Nova versão criada em rascunho. A anterior perdeu a validade.");
  }

  if (!pode.ok) return (
    <div className="decisao" role="group" aria-label="Decisão da proposta">
      <p className="aviso">{pode.motivo}</p>
      {(proposta.estado === "pendente" || proposta.estado === "expirada" || proposta.estado === "rejeitada") && (
        <button className="sec" onClick={() => void revisar()} disabled={ocupado}>Pedir nova versão (revisão)</button>)}
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
    </div>
  );

  return (
    <div className="decisao" role="group" aria-label="Decisão da proposta">
      <p className="aviso">Esta aprovação vale <strong>só para a versão {proposta.versao}</strong> (código <code>{hashCurto(proposta.hash)}</code>). Se a proposta mudar, ela perde a validade e você precisa aprovar de novo.</p>
      <p className="suave" style={{ margin: 0 }}>Escrita real no Bling: <strong>desligada nesta fase</strong> (execução simulada).</p>
      {alto && (
        <label className="linha marcar-linha"><input type="checkbox" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} />
          <span>Entendo que o risco é <strong>{ROTULO_RISCO[proposta.risco].toLowerCase()}</strong> e confirmo explicitamente.</span></label>
      )}
      <div className="linha acoes-toque">
        <button className="verde" disabled={ocupado || escolhidos.length === 0 || (alto && !confirmou)} onClick={() => setDialogo("aprovada")}>Aprovar {escolhidos.length === aprovaveis.length ? "tudo" : `${escolhidos.length} item(ns)`}</button>
        <button className="perigo" disabled={ocupado} onClick={() => setDialogo("rejeitada")}>Rejeitar</button>
        <button className="sec" disabled={ocupado} onClick={() => void revisar()}>Pedir revisão</button>
      </div>
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      <Dialogo aberto={dialogo === "aprovada"} titulo="Confirmar aprovação" rotuloConfirmar="Sim, aprovar esta versão" ocupado={ocupado} aoCancelar={() => setDialogo(null)} aoConfirmar={() => void decidir("aprovada")}>
        <p>Você vai aprovar <strong>{escolhidos.length} item(ns)</strong> de <strong>{produtos} produto(s)</strong> na versão {proposta.versao} (<code>{hashCurto(proposta.hash)}</code>), risco {ROTULO_RISCO[proposta.risco].toLowerCase()}.</p>
        <p className="suave">Só estas operações ficam autorizadas, por este usuário, até {proposta.expira_em ? new Date(proposta.expira_em).toLocaleString("pt-BR") : "o prazo da proposta"}.</p>
      </Dialogo>
      <Dialogo aberto={dialogo === "rejeitada"} titulo="Rejeitar proposta" perigo rotuloConfirmar="Sim, rejeitar" ocupado={ocupado} aoCancelar={() => setDialogo(null)} aoConfirmar={() => void decidir("rejeitada")}>
        <p>Nenhuma alteração será aplicada. Os produtos voltam a aceitar novas propostas.</p>
      </Dialogo>
    </div>
  );
}
