-- MOBIS / Nano — Evidência OEM, catálogo EPC e compatibilidade de SKU são fatos distintos.
-- Registro privado, sem VIN integral, screenshot, desenho EPC nem scraping automático.
create table if not exists public.catalogo_evidencias_oem (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 fonte_id uuid not null references public.fontes(id),
 produto_id uuid not null references public.produtos(id) on delete cascade,
 aplicacao_id uuid references public.produto_aplicacoes(id) on delete set null,
 codigo_oem text not null check(length(btrim(codigo_oem)) between 4 and 80),
 url_evidencia text not null check(length(url_evidencia)<=1200 and url_evidencia like 'https://%'),
 diagrama_epc text check(diagrama_epc is null or length(diagrama_epc)<=180),
 ref_item_diagrama text check(ref_item_diagrama is null or length(ref_item_diagrama)<=120),
 regiao_catalogo text not null default 'a_confirmar',
 situacao_evidencia text not null default 'candidato'
    check(situacao_evidencia in ('candidato','em_revisao','documentado','rejeitado')),
 relacao_sku text not null default 'nao_verificada'
    check(relacao_sku in ('nao_verificada','verificacao_pendente','equivalente_comprovado','incompativel')),
 confirmacao_independente_url text,
 confirmacao_peca_documento text,
 validacao_tecnica text,
 revisor text,
 revisado_em timestamptz,
 consultado_em timestamptz not null default now(),
 vin_usado_na_pesquisa boolean not null default false,
 observacoes text check(observacoes is null or length(observacoes)<=1200),
 criado_em timestamptz not null default now(),
 constraint catalogo_evidencias_oem_documentado_check check (
   situacao_evidencia <> 'documentado'
   or (nullif(btrim(confirmacao_independente_url),'') is not null
       and confirmacao_independente_url like 'https://%'
       and nullif(btrim(validacao_tecnica),'') is not null
       and nullif(btrim(revisor),'') is not null
       and revisado_em is not null and aplicacao_id is not null
       and regiao_catalogo <> 'a_confirmar')
 ),
 constraint catalogo_evidencias_oem_equivalencia_check check (
   relacao_sku <> 'equivalente_comprovado'
   or (situacao_evidencia='documentado'
       and nullif(btrim(confirmacao_peca_documento),'') is not null)
 )
);
create index if not exists catalogo_evidencias_oem_pendencias
  on public.catalogo_evidencias_oem(loja_id,situacao_evidencia,consultado_em desc);
create index if not exists catalogo_evidencias_oem_produto
  on public.catalogo_evidencias_oem(loja_id,produto_id,aplicacao_id);
create unique index if not exists catalogo_evidencias_oem_unica
  on public.catalogo_evidencias_oem
  (loja_id,produto_id,coalesce(aplicacao_id,'00000000-0000-0000-0000-000000000000'::uuid),
   upper(btrim(codigo_oem)),url_evidencia);
alter table public.catalogo_evidencias_oem enable row level security;
revoke all on public.catalogo_evidencias_oem from anon,authenticated;
comment on table public.catalogo_evidencias_oem is
'Arquivo de evidências OEM de catálogos eletrônicos: candidato não é aplicação aprovada, nem equivalência ao SKU. Não registrar VIN completo. Não distribuir desenhos/imagens de terceiros sem licença.';

-- Administrador registra apenas CANDIDATO identificado com consulta manual no PartSouq.
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
revoke all on function public.mobis_registrar_oem_partsouq(
  uuid,uuid,text,text,uuid,text,text,text,boolean,text)
  from public,anon,authenticated;
grant execute on function public.mobis_registrar_oem_partsouq(
  uuid,uuid,text,text,uuid,text,text,text,boolean,text) to authenticated;

create or replace function public.mobis_evidencias_oem_admin(
 p_loja uuid,p_limite integer default 80
) returns table (
 id uuid,produto_id uuid,aplicacao_id uuid,codigo_oem text,
 url_evidencia text,diagrama_epc text,regiao_catalogo text,
 situacao_evidencia text,relacao_sku text,consultado_em timestamptz
)
language plpgsql security definer stable set search_path to ''
as $$
begin
 if (select auth.uid()) is null
   or not coalesce(public.pode_administrar_loja(p_loja),false) then
   raise exception 'Acesso restrito ao administrador' using errcode='42501';
 end if;
 return query
 select e.id,e.produto_id,e.aplicacao_id,e.codigo_oem,e.url_evidencia,
 e.diagrama_epc,e.regiao_catalogo,e.situacao_evidencia,e.relacao_sku,e.consultado_em
 from public.catalogo_evidencias_oem e
 where e.loja_id=p_loja
 order by e.consultado_em desc
 limit least(greatest(coalesce(p_limite,80),1),200);
end;
$$;
revoke all on function public.mobis_evidencias_oem_admin(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.mobis_evidencias_oem_admin(uuid,integer)
 to authenticated;
comment on function public.mobis_registrar_oem_partsouq(
 uuid,uuid,text,text,uuid,text,text,text,boolean,text) is
'Insere somente candidato OEM pesquisado manualmente em PartSouq por administrador da loja. Nunca preenche aplicação, SKU, Bling, estoque ou publica.';
