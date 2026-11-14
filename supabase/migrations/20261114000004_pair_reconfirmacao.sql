-- Pareamento: reconfirmação a cada 8 h para autorizações longas (até 7 dias).
-- Modelo: `limite_ate` passa a ser a JANELA corrente (no máx. 8 h); `limite_absoluto_ate` é a duração total aprovada.
-- Sem reconfirmação, a sessão termina em 8 h (como já era). O lojista reconfirma (login recente) para estender a janela até o teto absoluto.
-- Mudança aditiva: coluna nova + função nova; pair_consultar recriada só para gravar a janela. Sessões existentes: teto = limite_ate atual.
alter table public.pair_sessoes add column if not exists limite_absoluto_ate timestamptz;
update public.pair_sessoes set limite_absoluto_ate = limite_ate where limite_absoluto_ate is null;
alter table public.pair_sessoes alter column limite_absoluto_ate set not null;
alter table public.pair_sessoes add constraint pair_sessoes_limites_ok check (limite_ate <= limite_absoluto_ate);

create or replace function public.pair_consultar(p_codigo_hash text, p_segredo_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.pair_desafios; v_disp uuid; v_sessao public.pair_sessoes;
begin
  select * into d from public.pair_desafios where codigo_hash = p_codigo_hash and segredo_hash = p_segredo_hash for update;
  if not found then return jsonb_build_object('estado', 'invalido'); end if;

  if d.estado = 'resgatado' then
    select * into v_sessao from public.pair_sessoes where dispositivo_id = d.dispositivo_id order by criado_em limit 1;
    return jsonb_build_object('estado', 'resgatado', 'loja_id', d.loja_id, 'escopos', d.escopos_aprovados,
      'dispositivo_id', d.dispositivo_id, 'limite_ate', v_sessao.limite_ate, 'revogada', v_sessao.revogado_em is not null);
  end if;
  if d.estado in ('recusado', 'cancelado', 'expirado') then return jsonb_build_object('estado', d.estado); end if;
  if d.expira_em <= now() then
    update public.pair_desafios set estado = 'expirado' where id = d.id;
    return jsonb_build_object('estado', 'expirado');
  end if;
  if d.estado = 'pendente' then return jsonb_build_object('estado', 'pendente', 'expira_em', d.expira_em); end if;

  -- estado = 'aprovado': consumo atômico (a linha está travada por FOR UPDATE; o UPDATE condicional é a garantia final)
  update public.pair_desafios set estado = 'resgatado', resgatado_em = now()
   where id = d.id and estado = 'aprovado' and expira_em > now();
  if not found then return jsonb_build_object('estado', 'expirado'); end if;
  insert into public.pair_dispositivos (loja_id, usuario_id, nome, tipo, capacidades)
  values (d.loja_id, d.aprovado_por, d.nome_dispositivo, d.tipo, coalesce(d.capacidades_aprovadas, '{}'))
  returning id into v_disp;
  insert into public.pair_sessoes (loja_id, usuario_id, dispositivo_id, token_hash, sal_hash, escopos, renovavel, expira_em, limite_ate, limite_absoluto_ate)
  values (d.loja_id, d.aprovado_por, v_disp, d.token_hash, d.sal_hash, d.escopos_aprovados, d.renovavel,
          case when d.renovavel then least(now() + interval '15 minutes', now() + make_interval(mins => least(d.duracao_aprovada_min, 480)))
               else now() + make_interval(mins => least(d.duracao_aprovada_min, 480)) end,
          now() + make_interval(mins => least(d.duracao_aprovada_min, 480)),   -- janela de 8 h; estendida só por reconfirmação do lojista
          now() + make_interval(mins => d.duracao_aprovada_min))
  returning * into v_sessao;
  update public.pair_desafios set dispositivo_id = v_disp where id = d.id;
  perform private.pair_auditar(d.loja_id, d.aprovado_por, 'pair.sessao_criada', 'pair_sessoes',
    jsonb_build_object('sessao_id', v_sessao.id, 'dispositivo_id', v_disp, 'tipo', d.tipo, 'escopos', d.escopos_aprovados, 'limite_ate', v_sessao.limite_ate));
  return jsonb_build_object('estado', 'resgatado', 'loja_id', d.loja_id, 'escopos', d.escopos_aprovados, 'dispositivo_id', v_disp,
    'sessao_expira_em', v_sessao.expira_em, 'limite_ate', v_sessao.limite_ate, 'renovavel', d.renovavel);
end $$;

create or replace function public.pair_reconfirmar(p_sessao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; uid uuid := auth.uid(); nova timestamptz;
begin
  select * into s from public.pair_sessoes where id = p_sessao for update;
  if not found or not private.pair_pode_revogar(s.loja_id, s.usuario_id, uid) then raise exception 'sessão não encontrada' using errcode = '42501'; end if;
  if not private.autenticacao_recente(300) then return jsonb_build_object('ok', false, 'motivo', 'login_recente_necessario'); end if;
  if s.revogado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'sessao_revogada'); end if;
  if s.limite_ate <= now() or s.limite_absoluto_ate <= now() then return jsonb_build_object('ok', false, 'motivo', 'sessao_encerrada'); end if;
  nova := least(now() + interval '8 hours', s.limite_absoluto_ate);
  if nova <= s.limite_ate then return jsonb_build_object('ok', true, 'limite_ate', s.limite_ate, 'limite_absoluto_ate', s.limite_absoluto_ate, 'estendida', false); end if;
  update public.pair_sessoes set limite_ate = nova where id = s.id;
  perform private.pair_auditar(s.loja_id, uid, 'pair.sessao_reconfirmada', 'pair_sessoes',
    jsonb_build_object('sessao_id', s.id, 'dispositivo_id', s.dispositivo_id, 'limite_ate', nova, 'limite_absoluto_ate', s.limite_absoluto_ate));
  return jsonb_build_object('ok', true, 'limite_ate', nova, 'limite_absoluto_ate', s.limite_absoluto_ate, 'estendida', true);
end $$;
revoke all on function public.pair_reconfirmar(uuid) from public, anon;
grant execute on function public.pair_reconfirmar(uuid) to authenticated;

-- ROLLBACK: drop function public.pair_reconfirmar(uuid); alter table public.pair_sessoes drop constraint pair_sessoes_limites_ok, drop column limite_absoluto_ate;
--   e recriar pair_consultar a partir de 20261018230657_conecta_pair.sql.

-- O painel precisa ler o teto absoluto para mostrar "reconfirmar" (coluna sem dado sensível).
grant select (limite_absoluto_ate) on public.pair_sessoes to authenticated;
