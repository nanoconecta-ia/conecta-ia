-- Condições comerciais CADASTRADAS pelo lojista: formas de pagamento e regras de entrega por faixa de CEP.
-- O agente só afirma prazo, frete e pagamento que existirem aqui e estiverem APROVADOS; sem cadastro, a resposta diz o que falta e pede o CEP.
-- Nada é presumido, calculado por distância nem copiado de terceiros. Mesmo padrão de loja_politicas: o lojista edita (RLS), a vitrine lê pelo servidor.

create table public.loja_formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  forma text not null check (forma in ('pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'dinheiro', 'outra')),
  rotulo text check (rotulo is null or length(btrim(rotulo)) between 1 and 80),
  parcelas_max smallint check (parcelas_max is null or parcelas_max between 1 and 24),
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovada')),
  revisado_em timestamptz,
  revisado_por uuid,
  atualizado_em timestamptz not null default now(),
  check (status <> 'aprovada' or (revisado_em is not null and revisado_por is not null)),
  check (parcelas_max is null or forma = 'cartao_credito')
);
create unique index loja_formas_pagamento_unica on public.loja_formas_pagamento (loja_id, forma, coalesce(lower(rotulo), ''));

create table public.loja_entrega_regras (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  tipo text not null check (tipo in ('retirada_na_loja', 'entrega_propria', 'transportadora')),
  cep_inicio text not null check (cep_inicio ~ '^[0-9]{8}$'),
  cep_fim text not null check (cep_fim ~ '^[0-9]{8}$'),
  prazo_dias_min smallint check (prazo_dias_min is null or prazo_dias_min between 0 and 90),
  prazo_dias_max smallint check (prazo_dias_max is null or prazo_dias_max between 0 and 90),
  valor_frete numeric(10,2) check (valor_frete is null or valor_frete >= 0),             -- null = a calcular (não é "grátis")
  frete_gratis_acima numeric(10,2) check (frete_gratis_acima is null or frete_gratis_acima > 0),
  fonte text not null check (length(btrim(fonte)) > 0),                                   -- de onde vem: tabela da transportadora, política da loja...
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovada')),
  revisado_em timestamptz,
  revisado_por uuid,
  atualizado_em timestamptz not null default now(),
  check (cep_fim >= cep_inicio),
  check (prazo_dias_max is null or prazo_dias_min is null or prazo_dias_max >= prazo_dias_min),
  check (status <> 'aprovada' or (revisado_em is not null and revisado_por is not null and prazo_dias_max is not null))   -- sem prazo máximo não se promete prazo
);
create index on public.loja_entrega_regras (loja_id, cep_inicio, cep_fim);

do $$ declare t text; begin
  foreach t in array array['loja_formas_pagamento', 'loja_entrega_regras'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.pode_ver_loja(loja_id)) with check (private.pode_ver_loja(loja_id))', t || '_lojista', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.toca_atualizado_em()', t || '_atualizado', t);
  end loop;
end $$;

-- Condições APROVADAS da loja para um CEP (opcional). Só leitura, só service_role.
create function public.condicoes_comerciais(p_loja uuid, p_cep text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cep text := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'); v_pag jsonb; v_ent jsonb; v_lacunas jsonb := '[]'::jsonb; v_tem_regra boolean;
begin
  select coalesce(jsonb_agg(jsonb_build_object('forma', forma, 'rotulo', rotulo, 'parcelas_max', parcelas_max) order by forma), '[]'::jsonb)
    into v_pag from public.loja_formas_pagamento where loja_id = p_loja and status = 'aprovada';
  if jsonb_array_length(v_pag) = 0 then v_lacunas := v_lacunas || to_jsonb('formas de pagamento (nenhuma aprovada)'::text); end if;
  select exists (select 1 from public.loja_entrega_regras where loja_id = p_loja and status = 'aprovada') into v_tem_regra;
  if not v_tem_regra then
    v_lacunas := v_lacunas || to_jsonb('regras de entrega (nenhuma aprovada)'::text);
    v_ent := '[]'::jsonb;
  elsif length(v_cep) <> 8 then
    v_lacunas := v_lacunas || to_jsonb('CEP do cliente (necessário para prazo e frete)'::text);
    v_ent := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'prazo_dias_min', prazo_dias_min, 'prazo_dias_max', prazo_dias_max,
        'valor_frete', valor_frete, 'frete_a_calcular', valor_frete is null, 'frete_gratis_acima', frete_gratis_acima, 'fonte', fonte) order by prazo_dias_max, tipo), '[]'::jsonb)
      into v_ent from public.loja_entrega_regras where loja_id = p_loja and status = 'aprovada' and v_cep between cep_inicio and cep_fim;
    if jsonb_array_length(v_ent) = 0 then v_lacunas := v_lacunas || to_jsonb('este CEP não tem regra de entrega cadastrada: ofereça o atendente'::text); end if;
  end if;
  return jsonb_build_object('cep_consultado', nullif(v_cep, ''), 'pagamento', v_pag, 'entrega', v_ent, 'lacunas', v_lacunas,
    'aviso', 'Só condições aprovadas pelo lojista. Prazo é o cadastrado (não é promessa de transportadora); frete_a_calcular = valor ainda não definido, não é grátis.');
end $$;
revoke all on function public.condicoes_comerciais(uuid, text) from public, anon, authenticated;
grant execute on function public.condicoes_comerciais(uuid, text) to service_role;
