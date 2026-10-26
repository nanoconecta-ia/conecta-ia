-- Taxonomia aprovada, em PASSOS PEQUENOS. Rode UM bloco por vez, na ordem, e olhe o resultado
-- de cada um antes de seguir. Cada bloco é independente e pode ser repetido sem duplicar nada.
-- Só dados em tabelas existentes. Projeto: conecta-ia (dsfzhsrudriqkumtlqwj).
-- Se algum bloco der erro, PARE aí e me mande a mensagem + o número do bloco.

-- ===== BLOCO 0 — diagnóstico (só leitura). Esperado: perfil=1, grupos=12, nos=50, mapas=11, loja=1
select (select count(*) from perfis_ramo where codigo = 'autopecas') as perfil,
       (select count(*) from taxonomia_nos where perfil_ramo = 'autopecas' and pai_id is null) as grupos,
       (select count(*) from taxonomia_nos) as nos,
       (select count(*) from bling_categoria_taxonomia) as mapas,
       (select count(*) from lojas where id = 'cd9d7570-f095-44f2-be28-b9b9cba6578e') as loja;

-- ===== BLOCO 1 — cria os 24 nós novos (propostos). Esperado depois: nos=74
insert into taxonomia_nos (perfil_ramo, pai_id, nome, slug, ordem, status)
select 'autopecas', g.id, v.nome, v.slug, 0, 'proposto'
from (values
    ('Arrefecimento', 'Mangueiras', 'mangueiras'),
    ('Arrefecimento', 'Reservatórios', 'reservatorios'),
    ('Motor', 'Blocos e motores completos', 'blocos-motores'),
    ('Motor', 'Virabrequins', 'virabrequins'),
    ('Motor', 'Bronzinas de mancal', 'bronzinas-mancal'),
    ('Motor', 'Bronzinas de biela', 'bronzinas-biela'),
    ('Motor', 'Camisas de cilindro', 'camisas-cilindro'),
    ('Motor', 'Turbocompressores', 'turbocompressores'),
    ('Alimentação e injeção', 'Injeção diesel', 'injecao-diesel'),
    ('Freios', 'Pinças', 'pincas'),
    ('Freios', 'Servo freio', 'servo-freio'),
    ('Suspensão e direção', 'Bandejas', 'bandejas'),
    ('Suspensão e direção', 'Bieletas', 'bieletas'),
    ('Filtros', 'Separadores de água', 'separadores-agua'),
    ('Filtros', 'Filtros hidráulicos', 'filtros-hidraulicos'),
    ('Filtros', 'Filtros de transmissão', 'filtros-transmissao'),
    ('Filtros', 'Filtros desumidificadores', 'filtros-desumidificadores'),
    ('Elétrica e ignição', 'Alternadores', 'alternadores'),
    ('Elétrica e ignição', 'Motores de partida', 'motores-partida'),
    ('Elétrica e ignição', 'Chicotes elétricos', 'chicotes-eletricos'),
    ('Carroceria e acabamento', 'Maçanetas', 'macanetas'),
    ('Carroceria e acabamento', 'Suportes', 'suportes'),
    ('Lubrificantes e fluidos', 'Óleos de transmissão', 'oleos-transmissao'),
    ('Lubrificantes e fluidos', 'Aditivos', 'aditivos')
) as v(pai, nome, slug)
join taxonomia_nos g on g.perfil_ramo = 'autopecas' and g.pai_id is null and g.nome = v.pai
on conflict (perfil_ramo, slug) do nothing;

select count(*) as nos_agora from taxonomia_nos;   -- esperado: 74

-- ===== BLOCO 2 — teste do mapeamento (só leitura). Esperado: 0 linhas (nada sem nó)
with m(bling_id, pai, nome) as (values
    ('14668450', null::text, 'Arrefecimento'),
    ('14668453', null::text, 'Elétrica e ignição'),
    ('14668454', null::text, 'Filtros'),
    ('14668456', null::text, 'Iluminação'),
    ('14668457', null::text, 'Suspensão e direção'),
    ('14668460', null::text, 'Motor'),
    ('14668461', null::text, 'Carroceria e acabamento'),
    ('14668462', null::text, 'Freios'),
    ('14668463', null::text, 'Lubrificantes e fluidos'),
    ('14668464', 'Arrefecimento', 'Embreagens viscosas'),
    ('14670618', 'Arrefecimento', 'Bombas d''água'),
    ('14676555', 'Arrefecimento', 'Radiadores'),
    ('14676556', 'Arrefecimento', 'Válvulas termostáticas'),
    ('14676557', 'Arrefecimento', 'Mangueiras'),
    ('14676559', 'Arrefecimento', 'Reservatórios'),
    ('14676530', 'Motor', 'Blocos e motores completos'),
    ('14676532', 'Motor', 'Cabeçote e válvulas'),
    ('14676534', 'Motor', 'Pistões e anéis'),
    ('14676537', 'Motor', 'Bielas'),
    ('14676539', 'Motor', 'Virabrequins'),
    ('14676541', 'Motor', 'Bronzinas de mancal'),
    ('14676543', 'Motor', 'Bronzinas de biela'),
    ('14676545', 'Motor', 'Camisas de cilindro'),
    ('14676548', 'Motor', 'Cabeçote e válvulas'),
    ('14676549', 'Motor', 'Bombas de óleo'),
    ('14676550', 'Motor', 'Correias e tensores'),
    ('14676551', 'Motor', 'Juntas e retentores'),
    ('14676552', 'Motor', 'Turbocompressores'),
    ('14676553', 'Alimentação e injeção', 'Injeção diesel'),
    ('14676554', null::text, 'Embreagem e transmissão'),
    ('14676562', 'Freios', 'Discos'),
    ('14676569', 'Freios', 'Pastilhas'),
    ('14676570', 'Freios', 'Pinças'),
    ('14676571', 'Freios', 'Cilindros e flexíveis'),
    ('14676572', 'Freios', 'Servo freio'),
    ('14676573', 'Suspensão e direção', 'Amortecedores'),
    ('14676574', 'Suspensão e direção', 'Bandejas'),
    ('14676575', 'Suspensão e direção', 'Pivôs e terminais'),
    ('14676576', 'Suspensão e direção', 'Bieletas'),
    ('14676577', 'Suspensão e direção', 'Pivôs e terminais'),
    ('14676578', 'Suspensão e direção', 'Buchas e batentes'),
    ('14676579', 'Filtros', 'Filtros de óleo'),
    ('14676580', 'Filtros', 'Filtros de ar'),
    ('14676581', 'Filtros', 'Filtros de combustível'),
    ('14676582', 'Filtros', 'Separadores de água'),
    ('14676608', 'Filtros', 'Filtros de cabine'),
    ('14676609', 'Filtros', 'Filtros hidráulicos'),
    ('14676610', 'Filtros', 'Filtros de transmissão'),
    ('14676612', 'Filtros', 'Filtros desumidificadores'),
    ('14676583', 'Elétrica e ignição', 'Alternadores'),
    ('14676584', 'Elétrica e ignição', 'Motores de partida'),
    ('14676585', 'Elétrica e ignição', 'Sensores'),
    ('14676586', 'Elétrica e ignição', 'Chicotes elétricos'),
    ('14676587', 'Elétrica e ignição', 'Velas'),
    ('14676588', 'Iluminação', 'Faróis e lanternas'),
    ('14676589', 'Iluminação', 'Faróis e lanternas'),
    ('14676590', 'Iluminação', 'Lâmpadas'),
    ('14676591', 'Carroceria e acabamento', 'Retrovisores'),
    ('14676592', 'Carroceria e acabamento', 'Maçanetas'),
    ('14676593', 'Carroceria e acabamento', 'Suportes'),
    ('14676594', null::text, 'Carroceria e acabamento'),
    ('14676595', 'Lubrificantes e fluidos', 'Óleos de motor'),
    ('14676596', 'Lubrificantes e fluidos', 'Óleos de transmissão'),
    ('14676597', 'Lubrificantes e fluidos', 'Fluidos de freio e arrefecimento'),
    ('14676598', 'Lubrificantes e fluidos', 'Aditivos')
),
alvo as (
  select n.id, n.nome, p.nome as pai
  from taxonomia_nos n left join taxonomia_nos p on p.id = n.pai_id
  where n.perfil_ramo = 'autopecas'
)
select m.bling_id, m.pai, m.nome
from m left join alvo a on a.nome = m.nome and a.pai is not distinct from m.pai
where a.id is null;

-- ===== BLOCO 3 — grava o mapeamento (troca os 11 antigos pelos 65). Esperado depois: mapas=65
begin;
delete from bling_categoria_taxonomia where loja_id = 'cd9d7570-f095-44f2-be28-b9b9cba6578e';
with m(bling_id, pai, nome) as (values
    ('14668450', null::text, 'Arrefecimento'),
    ('14668453', null::text, 'Elétrica e ignição'),
    ('14668454', null::text, 'Filtros'),
    ('14668456', null::text, 'Iluminação'),
    ('14668457', null::text, 'Suspensão e direção'),
    ('14668460', null::text, 'Motor'),
    ('14668461', null::text, 'Carroceria e acabamento'),
    ('14668462', null::text, 'Freios'),
    ('14668463', null::text, 'Lubrificantes e fluidos'),
    ('14668464', 'Arrefecimento', 'Embreagens viscosas'),
    ('14670618', 'Arrefecimento', 'Bombas d''água'),
    ('14676555', 'Arrefecimento', 'Radiadores'),
    ('14676556', 'Arrefecimento', 'Válvulas termostáticas'),
    ('14676557', 'Arrefecimento', 'Mangueiras'),
    ('14676559', 'Arrefecimento', 'Reservatórios'),
    ('14676530', 'Motor', 'Blocos e motores completos'),
    ('14676532', 'Motor', 'Cabeçote e válvulas'),
    ('14676534', 'Motor', 'Pistões e anéis'),
    ('14676537', 'Motor', 'Bielas'),
    ('14676539', 'Motor', 'Virabrequins'),
    ('14676541', 'Motor', 'Bronzinas de mancal'),
    ('14676543', 'Motor', 'Bronzinas de biela'),
    ('14676545', 'Motor', 'Camisas de cilindro'),
    ('14676548', 'Motor', 'Cabeçote e válvulas'),
    ('14676549', 'Motor', 'Bombas de óleo'),
    ('14676550', 'Motor', 'Correias e tensores'),
    ('14676551', 'Motor', 'Juntas e retentores'),
    ('14676552', 'Motor', 'Turbocompressores'),
    ('14676553', 'Alimentação e injeção', 'Injeção diesel'),
    ('14676554', null::text, 'Embreagem e transmissão'),
    ('14676562', 'Freios', 'Discos'),
    ('14676569', 'Freios', 'Pastilhas'),
    ('14676570', 'Freios', 'Pinças'),
    ('14676571', 'Freios', 'Cilindros e flexíveis'),
    ('14676572', 'Freios', 'Servo freio'),
    ('14676573', 'Suspensão e direção', 'Amortecedores'),
    ('14676574', 'Suspensão e direção', 'Bandejas'),
    ('14676575', 'Suspensão e direção', 'Pivôs e terminais'),
    ('14676576', 'Suspensão e direção', 'Bieletas'),
    ('14676577', 'Suspensão e direção', 'Pivôs e terminais'),
    ('14676578', 'Suspensão e direção', 'Buchas e batentes'),
    ('14676579', 'Filtros', 'Filtros de óleo'),
    ('14676580', 'Filtros', 'Filtros de ar'),
    ('14676581', 'Filtros', 'Filtros de combustível'),
    ('14676582', 'Filtros', 'Separadores de água'),
    ('14676608', 'Filtros', 'Filtros de cabine'),
    ('14676609', 'Filtros', 'Filtros hidráulicos'),
    ('14676610', 'Filtros', 'Filtros de transmissão'),
    ('14676612', 'Filtros', 'Filtros desumidificadores'),
    ('14676583', 'Elétrica e ignição', 'Alternadores'),
    ('14676584', 'Elétrica e ignição', 'Motores de partida'),
    ('14676585', 'Elétrica e ignição', 'Sensores'),
    ('14676586', 'Elétrica e ignição', 'Chicotes elétricos'),
    ('14676587', 'Elétrica e ignição', 'Velas'),
    ('14676588', 'Iluminação', 'Faróis e lanternas'),
    ('14676589', 'Iluminação', 'Faróis e lanternas'),
    ('14676590', 'Iluminação', 'Lâmpadas'),
    ('14676591', 'Carroceria e acabamento', 'Retrovisores'),
    ('14676592', 'Carroceria e acabamento', 'Maçanetas'),
    ('14676593', 'Carroceria e acabamento', 'Suportes'),
    ('14676594', null::text, 'Carroceria e acabamento'),
    ('14676595', 'Lubrificantes e fluidos', 'Óleos de motor'),
    ('14676596', 'Lubrificantes e fluidos', 'Óleos de transmissão'),
    ('14676597', 'Lubrificantes e fluidos', 'Fluidos de freio e arrefecimento'),
    ('14676598', 'Lubrificantes e fluidos', 'Aditivos')
),
alvo as (
  select n.id, n.nome, p.nome as pai
  from taxonomia_nos n left join taxonomia_nos p on p.id = n.pai_id
  where n.perfil_ramo = 'autopecas'
)
insert into bling_categoria_taxonomia (loja_id, bling_categoria_id, taxonomia_no_id)
select 'cd9d7570-f095-44f2-be28-b9b9cba6578e', m.bling_id, a.id
from m join alvo a on a.nome = m.nome and a.pai is not distinct from m.pai;
commit;

select count(*) as mapas_agora from bling_categoria_taxonomia;   -- esperado: 65

-- ===== BLOCO 4 — tira de "Motor" os 24 produtos sem categoria (1072643)
update produtos set taxonomia_no_id = null
where loja_id = 'cd9d7570-f095-44f2-be28-b9b9cba6578e' and categoria_bling_id = '1072643';

-- ===== BLOCO 5 — aplica o mapeamento aos produtos que têm categoria
select bling_categoria_taxonomia_aplicar('cd9d7570-f095-44f2-be28-b9b9cba6578e'::uuid) as produtos_reclassificados;

-- ===== BLOCO 6 — conferência final. Esperado: nos=74, mapas=65, map_sem_cat=0, cats_sem_mapa=0, sem_cat_classificados=0
select (select count(*) from taxonomia_nos) as nos,
       (select count(*) from bling_categoria_taxonomia) as mapas,
       (select count(*) from bling_categoria_taxonomia where bling_categoria_id = '1072643') as map_sem_cat,
       (select count(*) from bling_categorias c where not exists (
          select 1 from bling_categoria_taxonomia m where m.loja_id = c.loja_id and m.bling_categoria_id = c.bling_id)) as cats_sem_mapa,
       (select count(*) from produtos where categoria_bling_id = '1072643' and taxonomia_no_id is not null) as sem_cat_classificados;
