// Pré-triagem fiscal pública, sem CPF/CNPJ, nome, conta bancária ou endereço.
// NÃO cria contatos no Bling, pedido, pagamento ou NF. Sem regra validada => análise fiscal.
import { createClient } from "npm:@supabase/supabase-js@2";
import { guardarPublico, cabecalhoIpConfigurado, portaViaRpc, segredoDoLimite } from "../_shared/limite/publico.ts";
import { avaliarFiscal, validarEntrada, analise, type ContextoFiscal, type RegraFiscal } from "../_shared/loja/triagem_fiscal.ts";

const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const resposta=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{
  status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},
});
Deno.serve(async (req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return resposta({erro:"Método não permitido."},405);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url || !key)return resposta(analise("Triagem fiscal indisponível. Solicite conferência com a loja."),503);
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  // Reutiliza o limite conservador e tamanho máximo de corpo já testados da loja pública.
  const guard=await guardarPublico({
    endpoint:"loja-publica",req,
    segredo:segredoDoLimite(Deno.env),
    cabecalhoIp:cabecalhoIpConfigurado(Deno.env.get("LIMITE_CABECALHO_IP")),
    lojaDe:(b)=>typeof b?.slug==="string"?b.slug.slice(0,63):null,
    porta:portaViaRpc(sb),
    modo:"bloquear",
  });
  if(!guard.ok)return resposta(guard.corpo,guard.status);
  const e=validarEntrada(guard.corpo);
  if(!e)return resposta({erro:"Informe UF, tipo de comprador, condição no ICMS e finalidade válidos, sem inserir documentos."},400);
  const {data:loja,error:erroLoja}=await sb.from("lojas")
    .select("id,slug,ambiente,ativa").eq("slug",e.slug).eq("ativa",true).maybeSingle();
  if(erroLoja || !loja)return resposta({erro:"Loja não encontrada."},404);
  const {data:produto,error:erroProduto}=await sb.from("produtos")
    .select("id").eq("loja_id",loja.id).eq("sku",e.sku).eq("publicado",true).maybeSingle();
  if(erroProduto || !produto)return resposta({erro:"Produto não encontrado no catálogo publicado."},404);

  const [lf,pf,regra] = await Promise.all([
    sb.from("loja_fiscal").select("uf,regime,validado_em").eq("loja_id",loja.id).maybeSingle(),
    sb.from("produto_fiscal").select("status,ncm,validado_em").eq("loja_id",loja.id)
      .eq("produto_id",produto.id).maybeSingle(),
    sb.from("loja_regras_venda_uf")
      .select("uf_destino,tipo_destinatario,contribuinte_icms,finalidade,decisao,status,fundamento_normativo,fonte_oficial,validado_por_contador,validado_em,inicio_vigencia,fim_vigencia")
      .eq("loja_id",loja.id).eq("produto_id",produto.id).eq("uf_destino",e.uf_destino)
      .eq("tipo_destinatario",e.tipo_destinatario)
      .eq("contribuinte_icms",e.contribuinte_icms==="nao_sei"?"?":e.contribuinte_icms)
      .eq("finalidade",e.finalidade).maybeSingle(),
  ]);
  // Não presumir liberação quando a migração fiscal ainda não existe ou uma leitura falha.
  if(lf.error || pf.error || regra.error)return resposta(analise("Triagem ainda não homologada. Atendimento e contador devem avaliar a operação."));
  const contexto:ContextoFiscal={
    fase:loja.ambiente??"teste",
    lojaFiscal:lf.data,
    produtoFiscal:pf.data,
    regra:regra.data as RegraFiscal|null,
    hoje:new Date().toISOString().slice(0,10),
  };
  return resposta(avaliarFiscal(e,contexto));
});
