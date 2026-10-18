-- Pipeline de imagens (PROPOSTA, não aplicar em produção sem aprovação específica).
-- Regra nova: imagem só aparece no catálogo público com DIREITOS DE USO confirmados. Aprovar a identidade da peça (imagem_decidir)
-- e confirmar o direito de uso são decisões separadas. url_original (página de terceiros) continua interna.
-- ATENÇÃO (efeito): a vitrine anon deixa de ver imagem aprovada sem direito confirmado. Hoje há 0 imagens no projeto real.

alter table public.produto_imagens
  add column direitos_confirmados_em timestamptz,
  add column direitos_confirmados_por uuid,
  add column direitos_referencia text,                  -- evidência: contrato, nota, e-mail do fornecedor, termo do fabricante
  add constraint imagem_direitos_com_referencia check (
    direitos_confirmados_em is null or (direitos_confirmados_por is not null and char_length(btrim(coalesce(direitos_referencia, ''))) >= 10 and licenca_tipo is not null));

-- Condição única de publicabilidade (a mesma regra de imagens/regras.ts -> podePublicar/direitosConfirmados).
create function private.imagem_publicavel(p_licenca text, p_confirmado_em timestamptz, p_aprovada boolean, p_removida_em timestamptz)
returns boolean language sql immutable set search_path = '' as $$
  select p_aprovada and p_removida_em is null
     and (p_licenca in ('propria', 'licenciada') or (p_licenca is not null and p_confirmado_em is not null));
$$;

-- A vitrine anon só enxerga imagem publicável (substitui a policy da migração 9 sem mexer nos grants por coluna).
alter policy imagens_publicas on public.produto_imagens
  using (private.imagem_publicavel(licenca_tipo, direitos_confirmados_em, aprovada, removida_em)
         and exists (select 1 from public.produtos p where p.id = produto_id));

-- Leitura para as funções do servidor (service_role): só publicáveis e sem url_original/proveniência.
create view public.imagens_publicaveis as
  select i.id, i.loja_id, i.produto_id, i.url, i.ordem, i.tipo, i.principal, i.alt_texto, i.largura_px, i.altura_px, i.fundo_branco
  from public.produto_imagens i
  where private.imagem_publicavel(i.licenca_tipo, i.direitos_confirmados_em, i.aprovada, i.removida_em);
revoke all on public.imagens_publicaveis from public, anon, authenticated;
grant select on public.imagens_publicaveis to service_role;

-- Fila de trabalho do pipeline: produtos ativos sem nenhuma imagem publicável. security_invoker => a RLS do usuário vale.
create view public.produtos_sem_imagem_publicavel with (security_invoker = on) as
  select p.id as produto_id, p.loja_id, p.sku, p.nome, p.publicado
  from public.produtos p
  where coalesce(p.situacao, '') = 'A'
    and not exists (select 1 from public.produto_imagens i where i.produto_id = p.id
                    and private.imagem_publicavel(i.licenca_tipo, i.direitos_confirmados_em, i.aprovada, i.removida_em));
revoke all on public.produtos_sem_imagem_publicavel from public, anon;
grant select on public.produtos_sem_imagem_publicavel to authenticated, service_role;

-- Confirma o direito de uso (só lojista da loja). Exige tipo de licença e referência da evidência. Auditado.
create function public.imagem_confirmar_direitos(p_loja uuid, p_imagem uuid, p_user uuid, p_licenca text, p_referencia text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.usuarios_loja where loja_id = p_loja and user_id = p_user and papel = 'lojista') then
    raise exception 'sem_permissao: só o lojista confirma direitos de uso' using errcode = '42501';
  end if;
  if p_licenca not in ('propria', 'fornecedor', 'fabricante', 'publica_web', 'licenciada') then raise exception 'licenca_invalida' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_referencia, ''))) < 10 then raise exception 'referencia_obrigatoria: cite o documento ou autorização' using errcode = '22023'; end if;
  update public.produto_imagens set licenca_tipo = p_licenca, direitos_confirmados_em = now(), direitos_confirmados_por = p_user, direitos_referencia = btrim(p_referencia)
    where id = p_imagem and loja_id = p_loja and removida_em is null;
  if not found then raise exception 'imagem_nao_encontrada' using errcode = 'P0002'; end if;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois) values (p_loja, p_user, 'imagem.direitos_confirmados', 'produto_imagens', jsonb_build_object('id', p_imagem, 'licenca', p_licenca));
end $$;

-- Retira a imagem (takedown): some da vitrine e não volta.
create function public.imagem_retirar(p_loja uuid, p_imagem uuid, p_user uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.usuarios_loja where loja_id = p_loja and user_id = p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.produto_imagens set removida_em = now(), principal = false where id = p_imagem and loja_id = p_loja and removida_em is null;
  if not found then raise exception 'imagem_nao_encontrada' using errcode = 'P0002'; end if;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois) values (p_loja, p_user, 'imagem.retirada', 'produto_imagens', jsonb_build_object('id', p_imagem, 'motivo', left(p_motivo, 200)));
end $$;

revoke all on function public.imagem_confirmar_direitos(uuid, uuid, uuid, text, text), public.imagem_retirar(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.imagem_confirmar_direitos(uuid, uuid, uuid, text, text), public.imagem_retirar(uuid, uuid, uuid, text) to service_role;
revoke all on function private.imagem_publicavel(text, timestamptz, boolean, timestamptz) from public;
grant execute on function private.imagem_publicavel(text, timestamptz, boolean, timestamptz) to anon, authenticated, service_role;
