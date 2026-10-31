// Estrutura da tela para confirmar o mapa (botão "Registrar esta tela"). Puro: testável no Node.
import type { CampoLido } from "./leitura.ts";
import type { Reconhecimento } from "./reconhecer.ts";

export interface Leitura { origem: string; caminho: string; titulo: string; campos: CampoLido[] }

/** Exporta a ESTRUTURA da tela (rótulos, tipos, id/name, preenchido sim/não) para confirmar o mapa. Nunca exporta valores. */
export function estruturaParaRegistro(leitura: Leitura, r: Reconhecimento) {
  return {
    gerado_em: new Date().toISOString(), erp: "bling", tela_presumida: r.tela, mapa_versao: r.versaoMapa, reconhecida: r.estado === "reconhecida",
    endereco: `${leitura.origem}${leitura.caminho}`, titulo: leitura.titulo,
    campos: leitura.campos.map((c) => ({ rotulo: c.rotulo, tipo: c.tipo, id: c.id ?? null, nome: c.nome ?? null, obrigatorio: c.obrigatorio, preenchido: c.mascarado ? null : !!c.valor.trim(),
      casou_com: r.casados.find((x) => x.lido === c)?.mapa.canonico ?? null })),
  };
}

