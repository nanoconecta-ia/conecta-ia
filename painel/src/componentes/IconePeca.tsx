import { TIPOS_VEICULO, type TipoVeiculo } from "../lib/icones.ts";
import { ICONE_3D_PECA, ICONE_3D_VEICULO } from "./icones3d.ts";

/** Ícone de peça. Onde há ícone 3D aprovado usa a imagem; senão, o símbolo i-<nome> do sprite. Sem `titulo` é decorativo. */
export function IconePeca({ nome, tamanho = 40, titulo }: { nome: string; tamanho?: number; titulo?: string }) {
  const img = ICONE_3D_PECA[nome];
  if (img) return <img className="ico-peca ico-3d" src={img} width={tamanho} height={tamanho} alt={titulo ?? ""} aria-hidden={titulo ? undefined : true} loading="lazy" decoding="async" />;
  return (
    <svg className="ico-peca" width={tamanho} height={tamanho} viewBox="0 0 64 64" role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} focusable="false">
      <use href={`#i-${nome}`} />
    </svg>
  );
}

/** Veículo do tipo. Com ícone 3D aprovado usa a imagem (recorte largo); senão, a silhueta v-<tipo> na cor do tipo. */
export function IconeVeiculo({ tipo, largura = 120, titulo }: { tipo: TipoVeiculo | string; largura?: number; titulo?: string }) {
  const t = typeof tipo === "string" ? TIPOS_VEICULO.find((x) => x.chave === tipo) : tipo;
  if (!t) return null;
  const img = ICONE_3D_VEICULO[t.chave];
  if (img) return <img className="ico-veiculo ico-3d ico-3d-largo" src={img} width={largura} height={Math.round(largura * 0.62)} alt={titulo ?? t.rotulo} loading="lazy" decoding="async" />;
  return (
    <svg className="ico-veiculo" width={largura} height={largura / 2} viewBox="0 0 240 120" role="img" aria-label={titulo ?? t.rotulo} focusable="false" style={{ ["--cor" as string]: `var(--v-${t.chave})` }}>
      <use href={`#${t.simbolo}`} />
    </svg>
  );
}
