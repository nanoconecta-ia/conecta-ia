import { Esfera } from "./Esfera.tsx";

/** Balão flutuante do Nano.ia: fica no canto, em qualquer tela do painel, e abre/fecha o agente. Sem chamada ao servidor por si só. */
export function BalaoGenesis({ aberto, aoAlternar }: { aberto: boolean; aoAlternar: () => void }) {
  return (
    <button type="button" className="balao-genesis" onClick={aoAlternar} aria-expanded={aberto} aria-controls="dock-agente" aria-label={aberto ? "Fechar o Nano.ia" : "Abrir o Nano.ia"}>
      <Esfera estado="parado" tamanho={40} />
      <span>Nano.ia</span>
    </button>
  );
}
