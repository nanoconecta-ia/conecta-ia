-- MOBIS / Conecta.IA — construtor de loja versionado e auditável.
-- Apenas a ORDEM dos cinco blocos comerciais e a velocidade do Flash.
-- Cabeçalho, atendimento/lista e rodapé/privacidade não podem ser removidos nem deslocados.
-- Nenhuma tabela fiscal, estoque, produto, origem de NF ou Bling é modificada.

create table public.loja_layout_versoes (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 numero bigint generated always as identity unique,
 blocos text[] not null,
 intervalo_segundos integer not null default 6 check (intervalo_segundos between 4 and 15),
 criado_por uuid not null,
 criado_em timestamptz not null default now(),
 aprovado_por uuid,
 aprovado_em timestamptz,
 constraint loja_layout_versoes_par unique (loja_id,id),
 constraint loja_layout_blocos_validos check (
   cardinality(blocos)=5
   and blocos @> array['banner','montadoras','taxonomia','catalogo','empresa']::text[]
   and blocos <@ array['banner','montadoras','taxonomia','catalogo','empresa']::text[]
 )
);
create index loja_layout_versoes_historico on public.loja_layout_versoes(loja_id,numero desc);

create table public.loja_layout_publicado (
 loja_id uuid primary key references public.lojas(id) on delete cascade,
 versao_id uuid not null,
 publicado_por uuid not null,
 publicado_em timestamptz not null default now(),
 foreign key (loja_id,versao_id) references public.loja_layout_versoes(loja_id,id)
);

create function private.layout_versao_imutavel() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
   raise exception 'versões do layout são imutáveis' using errcode='23514';
 end if;
 if new.id is distinct from old.id
   or new.loja_id is distinct from old.loja_id
   or new.numero is distinct from old.numero
   or new.blocos is distinct from old.blocos
   or new.intervalo_segundos is distinct from old.intervalo_segundos
   or new.criado_por is distinct from old.criado_por
   or new.criado_em is distinct from old.criado_em
   or old.aprovado_em is not null
   or new.aprovado_em is null
   or new.aprovado_por is null
 then
   raise exception 'crie outra versão para mudar o layout' using errcode='23514';
 end if;
 return new;
end $$;
create trigger loja_layout_versao_proteger before update or delete on public.loja_layout_versoes
 for each row execute function private.layout_versao_imutavel();
create trigger loja_layout_versoes_auditoria after insert or update on public.loja_layout_versoes
 for each row execute function private.auditar_regra();
create trigger loja_layout_publicado_auditoria after insert or update on public.loja_layout_publicado
 for each row execute function private.auditar_regra();

alter table public.loja_layout_versoes enable row level security;
alter table public.loja_layout_publicado enable row level security;
revoke all on public.loja_layout_versoes,public.loja_layout_publicado from public,anon,authenticated;
grant select on public.loja_layout_versoes,public.loja_layout_publicado to authenticated,service_role;
grant insert,update,delete on public.loja_layout_versoes,public.loja_layout_publicado to service_role;
create policy loja_layout_versoes_ver on public.loja_layout_versoes for select to authenticated
  using(private.pode_ver_loja(loja_id));
create policy loja_layout_publicado_ver on public.loja_layout_publicado for select to authenticated
  using(private.pode_ver_loja(loja_id));

-- As mutações são transações do servidor, não updates diretos do navegador.
-- Somente papel "lojista" pode salvar, aprovar e publicar; auth.uid real é obrigatório.
create function private.layout_pode_editar(p_loja uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
   select 1 from public.usuarios_loja
   where loja_id=p_loja and user_id=auth.uid() and papel='lojista'
 );
$$;
revoke all on function private.layout_pode_editar(uuid) from public,anon,authenticated;

create function public.layout_salvar_versao(p_loja uuid,p_blocos text[],p_intervalo integer default 6) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.layout_pode_editar(p_loja) then
   raise exception 'somente o lojista pode salvar o layout' using errcode='42501';
 end if;
 insert into public.loja_layout_versoes(loja_id,blocos,intervalo_segundos,criado_por)
 values(p_loja,p_blocos,p_intervalo,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create function public.layout_aprovar_versao(p_loja uuid,p_versao uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.layout_pode_editar(p_loja) then
   raise exception 'somente o lojista pode aprovar o layout' using errcode='42501';
 end if;
 update public.loja_layout_versoes set aprovado_por=auth.uid(),aprovado_em=now()
 where loja_id=p_loja and id=p_versao and aprovado_em is null;
 if not found then
   raise exception 'versão não encontrada ou já aprovada' using errcode='23514';
 end if;
end $$;

create function public.layout_publicar_versao(p_loja uuid,p_versao uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.layout_pode_editar(p_loja) then
   raise exception 'somente o lojista pode publicar o layout' using errcode='42501';
 end if;
 if not exists(
   select 1 from public.loja_layout_versoes
   where loja_id=p_loja and id=p_versao and aprovado_por is not null and aprovado_em is not null
 ) then
   raise exception 'aprovação explícita obrigatória' using errcode='23514';
 end if;
 insert into public.loja_layout_publicado(loja_id,versao_id,publicado_por,publicado_em)
 values(p_loja,p_versao,auth.uid(),now())
 on conflict(loja_id) do update
 set versao_id=excluded.versao_id,publicado_por=excluded.publicado_por,publicado_em=excluded.publicado_em;
end $$;
-- Voltar a uma versão anterior é uma nova publicação auditada do ponteiro,
-- preservando integralmente a versão atual e todas as anteriores.
revoke all on function public.layout_salvar_versao(uuid,text[],integer),
 public.layout_aprovar_versao(uuid,uuid),public.layout_publicar_versao(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.layout_salvar_versao(uuid,text[],integer),
 public.layout_aprovar_versao(uuid,uuid),public.layout_publicar_versao(uuid,uuid) to authenticated;

-- Carrossel de campanhas: aumenta de 5 para 24 banners ATIVOS por loja,
-- sem relaxar as regras de produto aprovado/publicado e sem duplicar SKUs.
create or replace function private.valida_banner() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_loja uuid; v_pub boolean; v_n integer;
begin
 select loja_id,publicado into v_loja,v_pub from public.produtos where id=new.produto_id;
 if v_loja is null or v_loja<>new.loja_id then
   raise exception 'produto não pertence à loja' using errcode='23514';
 end if;
 if new.ativo and not coalesce(v_pub,false) then
   raise exception 'só produto publicado pode ter banner ativo' using errcode='23514';
 end if;
 if new.ativo then
   select count(*) into v_n from public.loja_banners
    where loja_id=new.loja_id and ativo and id<>new.id;
   if v_n>=24 then raise exception 'máximo de 24 banners ativos por loja' using errcode='23514'; end if;
 end if;
 new.atualizado_em:=now();
 if tg_op='INSERT' then new.criado_por:=auth.uid(); end if;
 return new;
end $$;
