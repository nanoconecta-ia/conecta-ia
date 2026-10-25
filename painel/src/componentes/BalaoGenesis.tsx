import { Esfera } from "./Esfera.tsx";

/** Balão flutuante do Gênesis: fica no canto, em qualquer tela do painel, e abre/fecha o agente. Sem chamada ao servidor por si só. */
export function BalaoGenesis({ aberto, aoAlternar }: { aberto: boolean; aoAlternar: () => void }) {
  return (
    <button type="button" className="balao-genesis" onClick={aoAlternar} aria-expanded={aberto} aria-controls="dock-agente" aria-label={aberto ? "Fechar o Gênesis" : "Abrir o Gênesis"}>
      <Esfera estado="parado" tamanho={40} />
      <span>Gênesis</span>
    </button>
  );
}
