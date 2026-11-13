import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import { expressaoBuscaCatalogo } from "./catalogoPaginacao.ts";

export type ProdutoWorkspace={id:string;sku:string|null;nome:string|null;marca:string|null;taxonomia_no_id:string|null;publicado:boolean};
export type AplicacaoWorkspace={produto_id:string;status:string;modelo:string|null;motorizacao:string|null;ano_inicial:number|null;ano_final:number|null};
export type DadosWorkspace={lojaId:string;produtos:ProdutoWorkspace[];aplicacoes:AplicacaoWorkspace[];nos:{id:string;nome:string}[];total:number|null;aprovadas:number|null;fila:number|null;publicados:number|null;erro:string|null};
/** Só leituras do cliente autenticado, sempre por loja. Nenhum snapshot embarcado. */
export function useWorkspaceDados(lojaId:string,pagina=1,busca=""){
 const [dados,setDados]=useState<DadosWorkspace|null>(null),[ciclo,setCiclo]=useState(0);
 useEffect(()=>{let ativo=true;setDados(null);
  async function carregar(){
   try{
    let produtos=supabase.from("produtos").select("id,sku,nome,marca,taxonomia_no_id,publicado",{count:"exact"}).eq("loja_id",lojaId).order("nome").range((pagina-1)*100,pagina*100-1);
    const filtro=expressaoBuscaCatalogo(busca);if(filtro)produtos=produtos.or(filtro);
    const [p,a,n,ap,f,pub]=await Promise.all([
     produtos,
     supabase.from("produto_aplicacoes").select("produto_id,status,modelo,motorizacao,ano_inicial,ano_final").eq("loja_id",lojaId).limit(100),
     supabase.from("taxonomia_nos").select("id,nome").limit(100),
     supabase.from("produto_aplicacoes").select("id",{count:"exact",head:true}).eq("loja_id",lojaId).eq("status","aprovado"),
     supabase.from("aprovacoes").select("id",{count:"exact",head:true}).eq("loja_id",lojaId).eq("estado","pendente"),
     supabase.from("produtos").select("id",{count:"exact",head:true}).eq("loja_id",lojaId).eq("publicado",true),
    ]);
    if(!ativo)return;
    const erro=p.error||a.error||n.error||ap.error||f.error||pub.error;
    setDados({lojaId,produtos:p.error?[]:p.data??[],aplicacoes:a.error?[]:a.data??[],nos:n.error?[]:n.data??[],total:p.error?null:p.count,aprovadas:ap.error?null:ap.count,fila:f.error?null:f.count,publicados:pub.error?null:pub.count,erro:erro?"Não foi possível conferir todos os dados autorizados. Totais indisponíveis são indicados por —.":null});
   }catch{if(ativo)setDados({lojaId,produtos:[],aplicacoes:[],nos:[],total:null,aprovadas:null,fila:null,publicados:null,erro:"Não foi possível consultar o espelho desta loja."});}
  }void carregar();return()=>{ativo=false;};
 },[lojaId,pagina,busca,ciclo]);
 return {dados:dados?.lojaId===lojaId?dados:null,recarregar:()=>setCiclo(c=>c+1)};
}
