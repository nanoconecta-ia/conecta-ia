import {test} from "node:test";
import assert from "node:assert/strict";
import {MODELOS_PALETA_MOBIS,PALETA_MOBIS_PADRAO,validarPaletaMobis,
 paletaPublicada,variaveisPaletaMobis,contraste} from "./paletaMobis.ts";
test("três combinações claras com contraste AA e cor institucional discreta",()=>{
  assert.equal(MODELOS_PALETA_MOBIS.length,3);
  for(const modelo of MODELOS_PALETA_MOBIS){
    assert.deepEqual(validarPaletaMobis(modelo.cores),{ok:true,cores:modelo.cores});
    assert.ok(contraste(modelo.cores.cor_botao,"#ffffff")>=4.5);
    assert.ok(contraste(modelo.cores.cor_texto,modelo.cores.cor_superficie)>=4.5);
  }
});
test("cores inválidas, perigosas ou ilegíveis não podem ser publicadas",()=>{
  for(const paleta of [
    null,{}, {...PALETA_MOBIS_PADRAO,cor_acento:"<script>"},
    {...PALETA_MOBIS_PADRAO,cor_acento:"#ff0000"},
    {...PALETA_MOBIS_PADRAO,cor_botao:"#f6f7f8"},
    {...PALETA_MOBIS_PADRAO,cor_fundo:"#000000"},
    {...PALETA_MOBIS_PADRAO,cor_texto:"#ffffff"},
  ]){
    assert.equal(validarPaletaMobis(paleta).ok,false);
    assert.equal(paletaPublicada(paleta),null);
  }
});
test("tokens públicos são apenas as cinco cores, sem logo, fonte ou dados sigilosos",()=>{
  const css=variaveisPaletaMobis(PALETA_MOBIS_PADRAO);
  assert.deepEqual(Object.keys(css).sort(),[
    "--mobis-fundo","--mobis-superficie","--mobis-texto","--mobis-botao","--mobis-acento"
  ].sort());
  assert.deepEqual(paletaPublicada(PALETA_MOBIS_PADRAO),PALETA_MOBIS_PADRAO);
});
