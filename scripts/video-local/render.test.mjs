import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { argumentos, prepararRenderizacao, parametrosFfmpeg, executarRenderizacao, verificarBinario } from "./render.mjs";

function fixture() {
  const root=mkdtempSync(join(tmpdir(),"nano-video-teste-")), media=join(root,"fotos"), output=join(root,"saida");
  mkdirSync(media);mkdirSync(output);
  const bytes=Buffer.alloc(120,0);bytes.set([0x89,0x50,0x4e,0x47],0);
  const nome="bomba-hr.png";writeFileSync(join(media,nome),bytes);
  const sha256=createHash("sha256").update(bytes).digest("hex");
  const plano={versao:1,tipo:"nano-video-local",loja_id:"0a000000-0000-4000-8000-000000000001",
    sku:"CI000016",titulo:"Bomba de agua HR 8V",marca:"",formato:"reels",
    segundos_por_foto:3,fotos:[{nome,sha256,bytes:bytes.length}],aprovacao:"pendente"};
  const manifest=join(root,"plano.json");writeFileSync(manifest,JSON.stringify(plano));
  return {root,media,output,manifest,plano,bytes,nome,limpar:()=>rmSync(root,{recursive:true,force:true})};
}
test("video: simulação verifica SHA original, destino e não executa FFmpeg", async()=>{
 const f=fixture();try{
  const saida=await executarRenderizacao({...f,dryRun:true},()=>{throw Error("FFmpeg nao deveria ser executado")});
  assert.equal(saida.gerado,false);assert.equal(saida.duracao_s,3);assert.equal(saida.fotos,1);
  assert.ok(saida.destino.endsWith("nano-video-CI000016.mp4"));
 }finally{f.limpar();}
});
test("video: comando FFmpeg é argv fixo, sem shell e em H.264",()=>{
 const f=fixture();try{
  const prep=prepararRenderizacao(f),args=parametrosFfmpeg(prep);
  assert.ok(args.includes("libx264"));assert.ok(args.includes("+faststart"));
  assert.ok(args.includes("-nostdin"));assert.ok(args.includes("-n"));
  assert.match(args[args.indexOf("-filter_complex")+1],/scale=720:1280/);
  assert.equal(args.at(-1),prep.arquivo);
 }finally{f.limpar();}
});
test("video: arquivo adulterado nao pode ser usado",()=>{
 const f=fixture();try{
  writeFileSync(join(f.media,f.nome),Buffer.alloc(120,42));
  assert.throws(()=>prepararRenderizacao(f),/Original não confere/);
 }finally{f.limpar();}
});
test("video: bloqueia symlink que escapa da pasta de fotos",()=>{
 const f=fixture();try{
  rmSync(join(f.media,f.nome));writeFileSync(join(f.root,f.nome),f.bytes);
  try{symlinkSync(join(f.root,f.nome),join(f.media,f.nome));}
  catch{return;} // Windows sem permissao de symlink: outros testes continuam executando.
  assert.throws(()=>prepararRenderizacao(f),/fora da pasta autorizada/);
 }finally{f.limpar();}
});
test("video: exige autorizacao; nunca renderiza sem approve",async()=>{
 const f=fixture();try{
  await assert.rejects(()=>executarRenderizacao(f,()=>{throw Error("nao executar")}),/exige autorização/);
  assert.throws(()=>argumentos(["--manifest","x","--media","y","--output","z"]),/apenas um/);
  assert.throws(()=>argumentos(["--manifest","x","--media","y","--output","z","--approve","--dry-run"]),/apenas um/);
 }finally{f.limpar();}
});
test("video: nao sobrescreve exportacao existente",()=>{
 const f=fixture();try{
  writeFileSync(join(f.output,"nano-video-CI000016.mp4"),Buffer.from("anterior"));
  assert.throws(()=>prepararRenderizacao(f),/já existe/);
 }finally{f.limpar();}
});

test("video: FFmpeg so roda com caminho absoluto e SHA-256 conferido; sem isso nada executa",async()=>{
 const f=fixture();try{
  const bin=join(f.root,"ffmpeg-falso");writeFileSync(bin,"ffmpeg de teste");
  const sha=createHash("sha256").update("ffmpeg de teste").digest("hex");
  const nuncaLanca=()=>{throw Error("nao deveria executar");};
  await assert.rejects(()=>executarRenderizacao({...f,approve:true,dryRun:false,ffmpeg:null,ffmpegSha256:sha},nuncaLanca),/ABSOLUTO/);
  await assert.rejects(()=>executarRenderizacao({...f,approve:true,dryRun:false,ffmpeg:bin,ffmpegSha256:null},nuncaLanca),/--ffmpeg-sha256/);
  await assert.rejects(()=>executarRenderizacao({...f,approve:true,dryRun:false,ffmpeg:bin,ffmpegSha256:"0".repeat(64)},nuncaLanca),/não confere/);
  assert.equal(await verificarBinario(bin,sha.toUpperCase()),bin);
 }finally{f.limpar();}
});
test("video: falha do FFmpeg apaga o MP4 parcial e permite nova tentativa",async()=>{
 const f=fixture();try{
  const bin=join(f.root,"ffmpeg-falso");writeFileSync(bin,"ffmpeg de teste");
  const sha=createHash("sha256").update("ffmpeg de teste").digest("hex");
  const { EventEmitter } = await import("node:events");
  const { writeFileSync: gravar, existsSync } = await import("node:fs");
  const lancarQueFalha=(_b,args)=>{const p=new EventEmitter();p.stderr=new EventEmitter();gravar(args.at(-1),"parcial");setImmediate(()=>p.emit("close",1));return p;};
  await assert.rejects(()=>executarRenderizacao({...f,approve:true,dryRun:false,ffmpeg:bin,ffmpegSha256:sha},lancarQueFalha),/FFmpeg falhou/);
  assert.equal(existsSync(join(f.output,"nano-video-CI000016.mp4")),false,"parcial removido");
  assert.doesNotThrow(()=>prepararRenderizacao(f),"nova tentativa nao e bloqueada");
 }finally{f.limpar();}
});
