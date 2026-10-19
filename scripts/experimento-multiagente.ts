// Executa o experimento (20 produtos de teste × 4 braços, cada um 3 vezes) e imprime as métricas.
//   node --experimental-strip-types scripts/experimento-multiagente.ts [saida.json] [--md]
// Precisão, erros e contagens são determinísticos; o TEMPO usa a mediana das 3 execuções (as latências das fontes são simuladas).
import { writeFileSync } from "node:fs";
import { avaliar, executarBraco, PREMISSAS, type Metricas, type NomeBraco } from "../supabase/functions/_shared/multiagente/experimento.ts";

const bracos: NomeBraco[] = ["S0", "S1", "M", "M_orcamento_apertado"];
const resultados: (Metricas & { total_ms: number; falhas: string[] })[] = [];
for (const b of bracos) {
  const rodadas = [];
  for (let i = 0; i < 3; i++) { const r = await executarBraco(b); rodadas.push({ ...avaliar(r), total_ms: r.total_ms, falhas: r.falhas }); }
  rodadas.sort((a, c) => a.total_ms - c.total_ms);
  resultados.push(rodadas[1]);
}
const saida = { premissas: PREMISSAS, resultados };
const arq = process.argv.find((a) => a.endsWith(".json"));
if (arq) writeFileSync(arq, JSON.stringify(saida, null, 1));
if (process.argv.includes("--md")) {
  const linhas: [string, (m: Metricas) => string | number][] = [
    ["Identificação correta (OEM, marca, classe)", (m) => `${m.identificacao_correta}/${m.produtos - m.retidos_por_orcamento}`],
    ["Duplicidades evitadas / esperadas", (m) => `${m.duplicidades_evitadas}/${m.duplicidades_esperadas}`],
    ["Duplicidades falsas (alarme indevido)", (m) => m.duplicidades_falsas],
    ["Taxonomia certa (inclui abster-se quando não há regra)", (m) => `${m.taxonomia_certa}/${m.produtos - m.retidos_por_orcamento}`],
    ["Taxonomia errada", (m) => m.taxonomia_errada],
    ["Compatibilidades confirmadas corretas / esperadas", (m) => `${m.confirmadas_corretas}/${m.confirmadas_esperadas}`],
    ["Falsas confirmações de compatibilidade", (m) => m.falsas_confirmacoes],
    ["Produtos com algum erro / taxa", (m) => `${m.produtos_com_erro} (${(m.taxa_de_erro * 100).toFixed(0)}%)`],
    ["Conflitos escalados ao lojista / esperados", (m) => `${m.escalonamentos_feitos}/${m.escalonamentos_esperados}`],
    ["Escalonamentos desnecessários", (m) => m.escalonamentos_desnecessarios],
    ["Intervenções humanas: resolver conflito + aprovar", (m) => `${m.intervencoes_conflito} + ${m.intervencoes_aprovacao}`],
    ["Itens retidos na fila por orçamento", (m) => m.retidos_por_orcamento],
    ["Pendências registradas por produto", (m) => m.pendencias_por_produto],
    ["Procedência completa (fonte, data, confiança, situação)", (m) => `${(m.completude_procedencia * 100).toFixed(0)}%`],
    ["Aplicações com fonte oficial", (m) => `${(m.aplicacoes_oficiais * 100).toFixed(0)}%`],
    ["Evidências externas por produto", (m) => m.evidencias_externas_por_produto],
    ["Chamadas de API por produto", (m) => m.chamadas_api_por_produto.toFixed(2)],
    ["Custo por produto (USD, simulado)", (m) => m.custo_por_produto_usd.toFixed(5)],
    ["Tempo por produto (ms, mediana de 3 execuções)", (m) => m.tempo_por_produto_ms],
    ["Pico de chamadas simultâneas às fontes", (m) => m.pico_concorrencia],
  ];
  console.log(`| Métrica | ${resultados.map((r) => r.braco).join(" | ")} |\n|---|${resultados.map(() => "---:").join("|")}|`);
  for (const [nome, f] of linhas) console.log(`| ${nome} | ${resultados.map((r) => f(r)).join(" | ")} |`);
} else console.log(JSON.stringify(saida, null, 1));
