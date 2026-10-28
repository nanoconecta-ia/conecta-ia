// Simulação LOCAL (sem rede, sem banco): colisão dos baldes de IP do guarda do PR #112, usando o chaveOpaca/baldeDe reais.
import { chaveOpaca, baldeDe } from new URL("../../supabase/functions/_shared/limite/publico.ts", import.meta.url).pathname;
const N_BALDES = 2048, SEG = "segredo-de-simulacao";
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const ipAleat = () => `${1 + Math.floor(rnd() * 223)}.${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}`;
const pool: number[] = []; // balde de 120k IPs sintéticos
for (let i = 0; i < 120000; i++) pool.push(baldeDe(await chaveOpaca(ipAleat(), SEG), N_BALDES));
// 1) uniformidade
const cont = new Array(N_BALDES).fill(0); for (const b of pool) cont[b]++;
const med = pool.length / N_BALDES, chi = cont.reduce((s, c) => s + (c - med) ** 2 / med, 0);
console.log(`uniformidade: média ${med.toFixed(1)}/balde, min ${Math.min(...cont)}, max ${Math.max(...cont)}, qui² ${chi.toFixed(0)} (esperado ≈ ${N_BALDES - 1} ± ${(2 * (N_BALDES - 1)) ** 0.5 | 0})`);
// 2) por minuto: N IPs ativos, cada um com r pedidos; pedidos negados no balde acima de TETO (60 rajada)
const TETO = 60;
function minuto(nIps: number, r: (i: number) => number) {
  const tot = new Array(N_BALDES).fill(0); const dono: number[] = [];
  for (let i = 0; i < nIps; i++) { const b = pool[Math.floor(rnd() * pool.length)]; dono.push(b); tot[b] += r(i); }
  let pedidos = 0, negados = 0, ipsAfetados = 0, comColisao = 0;
  const nIpsBalde = new Array(N_BALDES).fill(0); for (const b of dono) nIpsBalde[b]++;
  for (let b = 0; b < N_BALDES; b++) { pedidos += tot[b]; negados += Math.max(0, tot[b] - TETO); }
  for (const b of dono) { if (nIpsBalde[b] > 1) comColisao++; if (tot[b] > TETO) ipsAfetados++; }
  return { comColisao: comColisao / nIps, negados: negados / Math.max(1, pedidos), ipsAfetados: ipsAfetados / nIps };
}
console.log("\nA) navegação normal: cada IP faz 5 pedidos/min");
for (const n of [100, 500, 1000, 2048, 5000, 20000]) { const m = minuto(n, () => 5); console.log(`  ${String(n).padStart(6)} IPs/min  IPs que dividem balde ${(m.comColisao * 100).toFixed(1)}%  | pedidos negados ${(m.negados * 100).toFixed(2)}%  | IPs em balde saturado ${(m.ipsAfetados * 100).toFixed(2)}%`); }
console.log("\nB) uso intenso: cada IP faz 20 pedidos/min (ex.: vitrine-assistente no limite)");
for (const n of [100, 500, 1000, 2048, 5000]) { const m = minuto(n, () => 20); console.log(`  ${String(n).padStart(6)} IPs/min  IPs que dividem balde ${(m.comColisao * 100).toFixed(1)}%  | pedidos negados ${(m.negados * 100).toFixed(2)}%  | IPs em balde saturado ${(m.ipsAfetados * 100).toFixed(2)}%`); }
console.log("\nC) NAT/operadora: 1 IP com 40 usuários × 5 pedidos/min = 200 pedidos/min no MESMO IP (limite 60)");
console.log(`  pedidos aceitos 60/200 = 30% → 70% negados SEM colisão nenhuma (limite por IP, não por balde)`);
// 3) ataque: M IPs saturando 60/min cada; o teto da loja (1200 aceitos/min) limita quantos pedidos chegam às chaves de IP
console.log("\nD) atacante com M IPs, 60 pedidos/min cada; vítima = 1 IP legítimo com 5 pedidos/min");
for (const M of [20, 100, 1000, 5000]) {
  const aceitos = Math.min(M * 60, 1200); const ipsEfetivos = Math.floor(aceitos / 60); // só os aceitos pela loja gravam chave de IP
  const semLoja = 1 - (1 - 1 / N_BALDES) ** M, comLoja = 1 - (1 - 1 / N_BALDES) ** ipsEfetivos;
  console.log(`  M=${String(M).padStart(5)}  baldes saturados SEM teto de loja ${(semLoja * 100).toFixed(1)}%  | COM teto de loja primeiro: ${(comLoja * 100).toFixed(2)}% (≤${ipsEfetivos} baldes)  → chance de a vítima cair em balde saturado`);
}
// 4) tamanho da tabela: pior caso com retenção 2 h
const LINHA = 170;
const rajadaPorMin = Math.min(N_BALDES, 1200); // novas linhas de rajada por minuto, por endpoint, limitado pelo teto de loja (1 loja)
console.log("\nE) linhas na tabela (pior caso, 1 loja atacando os 2 endpoints, ~170 B/linha)");
for (const [rotulo, min] of [["retenção 2 h para tudo", 120], ["retenção 10 min só p/ rajada (emenda proposta)", 10]]) {
  const rajada = rajadaPorMin * 2 * (min as number), sust = N_BALDES * 2 * 3, lojas = 2 * 120 * 1;
  const total = rajada + sust + lojas; console.log(`  ${rotulo}: ~${total.toLocaleString("pt-BR")} linhas ≈ ${(total * LINHA / 1e6).toFixed(1)} MB`);
}
