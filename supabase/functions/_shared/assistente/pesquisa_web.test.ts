import { test } from "node:test"; import { strict as assert } from "node:assert";
import { validarConsultaPublica, fontePublica, pesquisarWebPublica } from "./pesquisa_web.ts";
test("rejeita segredos ou URL de sessão; aceita OEM legítimo", () => {
  assert.equal(validarConsultaPublica("  4D56  pino 29 mm  "), "4D56 pino 29 mm");
  for(const v of ["cpf 12345678901","token abcxyz","R$ 150 custo","custo de aquisicao 140","margem 38 porcento","https://fornecedor/login","email@site.com"]) assert.throws(() => validarConsultaPublica(v));
});
test("retorna somente fontes públicas https, deduplicadas e sem inferir compatibilidade", async () => {
  const f = async (_u: string | URL | Request, o?: RequestInit) => {
    const b=JSON.parse(String(o?.body));
    assert.deepEqual(b.tools,[{google_search:{}}]);
    assert.equal(b.contents.length,1);
    assert.equal(o?.method,"POST");
    return new Response(JSON.stringify({ candidates: [{content:{parts:[{text:"Verifique aplicação no catálogo."}]},
      groundingMetadata:{webSearchQueries:["4D56 sensor"],groundingChunks:[
        {web:{uri:"https://fabricante.example/catalogo",title:"Catálogo OEM"}},
        {web:{uri:"https://fabricante.example/catalogo",title:"Catálogo duplicado"}},
        {web:{uri:"http://192.168.0.1/config",title:"Intranet"}}
      ]}}],usageMetadata:{totalTokenCount:158}}),{status:200});
  };
  const r=await pesquisarWebPublica("chave-sintetica","gemini-3.6-flash","4D56 sensor",f as typeof fetch);
  assert.equal(r.fontes.length,1); assert.equal(r.fundamentada,true); assert.equal(r.tokens,158);
  assert.match(r.resumo,/Verifique aplicação/);
});
test("falha fechada quando não há fontes citáveis",async()=>{
  const f=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Pino 29"}]}}]}),{status:200});
  const r=await pesquisarWebPublica("x","gemini-3.6-flash","4D56 pino",f as typeof fetch);
  assert.equal(r.fundamentada,false);assert.equal(r.fontes.length,0);assert.doesNotMatch(r.resumo,/Pino 29/);
});
test("cota excedida é erro explícito e não repete a chamada",async()=>{
  let n=0;const f=async()=>{n++;return new Response("{}",{status:429})};
  await assert.rejects(()=>pesquisarWebPublica("x","gemini-3.6-flash","4D56 bomba",f as typeof fetch),/Cota/);
  assert.equal(n,1);
});
test("links com IP interno/credenciais não são citados",()=>{
  for(const x of ["http://site.com","https://127.0.0.1/","https://user:pwd@site.com/","file:///abc"]){assert.equal(fontePublica(x,"x"),null)}
});
