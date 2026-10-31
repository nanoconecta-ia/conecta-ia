// Reconhece a tela comparando os campos lidos com o mapa. Casamento por rótulo normalizado: igual vence "começa com".
// Sem campos suficientes, a tela é "desconhecida" e o Nano NÃO sugere nada (melhor parar do que preencher no lugar errado).
import type { CampoLido } from "./leitura.ts";
import type { CampoMapa, MapaTela } from "./mapa-produto.ts";

export interface Casamento { mapa: CampoMapa; lido: CampoLido; exato: boolean }
export interface Reconhecimento {
  estado: "reconhecida" | "desconhecida";
  tela: string; versaoMapa: number; mapaConferido: boolean;
  casados: Casamento[];
  faltando: CampoMapa[];          // campos do mapa que não apareceram nesta tela
  vazios: Casamento[];            // apareceram, mas sem valor
  naoMapeados: CampoLido[];       // campos da tela que o mapa ainda não conhece (material para confirmar o mapa)
}

export function reconhecer(lidos: readonly CampoLido[], mapa: MapaTela): Reconhecimento {
  // Campo sensível (custo, fornecedor, fiscal) nunca casa com campo do mapa: "Preço de compra" não pode virar "Preço".
  const usados = new Set<CampoLido>(lidos.filter((l) => l.mascarado));
  const casados: Casamento[] = [];
  for (const m of mapa.campos) {
    let achado: Casamento | null = null;
    for (const l of lidos) { if (!usados.has(l) && m.rotulos.includes(l.chave)) { achado = { mapa: m, lido: l, exato: true }; break; } }
    if (!achado) for (const l of lidos) { if (!usados.has(l) && m.rotulos.some((r) => l.chave.startsWith(`${r} `))) { achado = { mapa: m, lido: l, exato: false }; break; } }
    if (achado) { usados.add(achado.lido); casados.push(achado); }
  }
  const estado = casados.filter((c) => c.mapa.essencial).length >= mapa.minimoParaReconhecer ? "reconhecida" : "desconhecida";
  return {
    estado, tela: mapa.tela, versaoMapa: mapa.versao, mapaConferido: mapa.conferido, casados,
    faltando: mapa.campos.filter((m) => !casados.some((c) => c.mapa === m)),
    vazios: casados.filter((c) => !c.lido.mascarado && !c.lido.valor.trim()),
    naoMapeados: lidos.filter((l) => !casados.some((c) => c.lido === l)),
  };
}
