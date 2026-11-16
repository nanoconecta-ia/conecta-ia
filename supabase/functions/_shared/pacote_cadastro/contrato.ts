/** Nano cadastro por SKU (Ordem Mestra 16).
 * Pré-validação PURA de envelope. NÃO homologa fontes, aplicações ou identidade:
 * esses passos exigem Bling + banco + documentos e revisão humana no servidor.
 * Sem rede, sem banco, sem escrita. */
export interface AvaliacaoPacote {
  valido_estruturalmente: boolean;
  pronto_para_revisao: boolean;
  publicavel: false;
  altera_bling: false;
  erros: string[];
  pendencias: string[];
}
type Objeto = Record<string, unknown>;
const objeto = (x: unknown): x is Objeto =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const texto = (x: unknown, max: number) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= max;
const seguro = (x: unknown) => {
  if (typeof x !== "string" || x.length > 1000) return false;
  try {
    const u = new URL(x);
    return u.protocol === "https:" && !!u.hostname
      && !u.username && !u.password && !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(u.hostname)
      && !u.hostname.endsWith(".local") && !u.hostname.endsWith(".internal");
  } catch { return false; }
};
const STATUS = ["confirmado", "a_confirmar", "ausente", "divergente"] as const;
const permitido = (v: unknown): boolean => typeof v === "string" && STATUS.includes(v as (typeof STATUS)[number]);

export function verificarGtin(gtin: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)) return false;
  let soma = 0;
  for (let i = gtin.length - 2, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3)
    soma += Number(gtin[i]) * peso;
  return (10 - soma % 10) % 10 === Number(gtin[gtin.length - 1]);
}

/** Regras de bloqueio de entrada independentes da vontade do agente. */
export function validarPacoteCadastro(entrada: unknown): AvaliacaoPacote {
  const erros: string[] = [], pendencias: string[] = [];
  const resultado = (): AvaliacaoPacote => ({
    valido_estruturalmente: erros.length === 0,
    pronto_para_revisao: erros.length === 0,
    publicavel: false, altera_bling: false, erros, pendencias,
  });
  if (!objeto(entrada)) { erros.push("O pacote deve ser um objeto JSON."); return resultado(); }
  const permitidas = new Set([
    "versao", "bling_id", "sku", "idempotency_key", "origem_agente",
    "identidade", "evidencias", "aplicacoes", "taxonomia", "imagens", "texto", "logistica",
  ]);
  for (const k of Object.keys(entrada)) if (!permitidas.has(k))
    erros.push("Campo de entrada não permitido: " + k);
  if (entrada.versao !== 1) erros.push("Versão do contrato deve ser 1.");
  if (typeof entrada.bling_id !== "string" || !/^\d{1,24}$/.test(entrada.bling_id))
    erros.push("ID do produto físico no Bling é obrigatório.");
  if (entrada.sku !== null && entrada.sku !== undefined
    && (typeof entrada.sku !== "string" || !/^[A-Za-z0-9._/-]{1,80}$/.test(entrada.sku)))
    erros.push("SKU deve ser nulo ou o código já existente no ERP.");
  if (!texto(entrada.idempotency_key, 128) || !/^[A-Za-z0-9._:-]{8,128}$/.test(String(entrada.idempotency_key)))
    erros.push("Chave de idempotência obrigatória (8–128 caracteres).");
  if (!objeto(entrada.origem_agente) || !texto(entrada.origem_agente.agente, 100)
    || !texto(entrada.origem_agente.modelo, 100))
    erros.push("Agente e modelo de origem devem ser identificados.");
  const id = entrada.identidade;
  if (!objeto(id)) erros.push("Bloco identidade ausente.");
  else {
    for (const k of Object.keys(id))
      if (!["marca", "codigo_fabricante", "gtin"].includes(k)) erros.push("Identidade contém campo não permitido: " + k);
    if (id.gtin != null && (typeof id.gtin !== "string" || !verificarGtin(id.gtin)))
      erros.push("GTIN inválido ou dígito verificador incorreto.");
    if (id.gtin == null) pendencias.push("GTIN não informado; nunca inventar.");
    if (!texto(id.marca, 100)) pendencias.push("Marca comercial requer confirmação no produto/embalagem.");
    if (!texto(id.codigo_fabricante, 80)) pendencias.push("Referência do fabricante ausente.");
  }

  if (!Array.isArray(entrada.evidencias) || entrada.evidencias.length > 80)
    erros.push("Evidências devem ser lista de até 80 itens.");
  const evs = Array.isArray(entrada.evidencias) ? entrada.evidencias.slice(0, 80) : [];
  const ids = new Set<string>();
  for (const [i, e] of evs.entries()) {
    if (!objeto(e)) { erros.push("Evidência " + i + " inválida."); continue; }
    if (!texto(e.id, 100) || ids.has(String(e.id))) erros.push("ID da evidência inválido/duplicado: " + i);
    else ids.add(String(e.id));
    if (!["fabricante_oficial", "montadora_oficial", "distribuidor_b2b",
      "referencia_cruzada", "marketplace", "outra"].includes(String(e.classe)))
      erros.push("Classe da fonte não reconhecida: " + i);
    if (e.url != null && !seguro(e.url)) erros.push("URL da fonte insegura: " + i);
    if (!seguro(e.url) && !texto(e.documento, 250)) erros.push("Evidência precisa de URL HTTPS ou documento identificável: " + i);
    if (!texto(e.trecho, 1800) || !texto(e.codigo_exato, 80)
      || !String(e.trecho ?? "").toUpperCase().includes(String(e.codigo_exato ?? "").toUpperCase()))
      erros.push("Trecho literal deve conter o código declarado: " + i);
    const d = e.consultado_em;
    if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))
      erros.push("Data da evidência inválida: " + i);
    if (!Array.isArray(e.reivindicacoes) || e.reivindicacoes.length > 50)
      erros.push("Vínculos da evidência inválidos: " + i);
    // Esta validação NÃO confirma que a fonte é oficial: depende de domínio verificado NO SERVIDOR.
  }
  if (evs.length === 0) pendencias.push("Pacote sem fontes externas comprováveis.");

  if (!Array.isArray(entrada.aplicacoes) || entrada.aplicacoes.length > 30)
    erros.push("Aplicações devem formar lista de até 30 itens.");
  for (const [i,a] of (Array.isArray(entrada.aplicacoes) ? entrada.aplicacoes.slice(0,30) : []).entries()) {
    if (!objeto(a) || !texto(a.modelo, 100) || !texto(a.montadora,100)
      || !texto(a.motor,80) || !texto(a.id,100))
      { erros.push("Aplicação incompleta na posição " + i); continue; }
    const inicial = a.ano_inicial, final = a.ano_final;
    if (inicial != null && (!Number.isInteger(inicial) || (inicial as number) < 1950 || (inicial as number) > 2100))
      erros.push("Ano inicial inválido em aplicação " + i);
    if (final != null && (!Number.isInteger(final) || (final as number) < 1950 || (final as number) > 2100))
      erros.push("Ano final inválido em aplicação " + i);
    if (typeof inicial === "number" && typeof final === "number" && final < inicial)
      erros.push("Intervalo de anos invertido em aplicação " + i);
    if (!Array.isArray(a.evidencia_ids) || a.evidencia_ids.some(x=>!ids.has(String(x))))
      erros.push("Aplicação contém evidência ausente em " + i);
    if (!permitido(a.estado)) erros.push("Estado da aplicação inválido em " + i);
    if (a.estado === "confirmado") pendencias.push("Estado declarado confirmado pelo agente exige revalidação no servidor: " + a.id);
    if (!texto(a.modelo_id, 80) || !texto(a.codigo_oem,80))
      pendencias.push("Aplicação sem nó da árvore ou OEM confirmado: " + a.id);
    if (!Array.isArray(a.nao_se_aplica) || a.nao_se_aplica.length===0)
      pendencias.push("Aplicação sem contraindicações documentadas: " + a.id);
    // Duas fontes independentes e uma oficial serão verificadas com DOMÍNIOS cadastrados,
    // não confiando na classe/autoria autodeclarada pelo modelo de IA.
    if (new Set((a.evidencia_ids as unknown[] ?? []).map(String)).size < 2)
      pendencias.push("Aplicação exige triangulação com pelo menos duas evidências independentes: " + a.id);
  }

  if (!Array.isArray(entrada.imagens) || entrada.imagens.length > 8)
    erros.push("Galeria candidata deve ter no máximo oito imagens.");
  for (const [i, img] of (Array.isArray(entrada.imagens) ? entrada.imagens.slice(0,8) : []).entries()) {
    if (!objeto(img) || !seguro(img.url)) erros.push("URL HTTPS de imagem inválida: " + i);
    else if (img.aprovada === true || img.direitos_confirmados === true)
      erros.push("Agente não pode aprovar imagem nem seus direitos: " + i);
    else pendencias.push("Imagem " + (i+1) + " exige conferência física e jurídica.");
  }

  if (!objeto(entrada.taxonomia)) erros.push("Bloco taxonomia ausente.");
  else if (entrada.taxonomia.no_id == null) pendencias.push("Nó da taxonomia ausente.");
  if (!objeto(entrada.texto)) erros.push("Bloco de texto ausente.");
  else if (entrada.texto.titulo != null && (typeof entrada.texto.titulo !== "string" || entrada.texto.titulo.length > 150))
    erros.push("Título SEO acima de 150 caracteres.");
  if (!objeto(entrada.logistica)) erros.push("Bloco logístico ausente.");
  else {
    const log = entrada.logistica;
    if (log.margem_percentual != null && (typeof log.margem_percentual !== "number"
      || log.margem_percentual < 10 || log.margem_percentual > 20))
      erros.push("Margem logística candidata deve estar na faixa 10 a 20%.");
    if (log.estimado === true && (!texto(log.base,300) || log.margem_percentual == null))
      erros.push("Estimativa logística exige base identificável e margem explícita.");
    if (log.peso_kg == null && log.dimensoes_cm == null)
      pendencias.push("Peso e dimensões sem medição real: manter vazios.");
  }

  return resultado();
}
