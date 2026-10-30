/**
 * Read-only preflight. Falha fechada se o GitHub Environment não existe
 * ou não exige aprovação de um revisor ANTES de acessar segredos Cloudflare.
 * O workflow_dispatch nunca deve criar ambiente desprotegido implicitamente.
 */
import assert from "node:assert/strict";
const repo=process.env.GITHUB_REPOSITORY, token=process.env.GH_TOKEN;
const envName="cloudflare-homologacao-free";
assert.equal(repo,"nanoconecta-ia/conecta-ia");
if (!token)throw Error("token_github_indisponivel");
const response=await fetch(
 `https://api.github.com/repos/${repo}/environments/${envName}`,
 {headers:{accept:"application/vnd.github+json",authorization:"Bearer "+token,
 "x-github-api-version":"2022-11-28"},signal:AbortSignal.timeout(12000)});
if(response.status===404)throw Error("ambiente_protegido_ainda_nao_criado");
if(!response.ok)throw Error("protecao_de_ambiente_nao_verificada");
const config=await response.json();
if(config.name?.toLowerCase()!==envName)throw Error("ambiente_incorreto");
const rules=Array.isArray(config.protection_rules)?config.protection_rules:[];
const review=rules.find(x=>x.type==="required_reviewers"&&Array.isArray(x.reviewers)&&x.reviewers.length>0);
if(!review)throw Error("revisor_obrigatorio_ausente");
// O teste Free nunca deverá criar ambiente vazio ou liberar deploy por acidente.
console.log("PASS: cloudflare-homologacao-free existe e exige aprovação de revisor.");
