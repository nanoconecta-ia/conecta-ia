import { TIPOS_VEICULO, type TipoVeiculo } from "../lib/icones.ts";

/** Ícone de peça com volume (símbolo i-<nome> do sprite). Sem `titulo` é decorativo. */
export function IconePeca({ nome, tamanho = 40, titulo }: { nome: string; tamanho?: number; titulo?: string }) {
  return (
    <svg className="ico-peca" width={tamanho} height={tamanho} viewBox="0 0 64 64" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} focusable="false">
      <use href={`#i-${nome}`} />
    </svg>
  );
}

/** Silhueta de veículo (símbolo v-<tipo>) na cor do tipo (--v-<chave>, que muda com o tema). */
export function IconeVeiculo({ tipo, largura = 120, titulo }: { tipo: TipoVeiculo | string; largura?: number; titulo?: string }) {
  const t = typeof tipo === "string" ? TIPOS_VEICULO.find((x) => x.chave === tipo) : tipo;
  if (!t) return null;
  return (
    <svg className="ico-veiculo" width={largura} height={largura / 2} viewBox="0 0 240 120" role="img" aria-label={titulo ?? t.rotulo} focusable="false" style={{ ["--cor" as string]: `var(--v-${t.chave})` }}>
      <use href={`#${t.simbolo}`} />
    </svg>
  );
}
