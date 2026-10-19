-- Testa a migração de sistemas mecânicos e documentação técnica; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.recusa(cmd text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; raise exception 'FALHOU: aceitou -> %', msg;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then raise notice 'ok: %', msg; end;
end $$;

select public.afirma((select count(*) from public.sistemas_mecanicos where nivel = 1) = 4, 'semente do dono: 4 sistemas de nível 1 (como proposta)');
select public.afirma((select count(*) from public.sistemas_mecanicos where status <> 'proposta') = 0, 'nada nasce aprovado');
select public.afirma(not exists (select 1 from public.sistemas_mecanicos where nome ~* '(hyundai|kia|toyota|hr|bongo|hilux)'), 'a árvore não contém montadora nem veículo');
select public.recusa($$insert into public.sistemas_mecanicos (nivel, nome, origem) values (2, 'solto', 'teste')$$, 'nível 2 sem pai é recusado');
select public.recusa($$insert into public.sistemas_mecanicos (nivel, pai_id, nome, origem)
  select 3, id, 'pulo de nível', 'teste' from public.sistemas_mecanicos where nivel = 1 limit 1$$, 'filho que pula um nível é recusado');
select public.recusa($$insert into public.sistemas_mecanicos (nivel, nome, origem) values (1, 'motor', 'teste')$$, 'nome duplicado no mesmo nível é recusado (sem maiúscula/minúscula)');

insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000d1', 'outra', 'Fonte fictícia', 'https://exemplo.invalid/d');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-0000000000d1', 'MontadoraDoc');
select public.recusa($$insert into public.documentos_tecnicos (escopo_tabela, escopo_id, tipo, titulo, fonte_id)
  values ('montadoras', 'a0000000-0000-0000-0000-0000000000d1', 'manual_oficina', 'sem fonte', null)$$, 'documento sem fonte é recusado');
select public.recusa($$insert into public.documentos_tecnicos (escopo_tabela, escopo_id, tipo, titulo, fonte_id, publicavel)
  values ('montadoras', 'a0000000-0000-0000-0000-0000000000d1', 'manual_oficina', 'sem direitos', 'f0000000-0000-0000-0000-0000000000d1', true)$$, 'publicar sem direitos comprovados é recusado');
insert into public.documentos_tecnicos (escopo_tabela, escopo_id, sistema_id, tipo, titulo, fonte_id)
  select 'montadoras', 'a0000000-0000-0000-0000-0000000000d1', id, 'esquema_eletrico', 'Esquema fictício', 'f0000000-0000-0000-0000-0000000000d1'
  from public.sistemas_mecanicos where nivel = 1 order by nome limit 1;
select public.afirma((select count(*) from public.documentos_tecnicos where publicavel) = 0, 'documento novo nasce não publicável e a confirmar');
select public.recusa($$insert into public.documentos_tecnicos (escopo_tabela, escopo_id, tipo, titulo, fonte_id)
  values ('tabela_qualquer', 'a0000000-0000-0000-0000-0000000000d1', 'outro', 'x', 'f0000000-0000-0000-0000-0000000000d1')$$, 'escopo fora da lista é recusado');
rollback;
