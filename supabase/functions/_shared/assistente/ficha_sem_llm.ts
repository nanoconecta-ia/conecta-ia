// Ficha de consulta ao Bling sem LLM. Não cria, altera, aprova ou publica cadastro.
// Recebe SOMENTE evidência da ferramenta consultarProduto, já autorizada e auditada.
type Candidato = { id?: string; sku?: string | null; nome?: string | null; situacao?: string; origem?: string; achado_por?: string[] };
type EvidenciaFicha = {
  termo?: string; total_candidatos?: number; candidatos?: Candidato[];
  truncado?: boolean; lista_parcial?: boolean; candidatos_omitidos?: number;
  fontes?: { origem?: string; consultada?: boolean; completa?: boolean }[];
  conclusao?: { api_completa?: boolean; ausencia_nos_filtros_pesquisados?: boolean; autoriza_criacao?: boolean; aviso?: string };
  simulado?: boolean; consultado_em?: string;
};
const campo = (valor: unknown, limite = 120) => typeof valor === "string" && valor.trim()
  ? valor.replace(/[\x00-\x1F]/g, " ").slice(0, limite) : "não informado";
const numero = (n: unknown) => Number.isInteger(n) && Number(n) >= 0 ? Number(n) : 0;

/** Mantém só identidades exatas; nunca devolve sugestões aproximadas na ficha. */
export function evidenciaSkuExato<T extends EvidenciaFicha>(e: T, sku: string): T {
  if (!e || !Array.isArray(e.candidatos)) throw Error("Evidência incompleta.");
  const candidatos = e.candidatos.filter(c => c.sku === sku);
  return { ...e, termo: sku, candidatos, total_candidatos: candidatos.length,
    truncado: e.truncado, lista_parcial: e.truncado === true, candidatos_omitidos: 0 };
}

export function gerarFichaSemLLM(v: unknown) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("Evidência da consulta inválida.");
  const e = v as EvidenciaFicha;
  if (!Array.isArray(e.candidatos) || !Array.isArray(e.fontes) || !e.conclusao ||
      !Number.isInteger(e.total_candidatos) || (e.total_candidatos ?? -1) < 0) throw Error("Evidência incompleta.");
  const total = numero(e.total_candidatos), exibidos = e.candidatos.slice(0, 8);
  const parcial = e.truncado === true || e.lista_parcial === true || numero(e.candidatos_omitidos) > 0 ||
    total > e.candidatos.length;
  const apiCompleta = e.conclusao.api_completa === true;
  const apiConsultada = e.fontes.some(f => f.origem === "api_bling" && f.consultada === true);
  const situacao = total === 0 ? "sem_candidatos_no_escopo" : total === 1 && !parcial ? "um_candidato" : "conflito_ou_lista_parcial";
  const linhas = [
    "FICHA-BASE DO BLING — CONSULTA SEM INTELIGÊNCIA ARTIFICIAL",
    "Código pesquisado: " + campo(e.termo, 80),
    "Origem: " + (apiConsultada ? "API do Bling e/ou espelho" : "espelho ou consulta API não concluída") +
      "; API completa: " + (apiCompleta ? "sim" : "não") +
      "; ambiente: " + (e.simulado ? "SIMULADO" : "não identificado como simulado"),
    "Consulta em: " + campo(e.consultado_em, 35),
    "Candidatos identificados: " + total + (parcial ? " (LISTA PARCIAL)" : ""),
  ];
  if (!total) {
    linhas.push("Não encontrei candidato NOS FILTROS consultados. Isso NÃO prova que o produto inexiste no ERP.");
    linhas.push("Cadastro novo BLOQUEADO: verificar códigos OEM, fabricante/importador, descrição, excluídos e catálogo do fornecedor.");
  } else {
    for (const c of exibidos) {
      linhas.push("- Bling ID " + campo(c.id, 32) + " | SKU " + campo(c.sku, 80) +
        " | " + campo(c.nome, 160) + " | situação " + campo(c.situacao, 30) +
        " | origem " + campo(c.origem, 30));
    }
    if (total > 1 || parcial) linhas.push("Múltiplos candidatos/consulta parcial: escolha a identidade correta antes de qualquer proposta.");
    if (total === 1 && !parcial) linhas.push("Um candidato encontrado: conferir identidade e aplicações antes de propor atualização/reativação.");
  }
  if (!apiCompleta) linhas.push("ATENÇÃO: consulta ao ERP incompleta ou não confirmada. Não concluir ausência nem criar cadastro.");
  linhas.push("Campos que exigem confirmação por fonte: fabricante real, código OEM, GTIN, aplicação por motor/ano/versão, medidas, peso, imagens e licença de uso.");
  linhas.push("Preço e estoque são controlados pelo Bling. SKU, NCM e preço para produto novo são campos de responsabilidade do lojista; fiscal requer validação adequada.");
  linhas.push("NENHUM PRODUTO FOI CADASTRADO, ALTERADO, APROVADO OU PUBLICADO.");
  return { modo: "ficha_sem_llm" as const, situacao, candidatos: total, api_completa: apiCompleta,
    parcial, autoriza_criacao: false as const, resposta: linhas.join("\n") };
}

/** Uma consulta com vários registros exatos é um resultado INFORMATIVO válido, não erro da ferramenta.
 * Nunca seleciona automaticamente um SKU ativo se houver registros excluídos/inativos com o mesmo código.
 */
export function prepararResultadoFicha(ficha: ReturnType<typeof gerarFichaSemLLM>) {
  if (ficha.candidatos === 0 && !ficha.api_completa) return {
    status: 503, corpo: { erro: "Consulta incompleta; não foi possível confirmar o SKU.", categoria_erro: "ferramenta", origem_erro: "ferramenta", ia: false },
  };
  if (ficha.candidatos === 0) return {
    status: 404, corpo: { erro: "SKU não encontrado na consulta exata. Isso não comprova ausência no ERP.", categoria_erro: "sku_nao_encontrado", origem_erro: "produto", ia: false },
  };
  if (ficha.candidatos !== 1 || ficha.parcial) return {
    status: 200,
    corpo: {
      ...ficha, exige_selecao: true, identidade_confirmada: false,
      resposta: `ATENÇÃO — FICHA NÃO CONFIRMADA: ${ficha.parcial ? "consulta parcial" : "mais de um registro para este SKU"}.
A lista abaixo é apenas informativa. Diferencie produto ativo, inativo e excluído pelo ID do Bling. Não selecione, restaure, recadastre ou venda automaticamente qualquer candidato.

${ficha.resposta}`,
    },
  };
  return { status: 200, corpo: { ...ficha, exige_selecao: false, identidade_confirmada: true } };
}
