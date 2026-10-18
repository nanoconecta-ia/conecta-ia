-- Tema da loja pública por cliente: perfil/cores, fonte, logo e ícone. Só a loja pública usa; o painel mantém a identidade Conecta.IA.
-- Escrita só por service_role (função loja-tema valida contraste AA e o tipo real da imagem). Leitura: quem vê a loja (RLS).
create table public.loja_tema (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  perfil text not null default 'azul_conecta' check (perfil in ('azul_conecta', 'grafite_laranja', 'verde_floresta', 'vinho', 'personalizado')),
  cor_primaria text not null default '#0864a0' check (cor_primaria ~ '^#[0-9a-f]{6}$'),
  cor_destaque text not null default '#04a88d' check (cor_destaque ~ '^#[0-9a-f]{6}$'),
  cor_bloco text not null default '#102335' check (cor_bloco ~ '^#[0-9a-f]{6}$'),
  fonte text not null default 'inter' check (fonte in ('inter', 'sistema', 'serifada')),
  logo_url text check (logo_url is null or logo_url ~ '^https://[^/?#@ ]+/storage/v1/object/public/lojas-marca/[0-9a-f-]{36}/[a-z0-9._-]+$'),
  icone_url text check (icone_url is null or icone_url ~ '^https://[^/?#@ ]+/storage/v1/object/public/lojas-marca/[0-9a-f-]{36}/[a-z0-9._-]+$'),
  atualizado_em timestamptz not null default now()
);
alter table public.loja_tema enable row level security;
revoke all on public.loja_tema from anon, authenticated;
grant select on public.loja_tema to authenticated;
grant select, insert, update on public.loja_tema to service_role;
create policy loja_tema_ver on public.loja_tema for select to authenticated using (private.pode_ver_loja(loja_id));

-- Gravação do tema (service_role). Cria a linha se não existir; mantém logo/ícone quando não enviados (null = não mexer).
create function public.tema_salvar(p_loja uuid, p_perfil text, p_primaria text, p_destaque text, p_bloco text, p_fonte text)
returns void language sql security definer set search_path = '' as $$
  insert into public.loja_tema (loja_id, perfil, cor_primaria, cor_destaque, cor_bloco, fonte)
  values (p_loja, p_perfil, p_primaria, p_destaque, p_bloco, p_fonte)
  on conflict (loja_id) do update set perfil = excluded.perfil, cor_primaria = excluded.cor_primaria, cor_destaque = excluded.cor_destaque,
    cor_bloco = excluded.cor_bloco, fonte = excluded.fonte, atualizado_em = now();
$$;
-- tipo: 'logo' | 'icone'; url null remove a imagem do tema (o arquivo antigo fica no armazenamento).
create function public.tema_definir_imagem(p_loja uuid, p_tipo text, p_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.loja_tema (loja_id) values (p_loja) on conflict (loja_id) do nothing;
  if p_tipo = 'logo' then update public.loja_tema set logo_url = p_url, atualizado_em = now() where loja_id = p_loja;
  elsif p_tipo = 'icone' then update public.loja_tema set icone_url = p_url, atualizado_em = now() where loja_id = p_loja;
  else raise exception 'tipo de imagem inválido' using errcode = '22023'; end if;
end $$;
revoke all on function public.tema_salvar(uuid, text, text, text, text, text), public.tema_definir_imagem(uuid, text, text) from public, anon, authenticated;
grant execute on function public.tema_salvar(uuid, text, text, text, text, text), public.tema_definir_imagem(uuid, text, text) to service_role;

-- Armazenamento público das marcas (leitura pública; ninguém escreve pelo navegador: só a função, com service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lojas-marca', 'lojas-marca', true, 524288, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;
