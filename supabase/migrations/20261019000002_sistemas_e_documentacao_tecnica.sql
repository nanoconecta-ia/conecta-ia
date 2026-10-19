-- Conector IA: árvore funcional de sistemas mecânicos (3 níveis) e registro da DOCUMENTAÇÃO técnica de veículo/motor/sistema.
-- Catálogo GLOBAL (sem loja_id), como a genealogia: leitura para logados, escrita só pelo servidor.
-- A categoria diz o que a peça É (função); montadora/modelo/motor ficam na genealogia e nas compatibilidades, nunca na árvore.
-- Nada daqui é publicado sem direitos declarados; documento sem fonte não existe.

create table public.sistemas_mecanicos (
  id uuid primary key default gen_random_uuid(),
  nivel smallint not null check (nivel between 1 and 3),
  pai_id uuid references public.sistemas_mecanicos(id) on delete restrict,
  nome text not null check (length(btrim(nome)) > 0),
  ordem int not null default 0,
  origem text not null check (length(btrim(origem)) > 0),                         -- de onde veio (material do dono, Bling da loja...)
  status text not null default 'proposta' check (status in ('proposta', 'aprovada', 'aposentada')),
  criado_em timestamptz not null default now(),
  check ((nivel = 1) = (pai_id is null))
);
create unique index sistemas_mecanicos_unico on public.sistemas_mecanicos (coalesce(pai_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

-- um filho tem de estar exatamente um nível abaixo do pai
create function private.confere_nivel_sistema() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pai_id is not null and (select nivel from public.sistemas_mecanicos where id = new.pai_id) <> new.nivel - 1 then
    raise exception 'nivel do sistema incompatível com o pai' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger sistemas_mecanicos_nivel before insert or update on public.sistemas_mecanicos
  for each row execute function private.confere_nivel_sistema();

create table public.documentos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  escopo_tabela text not null check (escopo_tabela in ('montadoras', 'modelos', 'geracoes', 'versoes', 'familias_motor', 'motores', 'sistemas_mecanicos', 'pecas_ref')),
  escopo_id uuid not null,
  sistema_id uuid references public.sistemas_mecanicos(id) on delete restrict,   -- motor, suspensão, elétrica, sensores, acessórios...
  tipo text not null check (tipo in ('manual_oficina', 'manual_proprietario', 'catalogo_pecas_epc', 'esquema_eletrico', 'boletim_servico',
    'tabela_torque', 'ficha_tecnica', 'diagrama_sensores', 'homologacao', 'outro')),
  titulo text not null check (length(btrim(titulo)) > 0),
  idioma text,
  versao text,
  fonte_id uuid not null references public.fontes(id),                           -- documento sem fonte não existe
  arquivo_storage text,                                                          -- caminho no bucket privado, se o arquivo foi guardado
  direitos text not null default 'desconhecido' check (direitos in ('desconhecido', 'proprio', 'licenciado', 'dominio_publico')),
  publicavel boolean not null default false,
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (not publicavel or direitos in ('proprio', 'licenciado', 'dominio_publico'))   -- sem direitos comprovados não publica
);
create index on public.documentos_tecnicos (escopo_tabela, escopo_id);
create index on public.documentos_tecnicos (sistema_id);

do $$
declare t text;
begin
  foreach t in array array['sistemas_mecanicos', 'documentos_tecnicos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_ver', t);
  end loop;
end $$;

-- Semente: SOMENTE o que o dono forneceu (tabela de 3 níveis de 2026-10-19), como PROPOSTA a aprovar. Nada inventado.
do $$
declare s text; n1 uuid; n2 uuid; r record;
begin
  for r in select * from (values
    ('Motor', 'Componentes do Cabeçote', 'Cabeçote Completo / Comando / Válvulas / Tuchos'),
    ('Motor', 'Bloco e Parte Baixa', 'Bloco Completo / Virabrequim / Bielas / Pistões com Anéis'),
    ('Motor', 'Juntas e Vedação', 'Jogo de Juntas / Junta de Cabeçote / Junta Coletor / Retentores'),
    ('Motor', 'Distribuição e Sincronismo', 'Kit Corrente / Correia Dentada / Tensores / Polias'),
    ('Injeção e Alimentação', 'Sistema Common Rail', 'Bico Injetor / Bomba de Alta Pressão / Flauta / Válvula DRV'),
    ('Injeção e Alimentação', 'Turboalimentação', 'Turbina Completa / Conjunto Rotativo / Válvula Wastegate'),
    ('Arrefecimento', 'Circulação e Controle', 'Bomba d''Água / Válvula Termostática / Radiador / Hélice Viscosa'),
    ('Suspensão e Freios', 'Articulações e Hidráulica', 'Bandeja / Pivô / Servo Freio / Bomba de Vácuo / Pinça')
  ) v(a, b, c) loop
    s := 'material do dono 2026-10-19';
    select id into n1 from public.sistemas_mecanicos where nivel = 1 and lower(nome) = lower(r.a);
    if n1 is null then insert into public.sistemas_mecanicos (nivel, nome, origem) values (1, r.a, s) returning id into n1; end if;
    select id into n2 from public.sistemas_mecanicos where nivel = 2 and pai_id = n1 and lower(nome) = lower(r.b);
    if n2 is null then insert into public.sistemas_mecanicos (nivel, pai_id, nome, origem) values (2, n1, r.b, s) returning id into n2; end if;
    insert into public.sistemas_mecanicos (nivel, pai_id, nome, origem) values (3, n2, r.c, s) on conflict do nothing;
  end loop;
end $$;
