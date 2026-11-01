import { useState } from "react";
import { copiarTexto } from "../lib/copiar.ts";
import { Icone } from "./Icone.tsx";
import { Markdown } from "./Markdown.tsx";
import { EvidenciaProduto, type EvidenciaBusca } from "./EvidenciaProduto.tsx";
import { comecoDaLonga, ehLonga, resumoEvidencia, resumoLinha } from "../lib/retratil.ts";

export type MensagemChat = { de: "eu" | "ia"; texto: string; anexos?: string[]; evidencias?: unknown[]; simulado?: boolean };

/** Uma mensagem do chat que recolhe numa linha (as antigas), mostra só o começo quando é longa e guarda a evidência da consulta numa seção retrátil. */
export function MensagemRetratil({ m, recolhida, onAlternar }: { m: MensagemChat; recolhida: boolean; onAlternar: () => void }) {
  const [completa, setCompleta] = useState(false);
  const [copiado, setCopiado] = useState<null | boolean>(null);
  const copiar = async () => { const ok = await copiarTexto(m.texto); setCopiado(ok); setTimeout(() => setCopiado(null), 2000); };
  const quem = m.de === "eu" ? "Você" : "Nano.ia";
  if (recolhida) {
    return (
      <button type="button" className={`bolha-linha sec ${m.de}`} aria-expanded={false} onClick={onAlternar}>
        <b>{quem}</b><span>{resumoLinha(m.texto) || "(sem texto)"}</span><i aria-hidden="true">▸</i>
      </button>
    );
  }
  const longa = ehLonga(m.texto) && !completa;
  return (
    <div className={`bolha ${m.de}`}>
      <div className="bolha-topo"><b>{quem}</b><span className="bolha-acoes"><button type="button" className="mini sec icone-btn copiar" data-copiado={copiado === true ? "sim" : copiado === false ? "nao" : undefined} onClick={() => void copiar()} aria-label={copiado === true ? "Mensagem copiada" : copiado === false ? "Não foi possível copiar; selecione o texto" : "Copiar esta mensagem"} title="Copiar"><Icone nome={copiado === true ? "check" : "copiar"} tamanho={16} /></button><button type="button" className="mini sec icone-btn" aria-expanded onClick={onAlternar} aria-label="Recolher esta mensagem" title="Recolher"><Icone nome="recolher-msg" tamanho={16} /></button></span></div>
      {m.de === "ia" ? <Markdown texto={longa ? comecoDaLonga(m.texto) : m.texto} /> : (longa ? comecoDaLonga(m.texto) : m.texto)}
      {m.anexos?.length ? <p className="anexos-enviados">{m.anexos.map((n) => `📎 ${n}`).join("  ")}</p> : null}
      {ehLonga(m.texto) && <button type="button" className="mini sec mais" onClick={() => setCompleta((v) => !v)}>{completa ? "Mostrar menos" : "Mostrar mais"}</button>}
      {m.simulado === true && <strong> · RESPOSTA SIMULADA</strong>}
      {m.evidencias?.map((ev, n) => (
        <details key={n} className="evid-retratil">
          <summary>{resumoEvidencia(ev as EvidenciaBusca)}</summary>
          <EvidenciaProduto ev={ev as EvidenciaBusca} />
        </details>
      ))}
    </div>
  );
}
