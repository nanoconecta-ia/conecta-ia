-- Histórico de configuração aplicada manualmente, não é migração automática.
-- Conecta.IA | projeto d s f z h s r u d r i q k u m t l q w j (Mobis).
-- Em 2026-11-17 a exigência imagem_principal passou a ser opcional APENAS
-- quando a loja vinculada é a MOBIS (slug 'mobis'). Não altera outras lojas.
-- Requisitos de categoria, marca de peça, código de fabricante, bula e preço permanecem obrigatórios.
-- Executado e confirmado no Supabase; 0 produtos publicados após a alteração.
-- Registrar como migração formal antes de reproduzir em outro banco.
CREATE OR REPLACE FUNCTION public.publicar_produto(p_produto uuid, p_publicar boolean, p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.produtos%rowtype;
  exigidos text[];
  campo text;
  faltando text[] := '{}';
  ok boolean;
begin
  select * into p from public.produtos where id = p_produto;
  if not found then raise exception 'produto inexistente'; end if;

  if p_publicar then
    select r.campos_obrigatorios into exigidos
      from public.lojas l join public.perfis_ramo r on r.codigo = l.perfil_ramo where l.id = p.loja_id;
    -- FOTO OPCIONAL: apenas MOBIS, demais homologacoes preservadas.
    if exists (select 1 from public.lojas l where l.id = p.loja_id and l.slug = 'mobis') then
      exigidos := array_remove(exigidos, 'imagem_principal');
    end if;
    foreach campo in array coalesce(exigidos, '{}') loop
      ok := case campo
        when 'nome' then coalesce(btrim(p.nome), '') <> ''
        when 'sku' then coalesce(btrim(p.sku), '') <> ''
        when 'preco' then coalesce(p.preco, 0) > 0
        when 'categoria' then exists (select 1 from public.taxonomia_nos n where n.id = p.taxonomia_no_id and n.status = 'aprovado')
        when 'imagem_principal' then exists (select 1 from public.produto_imagens i
            where i.produto_id = p.id and i.principal and i.aprovada and i.removida_em is null)
        when 'marca_peca' then exists (select 1 from public.produto_codigos c join public.marcas m on m.id = c.marca_id
            where c.produto_id = p.id and c.tipo = 'fabricante' and c.status = 'aprovado' and m.tipo = 'peca' and m.status = 'aprovado')
        when 'codigo_fabricante' then exists (select 1 from public.produto_codigos c
            where c.produto_id = p.id and c.tipo = 'fabricante' and c.status = 'aprovado')
        when 'bula_tecnica' then exists (select 1 from public.produto_bula b where b.produto_id = p.id and b.status = 'aprovada')
        else false
      end;
      if not ok then faltando := faltando || campo; end if;
    end loop;
    if array_length(faltando, 1) is not null then
      return jsonb_build_object('ok', false, 'faltando', to_jsonb(faltando));
    end if;
  end if;

  update public.produtos set publicado = p_publicar where id = p.id;
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (p.loja_id, p_user, case when p_publicar then 'publicar' else 'despublicar' end, 'produtos',
          jsonb_build_object('id', p.id, 'publicado', p.publicado), jsonb_build_object('id', p.id, 'publicado', p_publicar));
  return jsonb_build_object('ok', true, 'faltando', '[]'::jsonb);
end $function$;
