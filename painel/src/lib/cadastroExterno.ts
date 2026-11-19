// Importação local de propostas externas. NÃO grava no ERP, Supabase nem publica.
export type Valor = string | null;
export interface Especificacao { campo: string; valor: string; fonte: string }
export interface OEMProposto { montadora: string; codigo: string; fonte: string; status: "a_confirmar" }
export interface AplicacaoProposta { montadora: string; modelo: string; versao: string | null; motor: string | null; ano_inicial: number | null; ano_final: number | null; fonte: string; status: "a_confirmar" }
export interface FonteExterna { titulo: string; url: string }
export interface PacoteCadastro {
  formato: "conecta-cadastro-v1";
  sku: string;
  erp_origem: string;
  operacao: "propor_enriquecimento";
  produto: { descricao: Valor; marca: Valor; codigo_fabricante: Valor; gtin: Valor; especificacoes: Especificacao[] };
  referencias_oem: OEMProposto[];
  aplicacoes_veiculares: AplicacaoProposta[];
  fontes: FonteExterna[];
  pendencias: string[];
  publicar: false;
  status: "a_confirmar";
}
export type ResultadoCadastro = { ok: true; pacote: PacoteCadastro; alertas: string[] } | { ok: false; erros: string[] };

const limiteBytes = 30000;
const isObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const letras = (v: unknown, max: number): string | null => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;
const textoOpcional = (v: unknown, max: number): Valor | undefined => v === null || v === undefined ? null : letras(v, max) ?? undefined;
function somenteChaves(o: Record<string, unknown>, chaves: readonly string[], nome: string, erros: string[]) {
  const inesperadas = Object.keys(o).filter((k) => !chaves.includes(k));
  if (inesperadas.length) erros.push(nome + ": campos não permitidos: " + inesperadas.join(", "));
}
function ano(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  return Number.isInteger(v) && typeof v === "number" && v >= 1900 && v <= 2100 ? v : undefined;
}
function arraySeguro(v: unknown, max: number, nome: string, erros: string[]): unknown[] {
  if (!Array.isArray(v)) { erros.push(nome + ": deve ser uma lista."); return []; }
  if (v.length > max) { erros.push(nome + ": limite de " + max + " entradas."); return []; }
  return v;
}
const segredo = /(?:BEGIN PRIVATE KEY|Authorization\s*:\s*Bearer\s+\S+|(?:service_role|refresh_token|access_token|api_secret|senha_secreta)\s*["':=]\s*["']?\S+)/i;
export function validarCadastroExterno(texto: string): ResultadoCadastro {
  const erros: string[] = [];
  const alertas: string[] = [];
  if (texto.length > limiteBytes) return { ok: false, erros: ["Texto muito grande (limite: 30 mil caracteres)."] };
  if (segredo.test(texto)) return { ok: false, erros: ["O texto parece conter uma credencial. Remova senhas e tokens antes de continuar."] };
  const limpo = texto.trim().replace(/^\`\`\`(?:json)?\s*\n/i, "").replace(/\n\`\`\`\s*$/, "");
  let raw: unknown;
  try { raw = JSON.parse(limpo); } catch { return { ok: false, erros: ["Formato inválido. Cole somente um objeto JSON, sem explicações ao redor."] }; }
  if (!isObjeto(raw)) return { ok: false, erros: ["A proposta precisa ser um objeto JSON."] };
  somenteChaves(raw, ["formato","sku","erp_origem","operacao","produto","referencias_oem","aplicacoes_veiculares","fontes","pendencias","publicar","status"], "Cadastro", erros);
  if (raw.formato !== "conecta-cadastro-v1") erros.push("Formato esperado: conecta-cadastro-v1.");
  const sku = letras(raw.sku, 80);
  if (!sku) erros.push("SKU obrigatório (até 80 caracteres).");
  const erp = letras(raw.erp_origem, 80);
  if (!erp) erros.push("Informe o ERP de origem.");
  if (raw.operacao !== "propor_enriquecimento") erros.push("Somente propostas de enriquecimento são aceitas.");
  if (raw.publicar !== false) erros.push("O campo publicar deve ser false.");
  if (raw.status !== "a_confirmar") erros.push("O status deve ser a_confirmar.");
  if (!isObjeto(raw.produto)) erros.push("produto: objeto obrigatório.");
  const prod = isObjeto(raw.produto) ? raw.produto : {};
  somenteChaves(prod, ["descricao","marca","codigo_fabricante","gtin","especificacoes"], "Produto", erros);
  const campos = ["descricao","marca","codigo_fabricante","gtin"] as const;
  const val: Record<string, Valor> = {};
  for (const campo of campos) {
    const v = textoOpcional(prod[campo], campo==="descricao"?2000:120);
    if (v === undefined) erros.push("Produto: " + campo + " deve ser texto ou null.");
    val[campo] = v ?? null;
  }
  const especificacoes: Especificacao[] = [];
  for (const [i, v] of arraySeguro(prod.especificacoes, 30, "especificacoes", erros).entries()) {
    if (!isObjeto(v)) { erros.push("Especificação " + (i+1) + ": objeto inválido."); continue; }
    somenteChaves(v, ["campo","valor","fonte"], "Especificação " + (i+1), erros);
    const campo=letras(v.campo,80), valor=letras(v.valor,500), fonte=letras(v.fonte,500);
    if (!campo||!valor||!fonte) erros.push("Especificação " + (i+1) + " requer campo, valor e fonte.");
    else especificacoes.push({campo,valor,fonte});
  }
  const referencias_oem: OEMProposto[] = [];
  for(const [i,v] of arraySeguro(raw.referencias_oem, 30, "referencias_oem", erros).entries()){
    if(!isObjeto(v)){erros.push("OEM "+(i+1)+": objeto inválido.");continue;}
    somenteChaves(v, ["montadora","codigo","fonte","status"], "OEM "+(i+1), erros);
    const montadora=letras(v.montadora,80),codigo=letras(v.codigo,100),fonte=letras(v.fonte,500);
    if(!montadora||!codigo||!fonte){erros.push("OEM "+(i+1)+" exige montadora, código e fonte.");continue;}
    if(v.status!=="a_confirmar")alertas.push("OEM "+codigo+": status informado por agente foi redefinido para a confirmar.");
    referencias_oem.push({montadora,codigo,fonte,status:"a_confirmar"});
  }
  const aplicacoes_veiculares: AplicacaoProposta[] = [];
  for(const [i,v] of arraySeguro(raw.aplicacoes_veiculares,30,"aplicacoes_veiculares",erros).entries()){
    if(!isObjeto(v)){erros.push("Aplicação "+(i+1)+": objeto inválido.");continue;}
    somenteChaves(v,["montadora","modelo","versao","motor","ano_inicial","ano_final","fonte","status"],"Aplicação "+(i+1),erros);
    const montadora=letras(v.montadora,80),modelo=letras(v.modelo,80),fonte=letras(v.fonte,500);
    const versao=textoOpcional(v.versao,120),motor=textoOpcional(v.motor,120);
    const inicio=ano(v.ano_inicial),fim=ano(v.ano_final);
    if(!montadora||!modelo||!fonte||versao===undefined||motor===undefined||inicio===undefined||fim===undefined){erros.push("Aplicação "+(i+1)+": verifique montadora, modelo, versão, motor, anos e fonte.");continue;}
    if(inicio!==null&&fim!==null&&fim<inicio){erros.push("Aplicação "+(i+1)+": ano final anterior ao inicial.");continue;}
    if(v.status!=="a_confirmar")alertas.push("Aplicação "+montadora+" "+modelo+": status redefinido para a confirmar.");
    aplicacoes_veiculares.push({montadora,modelo,versao:versao??null,motor:motor??null,ano_inicial:inicio??null,ano_final:fim??null,fonte,status:"a_confirmar"});
  }
  const fontes: FonteExterna[] = [];
  for(const [i,v] of arraySeguro(raw.fontes,30,"fontes",erros).entries()){
    if(!isObjeto(v)){erros.push("Fonte "+(i+1)+": objeto inválido.");continue;}
    somenteChaves(v,["titulo","url"],"Fonte "+(i+1),erros);
    const titulo=letras(v.titulo,160),url=letras(v.url,1200);
    if(!titulo||!url){erros.push("Fonte "+(i+1)+": título e URL são obrigatórios.");continue;}
    try{const u=new URL(url);if(u.protocol!=="https:"||!u.hostname||u.username||u.password)throw Error();}catch{erros.push("Fonte "+(i+1)+": informe URL HTTPS válida.");continue;}
    fontes.push({titulo,url});
  }
  const pendencias: string[] = [];
  for(const [i,v] of arraySeguro(raw.pendencias,30,"pendencias",erros).entries()){
    const t=letras(v,400);
    if(!t) erros.push("Pendência "+(i+1)+": texto inválido.");else pendencias.push(t);
  }
  if(!fontes.length) alertas.push("Nenhuma fonte URL foi apresentada; conferir evidências antes de aceitar dados técnicos.");
  if(!aplicacoes_veiculares.length)alertas.push("Não há aplicações por veículo; somente a ficha informativa geral poderá ser proposta.");
  if(!erros.length&&(!sku||!erp))erros.push("Identidade incompleta.");
  if(erros.length)return {ok:false,erros};
  return {ok:true,pacote:{formato:"conecta-cadastro-v1",sku:sku!,erp_origem:erp!,operacao:"propor_enriquecimento",produto:{descricao:val.descricao,marca:val.marca,codigo_fabricante:val.codigo_fabricante,gtin:val.gtin,especificacoes},referencias_oem,aplicacoes_veiculares,fontes,pendencias,publicar:false,status:"a_confirmar"},alertas};
}
export function gerarPromptCadastro(sku: string): string {
  const limpo=sku.trim().slice(0,80);
  return [
    "Prepare uma proposta técnica para o SKU: "+(limpo||"[INFORME O SKU]")+".",
    "Use fatos documentados e fontes HTTPS; se não houver prova, deixe null ou lista vazia.",
    "Não invente código OEM, GTIN, preço, estoque, nota fiscal, ano, aplicação ou equivalência.",
    "Gere apenas JSON válido, sem bloco Markdown, no formato exato:",
    JSON.stringify({formato:"conecta-cadastro-v1",sku:limpo||"SKU",erp_origem:"Bling",operacao:"propor_enriquecimento",produto:{descricao:null,marca:null,codigo_fabricante:null,gtin:null,especificacoes:[]},referencias_oem:[],aplicacoes_veiculares:[],fontes:[],pendencias:["Confirmar identidade e aplicação no ERP"],publicar:false,status:"a_confirmar"},null,2),
    "Objetos de especificacoes: {campo,valor,fonte}; referencias_oem: {montadora,codigo,fonte,status:'a_confirmar'};",
    "aplicacoes_veiculares: {montadora,modelo,versao,motor,ano_inicial,ano_final,fonte,status:'a_confirmar'};",
    "fontes: {titulo,url} (URL HTTPS). Tudo será revisado por humano, nada será publicado automaticamente.",
    "Um SKU físico no ERP; N páginas editoriais apenas para aplicações posteriormente aprovadas."
  ].join("\n");
}
