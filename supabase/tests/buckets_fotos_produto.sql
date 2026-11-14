-- Buckets de fotos de produto: originais privados, derivados públicos, e idempotência (reaplicar não muda nada).
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

select public.afirma((select public from storage.buckets where id = 'produtos-originais') = false, 'originais é PRIVADO');
select public.afirma((select public from storage.buckets where id = 'produtos-imagens') = true, 'derivados é público');
select public.afirma((select file_size_limit from storage.buckets where id = 'produtos-originais') = 3145728, 'originais limitado a 3 MB');
select public.afirma((select allowed_mime_types from storage.buckets where id = 'produtos-originais') = array['image/png', 'image/jpeg', 'image/webp'], 'originais só aceita imagem');
select public.afirma((select count(*) from storage.buckets where id in ('produtos-originais', 'produtos-imagens')) = 2, 'os dois buckets existem');

-- reaplicar (simula o projeto ao vivo, onde produtos-imagens já existe com os mesmos valores) não altera nada
update storage.buckets set file_size_limit = 1111 where id = 'produtos-imagens';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-imagens', 'produtos-imagens', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']) on conflict (id) do nothing;
select public.afirma((select file_size_limit from storage.buckets where id = 'produtos-imagens') = 1111, 'on conflict do nothing: bucket existente não é sobrescrito');
rollback;
