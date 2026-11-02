-- Reversão da migração 20261102000001. SÓ em banco descartável ou com ordem expressa do dono (apaga dados de vínculo).
alter table public.produtos drop column if exists protegido_por_nf;
drop table if exists public.marca_evidencia, public.produto_vinculo_nf, public.produto_origem_custo, public.produto_origem, public.produto_mestre cascade;
drop function if exists private.vinculo_nf_protege(), private.cadastro_sem_delete(), private.cadastro_append_only();
drop type if exists public.origem_tipo, public.origem_marca;
