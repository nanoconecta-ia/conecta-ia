-- MINUTA exclusivamente CI descartável. Não é migração nem autoridade de decisão.
begin;
-- O recibo técnico mantém o histórico antigo sem vínculo (NULL); não inventar aplicação.
alter table nano_lifecycle_interno.conferencias_gate
 add column aplicacao_id uuid,
 add column aplicacao_snapshot jsonb,
 add column aplicacao_sha256 text,
 add constraint nano_gate_vinculo_aplicacao check (
  (aplicacao_id is null and aplicacao_snapshot is null and aplicacao_sha256 is null)
  or (
   aplicacao_id is not null and aplicacao_snapshot is not null and aplicacao_sha256 is not null
   and jsonb_typeof(aplicacao_snapshot)='object'
   and aplicacao_snapshot->>'id'=aplicacao_id::text
   and aplicacao_snapshot->>'loja_id'=loja_id::text
   and aplicacao_snapshot->>'produto_id'=candidato->'escopo'->>'produto'
   and aplicacao_snapshot->>'codigo_oem'=candidato->'fato'->>'oem'
   and aplicacao_snapshot->>'modelo'=candidato->'fato'->>'modelo'
   and aplicacao_snapshot->>'motorizacao'=candidato->'fato'->>'motor'
   and aplicacao_snapshot->>'ano_inicial'=candidato->'fato'->>'ano_inicio'
   and aplicacao_snapshot->>'ano_final'=candidato->'fato'->>'ano_fim'
   and aplicacao_sha256=encode(sha256(convert_to(aplicacao_snapshot::text,'UTF8')),'hex')
   and length(candidato->'escopo'->>'revisao')>0
  ) is true
 );
-- Nenhuma RPC/grant novo: o escritor existente não preenche estes campos.
-- Vínculo candidato não comprova geração/mercado/montadora ou identidade humana.
-- Preservar trigger ALWAYS de imutabilidade e homologada=false.
-- Estender o namespace existente a escritores de aplicação, vínculo humano e marca.
-- Não altera privilégios nem permite escrita; somente exclusão por loja no CI.
do $$
declare rel regclass;
begin
 foreach rel in array array['public.produto_aplicacoes'::regclass,'public.usuarios_loja'::regclass,'public.marcas'::regclass] loop
  execute format('create trigger zz_nano_guard_catalogo_loja before insert or update or delete on %s for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja()',rel);
  execute format('create trigger zz_nano_guard_catalogo_truncate before truncate on %s for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja()',rel);
  execute format('alter table %s enable always trigger zz_nano_guard_catalogo_loja',rel);
  execute format('alter table %s enable always trigger zz_nano_guard_catalogo_truncate',rel);
 end loop;
end $$;
commit;
