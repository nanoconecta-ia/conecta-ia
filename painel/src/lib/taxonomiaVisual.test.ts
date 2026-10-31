import { test } from "node:test";
import { strict as assert } from "node:assert";
import { atendeBusca, cvVerificado, fotoUtilizavel, tituloSeoCategoria, indicadoresCadastro, urlExternaSegura } from "./taxonomiaVisual.ts";
test("busca tolera acentos mas não infere aplicação por motor",()=>{
  assert.equal(atendeBusca("cabecote","Cabeçote e Válvulas"),true);
  assert.equal(atendeBusca("hr","L200 Triton","4N15"),false);
});
test("foto real só se aprovada e com direito confirmado",()=>{
  const base={url:"https://cdn.example.com/piston.webp",aprovada:true,tipo:"real",direitos_confirmados_em:"2026-10-31T00:00:00Z"};
  assert.equal(fotoUtilizavel(base),true);
  assert.equal(fotoUtilizavel({...base,tipo:"ilustrativa"}),false);
  assert.equal(fotoUtilizavel({...base,direitos_confirmados_em:null}),false);
  assert.equal(fotoUtilizavel({...base,removida_em:"2026-11-01"}),false);
  assert.equal(fotoUtilizavel({...base,url:"http://192.168.0.1/a"}),false);
  assert.equal(urlExternaSegura("https://user:pwd@catalogo.example.com/p"),null);
});
test("CV apenas quando potência foi verificada",()=>{
  assert.equal(cvVerificado(100,"aprovado"),"136");
  assert.equal(cvVerificado(100,"a_confirmar"),null);
  assert.equal(cvVerificado(null,"aprovado"),null);
});
test("prévia SEO não inventa versão e sinaliza documentação ausente",()=>{
  assert.equal(tituloSeoCategoria("Bombas d'água","Hyundai","HR"),"Bombas d'água | Hyundai | HR");
  const e=indicadoresCadastro({foto:false,codigoOem:false,versaoConfirmada:false});
  assert.equal(e.filter(x=>x.ok).length,0);
});
