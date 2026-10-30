/**
 * COMPARATIVO SINTÉTICO: tamanho de payloads em bytes e número de mensagens intermediárias.
 * NÃO mede tokens do modelo, custos reais, velocidade de rede, Sandbox, HTTP ou Bling.
 */
import { catalogoListar, catalogoVer, taxonomiaConsultar } from "./src/dados-sinteticos.mjs";

const consultas = ["D4CB", "D4BH", "TEST-A", "Bomba", "Kit", "Filtro", "Jogo", "D4CB", "TEST-A-001", ""];
let bytesBasico = 0, bytesFinal = 0, callsBasico = 0, callsCode = 0, operacoes = 0, igual = true;
for (let i = 0; i < 30; i++) {
  const busca = consultas[i % consultas.length];
  const primeiro = catalogoListar("piloto-a", { busca, limite: 10 });
  const detalhes = primeiro.map((p) => catalogoVer("piloto-a", p.sku));
  const classificacoes = [...new Set(detalhes.map((p) => p.motor))].map((motor) => taxonomiaConsultar("piloto-a", motor));
  const baseline = [primeiro, ...detalhes, ...classificacoes].map((r) => JSON.stringify(r));
  const final = detalhes.map((p) => ({ sku: p.sku, pendencias: p.pendencias, motor: p.motor }));
  const code = JSON.stringify({ itens: final, homologacao: "nao_verificada", origem: "fixture_sintetica" });
  // Mesmo resultado final derivado das leituras acima. Não compara duas execuções remotas.
  const extraido = JSON.parse(code);
  if (JSON.stringify(extraido.itens) !== JSON.stringify(final)) igual = false;
  bytesBasico += baseline.reduce((s, str) => s + Buffer.byteLength(str), 0);
  bytesFinal += Buffer.byteLength(code);
  callsBasico += baseline.length;
  callsCode++; // uma chamada externa do modelo Code Mode em vez de várias
  operacoes += baseline.length; // o backend ainda teria as mesmas operações internas
}
const economiaBytes = bytesBasico ? (1 - bytesFinal / bytesBasico) * 100 : 0;
const r = { amostras: 30, validacao_resultado: igual, bytes_intermediarios_mcp_comum: bytesBasico, bytes_agregados_code_mode: bytesFinal, reducao_bytes_simulada_pct: Number(economiaBytes.toFixed(1)), chamadas_modelo_baseline_hipoteticas: callsBasico, chamadas_modelo_code_mode_hipoteticas: callsCode, operacoes_backend_internas: operacoes,
  ressalva: "Estimativa de payload; NÃO mede tokens reais, latência, uso de API ou execução isolada." };
console.log(JSON.stringify(r, null, 2));
if (!igual || callsCode !== 30 || !Number.isFinite(economiaBytes)) process.exitCode = 1;
