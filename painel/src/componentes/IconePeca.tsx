import { ICONES } from "../lib/icones.ts";

/** Ícone próprio da plataforma (peça ou tipo de veículo). Duotom: traço na cor do texto, preenchimento suave na cor da marca. */
export function IconePeca({ nome, tamanho = 40, titulo }: { nome: string; tamanho?: number; titulo?: string }) {
  const d = ICONES[nome] ?? ICONES.peca;
  return (
    <svg className="ico-peca" width={tamanho} height={tamanho} viewBox="0 0 48 48" fill="none" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} focusable="false">
      {d.f && <path d={d.f} className="ico-fill" />}
      <path d={d.s} className="ico-traco" />
    </svg>
  );
}
