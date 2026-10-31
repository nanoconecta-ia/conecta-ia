import { test } from "node:test";
import { strict as assert } from "node:assert";
import { fonteAprovada, fotoAprovada, resumirOem, seoCandidato, urlPublicaSegura, type MidiaCadastro } from "./atlasTecnico.ts";
const foto: MidiaCadastro = {url:"https://midia.fabricante.example/peca.jpg",url_tratada:null,alt_texto:"Bomba de água",tipo:"produto",origem:"fabricante",direitos:"uso autorizado",licenca_tipo:"comercial",direitos_confirmados_em:"2026-10-31",aprovada:true,removida_em:null};
test("nunca mostra foto não licenciada, pendente ou removida",()=>{
  assert.equal(fotoAprovada(foto),"https://midia.fabricante.example/peca.jpg");
  for(const m of [{aprovada:false},{direitos_confirmados_em:null},{licenca_tipo:null},{removida_em:"2026-11-01"},{origem:""}]){
    assert.equal(fotoAprovada({...foto,...m}),null);
  }
});
test("URLs não podem ser privadas, inseguras ou portar credenciais",()=>{
  for(const v of ["http://site.com/a.jpg","https://127.0.0.1/a","https://user:senha@site.com/a","https://192.168.0.1/","file:///etc/passwd","https://sso.local/a"]) assert.equal(urlPublicaSegura(v),null);
});
test("OEM só é homologado com fonte HTTPS, data e status aprovado",()=>{
  const aprov={tipo:"oem",valor:"25212-4A800",fonte:"https://fabricante.example/catalogo",coletado_em:"2026-10-20",status:"aprovado"};
  const pend={...aprov,valor:"CODIGO-INVENTADO",status:"a_confirmar"};
  assert.deepEqual(resumirOem([aprov,pend,aprov]),["25212-4A800"]);
  assert.equal(fonteAprovada({...aprov,fonte:null}),false);
});
test("SEO não inventa cv, aplicação ou OEM pendente",()=>{
  const r=seoCandidato({nome:"Bomba d'água",sku:"CI000016",marca:"Fabricante"},[],[]);
  assert.match(r.descricao,/não homologada/);
  assert.doesNotMatch(JSON.stringify(r),/pot[eê]ncia|\bcv\b|D4CB/i);
  assert.equal(r.publicavel,false);
  assert.ok(r.titulo.length<=60);assert.ok(r.descricao.length<=155);
});
