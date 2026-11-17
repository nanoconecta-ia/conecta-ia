-- Painel de cores Mobis: rascunho -> aprovação do lojista -> publicação auditável.
-- Independente da tabela de tema legado: NÃO substitui logo, fonte, ícones ou mascotes.
-- Não altera produto, fornecedor, preços, estoque, Bling ou NF.
create table public.loja_paleta_versoes(
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 numero bigint generated always as identity unique,
 cor_fundo text not null check(cor_fundo ~ '^#[0-9a-f]{6}$'),
 cor_superficie text not null check(cor_superficie ~ '^#[0-9a-f]{6}$'),
 cor_texto text not null check(cor_texto ~ '^#[0-9a-f]{6}$'),
 cor_botao text not null check(cor_botao ~ '^#[0-9a-f]{6}$'),
 cor_acento text not null check(cor_acento ~ '^#[0-9a-f]{6}$'),
 criado_por uuid not null,
 criado_em timestamptz not null default now(),
 aprovado_por uuid,
 aprovado_em timestamptz,
 constraint loja_paleta_versoes_par unique(loja_id,id)
);
create index loja_paleta_versoes_historico on public.loja_paleta_versoes(loja_id,numero desc);

create table public.loja_paleta_publicada(
 loja_id uuid primary key references public.lojas(id) on delete cascade,
 versao_id uuid not null,
 publicado_por uuid not null,
 publicado_em timestamptz not null default now(),
 foreign key(loja_id,versao_id) references public.loja_paleta_versoes(loja_id,id)
);

-- Contraste WCAG calculado no servidor. Não basta ocultar o erro no navegador.
create function private.mobis_paleta_luminancia(p_hex text) returns double precision
language plpgsql immutable strict set search_path='' as $$
declare v_bytes bytea; i integer; canal double precision; s double precision; retorno double precision:=0;
begin
 if p_hex !~ '^#[0-9a-f]{6}$' then
  raise exception 'cor inválida: use #rrggbb' using errcode='23514';
 end if;
 v_bytes:=decode(substr(p_hex,2),'hex');
 for i in 0..2 loop
  canal:=get_byte(v_bytes,i)/255.0;
  if canal<=0.04045 then s:=canal/12.92; else s:=power((canal+0.055)/1.055,2.4); end if;
  retorno:=retorno+s*(case i when 0 then 0.2126 when 1 then 0.7152 else 0.0722 end);
 end loop;
 return retorno;
end $$;
create function private.mobis_paleta_contraste(p_a text,p_b text) returns double precision
language sql immutable strict set search_path='' as $$
 select (greatest(private.mobis_paleta_luminancia(p_a),private.mobis_paleta_luminancia(p_b))+0.05)/
        (least(private.mobis_paleta_luminancia(p_a),private.mobis_paleta_luminancia(p_b))+0.05);
$$;
create function private.mobis_paleta_validar() returns trigger
language plpgsql set search_path='' as $$
begin
 if private.mobis_paleta_luminancia(new.cor_fundo)<0.75
    or private.mobis_paleta_luminancia(new.cor_superficie)<0.75 then
  raise exception 'A Mobis usa superfícies claras: selecione branco neve ou gelo' using errcode='23514';
 end if;
 if private.mobis_paleta_contraste(new.cor_texto,new.cor_fundo)<4.5
    or private.mobis_paleta_contraste(new.cor_texto,new.cor_superficie)<4.5 then
  raise exception 'Contraste insuficiente entre texto e fundos (mínimo AA)' using errcode='23514';
 end if;
 if private.mobis_paleta_contraste(new.cor_botao,'#ffffff')<4.5
    or private.mobis_paleta_contraste(new.cor_acento,'#ffffff')<4.5 then
  raise exception 'Botões e acentos precisam de contraste com branco (mínimo AA)' using errcode='23514';
 end if;
 return new;
end $$;
create trigger loja_paleta_validar before insert or update on public.loja_paleta_versoes
 for each row execute function private.mobis_paleta_validar();

-- Bloqueia sobrescrita ou exclusão das versões. Só primeira aprovação é permitida.
create function private.mobis_paleta_imutavel() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'versões de cor são imutáveis' using errcode='23514'; end if;
 if new.id is distinct from old.id or new.loja_id is distinct from old.loja_id
  or new.numero is distinct from old.numero
  or new.cor_fundo is distinct from old.cor_fundo
  or new.cor_superficie is distinct from old.cor_superficie
  or new.cor_texto is distinct from old.cor_texto
  or new.cor_botao is distinct from old.cor_botao
  or new.cor_acento is distinct from old.cor_acento
  or new.criado_por is distinct from old.criado_por
  or new.criado_em is distinct from old.criado_em
  or old.aprovado_em is not null or new.aprovado_em is null
  or new.aprovado_por is null then
   raise exception 'para mudar cores, crie uma nova versão' using errcode='23514';
 end if;
 return new;
end $$;
create trigger loja_paleta_imutavel before update or delete on public.loja_paleta_versoes
 for each row execute function private.mobis_paleta_imutavel();

create trigger loja_paleta_versoes_auditoria after insert or update on public.loja_paleta_versoes
 for each row execute function private.auditar_regra();
create trigger loja_paleta_publicada_auditoria after insert or update on public.loja_paleta_publicada
 for each row execute function private.auditar_regra();

alter table public.loja_paleta_versoes enable row level security;
alter table public.loja_paleta_publicada enable row level security;
revoke all on public.loja_paleta_versoes,public.loja_paleta_publicada from public,anon,authenticated;
grant select on public.loja_paleta_versoes,public.loja_paleta_publicada to authenticated,service_role;
grant insert,update,delete on public.loja_paleta_versoes,public.loja_paleta_publicada to service_role;
create policy loja_paleta_versoes_ver on public.loja_paleta_versoes
 for select to authenticated using(private.pode_ver_loja(loja_id));
create policy loja_paleta_publicada_ver on public.loja_paleta_publicada
 for select to authenticated using(private.pode_ver_loja(loja_id));

create function public.paleta_salvar_versao(
 p_loja uuid,p_fundo text,p_superficie text,p_texto text,p_botao text,p_acento text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.layout_pode_editar(p_loja) then
  raise exception 'somente lojista pode salvar cores' using errcode='42501';
 end if;
 insert into public.loja_paleta_versoes(loja_id,cor_fundo,cor_superficie,cor_texto,cor_botao,cor_acento,criado_por)
 values(p_loja,p_fundo,p_superficie,p_texto,p_botao,p_acento,auth.uid())
 returning id into v_id;
 return v_id;
end $$;
create function public.paleta_aprovar_versao(p_loja uuid,p_versao uuid)
 returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.layout_pode_editar(p_loja) then
  raise exception 'somente lojista pode aprovar cores' using errcode='42501';
 end if;
 update public.loja_paleta_versoes set aprovado_por=auth.uid(),aprovado_em=now()
 where loja_id=p_loja and id=p_versao and aprovado_em is null;
 if not found then raise exception 'versão inexistente ou já aprovada' using errcode='23514'; end if;
end $$;
create function public.paleta_publicar_versao(p_loja uuid,p_versao uuid)
 returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.layout_pode_editar(p_loja) then
  raise exception 'somente lojista pode publicar cores' using errcode='42501';
 end if;
 if not exists(select 1 from public.loja_paleta_versoes
   where loja_id=p_loja and id=p_versao and aprovado_por is not null and aprovado_em is not null) then
  raise exception 'publicação de cores requer aprovação explícita' using errcode='23514';
 end if;
 insert into public.loja_paleta_publicada(loja_id,versao_id,publicado_por,publicado_em)
 values(p_loja,p_versao,auth.uid(),now())
 on conflict(loja_id) do update set versao_id=excluded.versao_id,
    publicado_por=excluded.publicado_por,publicado_em=excluded.publicado_em;
end $$;

revoke all on function private.mobis_paleta_luminancia(text),private.mobis_paleta_contraste(text,text)
 from public,anon,authenticated;
revoke all on function public.paleta_salvar_versao(uuid,text,text,text,text,text),
 public.paleta_aprovar_versao(uuid,uuid),public.paleta_publicar_versao(uuid,uuid) from public,anon,authenticated;
grant execute on function public.paleta_salvar_versao(uuid,text,text,text,text,text),
 public.paleta_aprovar_versao(uuid,uuid),public.paleta_publicar_versao(uuid,uuid) to authenticated;
