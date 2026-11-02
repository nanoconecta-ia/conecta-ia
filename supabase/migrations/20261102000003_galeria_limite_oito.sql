-- PR #242: a galeria de um produto tem NO MÁXIMO 8 imagens ativas (candidatas ou aprovadas). Invariante no banco, além da checagem no código.
-- Só um gatilho: não cria tabela nova. NÃO APLICADA em produção (depende de aprovação do dono). Reversão: drop trigger/function abaixo.
create function private.imagens_limite_galeria() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.removida_em is null and (select count(*) from public.produto_imagens where produto_id = new.produto_id and removida_em is null) >= 8 then
    raise exception 'galeria cheia: no máximo 8 imagens por produto' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger produto_imagens_limite_galeria before insert on public.produto_imagens for each row execute function private.imagens_limite_galeria();
