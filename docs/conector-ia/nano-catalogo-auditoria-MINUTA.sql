-- MINUTA CI descartável, não aplicar em produção.
-- Preserva a autoridade original, inclusive os registros de outros módulos.
begin;
alter table public.auditoria enable always trigger auditoria_sem_update;
create trigger auditoria_sem_truncate before truncate on public.auditoria
 for each statement execute function private.auditoria_imutavel();
alter table public.auditoria enable always trigger auditoria_sem_truncate;
commit;
