-- Atomicidade de produtos_reconciliar_identidade: se qualquer passo falha (inserir conflitos, resolver, despublicar), NADA fica pela metade.
-- Provoca o erro com gatilhos de teste e confere o estado antes e depois; depois remove o gatilho e prova a retomada (idempotente).
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-00000000000b','Loja B','loja-b');
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set B '\'bbbbbbbb-0000-0000-0000-00000000000b\''

-- estado inicial: 100/101 duplicados (conflitos abertos, despublicados); 300/301 únicos e publicados; loja B com o mesmo SKU de 100
insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao, publicado) values
  (:A,'100','D-1','A',1,'A',true), (:A,'101','D-1','B',1,'A',true), (:A,'300','U-3','C',1,'A',true), (:A,'301','U-4','D',1,'A',true),
  (:B,'100','D-1','Loja B',1,'A',true);
select public.produtos_reconciliar_identidade(:A);
select public.produtos_reconciliar_identidade(:B);
select public.afirma((select count(*) from public.produto_conflitos where loja_id = :A and estado = 'aberto') = 2, 'estado inicial: 2 conflitos abertos na loja A');
-- agora: 101 deixa de repetir (resolve 100/101) e 300/301 passam a repetir (2 conflitos novos + 2 despublicações)
update public.produtos set sku = 'D-1B' where bling_id = '101' and loja_id = :A;
update public.produtos set sku = 'U-3' where bling_id = '301' and loja_id = :A;
create temp table antes as
  select (select jsonb_agg(to_jsonb(c) - 'id' - 'detectado_em' order by bling_id, motivo) from public.produto_conflitos c where loja_id = :A) as conflitos,
         (select jsonb_agg(jsonb_build_array(bling_id, publicado) order by bling_id) from public.produtos where loja_id = :A) as pubs;

-- falha no passo "resolver" (atualização de conflito): as inserções dos conflitos novos precisam desaparecer
create function pg_temp.falha_ao_resolver() returns trigger language plpgsql as $$ begin if new.estado = 'resolvido' then raise exception 'falha injetada: resolver'; end if; return new; end $$;
create trigger t_falha_resolver before update on public.produto_conflitos for each row execute function pg_temp.falha_ao_resolver();
do $$ begin begin perform public.produtos_reconciliar_identidade('aaaaaaaa-0000-0000-0000-00000000000a'); raise exception 'nao falhou';
  exception when others then if sqlerrm not like 'falha injetada%' then raise; end if; end; end $$;
select public.afirma((select conflitos from antes) is not distinct from (select jsonb_agg(to_jsonb(c) - 'id' - 'detectado_em' order by bling_id, motivo) from public.produto_conflitos c where loja_id = :A), 'falha ao resolver: conflitos exatamente como antes (inserções desfeitas)');
select public.afirma((select pubs from antes) = (select jsonb_agg(jsonb_build_array(bling_id, publicado) order by bling_id) from public.produtos where loja_id = :A), 'falha ao resolver: publicações intactas');
drop trigger t_falha_resolver on public.produto_conflitos;

-- falha no passo "despublicar": inserções E resoluções precisam ser desfeitas
create function pg_temp.falha_ao_despublicar() returns trigger language plpgsql as $$ begin if old.publicado and not new.publicado then raise exception 'falha injetada: despublicar'; end if; return new; end $$;
create trigger t_falha_despublicar before update of publicado on public.produtos for each row execute function pg_temp.falha_ao_despublicar();
do $$ begin begin perform public.produtos_reconciliar_identidade('aaaaaaaa-0000-0000-0000-00000000000a'); raise exception 'nao falhou';
  exception when others then if sqlerrm not like 'falha injetada%' then raise; end if; end; end $$;
select public.afirma((select conflitos from antes) is not distinct from (select jsonb_agg(to_jsonb(c) - 'id' - 'detectado_em' order by bling_id, motivo) from public.produto_conflitos c where loja_id = :A), 'falha ao despublicar: inserções e resoluções desfeitas');
select public.afirma((select pubs from antes) = (select jsonb_agg(jsonb_build_array(bling_id, publicado) order by bling_id) from public.produtos where loja_id = :A), 'falha ao despublicar: nenhum produto ficou despublicado pela metade');
drop trigger t_falha_despublicar on public.produtos;

-- retomada: sem o gatilho, a mesma chamada conclui tudo e reprocessar não muda mais nada
select public.afirma((public.produtos_reconciliar_identidade(:A)->>'abertos')::int = 2, 'retomada: conclui (2 conflitos novos abertos, 2 antigos resolvidos)');
select public.afirma((select count(*) from public.produto_conflitos where loja_id = :A and estado = 'resolvido') = 2 and (select count(*) from public.produto_conflitos where loja_id = :A and estado = 'aberto') = 2, 'retomada: estados corretos');
select public.afirma((select count(*) from public.produtos where loja_id = :A and publicado) = 0, 'retomada: 300/301 despublicados e ninguém é republicado sozinho (100/101 seguem despublicados até o lojista decidir)');
create temp table depois1 as select jsonb_agg(to_jsonb(c) - 'id' - 'detectado_em' - 'resolvido_em' order by bling_id, motivo) as c from public.produto_conflitos c where loja_id = :A;
select public.produtos_reconciliar_identidade(:A);
select public.afirma((select c from depois1) = (select jsonb_agg(to_jsonb(c) - 'id' - 'detectado_em' - 'resolvido_em' order by bling_id, motivo) from public.produto_conflitos c where loja_id = :A), 'reprocessar depois da retomada não muda nada (idempotente)');
-- a loja B não foi tocada em nenhum momento
select public.afirma((select count(*) from public.produto_conflitos where loja_id = :B) = 0 and (select publicado from public.produtos where loja_id = :B), 'loja B intacta: sem conflitos e produto publicado');
rollback;
