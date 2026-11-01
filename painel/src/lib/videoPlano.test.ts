import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATOS_VIDEO, montarPlanoVideo, nomePlanoVideo, validarPlanoVideo } from "./videoPlano.ts";

const foto = { nome: "bomba-hr.png", sha256: "a".repeat(64), bytes: 1024 };
const base = () => ({ loja_id: "0a000000-0000-4000-8000-000000000001", sku: "CI000016",
  titulo: "Bomba de agua HR 8V", marca: "", formato: "reels" as const, segundos_por_foto: 3, fotos: [foto] });
test("video: plano portavel, pendente, nenhuma publicacao automatica", () => {
  const r = montarPlanoVideo(base());
  assert.equal(r.ok, true);
  if(!r.ok) return;
  assert.equal(r.plano.aprovacao, "pendente");
  assert.deepEqual(Object.keys(r.plano).sort(), ["aprovacao","formato","fotos","loja_id","marca","segundos_por_foto","sku","tipo","titulo","versao"]);
  assert.equal(validarPlanoVideo(r.plano).ok, true);
  assert.equal(nomePlanoVideo("CI000016"), "nano-video-CI000016.json");
  assert.equal(FORMATOS_VIDEO.length, 3);
});
test("video: caminho, nome e URL externas sao recusados", () => {
  for (const nome of ["../etc.jpg", "/etc/segredo.png", "C:\\secret.png", "https://site.com/photo.jpg", ".oculta.png", "a.txt"]) {
    const p=montarPlanoVideo({ ...base(), fotos:[{...foto,nome}]});
    assert.equal(p.ok,false,nome);
  }
});
test("video: hash, tamanho, formato e quantidade invalida bloqueiam", () => {
  const entradas = [
    {...base(), fotos:[{...foto,sha256:"nao"}]},
    {...base(), fotos:[{...foto,bytes:50}]},
    {...base(), fotos:[]},
    {...base(), fotos:Array.from({length:5},(_,i)=>({...foto,nome:"f"+i+".png"}))},
    {...base(), fotos:[foto,foto]},
    {...base(), segundos_por_foto:30},
    {...base(), formato:"4K" as "reels"},
    {...base(), loja_id:"outra-loja"},
  ];
  for(const p of entradas) assert.equal(montarPlanoVideo(p).ok,false,JSON.stringify(p).slice(0,150));
});
test("video: campos sigilosos e SKU suspeito nao entram no manifesto", () => {
  for(const p of [{...base(),titulo:"Preco de custo R$10"}, {...base(),titulo:"CPF cliente 000"}, {...base(),sku:"../conf"},
    {...base(),marca:"fornecedor secreto"}]) assert.equal(montarPlanoVideo(p).ok,false);
});
