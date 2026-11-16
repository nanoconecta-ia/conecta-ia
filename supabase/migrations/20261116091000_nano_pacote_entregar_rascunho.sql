-- Ordem 16B — RPC de entrega transacional do Nano, ETAPA DE RASCUNHO.
-- Depende de 20261116090000_nano_pacote_cadastro_estrutura.sql.
-- Somente service_role (gateway); NÃO expor a anon/authenticated; NÃO publicar
-- nem enviar ao executor de Bling. Migração para validação local, SEM DEPLOY.
begin;

create function public.pacote_entregar(
  p_loja uuid,
  p_solicitante uuid,
  p_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path = ''
as $func$
declare
  v_key text;
  v_hash text;
  v_exist public.pacote_cadastro;
  v_prod public.produtos;
  v_agente text;
  v_modelo text;
  v_proposta uuid;
  v_pacote uuid;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_marca text;
  v_gtin text;
  v_divergente boolean := false;
  v_pendencias jsonb := '[]'::jsonb;
  v_e jsonb;
  v_b jsonb;
  v_blocos jsonb;
  v_ref text;
  v_refs text[];
  v_proposta_item uuid;
  v_tipo text;
  v_chave text;
  v_valor jsonb;
  v_estado text;
  v_ordem integer := 0;
  v_item_key text;
  v_pend_b jsonb;
  v_soma integer;
  v_pos integer;
  v_peso integer;
begin
  -- Esta função só é concedida a service_role, que deverá usar a identidade
  -- autenticada no gateway; p_solicitante NUNCA provém do texto do LLM.
  if p_loja is null or p_solicitante is null or
     not coalesce(private.administra_loja(p_loja,p_solicitante),false) then
    raise exception 'pacote_solicitante_sem_permissao' using errcode='42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 100000
    or p_payload->>'versao' <> '1' then
    raise exception 'pacote_envelope_invalido' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) as k(nome)
    where nome <> all(array[
      'versao','bling_id','sku','idempotency_key','origem_agente',
      'identidade','evidencias','aplicacoes','imagens','taxonomia','texto','logistica'
    ]::text[])
  ) then raise exception 'pacote_campo_de_entrada_nao_permitido' using errcode='22023'; end if;
  -- Recusa campos proibidos em qualquer profundidade, nunca grava fiscal, NF,
  -- preços, estoque, fornecedor, credenciais ou marcações de aprovação.
  if p_payload::text ~* '"(ncm|cfop|cest|cst|tributacao|tributação|fornecedor|fornecedores|preco|preço|preco_custo|preco_compra|estoque|custo|nota_fiscal|xml|vin|chassi|token|service_role)"[[:space:]]*:'
    then raise exception 'pacote_campo_comercial_ou_privado_proibido' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload->'identidade') <> 'object'
    or jsonb_typeof(p_payload->'origem_agente') <> 'object'
    or jsonb_typeof(p_payload->'aplicacoes') <> 'array'
    or jsonb_typeof(p_payload->'evidencias') <> 'array'
    or jsonb_typeof(p_payload->'imagens') <> 'array'
    or jsonb_typeof(p_payload->'taxonomia') <> 'object'
    or jsonb_typeof(p_payload->'texto') <> 'object'
    or jsonb_typeof(p_payload->'logistica') <> 'object'
    or jsonb_array_length(p_payload->'aplicacoes') > 30
    or jsonb_array_length(p_payload->'evidencias') > 80
    or jsonb_array_length(p_payload->'imagens') > 8
  then raise exception 'pacote_blocos_invalidos' using errcode='22023'; end if;

  v_key := p_payload->>'idempotency_key';
  if v_key is null or length(v_key) not between 8 and 100
    or v_key !~ '^[A-Za-z0-9._:-]+$'
    then raise exception 'pacote_idempotencia_invalida' using errcode='22023'; end if;
  v_agente := p_payload #>> '{origem_agente,agente}';
  v_modelo := p_payload #>> '{origem_agente,modelo}';
  if v_agente is null or length(btrim(v_agente)) not between 2 and 100
     or v_modelo is null or length(btrim(v_modelo)) not between 1 and 100 then
    raise exception 'pacote_agente_sem_identidade' using errcode='22023';
  end if;
  if coalesce(p_payload->>'bling_id','') !~ '^[0-9]{1,24}$' then
    raise exception 'pacote_bling_id_invalido' using errcode='22023'; end if;

  -- jsonb canonicaliza ordem de chaves; hash versionado é calculado no banco.
  v_hash := encode(sha256(convert_to('nano-pacote-v1:' || p_payload::text,'UTF8')),'hex');
  -- Trava antes de consultar: duas requisições simultâneas com mesma chave
  -- passam a disputar UMA única transação.
  perform pg_advisory_xact_lock(hashtextextended(
    'nano-pacote:' || p_loja::text || ':' || v_key,0
  ));
  select * into v_exist from public.pacote_cadastro
    where loja_id=p_loja and idempotency_key=v_key;
  if found then
    if v_exist.payload_hash is distinct from v_hash then
      raise exception 'pacote_idempotencia_hash_divergente' using errcode='23505';
    end if;
    return jsonb_build_object('ok',true,'repetido',true,
      'pacote_id',v_exist.id,'proposta_id',v_exist.proposta_id,
      'estado',v_exist.estado,'publicavel',false,'altera_bling',false);
  end if;

  -- Confirma identidade no ESPELHO atual (não em texto do agente).
  select * into v_prod from public.produtos
    where loja_id=p_loja and bling_id=p_payload->>'bling_id'
    for update;
  if not found then raise exception 'pacote_produto_bling_inexistente' using errcode='P0002'; end if;
  if v_prod.sku is distinct from (p_payload->>'sku') then
    raise exception 'pacote_sku_nao_corresponde_ao_bling' using errcode='22023';
  end if;

  -- Medidas logísticas estimadas exigem referência identificada e margem explícita.
  if p_payload #>> '{logistica,estimado}' = 'true' then
    if nullif(btrim(coalesce(p_payload #>> '{logistica,base}','')),'') is null
      or (p_payload #>> '{logistica,margem_percentual}') is null
      or (p_payload #>> '{logistica,margem_percentual}') !~ '^[0-9]+([.][0-9]+)?$'
    then raise exception 'pacote_logistica_estimativa_sem_base' using errcode='22023';
    end if;
    if (p_payload #>> '{logistica,margem_percentual}')::numeric not between 10 and 20
    then raise exception 'pacote_logistica_estimativa_sem_base' using errcode='22023';
    end if;
  end if;

  v_gtin := nullif(btrim(coalesce(p_payload #>> '{identidade,gtin}','')),'');
  if v_gtin is not null then
    if v_gtin !~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' then
      raise exception 'pacote_gtin_invalido' using errcode='22023';
    end if;
    -- O SQL também valida o dígito verificador; o gateway valida
    -- de forma independente antes da chamada, defesa em profundidade.
    v_soma := 0; v_peso := 3;
    for v_pos in reverse (length(v_gtin) - 1)..1 loop
      v_soma := v_soma + substring(v_gtin,v_pos,1)::integer * v_peso;
      v_peso := case when v_peso = 3 then 1 else 3 end;
    end loop;
    if (10 - v_soma % 10) % 10 <> right(v_gtin,1)::integer then
      raise exception 'pacote_gtin_digito_verificador_invalido' using errcode='22023';
    end if;
    if nullif(btrim(coalesce(v_prod.gtin,'')),'') is not null
       and v_prod.gtin is distinct from v_gtin then
      v_divergente := true;
      v_pendencias := v_pendencias ||
        jsonb_build_array('GTIN informado diverge do espelho do Bling');
    end if;
  else v_gtin := nullif(btrim(coalesce(v_prod.gtin,'')),'');
  end if;
  if v_gtin is not null and exists (
    select 1 from public.produtos p
     where p.loja_id=p_loja and p.id<>v_prod.id and p.gtin=v_gtin
  ) then
    v_divergente := true;
    v_pendencias := v_pendencias ||
      jsonb_build_array('Mesmo GTIN em outro ID do Bling: conciliação manual obrigatória');
  end if;

  v_snapshot := jsonb_build_object(
    'bling_id',v_prod.bling_id, 'sku',v_prod.sku,
    'gtin',v_prod.gtin, 'marca',v_prod.marca,
    'sincronizado_em',v_prod.sincronizado_em
  );
  v_snapshot_hash := encode(sha256(convert_to(
    'nano-espelho-v1:' || v_snapshot::text,'UTF8')),'hex');

  -- Cria proposta-pai apenas em RASCUNHO, nunca chama
  -- agente_proposta_enviar e nunca muda saldo, Bling ou aprovação.
  v_proposta := public.agente_proposta_criar(
    p_loja,p_solicitante,null,null,
    left(v_agente,100),'Nano/Conecta.IA',left(v_modelo,100),null,
    left('Pacote para conferir — Bling ' || v_prod.bling_id,160),
    'Propostas de evidência por blocos. Nada homologado ou executável.',true
  );
  insert into public.pacote_cadastro(
    loja_id,produto_id,bling_id,sku_espelho,versao_contrato,
    idempotency_key,payload_hash,snapshot_espelho,snapshot_hash,
    agente,modelo,estado,proposta_id
  ) values (
    p_loja,v_prod.id,v_prod.bling_id,v_prod.sku,1,v_key,v_hash,
    v_snapshot,v_snapshot_hash,v_agente,v_modelo,
    case when v_divergente then 'divergente' else 'pendente_revisao' end,
    v_proposta
  ) returning id into v_pacote;

  -- Evidência de IA é sempre candidata, mesmo que se declare "oficial".
  for v_e in select x from jsonb_array_elements(p_payload->'evidencias') as a(x) loop
    if jsonb_typeof(v_e) <> 'object' or
       length(btrim(coalesce(v_e->>'id',''))) not between 1 and 100 or
       coalesce(v_e->>'classe','') not in (
         'fabricante_oficial','montadora_oficial','distribuidor_b2b',
         'epc_terceiro','referencia_cruzada','marketplace','ia_terceira',
         'foto_estoque','nota_entrada','outra'
       ) then raise exception 'pacote_evidencia_invalida' using errcode='22023'; end if;

    if nullif(v_e->>'url','') is null
       and nullif(v_e->>'documento','') is null
       then raise exception 'pacote_evidencia_sem_origem' using errcode='22023'; end if;
    if v_e->>'url' is not null and (
       length(v_e->>'url') > 1000 or
       (v_e->>'url') !~ '^https://[A-Za-z0-9.-]+(/[^\s#]*)?$' or
       (v_e->>'url') ~* '([?&](vin|frame|chassis|chassi|token|api_key|access_token)=)'
    ) then raise exception 'pacote_url_insegura' using errcode='22023'; end if;
    if v_e->>'documento' is not null and
       (v_e->>'documento') !~ '^(nf|arquivo|drive|bling|storage):[A-Za-z0-9_./-]{3,240}$'
       then raise exception 'pacote_documento_referencia_invalida' using errcode='22023'; end if;

    insert into public.pacote_evidencias(
      loja_id,pacote_id,chave_evidencia,classe,url_publica,
      documento_ref_interno,trecho,codigo_exato,identidade_emissora,
      dominio_verificado,consultado_em,verificacao
    ) values (
      p_loja,v_pacote, v_e->>'id', v_e->>'classe',
      nullif(v_e->>'url',''),nullif(v_e->>'documento',''),
      nullif(v_e->>'trecho',''),nullif(v_e->>'codigo_exato',''),
      nullif(v_e->>'emissor',''),false,
      coalesce((v_e->>'consultado_em')::date::timestamptz,now()),
      'candidato'
    );
  end loop;

  -- Uma proposta de revisão para cada seção. Nenhum valor técnico externo
  -- é inserido no item executável existente: fica em pacote_blocos sob RLS
  -- de administrador. Itens são marcadores internos SEM campos Bling.
  v_blocos := jsonb_build_array(
    jsonb_build_object('tipo','identidade','chave','mestre','valor',p_payload->'identidade','refs','[]'::jsonb),
    jsonb_build_object('tipo','evidencias','chave','fontes','valor',jsonb_build_object('quantidade',jsonb_array_length(p_payload->'evidencias')),'refs','[]'::jsonb),
    jsonb_build_object('tipo','taxonomia','chave','no','valor',p_payload->'taxonomia','refs','[]'::jsonb),
    jsonb_build_object('tipo','texto_seo','chave','texto','valor',p_payload->'texto','refs','[]'::jsonb),
    jsonb_build_object('tipo','logistica','chave','embalagem','valor',p_payload->'logistica','refs','[]'::jsonb)
  ) ||
  coalesce((
    select jsonb_agg(jsonb_build_object('tipo','aplicacao',
      'chave',coalesce(x->>'id',ord::text),'valor',x,
      'refs',coalesce(x->'evidencia_ids','[]'::jsonb)) order by ord)
    from jsonb_array_elements(p_payload->'aplicacoes') with ordinality a(x,ord)
  ),'[]'::jsonb) ||
  coalesce((
    select jsonb_agg(jsonb_build_object('tipo','imagem',
      'chave',ord::text,'valor',x,'refs','[]'::jsonb) order by ord)
    from jsonb_array_elements(p_payload->'imagens') with ordinality a(x,ord)
  ),'[]'::jsonb);

  for v_b in select x from jsonb_array_elements(v_blocos) as q(x) loop
    v_tipo := v_b->>'tipo'; v_chave := v_b->>'chave';
    v_valor := v_b->'valor';
    if v_chave is null or length(v_chave) > 100 or v_chave = '' then
      raise exception 'pacote_chave_bloco_invalida' using errcode='22023'; end if;
    if jsonb_typeof(v_valor) <> 'object' then
      raise exception 'pacote_bloco_valor_invalido' using errcode='22023'; end if;
    if jsonb_typeof(v_b->'refs') <> 'array' then
      raise exception 'pacote_referencias_invalidas' using errcode='22023'; end if;
    select coalesce(array_agg(v.ref),array[]::text[]) into v_refs
      from jsonb_array_elements_text(v_b->'refs') as v(ref);
    if exists (
      select 1 from unnest(v_refs) as e(ref)
      where not exists (
        select 1 from public.pacote_evidencias r
          where r.loja_id=p_loja and r.pacote_id=v_pacote
            and r.chave_evidencia=e.ref
      )
    ) then raise exception 'pacote_evidencia_nao_encontrada' using errcode='23503'; end if;
    if v_tipo='imagem' and (
      coalesce(v_valor->>'aprovada','false')='true' or
      coalesce(v_valor->>'direitos_confirmados','false')='true'
    ) then raise exception 'pacote_imagem_nao_pode_ser_autoaprovada' using errcode='22023'; end if;

    v_estado := case
      when v_tipo='identidade' and v_divergente then 'divergente'
      when v_tipo='aplicacao' and v_valor->>'estado'='divergente' then 'divergente'
      else 'a_confirmar'
    end;
    v_pend_b := jsonb_build_array(
      'Proposta técnica candidata: requer documento e decisão humana.'
    );
    -- Item da Fila tem SOMENTE metadados não executáveis; nunca contém NF, VIN,
    -- URL privada, preço, código OEM não verificado ou custo do fornecedor.
    v_item_key := 'nano-' || substr(encode(sha256(convert_to(
      v_pacote::text || ':' || v_tipo || ':' || v_chave,'UTF8'
    )),'hex'),1,60);
    v_proposta_item := public.agente_proposta_item_adicionar(
      p_loja,v_proposta,v_prod.id,'nano.pacote_conferir',
      left(v_tipo||':'||v_chave,200),array[]::text[],null,
      jsonb_build_object('pacote_id',v_pacote,'tipo',v_tipo,
        'chave',v_chave,'situacao','a_confirmar','executavel',false),
      '[]'::jsonb,jsonb_build_array('Sem homologação; conferir na aba protegida do pacote.'),
      'LOW'::public.risco_nivel,v_item_key
    );
    insert into public.pacote_blocos(
      loja_id,pacote_id,tipo,chave_bloco,ordem,estado_fonte,
      valor_proposto,evidencia_chaves,pendencias,item_proposta_id
    ) values (
      p_loja,v_pacote,v_tipo,v_chave,v_ordem,v_estado,
      v_valor,v_refs,v_pend_b,v_proposta_item
    );
    v_ordem := v_ordem + 1;
  end loop;
  return jsonb_build_object(
    'ok',true,'repetido',false,
    'pacote_id',v_pacote,'proposta_id',v_proposta,
    'estado',case when v_divergente then 'divergente' else 'pendente_revisao' end,
    'proposta_estado','rascunho',
    'blocos',v_ordem,'pendencias',v_pendencias,
    'publicavel',false,'altera_bling',false
  );
end
$func$;

-- RPC está em schema público APENAS para ser alcançável pelo gateway Supabase;
-- só o service_role pode chamá-la. O gateway precisa verificar seu próprio
-- escopo "propor" e passar p_solicitante autenticado (nunca extraído do LLM).
revoke all on function public.pacote_entregar(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.pacote_entregar(uuid,uuid,jsonb)
  to service_role;
comment on function public.pacote_entregar(uuid,uuid,jsonb) is
  'Transação idempotente de captura de pacote no espelho Bling; cria proposta-pai em RASCUNHO sem enviar à aprovação, sem executar nem publicar. Somente gateway service_role.';
commit;

      or (p_payload #>> '{logistica,margem_percentual}')::numeric not between 10 and 20)
  then raise exception 'pacote_logistica_estimativa_sem_base' using errcode='22023'; end if;

  v_gtin := nullif(btrim(coalesce(p_payload #>> '{identidade,gtin}','')),'');
  if v_gtin is not null then
    if v_gtin !~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' then
      raise exception 'pacote_gtin_invalido' using errcode='22023';
    end if;
    -- O SQL também valida o dígito verificador; o gateway valida
    -- de forma independente antes da chamada, defesa em profundidade.
    v_soma := 0; v_peso := 3;
    for v_pos in reverse (length(v_gtin) - 1)..1 loop
      v_soma := v_soma + substring(v_gtin,v_pos,1)::integer * v_peso;
      v_peso := case when v_peso = 3 then 1 else 3 end;
    end loop;
    if (10 - v_soma % 10) % 10 <> right(v_gtin,1)::integer then
      raise exception 'pacote_gtin_digito_verificador_invalido' using errcode='22023';
    end if;
    if nullif(btrim(coalesce(v_prod.gtin,'')),'') is not null
       and v_prod.gtin is distinct from v_gtin then
      v_divergente := true;
      v_pendencias := v_pendencias ||
        jsonb_build_array('GTIN informado diverge do espelho do Bling');
    end if;
  else v_gtin := nullif(btrim(coalesce(v_prod.gtin,'')),'');
  end if;
  if v_gtin is not null and exists (
    select 1 from public.produtos p
     where p.loja_id=p_loja and p.id<>v_prod.id and p.gtin=v_gtin
  ) then
    v_divergente := true;
    v_pendencias := v_pendencias ||
      jsonb_build_array('Mesmo GTIN em outro ID do Bling: conciliação manual obrigatória');
  end if;

  v_snapshot := jsonb_build_object(
    'bling_id',v_prod.bling_id, 'sku',v_prod.sku,
    'gtin',v_prod.gtin, 'marca',v_prod.marca,
    'sincronizado_em',v_prod.sincronizado_em
  );
  v_snapshot_hash := encode(sha256(convert_to(
    'nano-espelho-v1:' || v_snapshot::text,'UTF8')),'hex');

  -- Cria proposta-pai apenas em RASCUNHO, nunca chama
  -- agente_proposta_enviar e nunca muda saldo, Bling ou aprovação.
  v_proposta := public.agente_proposta_criar(
    p_loja,p_solicitante,null,null,
    left(v_agente,100),'Nano/Conecta.IA',left(v_modelo,100),null,
    left('Pacote para conferir — Bling ' || v_prod.bling_id,160),
    'Propostas de evidência por blocos. Nada homologado ou executável.',true
  );
  insert into public.pacote_cadastro(
    loja_id,produto_id,bling_id,sku_espelho,versao_contrato,
    idempotency_key,payload_hash,snapshot_espelho,snapshot_hash,
    agente,modelo,estado,proposta_id
  ) values (
    p_loja,v_prod.id,v_prod.bling_id,v_prod.sku,1,v_key,v_hash,
    v_snapshot,v_snapshot_hash,v_agente,v_modelo,
    case when v_divergente then 'divergente' else 'pendente_revisao' end,
    v_proposta
  ) returning id into v_pacote;

  -- Evidência de IA é sempre candidata, mesmo que se declare "oficial".
  for v_e in select x from jsonb_array_elements(p_payload->'evidencias') as a(x) loop
    if jsonb_typeof(v_e) <> 'object' or
       length(btrim(coalesce(v_e->>'id',''))) not between 1 and 100 or
       coalesce(v_e->>'classe','') not in (
         'fabricante_oficial','montadora_oficial','distribuidor_b2b',
         'epc_terceiro','referencia_cruzada','marketplace','ia_terceira',
         'foto_estoque','nota_entrada','outra'
       ) then raise exception 'pacote_evidencia_invalida' using errcode='22023'; end if;

    if nullif(v_e->>'url','') is null
       and nullif(v_e->>'documento','') is null
       then raise exception 'pacote_evidencia_sem_origem' using errcode='22023'; end if;
    if v_e->>'url' is not null and (
       length(v_e->>'url') > 1000 or
       (v_e->>'url') !~ '^https://[A-Za-z0-9.-]+(/[^\s#]*)?$' or
       (v_e->>'url') ~* '([?&](vin|frame|chassis|chassi|token|api_key|access_token)=)'
    ) then raise exception 'pacote_url_insegura' using errcode='22023'; end if;
    if v_e->>'documento' is not null and
       (v_e->>'documento') !~ '^(nf|arquivo|drive|bling|storage):[A-Za-z0-9_./-]{3,240}$'
       then raise exception 'pacote_documento_referencia_invalida' using errcode='22023'; end if;

    insert into public.pacote_evidencias(
      loja_id,pacote_id,chave_evidencia,classe,url_publica,
      documento_ref_interno,trecho,codigo_exato,identidade_emissora,
      dominio_verificado,consultado_em,verificacao
    ) values (
      p_loja,v_pacote, v_e->>'id', v_e->>'classe',
      nullif(v_e->>'url',''),nullif(v_e->>'documento',''),
      nullif(v_e->>'trecho',''),nullif(v_e->>'codigo_exato',''),
      nullif(v_e->>'emissor',''),false,
      coalesce((v_e->>'consultado_em')::date::timestamptz,now()),
      'candidato'
    );
  end loop;

  -- Uma proposta de revisão para cada seção. Nenhum valor técnico externo
  -- é inserido no item executável existente: fica em pacote_blocos sob RLS
  -- de administrador. Itens são marcadores internos SEM campos Bling.
  v_blocos := jsonb_build_array(
    jsonb_build_object('tipo','identidade','chave','mestre','valor',p_payload->'identidade','refs','[]'::jsonb),
    jsonb_build_object('tipo','evidencias','chave','fontes','valor',jsonb_build_object('quantidade',jsonb_array_length(p_payload->'evidencias')),'refs','[]'::jsonb),
    jsonb_build_object('tipo','taxonomia','chave','no','valor',p_payload->'taxonomia','refs','[]'::jsonb),
    jsonb_build_object('tipo','texto_seo','chave','texto','valor',p_payload->'texto','refs','[]'::jsonb),
    jsonb_build_object('tipo','logistica','chave','embalagem','valor',p_payload->'logistica','refs','[]'::jsonb)
  ) ||
  coalesce((
    select jsonb_agg(jsonb_build_object('tipo','aplicacao',
      'chave',coalesce(x->>'id',ord::text),'valor',x,
      'refs',coalesce(x->'evidencia_ids','[]'::jsonb)) order by ord)
    from jsonb_array_elements(p_payload->'aplicacoes') with ordinality a(x,ord)
  ),'[]'::jsonb) ||
  coalesce((
    select jsonb_agg(jsonb_build_object('tipo','imagem',
      'chave',ord::text,'valor',x,'refs','[]'::jsonb) order by ord)
    from jsonb_array_elements(p_payload->'imagens') with ordinality a(x,ord)
  ),'[]'::jsonb);

  for v_b in select x from jsonb_array_elements(v_blocos) as q(x) loop
    v_tipo := v_b->>'tipo'; v_chave := v_b->>'chave';
    v_valor := v_b->'valor';
    if v_chave is null or length(v_chave) > 100 or v_chave = '' then
      raise exception 'pacote_chave_bloco_invalida' using errcode='22023'; end if;
    if jsonb_typeof(v_valor) <> 'object' then
      raise exception 'pacote_bloco_valor_invalido' using errcode='22023'; end if;
    if jsonb_typeof(v_b->'refs') <> 'array' then
      raise exception 'pacote_referencias_invalidas' using errcode='22023'; end if;
    select coalesce(array_agg(v.ref),array[]::text[]) into v_refs
      from jsonb_array_elements_text(v_b->'refs') as v(ref);
    if exists (
      select 1 from unnest(v_refs) as e(ref)
      where not exists (
        select 1 from public.pacote_evidencias r
          where r.loja_id=p_loja and r.pacote_id=v_pacote
            and r.chave_evidencia=e.ref
      )
    ) then raise exception 'pacote_evidencia_nao_encontrada' using errcode='23503'; end if;
    if v_tipo='imagem' and (
      coalesce(v_valor->>'aprovada','false')='true' or
      coalesce(v_valor->>'direitos_confirmados','false')='true'
    ) then raise exception 'pacote_imagem_nao_pode_ser_autoaprovada' using errcode='22023'; end if;

    v_estado := case
      when v_tipo='identidade' and v_divergente then 'divergente'
      when v_tipo='aplicacao' and v_valor->>'estado'='divergente' then 'divergente'
      else 'a_confirmar'
    end;
    v_pend_b := jsonb_build_array(
      'Proposta técnica candidata: requer documento e decisão humana.'
    );
    -- Item da Fila tem SOMENTE metadados não executáveis; nunca contém NF, VIN,
    -- URL privada, preço, código OEM não verificado ou custo do fornecedor.
    v_item_key := 'nano-' || substr(encode(sha256(convert_to(
      v_pacote::text || ':' || v_tipo || ':' || v_chave,'UTF8'
    )),'hex'),1,60);
    v_proposta_item := public.agente_proposta_item_adicionar(
      p_loja,v_proposta,v_prod.id,'nano.pacote_conferir',
      left(v_tipo||':'||v_chave,200),array[]::text[],null,
      jsonb_build_object('pacote_id',v_pacote,'tipo',v_tipo,
        'chave',v_chave,'situacao','a_confirmar','executavel',false),
      '[]'::jsonb,jsonb_build_array('Sem homologação; conferir na aba protegida do pacote.'),
      'LOW'::public.risco_nivel,v_item_key
    );
    insert into public.pacote_blocos(
      loja_id,pacote_id,tipo,chave_bloco,ordem,estado_fonte,
      valor_proposto,evidencia_chaves,pendencias,item_proposta_id
    ) values (
      p_loja,v_pacote,v_tipo,v_chave,v_ordem,v_estado,
      v_valor,v_refs,v_pend_b,v_proposta_item
    );
    v_ordem := v_ordem + 1;
  end loop;
  return jsonb_build_object(
    'ok',true,'repetido',false,
    'pacote_id',v_pacote,'proposta_id',v_proposta,
    'estado',case when v_divergente then 'divergente' else 'pendente_revisao' end,
    'proposta_estado','rascunho',
    'blocos',v_ordem,'pendencias',v_pendencias,
    'publicavel',false,'altera_bling',false
  );
end
$func$;

-- RPC está em schema público APENAS para ser alcançável pelo gateway Supabase;
-- só o service_role pode chamá-la. O gateway precisa verificar seu próprio
-- escopo "propor" e passar p_solicitante autenticado (nunca extraído do LLM).
revoke all on function public.pacote_entregar(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.pacote_entregar(uuid,uuid,jsonb)
  to service_role;
comment on function public.pacote_entregar(uuid,uuid,jsonb) is
  'Transação idempotente de captura de pacote no espelho Bling; cria proposta-pai em RASCUNHO sem enviar à aprovação, sem executar nem publicar. Somente gateway service_role.';
commit;
