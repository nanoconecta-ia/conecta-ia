/**
 * Dados FICTÍCIOS do piloto Code Mode.
 * Jamais importar Supabase/Bling, chamar fetch ou transportar custo/fiscal/fornecedor.
 */
export const BASE_DEMO = Object.freeze({
  "piloto-a": [
    { sku: "TEST-A-001", nome: "Bomba de água - teste D4CB", marca: null, motor: "D4CB", taxonomia: "Arrefecimento", peso_kg: null, largura_cm: null, altura_cm: 12, profundidade_cm: null },
    { sku: "TEST-A-002", nome: "Kit distribuição - teste D4CB", marca: "Marca demonstrativa", motor: "D4CB", taxonomia: null, peso_kg: 0.4, largura_cm: 20, altura_cm: 15, profundidade_cm: 7 },
    { sku: "TEST-A-003", nome: "Jogo de juntas - teste D4BH", marca: "Marca demonstrativa", motor: "D4BH", taxonomia: "Motor", peso_kg: 0.7, largura_cm: 24, altura_cm: 6, profundidade_cm: 19 },
  ],
  "piloto-b": [
    { sku: "TEST-B-101", nome: "Filtro de óleo sintético", marca: null, motor: "4M41", taxonomia: null, peso_kg: null, largura_cm: null, altura_cm: null, profundidade_cm: null },
  ],
});
export const TENANTS_VALIDOS = Object.freeze(Object.keys(BASE_DEMO));
function linhaPublica(p) {
  return { sku: p.sku, nome: p.nome, marca: p.marca, motor: p.motor, taxonomia: p.taxonomia, peso_kg: p.peso_kg, largura_cm: p.largura_cm, altura_cm: p.altura_cm, profundidade_cm: p.profundidade_cm };
}
export function pendencias(p) {
  const campos = [];
  if (!p.marca) campos.push("marca");
  if (!p.taxonomia) campos.push("taxonomia");
  if ([p.peso_kg, p.largura_cm, p.altura_cm, p.profundidade_cm].some((x) => typeof x !== "number" || !Number.isFinite(x) || x <= 0)) campos.push("logistica");
  return campos;
}
function listarDados(tenant) {
  if (!Object.hasOwn(BASE_DEMO, tenant)) throw new Error("tenant_nao_autorizado");
  return BASE_DEMO[tenant];
}
/** Só permite leitura da loja passada pelo contexto autenticado, nunca pelos parâmetros da IA. */
export function catalogoListar(tenant, { busca = "", limite = 10 } = {}) {
  if (typeof busca !== "string" || busca.length > 80 || !Number.isInteger(limite) || limite < 1 || limite > 20) throw new Error("argumento_invalido");
  const q = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  return listarDados(tenant)
    .filter((p) => !q || [p.sku, p.nome, p.motor].some((v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(q)))
    .slice(0, limite).map((p) => ({ sku: p.sku, nome: p.nome, motor: p.motor, pendencias: pendencias(p) }));
}
export function catalogoVer(tenant, sku) {
  if (typeof sku !== "string" || !/^TEST-[A-Z0-9-]{1,32}$/.test(sku)) throw new Error("sku_invalido");
  const p = listarDados(tenant).find((x) => x.sku === sku);
  if (!p) throw new Error("produto_nao_encontrado_nesta_loja");
  return { ...linhaPublica(p), pendencias: pendencias(p), origem: "fixture_sintetica", homologado: false };
}
export function taxonomiaConsultar(tenant, motor) {
  if (typeof motor !== "string" || !/^[A-Z0-9-]{2,16}$/.test(motor)) throw new Error("motor_invalido");
  const encontrados = listarDados(tenant).filter((p) => p.motor === motor);
  return {
    motor, quantidade: encontrados.length,
    categorias_candidatas: [...new Set(encontrados.map((p) => p.taxonomia).filter(Boolean))],
    homologacao: "nao_verificada",
    aviso: "Mesmo motor não prova compatibilidade de peça; confirmar por aplicação, referência e fonte.",
  };
}
export function resumoCatalogo(tenant) {
  const p = listarDados(tenant);
  return { produtos: p.length, incompletos: p.filter((x) => pendencias(x).length > 0).length, origem: "fixture_sintetica" };
}
