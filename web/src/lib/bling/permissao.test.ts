import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oauthLegadoAtivo, podeConectarBling } from './permissao.ts';
test('OAuth histórico fica desligado por padrão, sem configuração implícita',()=>{
  for(const v of [undefined,'','true','0'])assert.equal(oauthLegadoAtivo({WEB_OAUTH_LEGADO_ATIVO:v}),false);
  assert.equal(oauthLegadoAtivo({WEB_OAUTH_LEGADO_ATIVO:'1'}),true);
});
test('lojista só é autorizado pela RPC atual, com a loja exata e JWT do cliente',async()=>{
  const chamadas:unknown[]=[];
  const permitido=await podeConectarBling({rpc:async(fn,args)=>{chamadas.push({fn,args});return {data:true}}},'loja-A');
  assert.equal(permitido,true);assert.deepEqual(chamadas,[{fn:'pode_administrar_loja',args:{p_loja_id:'loja-A'}}]);
});
for(const resposta of [{data:false},{data:null},{data:'true'},{data:true,error:{message:'erro'}}])test('editor, loja alheia ou falha de permissão bloqueiam OAuth '+JSON.stringify(resposta),async()=>{
  assert.equal(await podeConectarBling({rpc:async()=>resposta},'loja-A'),false);
});
test('falha de rede fecha autorização',async()=>{
  assert.equal(await podeConectarBling({rpc:async()=>{throw Error('segredo')}},'loja-A'),false);
});
