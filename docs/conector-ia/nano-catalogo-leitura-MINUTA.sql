-- MINUTA CI descartável. Leitura consultiva; não é homologação nem migração.
begin;
create role nano_catalogo_decisao_leitor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,nano_lifecycle_interno to nano_catalogo_decisao_leitor;
grant create on schema nano_lifecycle_interno to nano_catalogo_decisao_leitor;
grant select on public.produto_aplicacoes,public.auditoria to nano_catalogo_decisao_leitor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) to nano_catalogo_decisao_leitor;
create policy nano_catalogo_decisao_ler on public.produto_aplicacoes for select to nano_catalogo_decisao_leitor using(loja_id::text=current_setting('nano.catalogo_loja',true));
create policy nano_catalogo_decisao_escopo on public.produto_aplicacoes as restrictive for all to nano_catalogo_decisao_leitor using(loja_id::text=current_setting('nano.catalogo_loja',true)) with check(false);
create policy nano_catalogo_decisao_ler on public.auditoria for select to nano_catalogo_decisao_leitor using(loja_id::text=current_setting('nano.catalogo_loja',true) and tabela='produto_aplicacoes');
create policy nano_catalogo_decisao_escopo on public.auditoria as restrictive for all to nano_catalogo_decisao_leitor using(loja_id::text=current_setting('nano.catalogo_loja',true) and tabela='produto_aplicacoes') with check(false);
create function nano_lifecycle_interno.nano_catalogo_ler_decisao(p_loja uuid,p_produto uuid,p_aplicacao uuid)
returns jsonb language plpgsql stable security definer set search_path='' set nano.catalogo_loja='' as $fn$
declare r jsonb;
begin
 if p_loja is null or p_produto is null or p_aplicacao is null or not nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) then return null; end if;
 -- STABLE: autorização, linha e histórico compartilham snapshot da instrução.
 -- Rejeita sessão com acesso ao papel interno de leitura (não deve ser concedido a logins).
 if pg_has_role(session_user,'nano_catalogo_decisao_leitor','MEMBER') then return null; end if;
 perform set_config('nano.catalogo_loja',p_loja::text,true);
 select jsonb_build_object('atual',to_jsonb(a.*),'eventos',(
  select coalesce(jsonb_agg(jsonb_build_object('id',h.id::text,'quando',h.quando,'loja_id',h.loja_id,'user_id',h.user_id,'acao',h.acao,'tabela',h.tabela,'antes',h.antes,'depois',h.depois) order by h.id),'[]'::jsonb)
  from public.auditoria h where h.loja_id=p_loja and h.tabela='produto_aplicacoes' and (h.antes->>'id'=p_aplicacao::text or h.depois->>'id'=p_aplicacao::text)
 ),'agora',statement_timestamp()) into r
 from public.produto_aplicacoes a where a.loja_id=p_loja and a.produto_id=p_produto and a.id=p_aplicacao;
 return r;
end $fn$;
alter function nano_lifecycle_interno.nano_catalogo_ler_decisao(uuid,uuid,uuid) owner to nano_catalogo_decisao_leitor;
revoke all on function nano_lifecycle_interno.nano_catalogo_ler_decisao(uuid,uuid,uuid) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_catalogo_ler_decisao(uuid,uuid,uuid) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_catalogo_decisao_leitor;
commit;
