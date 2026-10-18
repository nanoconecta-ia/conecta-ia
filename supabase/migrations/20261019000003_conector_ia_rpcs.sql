-- Conector IA — máquina de estados no banco (Fase 1, PROPOSTA: não aplicar em produção sem aprovação específica).
-- Toda regra que protege o ERP vive aqui, não só no código: aprovação presa à versão/hash, trava por produto,
-- idempotência, estado "desconhecido" em timeout e escrita REAL só com liberação explícita por loja e ferramenta.
-- Todas as funções: security definer, search_path vazio, executáveis só por service_role (as Edge Functions
-- autenticam o usuário com o JWT dele e passam o user_id verificado).

-- ------------------------------------------------------------ utilidades
create function private.auditar(p_loja uuid, p_user uuid, p_acao text, p_tabela text, p_antes jsonb, p_depois jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois) values (p_loja, p_user, p_acao, p_tabela, p_antes, p_depois);
$$;

create function private.eh_membro(p_loja uuid, p_user uuid, p_so_lojista boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios_loja where loja_id = p_loja and user_id = p_user and (not p_so_lojista or papel = 'lojista'));
$$;

-- Hash determinístico do conteúdo que o humano vai aprovar (jsonb::text é canônico para o mesmo valor).
create function private.proposta_calcular_hash(p_proposta uuid) returns text
language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'loja', p.loja_id, 'solicitante', p.solicitante_user, 'versao', p.versao, 'lote', p.lote,
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'ordem', i.ordem, 'produto', i.produto_id, 'operacao', i.operacao, 'alvo', i.alvo, 'campos', i.campos,
        'antes', i.antes, 'depois', i.depois, 'fontes', i.fontes, 'risco', i.risco, 'idempotency_key', i.idempotency_key)
        order by i.ordem) from public.agente_proposta_itens i where i.proposta_id = p.id), '[]'::jsonb)
  )::text, 'UTF8')), 'hex')
  from public.agente_propostas p where p.id = p_proposta;
$$;

create function private.estado_produto(p_loja uuid, p_produto uuid) returns public.produto_estado_op
language sql stable security definer set search_path = '' as $$
  select coalesce((select estado from public.produto_travas where produto_id = p_produto and loja_id = p_loja), 'liberado_propostas');
$$;

create function private.definir_estado_produto(p_loja uuid, p_produto uuid, p_estado public.produto_estado_op, p_user uuid, p_motivo text)
returns void language sql security definer set search_path = '' as $$
  insert into public.produto_travas (produto_id, loja_id, estado, motivo, alterado_por, alterado_em)
  values (p_produto, p_loja, p_estado, p_motivo, p_user, now())
  on conflict (produto_id) do update set estado = excluded.estado, motivo = excluded.motivo, alterado_por = excluded.alterado_por, alterado_em = now();
$$;

-- ------------------------------------------------------------ conversas
create function public.agente_conversa_criar(p_loja uuid, p_user uuid, p_titulo text, p_provedor text, p_modelo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  insert into public.agente_conversas (loja_id, user_id, titulo, provedor, modelo)
  values (p_loja, p_user, coalesce(nullif(left(trim(p_titulo), 120), ''), 'Nova conversa'), p_provedor, p_modelo) returning id into v_id;
  return v_id;
end $$;

-- Acrescenta mensagem com seq sequencial (trava a conversa) e registra o modelo que respondeu: trocar de modelo não quebra a ordem.
create function public.agente_mensagem_gravar(p_loja uuid, p_conversa uuid, p_user uuid, p_papel public.agente_msg_papel, p_conteudo jsonb,
  p_provedor text, p_modelo text, p_tokens_in int, p_tokens_out int, p_custo numeric, p_prompt_versao int)
returns int language plpgsql security definer set search_path = '' as $$
declare v_seq int;
begin
  perform 1 from public.agente_conversas where id = p_conversa and loja_id = p_loja and user_id = p_user for update;
  if not found then raise exception 'conversa_nao_encontrada' using errcode = 'P0002'; end if;
  select coalesce(max(seq), 0) + 1 into v_seq from public.agente_mensagens where conversa_id = p_conversa;
  insert into public.agente_mensagens (loja_id, conversa_id, seq, papel, conteudo, provedor, modelo, tokens_entrada, tokens_saida, custo_estimado, prompt_versao)
  values (p_loja, p_conversa, v_seq, p_papel, p_conteudo, p_provedor, p_modelo, p_tokens_in, p_tokens_out, p_custo, p_prompt_versao);
  update public.agente_conversas set atualizado_em = now(), provedor = coalesce(p_provedor, provedor), modelo = coalesce(p_modelo, modelo)
  where id = p_conversa;
  return v_seq;
end $$;

-- Exclui a conversa do próprio usuário. Tarefas, propostas, aprovações e auditoria PERMANECEM (conversa_id vira null).
create function public.agente_conversa_excluir(p_loja uuid, p_conversa uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.agente_conversas where id = p_conversa and loja_id = p_loja and user_id = p_user;
  get diagnostics v_n = row_count;
  if v_n = 1 then perform private.auditar(p_loja, p_user, 'agente.conversa.excluida', 'agente_conversas', jsonb_build_object('id', p_conversa), null); end if;
  return v_n = 1;
end $$;

-- ------------------------------------------------------------ propostas
create function public.agente_proposta_criar(p_loja uuid, p_user uuid, p_tarefa uuid, p_conversa uuid, p_agente text, p_provedor text, p_modelo text,
  p_prompt_versao int, p_titulo text, p_resumo text, p_lote boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  insert into public.agente_propostas (loja_id, tarefa_id, conversa_id, solicitante_user, agente, provedor, modelo, prompt_versao, titulo, resumo, lote)
  values (p_loja, p_tarefa, p_conversa, p_user, coalesce(p_agente, 'Conector IA'), p_provedor, p_modelo, p_prompt_versao, p_titulo, p_resumo, coalesce(p_lote, false))
  returning id into v_id;
  return v_id;
end $$;

create function public.agente_proposta_item_adicionar(p_loja uuid, p_proposta uuid, p_produto uuid, p_operacao text, p_alvo text, p_campos text[],
  p_antes jsonb, p_depois jsonb, p_fontes jsonb, p_validacoes jsonb, p_risco public.risco_nivel, p_idempotency_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ordem int;
begin
  perform 1 from public.agente_propostas where id = p_proposta and loja_id = p_loja and estado = 'rascunho' for update;
  if not found then raise exception 'proposta_nao_e_rascunho' using errcode = '42501'; end if;
  select coalesce(max(ordem) + 1, 0) into v_ordem from public.agente_proposta_itens where proposta_id = p_proposta;
  insert into public.agente_proposta_itens (loja_id, proposta_id, produto_id, ordem, operacao, alvo, campos, antes, depois, fontes, validacoes, risco, idempotency_key)
  values (p_loja, p_proposta, p_produto, v_ordem, p_operacao, p_alvo, coalesce(p_campos, '{}'), p_antes, p_depois,
          coalesce(p_fontes, '[]'), coalesce(p_validacoes, '[]'), p_risco, p_idempotency_key)
  returning id into v_id;
  return v_id;
end $$;

-- Envia para aprovação: valida fonte/antes, fixa o hash e o prazo, e marca o produto (travado fica só como sugestão).
create function public.agente_proposta_enviar(p_loja uuid, p_proposta uuid, p_validade_horas int default 24) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.agente_propostas; v_i record; v_risco public.risco_nivel := 'LOW'; v_hash text; v_est public.produto_estado_op;
begin
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja for update;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = 'P0002'; end if;
  if v_p.estado <> 'rascunho' then raise exception 'proposta_ja_enviada' using errcode = '42501'; end if;
  if not exists (select 1 from public.agente_proposta_itens where proposta_id = p_proposta) then raise exception 'proposta_sem_itens' using errcode = '22023'; end if;
  if p_validade_horas < 1 or p_validade_horas > 168 then raise exception 'validade_invalida' using errcode = '22023'; end if;

  for v_i in select * from public.agente_proposta_itens where proposta_id = p_proposta order by ordem loop
    -- zero invenção: todo item precisa de ao menos uma fonte real (url ou documento)
    if not exists (select 1 from jsonb_array_elements(v_i.fontes) f where coalesce(f->>'url', f->>'documento', '') <> '') then
      raise exception 'item_sem_fonte: ordem %', v_i.ordem using errcode = '22023';
    end if;
    if cardinality(v_i.campos) > 0 and v_i.antes is null then raise exception 'item_sem_antes: ordem %', v_i.ordem using errcode = '22023'; end if;
    if v_i.risco > v_risco then v_risco := v_i.risco; end if;
    if v_i.produto_id is not null then
      v_est := private.estado_produto(p_loja, v_i.produto_id);
      if v_est in ('em_execucao', 'aprovado_execucao') then raise exception 'produto_em_execucao: ordem %', v_i.ordem using errcode = '55006'; end if;
      if v_est = 'bloqueado' then
        update public.agente_proposta_itens set estado = 'travado', motivo = 'produto travado: só sugestão' where id = v_i.id;
      else
        perform private.definir_estado_produto(p_loja, v_i.produto_id, 'pendente_aprovacao', v_p.solicitante_user, 'proposta enviada');
      end if;
    end if;
  end loop;

  v_hash := private.proposta_calcular_hash(p_proposta);
  update public.agente_propostas set risco = v_risco, hash = v_hash, estado = 'pendente', enviado_em = now(), expira_em = now() + make_interval(hours => p_validade_horas)
  where id = p_proposta;
  update public.agente_tarefas set estado = 'aguardando_aprovacao', atualizado_em = now() where id = v_p.tarefa_id;
  perform private.auditar(p_loja, v_p.solicitante_user, 'agente.proposta.enviada', 'agente_propostas', null,
    jsonb_build_object('id', p_proposta, 'versao', v_p.versao, 'hash', v_hash, 'risco', v_risco));
  return jsonb_build_object('proposta', p_proposta, 'versao', v_p.versao, 'hash', v_hash, 'risco', v_risco);
end $$;

-- Nova versão a partir de uma proposta pendente/aprovada ainda não executada: a anterior perde a validade.
create function public.agente_proposta_revisar(p_loja uuid, p_proposta uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_p public.agente_propostas; v_novo uuid; v_i record; v_n int := 0;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja for update;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = 'P0002'; end if;
  if v_p.estado not in ('pendente', 'aprovada', 'rejeitada', 'expirada') then raise exception 'proposta_nao_revisavel: %', v_p.estado using errcode = '55006'; end if;
  if exists (select 1 from public.agente_propostas where proposta_anterior_id = p_proposta) then raise exception 'ja_revisada' using errcode = '55006'; end if;
  insert into public.agente_propostas (loja_id, tarefa_id, conversa_id, solicitante_user, agente, provedor, modelo, prompt_versao, titulo, resumo, risco, versao, proposta_anterior_id, lote)
  values (p_loja, v_p.tarefa_id, v_p.conversa_id, p_user, v_p.agente, v_p.provedor, v_p.modelo, v_p.prompt_versao, v_p.titulo, v_p.resumo, v_p.risco, v_p.versao + 1, p_proposta, v_p.lote)
  returning id into v_novo;
  for v_i in select * from public.agente_proposta_itens where proposta_id = p_proposta order by ordem loop
    v_n := v_n + 1;
    insert into public.agente_proposta_itens (loja_id, proposta_id, produto_id, ordem, operacao, alvo, campos, antes, depois, fontes, validacoes, risco, idempotency_key)
    values (p_loja, v_novo, v_i.produto_id, v_i.ordem, v_i.operacao, v_i.alvo, v_i.campos, v_i.antes, v_i.depois, v_i.fontes, v_i.validacoes, v_i.risco,
            left(v_i.idempotency_key, 80) || '.v' || (v_p.versao + 1)::text || '.' || substr(md5(random()::text), 1, 6));
  end loop;
  if v_p.estado in ('pendente', 'aprovada') then
    update public.agente_propostas set estado = 'invalidada', decidido_em = now() where id = p_proposta;
    update public.agente_proposta_itens set estado = 'ignorado', motivo = 'proposta substituída por nova versão' where proposta_id = p_proposta and estado in ('pendente', 'aprovado', 'travado');
    update public.produto_travas t set estado = 'liberado_propostas', alterado_em = now(), motivo = 'proposta substituída'
      where t.loja_id = p_loja and t.estado in ('pendente_aprovacao', 'aprovado_execucao')
        and t.produto_id in (select produto_id from public.agente_proposta_itens where proposta_id = p_proposta and produto_id is not null);
  end if;
  perform private.auditar(p_loja, p_user, 'agente.proposta.revisada', 'agente_propostas',
    jsonb_build_object('id', p_proposta, 'versao', v_p.versao), jsonb_build_object('id', v_novo, 'versao', v_p.versao + 1));
  return v_novo;
end $$;

-- ------------------------------------------------------------ aprovação (somente humano membro da loja; presa a versão+hash)
create function public.agente_proposta_decidir(p_loja uuid, p_proposta uuid, p_versao int, p_hash text, p_user uuid, p_decisao text,
  p_itens uuid[] default null, p_confirmacao_explicita boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.agente_propostas; v_atual text; v_ids uuid[]; v_prod uuid[]; v_campos text[];
begin
  if p_decisao not in ('aprovada', 'rejeitada') then raise exception 'decisao_invalida' using errcode = '22023'; end if;
  if p_user is null or not private.eh_membro(p_loja, p_user, true) then raise exception 'sem_permissao: só o lojista da loja decide' using errcode = '42501'; end if;
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja for update;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = 'P0002'; end if;
  if v_p.estado <> 'pendente' then raise exception 'proposta_nao_pendente: %', v_p.estado using errcode = '55006'; end if;
  if v_p.expira_em <= now() then
    update public.agente_propostas set estado = 'expirada', decidido_em = now() where id = p_proposta;
    update public.produto_travas set estado = 'liberado_propostas', alterado_em = now() where loja_id = p_loja and estado = 'pendente_aprovacao'
      and produto_id in (select produto_id from public.agente_proposta_itens where proposta_id = p_proposta and produto_id is not null);
    return jsonb_build_object('ok', false, 'erro', 'proposta_expirada');
  end if;
  v_atual := private.proposta_calcular_hash(p_proposta);
  if v_p.versao <> p_versao or v_p.hash is distinct from p_hash or v_atual is distinct from p_hash then
    raise exception 'versao_ou_hash_divergente: a proposta mudou; revise e aprove a versão atual' using errcode = '40001';
  end if;

  if p_decisao = 'rejeitada' then
    update public.agente_propostas set estado = 'rejeitada', decidido_em = now() where id = p_proposta;
    update public.agente_proposta_itens set estado = 'ignorado', motivo = 'proposta rejeitada' where proposta_id = p_proposta and estado in ('pendente', 'travado');
    update public.produto_travas set estado = 'liberado_propostas', alterado_em = now() where loja_id = p_loja and estado = 'pendente_aprovacao'
      and produto_id in (select produto_id from public.agente_proposta_itens where proposta_id = p_proposta and produto_id is not null);
    insert into public.agente_aprovacoes (loja_id, proposta_id, versao, hash_proposta, user_id, decisao, risco, escopo, expira_em)
    values (p_loja, p_proposta, p_versao, p_hash, p_user, 'rejeitada', v_p.risco, '{}', v_p.expira_em);
    update public.agente_tarefas set estado = 'cancelada', atualizado_em = now() where id = v_p.tarefa_id;
    perform private.auditar(p_loja, p_user, 'agente.proposta.rejeitada', 'agente_propostas', null, jsonb_build_object('id', p_proposta, 'versao', p_versao));
    return jsonb_build_object('ok', true, 'estado', 'rejeitada');
  end if;

  if v_p.risco >= 'HIGH' and not p_confirmacao_explicita then raise exception 'confirmacao_explicita_obrigatoria: risco %', v_p.risco using errcode = '22023'; end if;
  -- produto travado depois do envio: o item sai do escopo (só sugestão)
  update public.agente_proposta_itens i set estado = 'travado', motivo = 'produto travado: só sugestão'
    where i.proposta_id = p_proposta and i.estado = 'pendente' and i.produto_id is not null and private.estado_produto(p_loja, i.produto_id) = 'bloqueado';
  select array_agg(i.id), array_agg(distinct i.produto_id) filter (where i.produto_id is not null)
    into v_ids, v_prod
    from public.agente_proposta_itens i
    where i.proposta_id = p_proposta and i.estado = 'pendente' and (p_itens is null or i.id = any (p_itens));
  select array_agg(distinct c) into v_campos from public.agente_proposta_itens i, unnest(i.campos) c where i.id = any (v_ids);
  if v_ids is null then raise exception 'nada_aprovavel: todos os itens estão travados ou fora do escopo' using errcode = '22023'; end if;
  update public.agente_proposta_itens set estado = 'aprovado' where id = any (v_ids);
  update public.agente_proposta_itens set estado = 'ignorado', motivo = 'fora do escopo aprovado' where proposta_id = p_proposta and estado = 'pendente';
  if v_prod is not null then
    update public.produto_travas set estado = 'aprovado_execucao', alterado_por = p_user, alterado_em = now()
      where loja_id = p_loja and produto_id = any (v_prod) and estado = 'pendente_aprovacao';
  end if;
  insert into public.agente_aprovacoes (loja_id, proposta_id, versao, hash_proposta, user_id, decisao, risco, escopo, expira_em)
  values (p_loja, p_proposta, p_versao, p_hash, p_user, 'aprovada', v_p.risco,
    jsonb_build_object('itens', to_jsonb(v_ids), 'produtos', coalesce(to_jsonb(v_prod), '[]'::jsonb), 'campos', coalesce(to_jsonb(v_campos), '[]'::jsonb)),
    v_p.expira_em);
  update public.agente_propostas set estado = 'aprovada', decidido_em = now() where id = p_proposta;
  perform private.auditar(p_loja, p_user, 'agente.proposta.aprovada', 'agente_propostas', null,
    jsonb_build_object('id', p_proposta, 'versao', p_versao, 'hash', p_hash, 'itens', to_jsonb(v_ids)));
  return jsonb_build_object('ok', true, 'estado', 'aprovada', 'itens', to_jsonb(v_ids));
end $$;

-- ------------------------------------------------------------ execução
-- Libera/revoga escrita REAL por loja e ferramenta (decisão deliberada do dono, com referência da evidência).
create function public.agente_escrita_liberar(p_loja uuid, p_ferramenta text, p_user uuid, p_referencia text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_ferramenta !~ '^bling\.[a-z_]+\.[a-z_]+$' then raise exception 'ferramenta_invalida' using errcode = '22023'; end if;
  if char_length(coalesce(p_referencia, '')) < 10 then raise exception 'referencia_obrigatoria: cite testes/escopo/aprovação' using errcode = '22023'; end if;
  if not private.eh_membro(p_loja, p_user, true) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  insert into public.agente_escrita_liberada (loja_id, ferramenta, liberada_por, referencia) values (p_loja, p_ferramenta, p_user, p_referencia)
  on conflict (loja_id, ferramenta) do update set liberada_por = excluded.liberada_por, liberada_em = now(), revogada_em = null, referencia = excluded.referencia;
  perform private.auditar(p_loja, p_user, 'agente.escrita.liberada', 'agente_escrita_liberada', null, jsonb_build_object('ferramenta', p_ferramenta, 'referencia', p_referencia));
end $$;

create function public.agente_escrita_revogar(p_loja uuid, p_ferramenta text, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.eh_membro(p_loja, p_user, true) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.agente_escrita_liberada set revogada_em = now() where loja_id = p_loja and ferramenta = p_ferramenta and revogada_em is null;
  perform private.auditar(p_loja, p_user, 'agente.escrita.revogada', 'agente_escrita_liberada', null, jsonb_build_object('ferramenta', p_ferramenta));
end $$;

-- Revalida TUDO antes de executar: aprovação existe e bate com o hash recalculado, não expirou, produtos não travados,
-- e cada ferramenta bling.* tem liberação ativa para a loja. Retoma só itens aprovados ou que falharam com prova de que não gravaram.
-- Esta é a máquina de estados da execução REAL (o que fala com o Bling é a porta do executor: mock em teste, real só depois de liberada).
create function public.agente_proposta_iniciar_execucao(p_loja uuid, p_proposta uuid) returns table (
  item_id uuid, produto_id uuid, operacao text, alvo text, campos text[], antes jsonb, depois jsonb, idempotency_key text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_p public.agente_propostas; v_a public.agente_aprovacoes; v_i record;
begin
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja for update;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = 'P0002'; end if;
  if v_p.estado not in ('aprovada', 'parcial', 'falhou') then raise exception 'proposta_nao_executavel: %', v_p.estado using errcode = '55006'; end if;
  select * into v_a from public.agente_aprovacoes where proposta_id = p_proposta and decisao = 'aprovada';
  if not found then raise exception 'sem_aprovacao' using errcode = '42501'; end if;
  if v_a.hash_proposta is distinct from private.proposta_calcular_hash(p_proposta) or v_a.versao <> v_p.versao then
    raise exception 'aprovacao_invalida: a proposta mudou depois da aprovação' using errcode = '40001';
  end if;
  if v_a.expira_em <= now() then raise exception 'aprovacao_expirada' using errcode = '55006'; end if;
  if exists (select 1 from public.agente_proposta_itens where proposta_id = p_proposta and estado = 'desconhecido') then
    raise exception 'reconciliar_antes: há operação com resultado desconhecido' using errcode = '55006';
  end if;

  for v_i in select * from public.agente_proposta_itens i where i.proposta_id = p_proposta and i.estado in ('aprovado', 'falhou')
              and i.id in (select (jsonb_array_elements_text(v_a.escopo->'itens'))::uuid) order by i.ordem loop
    if v_i.produto_id is not null and private.estado_produto(p_loja, v_i.produto_id) = 'bloqueado' then
      raise exception 'produto_travado: ordem %', v_i.ordem using errcode = '42501';
    end if;
    if v_i.operacao like 'bling.%' and not exists (select 1 from public.agente_escrita_liberada l where l.loja_id = p_loja and l.ferramenta = v_i.operacao and l.revogada_em is null) then
      raise exception 'escrita_real_nao_liberada: %', v_i.operacao using errcode = '42501';
    end if;
  end loop;

  update public.agente_proposta_itens set estado = 'em_execucao'
    where proposta_id = p_proposta and estado in ('aprovado', 'falhou') and id in (select (jsonb_array_elements_text(v_a.escopo->'itens'))::uuid);
  update public.produto_travas set estado = 'em_execucao', alterado_em = now()
    where loja_id = p_loja and estado in ('aprovado_execucao', 'erro_divergencia')
      and produto_travas.produto_id in (select i.produto_id from public.agente_proposta_itens i where i.proposta_id = p_proposta and i.estado = 'em_execucao' and i.produto_id is not null);
  update public.agente_propostas set estado = 'executando' where id = p_proposta;
  update public.agente_tarefas set estado = 'executando', atualizado_em = now() where id = v_p.tarefa_id;
  perform private.auditar(p_loja, v_a.user_id, 'agente.execucao.iniciada', 'agente_propostas', null, jsonb_build_object('id', p_proposta));
  return query select i.id, i.produto_id, i.operacao, i.alvo, i.campos, i.antes, i.depois, i.idempotency_key
    from public.agente_proposta_itens i where i.proposta_id = p_proposta and i.estado = 'em_execucao' order by i.ordem;
end $$;

-- Ensaio: valida aprovação/hash/prazo/trava e devolve os itens aprováveis SEM mudar nenhum estado.
create function public.agente_proposta_validar(p_loja uuid, p_proposta uuid) returns table (
  item_id uuid, produto_id uuid, operacao text, alvo text, campos text[], antes jsonb, depois jsonb, idempotency_key text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_p public.agente_propostas; v_a public.agente_aprovacoes;
begin
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = 'P0002'; end if;
  select * into v_a from public.agente_aprovacoes where proposta_id = p_proposta and decisao = 'aprovada';
  if not found then raise exception 'sem_aprovacao' using errcode = '42501'; end if;
  if v_a.hash_proposta is distinct from private.proposta_calcular_hash(p_proposta) or v_a.versao <> v_p.versao then
    raise exception 'aprovacao_invalida: a proposta mudou depois da aprovação' using errcode = '40001';
  end if;
  if v_a.expira_em <= now() then raise exception 'aprovacao_expirada' using errcode = '55006'; end if;
  return query select i.id, i.produto_id, i.operacao, i.alvo, i.campos, i.antes, i.depois, i.idempotency_key
    from public.agente_proposta_itens i where i.proposta_id = p_proposta and i.estado in ('aprovado', 'falhou', 'em_execucao')
      and i.id in (select (jsonb_array_elements_text(v_a.escopo->'itens'))::uuid)
      and (i.produto_id is null or private.estado_produto(p_loja, i.produto_id) <> 'bloqueado') order by i.ordem;
end $$;

create function public.agente_simulacao_registrar(p_loja uuid, p_proposta uuid, p_user uuid, p_resultado jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_p public.agente_propostas; v_id uuid;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja;
  if not found then raise exception 'proposta_nao_encontrada' using errcode = 'P0002'; end if;
  insert into public.agente_simulacoes (loja_id, proposta_id, versao, hash_proposta, solicitada_por, resultado)
  values (p_loja, p_proposta, v_p.versao, coalesce(v_p.hash, ''), p_user, p_resultado) returning id into v_id;
  perform private.auditar(p_loja, p_user, 'agente.simulacao.registrada', 'agente_simulacoes', null, jsonb_build_object('id', v_id, 'proposta', p_proposta));
  return v_id;
end $$;

-- Abre uma tentativa. Não abre outra enquanto a anterior está "enviada" ou "desconhecida": nada de repetir às cegas.
create function public.agente_operacao_abrir(p_loja uuid, p_item uuid, p_ferramenta text, p_requisicao jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_i public.agente_proposta_itens; v_t int; v_id uuid;
begin
  select * into v_i from public.agente_proposta_itens where id = p_item and loja_id = p_loja for update;
  if not found then raise exception 'item_nao_encontrado' using errcode = 'P0002'; end if;
  if v_i.estado <> 'em_execucao' then raise exception 'item_nao_esta_em_execucao: %', v_i.estado using errcode = '55006'; end if;
  if exists (select 1 from public.agente_operacoes where item_id = p_item and estado in ('enviada', 'desconhecida', 'pendente')) then
    raise exception 'tentativa_anterior_em_aberto: reconcilie antes de repetir' using errcode = '55006';
  end if;
  if p_ferramenta like 'bling.%' and not exists (select 1 from public.agente_escrita_liberada l where l.loja_id = p_loja and l.ferramenta = p_ferramenta and l.revogada_em is null) then
    raise exception 'escrita_real_nao_liberada: %', p_ferramenta using errcode = '42501';
  end if;
  select coalesce(max(tentativa), 0) + 1 into v_t from public.agente_operacoes where item_id = p_item;
  insert into public.agente_operacoes (loja_id, proposta_id, item_id, tentativa, idempotency_key, ferramenta, estado, requisicao)
  values (p_loja, v_i.proposta_id, p_item, v_t, v_i.idempotency_key, p_ferramenta, 'pendente', p_requisicao) returning id into v_id;
  return v_id;
end $$;

create function public.agente_operacao_marcar_enviada(p_loja uuid, p_operacao uuid) returns void
language sql security definer set search_path = '' as $$
  update public.agente_operacoes set estado = 'enviada' where id = p_operacao and loja_id = p_loja and estado = 'pendente';
$$;

-- Fecha a tentativa. 'confirmada' exige evidência (leitura após a escrita). Timeout = 'desconhecida' (nunca 'falhou').
create function public.agente_operacao_fechar(p_loja uuid, p_operacao uuid, p_estado public.operacao_estado, p_resposta jsonb, p_evidencia jsonb, p_erro text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_o public.agente_operacoes;
begin
  select * into v_o from public.agente_operacoes where id = p_operacao and loja_id = p_loja for update;
  if not found then raise exception 'operacao_nao_encontrada' using errcode = 'P0002'; end if;
  if v_o.estado in ('confirmada', 'falhou') then raise exception 'operacao_ja_fechada' using errcode = '55006'; end if;
  if p_estado not in ('confirmada', 'falhou', 'desconhecida') then raise exception 'estado_final_invalido' using errcode = '22023'; end if;
  if p_estado = 'confirmada' and (p_evidencia is null or p_evidencia = '{}'::jsonb) then raise exception 'confirmacao_exige_evidencia' using errcode = '22023'; end if;
  update public.agente_operacoes set estado = p_estado, resposta = p_resposta, evidencia = p_evidencia, erro = left(p_erro, 500), concluido_em = now() where id = p_operacao;
  update public.agente_proposta_itens set estado = case p_estado when 'confirmada' then 'confirmado'::public.item_estado
      when 'falhou' then 'falhou'::public.item_estado else 'desconhecido'::public.item_estado end
    where id = v_o.item_id;
end $$;

-- Prova positiva de que gravou ('gravado') ou de que NÃO gravou ('nao_gravado'). Só então o item pode ser retomado.
create function public.agente_operacao_reconciliar(p_loja uuid, p_operacao uuid, p_resultado text, p_evidencia jsonb, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_o public.agente_operacoes;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into v_o from public.agente_operacoes where id = p_operacao and loja_id = p_loja for update;
  if not found or v_o.estado <> 'desconhecida' then raise exception 'operacao_nao_desconhecida' using errcode = '55006'; end if;
  if p_evidencia is null or p_evidencia = '{}'::jsonb then raise exception 'reconciliacao_exige_evidencia' using errcode = '22023'; end if;
  if p_resultado = 'gravado' then
    update public.agente_operacoes set estado = 'confirmada', evidencia = p_evidencia, concluido_em = now() where id = p_operacao;
    update public.agente_proposta_itens set estado = 'confirmado' where id = v_o.item_id;
  elsif p_resultado = 'nao_gravado' then
    update public.agente_operacoes set estado = 'falhou', evidencia = p_evidencia, erro = 'reconciliado: não gravou', concluido_em = now() where id = p_operacao;
    update public.agente_proposta_itens set estado = 'falhou' where id = v_o.item_id;
  else raise exception 'resultado_invalido' using errcode = '22023'; end if;
  perform private.auditar(p_loja, p_user, 'agente.operacao.reconciliada', 'agente_operacoes', null, jsonb_build_object('id', p_operacao, 'resultado', p_resultado));
end $$;

-- Fecha a proposta conforme os itens e solta/estampa o estado operacional dos produtos.
create function public.agente_proposta_finalizar(p_loja uuid, p_proposta uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_p public.agente_propostas; v_ok int; v_ruim int; v_aberto int; v_novo public.proposta_estado;
begin
  select * into v_p from public.agente_propostas where id = p_proposta and loja_id = p_loja for update;
  if not found or v_p.estado <> 'executando' then raise exception 'proposta_nao_esta_executando' using errcode = '55006'; end if;
  select count(*) filter (where estado = 'confirmado'), count(*) filter (where estado in ('falhou', 'desconhecido')),
         count(*) filter (where estado in ('em_execucao', 'aprovado'))
    into v_ok, v_ruim, v_aberto from public.agente_proposta_itens where proposta_id = p_proposta;
  if v_aberto > 0 then raise exception 'ha_itens_em_aberto' using errcode = '55006'; end if;
  v_novo := case when v_ruim = 0 and v_ok > 0 then 'executada' when v_ok > 0 then 'parcial' else 'falhou' end;
  update public.agente_propostas set estado = v_novo where id = p_proposta;
  update public.produto_travas t set estado = case when exists (select 1 from public.agente_proposta_itens i where i.proposta_id = p_proposta and i.produto_id = t.produto_id and i.estado in ('falhou', 'desconhecido'))
      then 'erro_divergencia'::public.produto_estado_op else 'sincronizado'::public.produto_estado_op end, alterado_em = now()
    where t.loja_id = p_loja and t.estado in ('em_execucao', 'erro_divergencia')
      and t.produto_id in (select produto_id from public.agente_proposta_itens where proposta_id = p_proposta and produto_id is not null);
  update public.agente_tarefas set estado = case v_novo when 'executada' then 'concluida'::public.tarefa_estado else 'falhou'::public.tarefa_estado end,
    atualizado_em = now(), concluida_em = case v_novo when 'executada' then now() end where id = v_p.tarefa_id;
  perform private.auditar(p_loja, null, 'agente.execucao.finalizada', 'agente_propostas', null, jsonb_build_object('id', p_proposta, 'estado', v_novo, 'confirmados', v_ok, 'problemas', v_ruim));
  return v_novo::text;
end $$;


-- ------------------------------------------------------------ execução INTERNA (camada Conecta.IA), só de item aprovado e em execução
-- Aplica o enriquecimento aprovado. Confere conflito (o valor atual precisa ser o "antes" aprovado) e devolve o que ficou gravado
-- (a evidência é a leitura da própria tabela, não a resposta do INSERT).
create function public.agente_aplicar_enriquecimento(p_loja uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.agente_proposta_itens; k text; v jsonb; v_atual jsonb; v_fonte text;
begin
  select * into i from public.agente_proposta_itens where id = p_item and loja_id = p_loja and estado = 'em_execucao' and operacao = 'conecta.enriquecimento.definir' for update;
  if not found or i.produto_id is null then raise exception 'item_invalido_para_enriquecimento' using errcode = '55006'; end if;
  select coalesce(f->>'url', f->>'documento') into v_fonte from jsonb_array_elements(i.fontes) f where coalesce(f->>'url', f->>'documento', '') <> '' limit 1;
  if v_fonte is null then raise exception 'item_sem_fonte' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(i.depois) loop
    select valor into v_atual from public.produto_enriquecimento where produto_id = i.produto_id and campo = k;
    if coalesce(i.antes -> k, 'null'::jsonb) is distinct from coalesce(v_atual, 'null'::jsonb) then
      raise exception 'divergencia_antes: o campo % mudou depois da proposta', k using errcode = '40001';
    end if;
    insert into public.produto_enriquecimento (loja_id, produto_id, campo, valor, fonte, coletado_em, provedor, status)
    values (p_loja, i.produto_id, k, v, v_fonte, now(), 'integrado', 'aprovado')
    on conflict (produto_id, campo) do update set valor = excluded.valor, fonte = excluded.fonte, coletado_em = excluded.coletado_em, provedor = 'integrado', status = 'aprovado';
  end loop;
  return coalesce((select jsonb_object_agg(campo, valor) from public.produto_enriquecimento where produto_id = i.produto_id and status = 'aprovado' and campo in (select jsonb_object_keys(i.depois))), '{}'::jsonb);
end $$;

-- Publica no site SÓ se o produto estiver completo (regra do projeto: produto incompleto não é publicado).
create function public.agente_aplicar_publicacao(p_loja uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.agente_proposta_itens; p public.produtos; v_falta text[] := '{}';
begin
  select * into i from public.agente_proposta_itens where id = p_item and loja_id = p_loja and estado = 'em_execucao' and operacao = 'conecta.publicacao.publicar' for update;
  if not found or i.produto_id is null then raise exception 'item_invalido_para_publicacao' using errcode = '55006'; end if;
  select * into p from public.produtos where id = i.produto_id and loja_id = p_loja for update;
  if p.situacao is distinct from 'A' then v_falta := v_falta || 'produto ativo'; end if;
  if p.sku is null then v_falta := v_falta || 'sku'; end if;
  if p.preco is null then v_falta := v_falta || 'preço'; end if;
  if coalesce(p.descricao_curta, (select valor #>> '{}' from public.produto_enriquecimento where produto_id = p.id and campo = 'descricao_curta' and status = 'aprovado')) is null then v_falta := v_falta || 'descrição curta'; end if;
  if not exists (select 1 from public.produto_imagens im where im.produto_id = p.id and im.aprovada and im.principal and im.removida_em is null) then v_falta := v_falta || 'imagem principal aprovada'; end if;
  if cardinality(v_falta) > 0 then raise exception 'produto_nao_pronto: %', array_to_string(v_falta, ', ') using errcode = '22023'; end if;
  update public.produtos set publicado = true where id = p.id;
  return (select jsonb_build_object('sku', sku, 'publicado', publicado) from public.produtos where id = p.id);
end $$;

-- ------------------------------------------------------------ trava por produto e por lote
create function public.produto_travar(p_loja uuid, p_produtos uuid[], p_user uuid, p_motivo text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_p uuid; v_n int := 0; v_est public.produto_estado_op;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  foreach v_p in array p_produtos loop
    if not exists (select 1 from public.produtos where id = v_p and loja_id = p_loja) then raise exception 'produto_nao_pertence_a_loja' using errcode = '42501'; end if;
    v_est := private.estado_produto(p_loja, v_p);
    if v_est = 'em_execucao' then raise exception 'produto_em_execucao' using errcode = '55006'; end if;
    perform private.definir_estado_produto(p_loja, v_p, 'bloqueado', p_user, left(p_motivo, 200));
    -- sugestões pendentes deste produto deixam de ser aprováveis
    update public.agente_proposta_itens set estado = 'travado', motivo = 'produto travado: só sugestão'
      where loja_id = p_loja and produto_id = v_p and estado in ('pendente', 'aprovado');
    v_n := v_n + 1;
  end loop;
  perform private.auditar(p_loja, p_user, 'produto.travado', 'produto_travas', null, jsonb_build_object('produtos', to_jsonb(p_produtos), 'motivo', p_motivo));
  return v_n;
end $$;

create function public.produto_destravar(p_loja uuid, p_produtos uuid[], p_user uuid, p_motivo text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_p uuid; v_n int := 0;
begin
  if not private.eh_membro(p_loja, p_user, true) then raise exception 'sem_permissao: só o lojista destrava' using errcode = '42501'; end if;
  foreach v_p in array p_produtos loop
    if private.estado_produto(p_loja, v_p) in ('bloqueado', 'erro_divergencia') then
      perform private.definir_estado_produto(p_loja, v_p, 'liberado_propostas', p_user, left(p_motivo, 200));
      v_n := v_n + 1;
    end if;
  end loop;
  perform private.auditar(p_loja, p_user, 'produto.destravado', 'produto_travas', null, jsonb_build_object('produtos', to_jsonb(p_produtos), 'motivo', p_motivo));
  return v_n;
end $$;


-- ------------------------------------------------------------ tarefas e registro de chamadas de ferramenta
create function public.agente_tarefa_criar(p_loja uuid, p_user uuid, p_conversa uuid, p_objetivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.eh_membro(p_loja, p_user) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  insert into public.agente_tarefas (loja_id, conversa_id, criada_por, objetivo) values (p_loja, p_conversa, p_user, left(p_objetivo, 2000)) returning id into v_id;
  return v_id;
end $$;

-- Remove da entrada/saída qualquer chave que pareça segredo e limita o tamanho: o log nunca guarda token nem chave.
create function private.sanitizar_log(p jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb; k text; v jsonb;
begin
  if p is null then return null; end if;
  if jsonb_typeof(p) = 'object' then
    r := '{}'::jsonb;
    for k, v in select * from jsonb_each(p) loop
      r := r || jsonb_build_object(k, case when k ~* '(key|token|secret|senha|authorization|cookie|credencial)' then '"[removido]"'::jsonb else private.sanitizar_log(v) end);
    end loop;
    return r;
  elsif jsonb_typeof(p) = 'array' then
    return coalesce((select jsonb_agg(private.sanitizar_log(e)) from (select e from jsonb_array_elements(p) e limit 50) t), '[]'::jsonb);
  elsif jsonb_typeof(p) = 'string' then
    return to_jsonb(left(p #>> '{}', 1000));
  end if;
  return p;
end $$;

create function public.agente_chamada_registrar(p_loja uuid, p_origem text, p_conversa uuid, p_tarefa uuid, p_user uuid, p_mcp_chave uuid,
  p_ferramenta text, p_risco public.risco_nivel, p_decisao text, p_motivo text, p_entrada jsonb, p_saida jsonb, p_duracao int) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_chamadas_ferramenta (loja_id, origem, conversa_id, tarefa_id, user_id, mcp_chave_id, ferramenta, risco, decisao, motivo, entrada, saida, duracao_ms)
  values (p_loja, p_origem, p_conversa, p_tarefa, p_user, p_mcp_chave, left(p_ferramenta, 120), p_risco, p_decisao, left(p_motivo, 300),
          private.sanitizar_log(p_entrada), private.sanitizar_log(p_saida), p_duracao);
$$;

-- ------------------------------------------------------------ dashboard operacional: números reais, sem simulação
-- null = ainda não medido (a tela mostra "não medido", nunca um número inventado). `filtro` diz qual lista abre ao clicar.
create function public.dashboard_operacional(p_loja uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not private.pode_ver_loja(p_loja) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select jsonb_build_object(
    'produtos_sincronizados', jsonb_build_object('valor', (select count(*) from public.produtos where loja_id = p_loja and coalesce(situacao, '') <> 'ausente'), 'filtro', 'produtos'),
    'produtos_incompletos', jsonb_build_object('valor', (select count(*) from public.produtos where loja_id = p_loja and coalesce(situacao, '') <> 'ausente'
        and (sku is null or preco is null or descricao_curta is null or marca is null or gtin is null or peso_kg is null)), 'filtro', 'produtos:incompletos'),
    'produtos_bloqueados', jsonb_build_object('valor', (select count(*) from public.produto_travas where loja_id = p_loja and estado = 'bloqueado'), 'filtro', 'produtos:bloqueados'),
    'produtos_enriquecidos', jsonb_build_object('valor', (select count(distinct produto_id) from public.produto_enriquecimento where loja_id = p_loja and status = 'aprovado'), 'filtro', 'produtos:enriquecidos'),
    'categorias_aprovadas', jsonb_build_object('valor', (select count(*) from public.bling_categoria_taxonomia m join public.taxonomia_nos n on n.id = m.taxonomia_no_id
        where m.loja_id = p_loja and n.status = 'aprovado'), 'filtro', 'taxonomia'),
    'prontos_publicacao', jsonb_build_object('valor', (select count(*) from public.produtos p where p.loja_id = p_loja and p.publicado = false and p.situacao = 'A'
        and p.sku is not null and p.preco is not null and p.descricao_curta is not null and p.marca is not null
        and exists (select 1 from public.produto_imagens i where i.produto_id = p.id and i.aprovada and i.principal and i.removida_em is null)), 'filtro', 'produtos:prontos'),
    'imagens_pendentes', jsonb_build_object('valor', (select count(*) from public.produto_imagens where loja_id = p_loja and aprovada = false and removida_em is null), 'filtro', 'imagens'),
    'erros_sincronizacao_24h', jsonb_build_object('valor', (select count(*) from public.sync_erros where loja_id = p_loja and criado_em > now() - interval '24 hours'), 'filtro', 'sincronizacao'),
    'ferramentas_em_execucao', jsonb_build_object('valor', (select count(*) from public.agente_operacoes where loja_id = p_loja and estado in ('pendente', 'enviada')), 'filtro', 'execucoes'),
    'aprovacoes_pendentes', jsonb_build_object('valor', (select count(*) from public.agente_propostas where loja_id = p_loja and estado = 'pendente' and expira_em > now()), 'filtro', 'aprovacoes'),
    'divergencias', jsonb_build_object('valor', (select count(*) from public.produto_travas where loja_id = p_loja and estado = 'erro_divergencia'), 'filtro', 'produtos:divergencia'),
    'qualidade_seo', jsonb_build_object('valor', null, 'filtro', 'seo', 'observacao', 'ainda não medido'),
    'custo_por_agente_mes', coalesce((select jsonb_agg(jsonb_build_object('provedor', provedor, 'modelo', modelo, 'tokens', tokens, 'custo_estimado', custo))
      from (select coalesce(provedor, 'n/d') provedor, coalesce(modelo, 'n/d') modelo, sum(coalesce(tokens_entrada, 0) + coalesce(tokens_saida, 0)) tokens, sum(custo_estimado) custo
            from public.agente_mensagens where loja_id = p_loja and papel = 'assistant' and criado_em >= date_trunc('month', now()) group by 1, 2) c), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ------------------------------------------------------------ grants: service_role executa; só o dashboard é do usuário logado
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('agente_conversa_criar', 'agente_mensagem_gravar', 'agente_conversa_excluir', 'agente_proposta_criar',
    'agente_proposta_item_adicionar', 'agente_proposta_enviar', 'agente_proposta_revisar', 'agente_proposta_decidir', 'agente_escrita_liberar',
    'agente_escrita_revogar', 'agente_proposta_iniciar_execucao', 'agente_proposta_validar', 'agente_simulacao_registrar', 'agente_aplicar_enriquecimento', 'agente_aplicar_publicacao', 'agente_operacao_abrir', 'agente_operacao_marcar_enviada',
    'agente_operacao_fechar', 'agente_operacao_reconciliar', 'agente_proposta_finalizar', 'produto_travar', 'produto_destravar',
    'agente_tarefa_criar', 'agente_chamada_registrar', 'dashboard_operacional') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
grant execute on function public.dashboard_operacional(uuid) to authenticated;
revoke all on function private.sanitizar_log(jsonb), private.auditar(uuid, uuid, text, text, jsonb, jsonb), private.eh_membro(uuid, uuid, boolean),
  private.proposta_calcular_hash(uuid), private.estado_produto(uuid, uuid),
  private.definir_estado_produto(uuid, uuid, public.produto_estado_op, uuid, text) from public, anon, authenticated;
grant execute on function private.sanitizar_log(jsonb), private.auditar(uuid, uuid, text, text, jsonb, jsonb), private.eh_membro(uuid, uuid, boolean),
  private.proposta_calcular_hash(uuid), private.estado_produto(uuid, uuid),
  private.definir_estado_produto(uuid, uuid, public.produto_estado_op, uuid, text) to service_role;
