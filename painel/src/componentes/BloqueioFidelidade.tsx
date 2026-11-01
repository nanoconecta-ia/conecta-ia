import type { Bloqueio } from "../lib/fidelidadeVisual.ts";
import { agruparBloqueios, rotuloBloqueio, type Grupo } from "../lib/fidelidadeBloqueios.ts";

const TITULO: Record<Grupo, string> = {
  imagem: "A foto da peça foi alterada de um jeito não permitido",
  dados: "Dados do banner sem confirmação",
  provas: "Falta prova antes de autorizar",
  permissao: "Ação que não é permitida aqui",
};

/** Lista de bloqueios do validador de fidelidade. Enquanto houver algum, o editor não deixa autorizar, exportar nem publicar.
 *  Só apresenta o resultado: a decisão é do validador no editor e no servidor. */
export function BloqueioFidelidade({ bloqueios }: { bloqueios: readonly Bloqueio[] }) {
  if (bloqueios.length === 0) return null;
  const g = agruparBloqueios(bloqueios);
  return (
    <div role="alert" className="bloqueio-fidelidade">
      <strong>Bloqueado: {bloqueios.length === 1 ? "1 problema" : `${bloqueios.length} problemas`}</strong>
      {(Object.keys(TITULO) as Grupo[]).filter((k) => g[k].length > 0).map((k) => (
        <section key={k}>
          <h3>{TITULO[k]}</h3>
          <ul>{g[k].map((b, i) => <li key={`${b.codigo}-${i}`} title={b.mensagem}>{rotuloBloqueio(b.codigo)}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
