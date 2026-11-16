-- Bloqueio adicional para evitar registrar VIN/chassi nos links ou observações.
create or replace function public.mobis_registrar_oem_partsouq(
  p_loja uuid,p_produto uuid,p_codigo text,p_url text,
  p_aplicacao uuid default null,p_diagrama text default null,
  p_item text default null,p_regiao text default 'a_confirmar',
  p_vin_consultado boolean default false,p_observacoes text default null
) returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare v_fonte uuid;v_id uuid;
begin
 if (select auth.uid()) is null
   or not coalesce(public.pode_administrar_loja(p_loja),false) then
   raise exception 'Acesso restrito ao administrador' using errcode='42501';
 end if;
 if not exists(select 1 from public.produtos
   where id=p_produto and loja_id=p_loja) then
   raise exception 'Produto não pertence à loja' using errcode='22023';
 end if;
 if p_aplicacao is not null and not exists(select 1
   from public.produto_aplicacoes where id=p_aplicacao
   and loja_id=p_loja and produto_id=p_produto) then
   raise exception 'Aplicação não pertence ao produto' using errcode='22023';
 end if;
 if p_codigo is null or length(btrim(p_codigo)) not between 4 and 80
   or p_codigo !~ '^[A-Za-z0-9][A-Za-z0-9 ./_-]*$' then
   raise exception 'Código OEM inválido' using errcode='22023';
 end if;
 -- Somente URL da origem cadastrada. Nada de coletar VIN nos parâmetros.
 if p_url is null or length(p_url)>1200 or
   p_url !~ '^https://(www[.]|meta[.])?partsouq[.]com(/[^?# ]*)?([?][^# ]*)?$' then
   raise exception 'Somente URL HTTPS oficial PartSouq é aceita' using errcode='22023';
 end if;
 -- A URL pode conter VIN/chassi mesmo sem campo separado: rejeitar esses parâmetros.
 if p_url ~* '[?&](vin|frame|chassis|chassi)='
    or p_url ~* '[?&]q=[a-hj-npr-z0-9]{17}([&#]|$)'
    or coalesce(p_observacoes,'') ~* '(vin|chassi|chassis)[[:space:]:#=-]*[a-hj-npr-z0-9]{17}'
 then
   raise exception 'VIN/chassi identificável não pode ser armazenado na evidência' using errcode='22023';
 end if;
 select id into v_fonte from public.fontes
   where titulo='PartSouq — EPC / catálogo de peças genuínas'
   and tipo='epc' and url='https://partsouq.com/catalogs/'
   limit 1;
 if v_fonte is null then
   raise exception 'Fonte PartSouq não cadastrada' using errcode='23503';
 end if;
 insert into public.catalogo_evidencias_oem(
   loja_id,fonte_id,produto_id,aplicacao_id,codigo_oem,url_evidencia,
   diagrama_epc,ref_item_diagrama,regiao_catalogo,vin_usado_na_pesquisa,observacoes
 ) values (
   p_loja,v_fonte,p_produto,p_aplicacao,upper(btrim(p_codigo)),p_url,
   nullif(left(btrim(coalesce(p_diagrama,'')),180),''),
   nullif(left(btrim(coalesce(p_item,'')),120),''),
   left(btrim(coalesce(p_regiao,'a_confirmar')),120),
   coalesce(p_vin_consultado,false),nullif(left(btrim(coalesce(p_observacoes,'')),1200),'')
 ) on conflict do nothing returning id into v_id;
 if v_id is null then
   select id into v_id from public.catalogo_evidencias_oem
   where loja_id=p_loja and produto_id=p_produto
   and aplicacao_id is not distinct from p_aplicacao
   and upper(btrim(codigo_oem))=upper(btrim(p_codigo))
   and url_evidencia=p_url limit 1;
 end if;
 return v_id;
end;
$$;

