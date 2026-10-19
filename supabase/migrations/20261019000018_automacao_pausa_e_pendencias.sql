-- Regras de segurança do agente no cadastro:
--  (1) O lojista pode PARAR o cadastro automático de um produto ou de um lote (seleção visual no Catálogo). Com a pausa, nenhuma proposta
--      de agente (interno ou externo pareado por QR) entra naquele produto; o banco recusa mesmo se a ferramenta esquecer de checar.
--  (2) O agente vê exatamente o que falta para o produto poder ser publicado (as mesmas exigências de publicar_produto), sem publicar nada.
--  (3) Bula técnica proposta pelo agente fica em RASCUNHO com FONTE; só o lojista aprova.
-- O espelho do Bling não é apagado por ninguém além do próprio sincronizador: usuários logados só têm SELECT em produtos (conferido em produção).

create table public.produto_automacao (
  produto_id uuid primary key,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  pausado boolean not null default true,
  motivo text check (motivo is null or length(motivo) <= 300),
  alterado_em timestamptz not null default now(),
  alterado_por uuid,
  foreign key (produto_id, loja_id) references public.produtos(id, loja_id) on delete cascade
);
alter table public.produto_automacao enable row level security;
revoke all on public.produto_automacao from anon, authenticated;
grant select on public.produto_automacao to authenticated;
grant select, insert, update, delete on public.produto_automacao to service_role;
create policy produto_automacao_ver on public.produto_automacao for select to authenticated using (private.pode_ver_loja(loja_id));

-- Pausar/retomar um produto ou um lote. Só quem administra a loja. Tudo auditado.
create function public.automacao_pausar(p_produtos uuid[], p_pausar boolean, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ok int := 0; r record;
begin
  if v_uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if p_produtos is null or coalesce(array_length(p_produtos, 1), 0) = 0 then raise exception 'selecione ao menos um produto' using errcode = '22023'; end if;
  if array_length(p_produtos, 1) > 500 then raise exception 'lote grande demais (máximo 500)' using errcode = '22023'; end if;
  for r in select id, loja_id from public.produtos where id = any (p_produtos) loop
    if not private.administra_loja(r.loja_id, v_uid) then raise exception 'produto não encontrado' using errcode = '42501'; end if;
  end loop;
  insert into public.produto_automacao (produto_id, loja_id, pausado, motivo, alterado_por)
    select p.id, p.loja_id, coalesce(p_pausar, true), left(p_motivo, 300), v_uid from public.produtos p where p.id = any (p_produtos)
  on conflict (produto_id) do update set pausado = excluded.pausado, motivo = excluded.motivo, alterado_em = now(), alterado_por = v_uid;
  get diagnostics v_ok = row_count;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois)
    select p.loja_id, v_uid, case when coalesce(p_pausar, true) then 'automacao.pausada' else 'automacao.retomada' end, 'produto_automacao',
      jsonb_build_object('produtos', count(*), 'motivo', left(p_motivo, 300)) from public.produtos p where p.id = any (p_produtos) group by p.loja_id;
  return jsonb_build_object('ok', true, 'produtos', v_ok, 'pausado', coalesce(p_pausar, true));
end $$;
revoke all on function public.automacao_pausar(uuid[], boolean, text) from public, anon;
grant execute on function public.automacao_pausar(uuid[], boolean, text) to authenticated, service_role;

-- Rede de segurança no banco: proposta de agente (a_confirmar / rascunho / imagem não aprovada) em produto pausado é recusada.
create function private.bloqueia_proposta_pausada() returns trigger language plpgsql set search_path = '' as $$
declare v jsonb := to_jsonb(new); v_produto uuid := (v->>'produto_id')::uuid; v_proposta boolean;
begin
  v_proposta := (v->>'status') in ('a_confirmar', 'rascunho') or (v ? 'aprovada' and (v->>'aprovada') = 'false');
  if v_proposta and exists (select 1 from public.produto_automacao a where a.produto_id = v_produto and a.pausado) then
    raise exception 'automacao_pausada: o lojista pausou o cadastro automático deste produto' using errcode = '55000';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['produto_enriquecimento', 'produto_codigos', 'produto_aplicacoes', 'produto_imagens', 'produto_bula'] loop
    execute format('create trigger %I before insert on public.%I for each row execute function private.bloqueia_proposta_pausada()', t || '_pausa', t);
  end loop;
end $$;

-- O que falta para publicar (mesmas exigências de publicar_produto), só leitura, para o agente saber o que preencher.
create function public.produto_pendencias(p_loja uuid, p_produto uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.produtos%rowtype; exigidos text[]; campo text; ok boolean; faltando text[] := '{}';
begin
  select * into p from public.produtos where id = p_produto and loja_id = p_loja;
  if not found then return jsonb_build_object('erro', 'Produto não encontrado nesta loja.'); end if;
  select r.campos_obrigatorios into exigidos from public.lojas l join public.perfis_ramo r on r.codigo = l.perfil_ramo where l.id = p.loja_id;
  foreach campo in array coalesce(exigidos, '{}') loop
    ok := case campo
      when 'nome' then coalesce(btrim(p.nome), '') <> ''
      when 'sku' then coalesce(btrim(p.sku), '') <> ''
      when 'preco' then coalesce(p.preco, 0) > 0
      when 'categoria' then exists (select 1 from public.taxonomia_nos n where n.id = p.taxonomia_no_id and n.status = 'aprovado')
      when 'imagem_principal' then exists (select 1 from public.produto_imagens i where i.produto_id = p.id and i.principal and i.aprovada and i.removida_em is null)
      when 'marca_peca' then exists (select 1 from public.produto_codigos c join public.marcas m on m.id = c.marca_id where c.produto_id = p.id and c.tipo = 'fabricante' and c.status = 'aprovado' and m.tipo = 'peca' and m.status = 'aprovado')
      when 'codigo_fabricante' then exists (select 1 from public.produto_codigos c where c.produto_id = p.id and c.tipo = 'fabricante' and c.status = 'aprovado')
      when 'bula_tecnica' then exists (select 1 from public.produto_bula b where b.produto_id = p.id and b.status = 'aprovada')
      else false end;
    if not ok then faltando := faltando || campo; end if;
  end loop;
  return jsonb_build_object('sku', p.sku, 'publicado', p.publicado, 'exigidos', to_jsonb(coalesce(exigidos, '{}')), 'faltando', to_jsonb(faltando),
    'pronto_para_publicar', array_length(faltando, 1) is null,
    'automacao_pausada', exists (select 1 from public.produto_automacao a where a.produto_id = p.id and a.pausado));
end $$;
revoke all on function public.produto_pendencias(uuid, uuid) from public, anon, authenticated;
grant execute on function public.produto_pendencias(uuid, uuid) to service_role;

-- Bula técnica: proposta do agente (rascunho, com FONTE) e aprovação do lojista.
alter table public.produto_bula add column fonte text check (fonte is null or length(btrim(fonte)) > 0);
-- (sem constraint nova em status: o fluxo existente de aprovação de bula continua igual; a exigência de fonte vale na proposta do agente e em bula_aprovar)

create function public.bula_propor(p_loja uuid, p_produto uuid, p_medidas jsonb, p_contra text[], p_fonte text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb;
begin
  if coalesce(btrim(p_fonte), '') = '' then return jsonb_build_object('erro', 'Informe a fonte das medidas.'); end if;
  if p_medidas is null or jsonb_typeof(p_medidas) <> 'object' or p_medidas = '{}'::jsonb then return jsonb_build_object('erro', 'Informe ao menos uma medida.'); end if;
  for k, v in select * from jsonb_each(p_medidas) loop
    if jsonb_typeof(v) <> 'object' or jsonb_typeof(v->'valor') <> 'number' or coalesce(v->>'unidade', '') not in ('mm', 'cm', 'm', 'g', 'kg', 'nm', 'bar', 'l', 'graus', 'un') then
      return jsonb_build_object('erro', format('Medida "%s": informe valor numérico e unidade (mm, cm, m, g, kg, nm, bar, l, graus, un).', left(k, 40)));
    end if;
  end loop;
  if not exists (select 1 from public.produtos where id = p_produto and loja_id = p_loja) then return jsonb_build_object('erro', 'Produto não encontrado nesta loja.'); end if;
  if exists (select 1 from public.produto_bula where produto_id = p_produto and status = 'aprovada') then return jsonb_build_object('erro', 'Já existe bula aprovada: ela não é alterada por agente.'); end if;
  insert into public.produto_bula (produto_id, loja_id, medidas_peca, contraindicacoes, fonte, status)
    values (p_produto, p_loja, p_medidas, coalesce(p_contra, '{}'), btrim(p_fonte), 'rascunho')
  on conflict (produto_id) do update set medidas_peca = excluded.medidas_peca, contraindicacoes = excluded.contraindicacoes, fonte = excluded.fonte, status = 'rascunho', atualizado_em = now();
  return jsonb_build_object('ok', true, 'status', 'rascunho', 'aviso', 'Bula em rascunho. O lojista precisa aprovar.');
end $$;
revoke all on function public.bula_propor(uuid, uuid, jsonb, text[], text) from public, anon, authenticated;
grant execute on function public.bula_propor(uuid, uuid, jsonb, text[], text) to service_role;

create function public.bula_aprovar(p_produto uuid, p_aprovar boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_loja uuid;
begin
  if v_uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select loja_id into v_loja from public.produto_bula where produto_id = p_produto;
  if v_loja is null or not private.administra_loja(v_loja, v_uid) then raise exception 'bula não encontrada' using errcode = '42501'; end if;
  if p_aprovar and not exists (select 1 from public.produto_bula where produto_id = p_produto and coalesce(btrim(fonte), '') <> '') then
    return jsonb_build_object('ok', false, 'erro', 'A bula não tem fonte registrada: peça ao agente a fonte das medidas antes de aprovar.');
  end if;
  update public.produto_bula set status = case when p_aprovar then 'aprovada' else 'rascunho' end,
    aprovada_em = case when p_aprovar then now() end, aprovada_por = case when p_aprovar then v_uid::text end, atualizado_em = now() where produto_id = p_produto;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois) values (v_loja, v_uid, case when p_aprovar then 'bula.aprovada' else 'bula.reaberta' end, 'produto_bula', jsonb_build_object('produto_id', p_produto));
  return jsonb_build_object('ok', true, 'aprovada', p_aprovar);
end $$;
revoke all on function public.bula_aprovar(uuid, boolean) from public, anon;
grant execute on function public.bula_aprovar(uuid, boolean) to authenticated, service_role;
