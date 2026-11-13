// Painel autenticado: acesso direto às ferramentas EXISTENTES do Nano via mesmo Policy Engine.
// NÃO escreve no ERP. "preparar_erp" apenas cria uma proposta versionada com before/after e fontes.
// Escrita posterior é outro fluxo: Central de Inteligência, humano, simulação, executor e readback.
import { autenticar, blingLeitura, json, CORS } from "../_shared/conector/edge.ts";
import { dadosSupabase } from "../_shared/conector/dados.ts";
import { despachar } from "../_shared/conector/despacho.ts";
import { validarAcaoCatalogo } from "../_shared/conector/catalogo_ferramentas.ts";

Deno.serve(async(req) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if (req.method!=="POST") return json({erro:"Método não permitido."},405);
  let body:Record<string,unknown>;
  try {
    const raw=await req.text();
    if (raw.length>9500) return json({erro:"Solicitação excede o limite."},413);
    const obj:unknown=JSON.parse(raw);
    if (!obj || typeof obj!=="object" || Array.isArray(obj)) return json({erro:"Corpo inválido."},400);
    body=obj as Record<string,unknown>;
  } catch { return json({erro:"JSON inválido."},400); }
  const sessao=await autenticar(req,body.loja_id);
  if (sessao instanceof Response)return sessao;
  // Ferramentas são do lojista/editor autenticado; visitantes não usam credenciais do Bling.
  if (!["lojista","editor"].includes(sessao.papel))return json({erro:"Perfil sem permissão."},403);
  const validacao=validarAcaoCatalogo(body);
  if (!validacao.ok)return json({erro:validacao.erro},422);

  // Limita abuso do serviço por usuário e loja. Se o limiter falhar, bloqueia.
  const {data:permitido,error:erroLimite}=await sessao.admin.rpc("limite_chamada",{
    p_chave:"catalogo-tools:"+sessao.lojaId+":"+sessao.userId,
    p_max:15,p_janela_s:60
  });
  if (erroLimite || permitido!==true)return json({erro:"Limite temporário de consultas; tente novamente depois."},429);
  const precisaBling=validacao.dados.ferramenta.startsWith("bling.");
  const bling=await blingLeitura(sessao);
  if (precisaBling && !bling)return json({erro:"Bling indisponível: reconecte ou consulte o painel de conexões."},503);

  const resultado=await despachar(validacao.dados.ferramenta,validacao.dados.entrada,{
    origem:"chat",lojaId:sessao.lojaId,userId:sessao.userId,
    rpc:(fn,args)=>sessao.admin.rpc(fn,args),
    admin:sessao.admin,
    dados:dadosSupabase(sessao.admin,sessao.lojaId),
    bling,
    agente:{nome:"Painel do lojista",provedor:"nenhum"}
  });
  if(resultado.auditoria_falhou) return json({erro:"Falha na auditoria. Confira a Central antes de repetir; uma proposta pode já ter sido registrada."},503);
  if(!resultado.ok)return json({erro:resultado.erro??"Ferramenta recusada.",decisao:resultado.decisao},422);
  return json({ok:true,modo:"consulta_ou_proposta",ferramenta:validacao.dados.ferramenta,
    resultado:resultado.resultado,observacao:"Nenhuma gravação foi enviada ao Bling."});
});