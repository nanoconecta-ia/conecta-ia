-- Revisão HUMANA de fotos e banners recebidos pelo MCP.
-- Confirmação = uso interno no Conecta.IA, NÃO publicação e NÃO escrita no Bling.
alter table public.conecta_midia_pendentes
  add column if not exists decisao_por uuid,
  add column if not exists decisao_em timestamptz,
  add column if not exists direitos_confirmados_em timestamptz,
  add column if not exists observacao_decisao text
    check (observacao_decisao is null or length(observacao_decisao)<=500);

-- Defesa em profundidade: mesmo o service_role NÃO pode vincular a foto a outro SKU/loja.
create or replace function private.conecta_midia_conferir_vinculo()
returns trigger language plpgsql set search_path = '' as $$
declare v_sku text; v_loja uuid;
begin
  select p.sku,p.loja_id into v_sku,v_loja from public.produtos p where p.id=new.produto_id;
  if v_loja is distinct from new.loja_id or v_sku is distinct from new.sku then
    raise exception 'produto ou SKU nao pertence a loja' using errcode='23514';
  end if;
  if new.aplicacao_id is not null and not exists (
    select 1 from public.produto_aplicacoes a
    where a.id=new.aplicacao_id and a.produto_id=new.produto_id and a.loja_id=new.loja_id
    and a.status='aprovado' and a.pagina_indexavel=true and coalesce(a.pagina_slug,'')<>''
  ) then
    raise exception 'aplicacao nao aprovada para este SKU' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists conecta_midia_validar_vinculo on public.conecta_midia_pendentes;
create trigger conecta_midia_validar_vinculo
  before insert on public.conecta_midia_pendentes
  for each row execute function private.conecta_midia_conferir_vinculo();

-- Acesso temporário de visualização à mídia privada somente para lojista da mesma loja.
-- O navegador solicitará signed URL de no máximo 120 s, jamais public URL.
create policy conecta_midia_preview_dono
on storage.objects for select to authenticated
using (
  bucket_id='agente-anexos' and name like 'mcp-midias/%'
  and exists (
    select 1 from public.conecta_midia_pendentes m
    where m.storage_bucket=storage.objects.bucket_id
    and m.storage_path=storage.objects.name
    and private.administra_loja(m.loja_id, (select auth.uid()))
  )
);

-- A aprovação grava somente decisão na fila privada. Não movimenta imagem para bucket público.
create or replace function public.conecta_midia_decidir(
  p_loja uuid, p_midia uuid, p_acao text,
  p_criado_em timestamptz, p_confirmou_direitos boolean default false,
  p_observacao text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_ator uuid; v_row public.conecta_midia_pendentes%rowtype; v_decisao text;
begin
  v_ator := auth.uid();
  if v_ator is null or not private.administra_loja(p_loja,v_ator) then
    raise exception 'sem_permissao: somente lojista' using errcode='42501';
  end if;
  if p_acao is null or p_acao not in ('aprovar','rejeitar') then
    raise exception 'acao_invalida' using errcode='22023';
  end if;
  if p_acao='aprovar' and p_confirmou_direitos is distinct from true then
    raise exception 'direitos_nao_confirmados' using errcode='22023';
  end if;
  if length(coalesce(p_observacao,''))>500 then
    raise exception 'observacao_muito_longa' using errcode='22023';
  end if;
  select * into v_row from public.conecta_midia_pendentes
    where id=p_midia and loja_id=p_loja and criado_em=p_criado_em and status='a_confirmar'
    for update;
  if not found then
    raise exception 'midia_foi_alterada_ou_nao_esta_pendente' using errcode='40001';
  end if;
  if p_acao='aprovar' and v_row.aplicacao_id is not null and not exists (
    select 1 from public.produto_aplicacoes a
    where a.id=v_row.aplicacao_id and a.loja_id=p_loja
    and a.produto_id=v_row.produto_id and a.status='aprovado'
    and a.pagina_indexavel=true and coalesce(a.pagina_slug,'')<>''
  ) then
    raise exception 'pagina_de_aplicacao_nao_esta_aprovada' using errcode='22023';
  end if;
  v_decisao:=case when p_acao='aprovar' then 'aprovada' else 'rejeitada' end;
  update public.conecta_midia_pendentes set
    status=v_decisao,
    decisao_por=v_ator, decisao_em=now(),
    direitos_confirmados_em=case when p_acao='aprovar' then now() else null end,
    observacao_decisao=nullif(trim(p_observacao),'')
  where id=p_midia and loja_id=p_loja;
  return jsonb_build_object('ok',true,'midia_id',p_midia,'estado',v_decisao,
    'publicada',false,'alterou_bling',false);
end;
$$;
revoke all on function public.conecta_midia_decidir(uuid,uuid,text,timestamptz,boolean,text)
  from public,anon,authenticated;
grant execute on function public.conecta_midia_decidir(uuid,uuid,text,timestamptz,boolean,text)
  to authenticated;
comment on function public.conecta_midia_decidir(uuid,uuid,text,timestamptz,boolean,text)
  is 'Decisão de visualização de mídia pelo lojista; somente staging privado, sem publicação.';
