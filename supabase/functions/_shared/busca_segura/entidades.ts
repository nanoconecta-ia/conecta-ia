// Resolução de ENTIDADES da consulta (PR #242, requisitos 1-3 e testes de aceite 1 e 2). Pura e determinística: sem rede, sem IA, sem relógio.
// Reaproveita `interpretarConsulta` (consulta/interpretar.ts) e acrescenta o que ela não decidia: ANO NÃO É MOTOR e códigos de motor são só TERMOS CANDIDATOS.
// O glossário de motores vem do BANCO como dado (como o vocabulário): nenhuma família de motor, montadora ou ano está escrita aqui.
//
// O QUE PROVA: "HR 2008" resolve ano/modelo candidatos e NUNCA um motor; se o glossário dá mais de uma motorização para o modelo naquele ano, a saída é uma
// PERGUNTA (8V/16V, código do motor, chassi ou peça); códigos próximos (ex.: 4D56, D4BH, D4BB) entram como termos de busca com `equivalencia: "nao_afirmada"`.
// O QUE NÃO PROVA: que o motor é aquele, nem que dois códigos são equivalentes. Motor só vira "informado" quando a PESSOA digita o código, e continua não verificado.
import { interpretarConsulta, normalizar, type Interpretacao, type Vocabulario } from "../consulta/interpretar.ts";

export interface AplicacaoMotor { montadora: string; modelo: string; de?: number; ate?: number }
export interface TermoMotor { codigo: string; valvulas?: number; cilindrada?: string; aplicacoes: AplicacaoMotor[] }
export interface GlossarioMotor { termos: TermoMotor[] }

export interface CandidatoMotor { codigo: string; valvulas?: number; cilindrada?: string; equivalencia: "nao_afirmada"; fonte: "glossario" }
export interface ResolucaoEntidades {
  interpretacao: Interpretacao;
  ano: { valor?: number; papel: "ano_candidato_do_veiculo"; e_motor: false };
  motor: {
    /** Preenchido só quando a pessoa digitou um código que existe no glossário. Nunca é "verificado". */
    informado: string | null;
    candidatos: CandidatoMotor[];
    ambiguo: boolean;
    verificado: false;
  };
  perguntas: string[];
  avisos: string[];
}

const dentro = (a: AplicacaoMotor, ano?: number) => ano == null || ((a.de == null || ano >= a.de) && (a.ate == null || ano <= a.ate));

export function resolverEntidades(texto: string, voc: Vocabulario, gloss: GlossarioMotor, anoAtual = new Date().getFullYear()): ResolucaoEntidades {
  const it = interpretarConsulta(texto, voc, anoAtual);
  const t = normalizar(it.texto);
  const avisos = [...it.avisos];
  const perguntas = [...it.perguntas];

  // Código de motor digitado pela pessoa: reconhecido só se existe no glossário (fronteira de palavra).
  const citados = gloss.termos.filter((m) => new RegExp(`(^| )${normalizar(m.codigo).replace(/ /g, " +")}( |$)`).test(t));
  const informado = citados.length === 1 ? citados[0].codigo : null;
  if (citados.length > 1) avisos.push(`Vários códigos de motor citados (${citados.map((c) => c.codigo).join(", ")}): confirme qual é o do veículo; não são tratados como equivalentes.`);

  // Candidatos pelo modelo+ano resolvidos no cadastro.
  const { modelo, montadora, ano } = it.veiculo;
  let candidatos: TermoMotor[] = [];
  if (modelo) {
    candidatos = gloss.termos.filter((m) => m.aplicacoes.some((a) => normalizar(a.modelo) === normalizar(modelo) && (!montadora || normalizar(a.montadora) === normalizar(montadora)) && dentro(a, ano)));
  }
  if (informado && !candidatos.some((c) => c.codigo === informado)) candidatos = [...candidatos, citados[0]];
  const motoresDistintos = candidatos.length;
  const ambiguo = !informado && motoresDistintos > 1;
  if (ambiguo) {
    const vs = [...new Set(candidatos.map((c) => c.valvulas).filter((v): v is number => v != null))];
    const opcao = vs.length > 1 ? `${vs.sort((a, b) => a - b).join("V ou ")}V` : "a motorização";
    perguntas.push(`O ano ${ano ?? ""} do ${modelo ?? "veículo"} não define o motor sozinho. É ${opcao}? Informe o código do motor (placa/bloco), o chassi ou a peça antiga.`.replace("  ", " "));
    avisos.push(`Códigos de motor candidatos (${candidatos.map((c) => c.codigo).join(", ")}) são termos de busca, NÃO equivalentes entre si e NÃO confirmados.`);
  } else if (!informado && motoresDistintos === 1) {
    avisos.push(`Candidato único no glossário (${candidatos[0].codigo}) para ${modelo} ${ano ?? ""}: ainda é hipótese. Confirme pelo código do motor, chassi ou peça antiga.`);
  } else if (!informado && motoresDistintos === 0 && modelo) {
    avisos.push("Sem motor candidato no glossário para este modelo e ano: não vou presumir; pergunte o código do motor, o chassi ou a peça.");
  }
  if (ano != null && !it.falta.includes("versao_ou_motor") && !informado && motoresDistintos !== 1 && !perguntas.some((p) => /motor/i.test(p))) {
    perguntas.push("Qual é o código do motor? Sem ele não afirmo compatibilidade.");
  }
  return {
    interpretacao: it,
    ano: { valor: ano, papel: "ano_candidato_do_veiculo", e_motor: false },
    motor: {
      informado,
      candidatos: candidatos.map((c) => ({ codigo: c.codigo, valvulas: c.valvulas, cilindrada: c.cilindrada, equivalencia: "nao_afirmada" as const, fonte: "glossario" as const })),
      ambiguo, verificado: false,
    },
    perguntas: [...new Set(perguntas)],
    avisos: [...new Set(avisos)],
  };
}
