-- Produto de TESTE da vitrine: aparece com nome, descrição e imagem aprovados, SEM preço, SEM estoque e SEM botão de consulta/venda.
-- Não apaga nem altera dado existente: só acrescenta uma coluna (padrão falso) e uma função. Rascunho: não aplicar sem autorização do dono.
alter table public.produtos add column exibicao_teste boolean not null default false;

-- A chave pública (anon) também lê a tabela direto pela API REST e hoje enxerga preço e estoque de todo produto publicado.
-- Produto de teste sai dessa porta: só é servido pela função loja-publica, que omite preço e estoque.
drop policy produtos_publicos on public.produtos;
create policy produtos_publicos on public.produtos for select to anon
  using (publicado and not exibicao_teste and private.loja_ativa(loja_id));

-- Marcar/desmarcar: só o lojista da loja (nunca editor), ativar só em loja de ambiente de teste, tudo auditado.
create function public.produto_exibicao_teste(p_produto uuid, p_ativo boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  p public.produtos%rowtype;
  v_ativo boolean := coalesce(p_ativo, false);
  v_ambiente text;
begin
  if v_uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select * into p from public.produtos where id = p_produto;
  -- mesma resposta para produto inexistente e de outra loja: sem oráculo entre lojas
  if not found or not private.administra_loja(p.loja_id, v_uid) then raise exception 'produto não encontrado' using errcode = '42501'; end if;
  if v_ativo then
    select ambiente into v_ambiente from public.lojas where id = p.loja_id;
    if v_ambiente is distinct from 'teste' then
      return jsonb_build_object('ok', false, 'motivo', 'loja_fora_do_ambiente_de_teste');
    end if;
  end if;
  update public.produtos set exibicao_teste = v_ativo where id = p.id;
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (p.loja_id, v_uid, case when v_ativo then 'exibicao_teste_ligar' else 'exibicao_teste_desligar' end, 'produtos',
          jsonb_build_object('id', p.id, 'exibicao_teste', p.exibicao_teste), jsonb_build_object('id', p.id, 'exibicao_teste', v_ativo));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.produto_exibicao_teste(uuid, boolean) from public, anon;
grant execute on function public.produto_exibicao_teste(uuid, boolean) to authenticated, service_role;
