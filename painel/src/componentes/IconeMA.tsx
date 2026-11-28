// Renderizador da biblioteca universal MA Display.
// Geometria pura (24×24, traço uniforme) com película/acabamento via CSS.
// Nunca usa atlas histórico nem substitui ícone ausente por outra peça.
import { iconeMA, PALETA_MA, type VarianteMA } from "../lib/maIcones.ts";

const COR_TRACO: Record<VarianteMA, string> = {
  grafite: PALETA_MA.grafite,
  vermelho: PALETA_MA.vermelho,
  aco: PALETA_MA.aco,
  azul: PALETA_MA.azul,
  branco: PALETA_MA.branco,
  gelo: PALETA_MA.gelo,
};

export function IconeMA({
  id,
  tamanho = 24,
  variante = "aco",
  titulo,
  className = "",
}: {
  id: string | null | undefined;
  tamanho?: number;
  variante?: VarianteMA;
  titulo?: string;
  className?: string;
}) {
  const ic = id ? iconeMA(id) : undefined;
  if (!ic || ic.estado === "revogado") {
    return (
      <span
        className={`ma-icone ma-icone-ausente ${className}`.trim()}
        data-ma-icone="ausente"
        data-ma-chave={id ?? ""}
        aria-hidden={titulo ? undefined : true}
        title={titulo ?? "Ativo visual pendente"}
        style={{ width: tamanho, height: tamanho }}
      >
        —
      </span>
    );
  }
  const acento = variante === "vermelho" ? PALETA_MA.gelo : PALETA_MA.vermelho;
  return (
    <span
      className={`ma-icone ma-icone-${variante} ${className}`.trim()}
      data-ma-icone={ic.id}
      data-ma-versao={ic.versao}
      data-ma-estado={ic.estado}
      style={{ width: tamanho, height: tamanho, ["--ma-traco" as string]: COR_TRACO[variante], ["--ma-acento" as string]: acento }}
    >
      <svg
        width={Math.max(14, Math.round(tamanho * 0.68))}
        height={Math.max(14, Math.round(tamanho * 0.68))}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        role={titulo ? "img" : undefined}
        aria-label={titulo}
        aria-hidden={titulo ? undefined : true}
        focusable="false"
      >
        <path d={ic.d} />
        {ic.acento && <path d={ic.acento} stroke="var(--ma-acento, #E2181A)" />}
      </svg>
    </span>
  );
}
