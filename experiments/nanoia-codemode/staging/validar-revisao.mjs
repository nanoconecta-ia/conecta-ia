/**
 * Verifica que o SHA exato do PR #153 foi testado por NOVE fluxos aprovados.
 * Executado SEM segredos Cloudflare, antes de liberar o job protegido.
 */
import assert from "node:assert/strict";
const sha=process.env.TARGET_SHA,token=process.env.GH_TOKEN;
const repo=process.env.GITHUB_REPOSITORY;
assert.match(sha??"",/^[a-f0-9]{40}$/);
assert.equal(repo,"nanoconecta-ia/conecta-ia");
if(!token)throw Error("github_token_indisponivel");
const expected=[
  "Testes das funções e do banco",
  "Fase 1 - preparação sem deploy",
  "OAuth do agente - cliente MCP e segurança",
  "Pair e gateway - artefatos sem produção",
  "NanoIA Code Mode - piloto isolado",
  "Painel (verificação em PR)",
  "Estúdio do agente - revisão visual sintética",
  "Conector IA (testes)",
  "Chat operacional - validação sem produção",
];
const url=`https://api.github.com/repos/${repo}/actions/runs?head_sha=${sha}&event=pull_request&per_page=100`;
const r=await fetch(url,{headers:{accept:"application/vnd.github+json",authorization:"Bearer "+token,
  "x-github-api-version":"2022-11-28"},signal:AbortSignal.timeout(12000)});
if(!r.ok)throw Error("nao_foi_possivel_confirmar_ci");
const data=await r.json();
const runs=Array.isArray(data.workflow_runs)?data.workflow_runs:[];
for(const name of expected){
  const approved=runs.some(x=>x.name===name && x.head_sha===sha && x.status==="completed" && x.conclusion==="success");
  if(!approved)throw Error("ci_nao_aprovada:"+name);
}
console.log("PASS: os nove fluxos estão verdes para "+sha.slice(0,8));
