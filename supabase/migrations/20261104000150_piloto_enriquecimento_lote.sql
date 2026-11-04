-- Piloto de filas do Nano: aproveita enriquecimento_tarefas, sem criar novo sistema.
-- Segurança: só o administrador autenticado seleciona um lote; trabalhador apenas service_role.
-- Registro pausado continua pausado e nunca recebe proposta ou é processado.
create unique index if not exists enriquecimento_pendente_unico_piloto
on public.enriquecimento_tarefas(loja_id,produto_id,tipo)
where status in ('na_fila'::public.status_tarefa,'reivindicada'::public.status_tarefa);

create or replace function public.enriquecimento_lote_preparar(p_produtos uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_user uuid := auth.uid();
 v_qtd int;
 v_loja uuid;
 v_linha record;
 v_itens jsonb := '[]'::jsonb;
 v_aptos int := 0;
 v_pausados int := 0;
 v_em_fila int := 0;
 v_inativos int := 0;
 v_motivo text;
begin
 if v_user is null then raise exception 'autenticacao exigida' using errcode='28000'; end if;
 v_qtd := cardinality(p_produtos);
 if v_qtd is null or v_qtd < 1 or v_qtd > 10 then
  raise exception 'piloto: selecione de 1 a 10 produtos' using errcode='22023';
 end if;
 if (select count(distinct u.id) from unnest(p_produtos) as u(id)) <> v_qtd then
  raise exception 'ids repetidos nao sao permitidos' using errcode='22023';
 end if;
 select p.loja_id into v_loja from public.produtos p where p.id=any(p_produtos) limit 1;
 if v_loja is null or not private.administra_loja(v_loja,v_user) or
    (select count(*) from public.produtos p where p.id=any(p_produtos) and p.loja_id=v_loja) <> v_qtd then
  raise exception 'produtos indisponiveis para esta loja' using errcode='42501';
 end if;
 for v_linha in
  select p.id,p.sku,p.nome,p.situacao,coalesce(a.pausado,false) as pausado,
    exists (select 1 from public.enriquecimento_tarefas t
      where t.loja_id=p.loja_id and t.produto_id=p.id and t.tipo='catalogo_tecnico'
        and t.status in ('na_fila','reivindicada')) as em_fila
  from public.produtos p left join public.produto_automacao a on a.produto_id=p.id
  where p.loja_id=v_loja and p.id=any(p_produtos)
  order by p.sku,p.id
 loop
  v_motivo := case
    when v_linha.pausado then 'automacao_pausada'
    when v_linha.situacao <> 'A' then 'produto_inativo'
    when v_linha.em_fila then 'ja_na_fila'
    else 'apto'
   end;
  v_itens := v_itens || jsonb_build_array(jsonb_build_object(
    'produto_id',v_linha.id,'sku',v_linha.sku,'nome',v_linha.nome,'estado',v_motivo));
  if v_motivo='apto' then v_aptos := v_aptos+1;
  elsif v_motivo='automacao_pausada' then v_pausados := v_pausados+1;
  elsif v_motivo='ja_na_fila' then v_em_fila := v_em_fila+1;
  else v_inativos := v_inativos+1;
  end if;
 end loop;
 return jsonb_build_object('loja_id',v_loja,'itens',v_itens,'aptos',v_aptos,
  'pausados',v_pausados,'ja_na_fila',v_em_fila,'inativos',v_inativos,
  'aviso','Apenas pre-visualizacao: nenhuma tarefa ou produto foi alterado.');
end $$;

create or replace function public.enriquecimento_lote_enfileirar(p_produtos uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_previa jsonb;
 v_loja uuid;
 v_inseridos int;
begin
 -- Mesma verificacao de usuario, loja, selecao e pausas da pre-visualizacao.
 v_previa := public.enriquecimento_lote_preparar(p_produtos);
 v_loja := (v_previa->>'loja_id')::uuid;
 insert into public.enriquecimento_tarefas(loja_id,produto_id,tipo,provedor_preferido,status)
 select p.loja_id,p.id,'catalogo_tecnico','automatico','na_fila'
 from public.produtos p
 where p.loja_id=v_loja and p.id=any(p_produtos) and p.situacao='A'
   and not exists (select 1 from public.produto_automacao a where a.produto_id=p.id and a.pausado)
 on conflict do nothing;
 get diagnostics v_inseridos = row_count;
 return v_previa || jsonb_build_object('enfileirados',v_inseridos,
   'aviso','Tarefas registradas para processamento posterior, sem executar IA nem gravar Bling.');
end $$;

revoke all on function public.enriquecimento_lote_preparar(uuid[]) from public,anon;
revoke all on function public.enriquecimento_lote_enfileirar(uuid[]) from public,anon;
grant execute on function public.enriquecimento_lote_preparar(uuid[]) to authenticated;
grant execute on function public.enriquecimento_lote_enfileirar(uuid[]) to authenticated;

-- A reivindicacao paralela precisa de SKIP LOCKED; so um worker server-side autorizado.
create or replace function public.enriquecimento_lote_reivindicar(p_loja uuid,p_worker text,p_max integer default 2)
returns table(tarefa_id uuid,produto_id uuid,sku text,nome text,tentativas integer)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'uso exclusivo do worker' using errcode='42501';
 end if;
 if p_max < 1 or p_max > 2 or length(coalesce(p_worker,'')) < 8 then
  raise exception 'parametros invalidos' using errcode='22023';
 end if;
 return query
 with selecionadas as (
  select t.id from public.enriquecimento_tarefas t
    join public.produtos p on p.id=t.produto_id and p.loja_id=t.loja_id
  where t.loja_id=p_loja and t.tipo='catalogo_tecnico' and p.situacao='A'
    and t.tentativas < 3
    and ((t.status='na_fila' and coalesce(t.lease_ate,now())<=now())
      or (t.status='reivindicada' and t.lease_ate<now()))
    and not exists (select 1 from public.produto_automacao a where a.produto_id=p.id and a.pausado)
  order by t.criado_em,t.id
  for update of t skip locked limit p_max
 ), atualizadas as (
  update public.enriquecimento_tarefas t set
    status='reivindicada',lease_ate=now()+interval '3 minutes',
    lease_por=p_worker,tentativas=t.tentativas+1
  from selecionadas s where t.id=s.id
  returning t.id,t.produto_id,t.tentativas
 )
 select a.id,a.produto_id,p.sku,p.nome,a.tentativas
 from atualizadas a join public.produtos p on p.id=a.produto_id;
end $$;

create or replace function public.enriquecimento_lote_concluir(p_tarefa uuid,p_worker text,p_sucesso boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_qtd int;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'uso exclusivo do worker' using errcode='42501';
 end if;
 update public.enriquecimento_tarefas t set
  status=case when p_sucesso then 'concluida'::public.status_tarefa
      when t.tentativas>=3 then 'falhou'::public.status_tarefa
      else 'na_fila'::public.status_tarefa end,
  lease_por=null,
  lease_ate=case when p_sucesso or t.tentativas>=3 then null
    else now()+interval '2 minutes' * t.tentativas end,
  concluido_em=case when p_sucesso then now() else null end
 where t.id=p_tarefa and t.status='reivindicada' and t.lease_por=p_worker
   and t.lease_ate>=now();
 get diagnostics v_qtd=row_count;
 return v_qtd=1;
end $$;
revoke all on function public.enriquecimento_lote_reivindicar(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.enriquecimento_lote_concluir(uuid,text,boolean) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.enriquecimento_lote_reivindicar(uuid,text,integer) to service_role;
grant execute on function public.enriquecimento_lote_concluir(uuid,text,boolean) to service_role;
