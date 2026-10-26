-- Aplica a taxonomia aprovada (docs/taxonomia/proposta-bling.md) à loja piloto.
-- Só dados nas tabelas existentes; nenhuma mudança de estrutura. Roda numa transação única:
-- se qualquer passo falhar, nada é gravado.
-- Passos: (1) cria os nós novos como "proposto"; (2) troca o mapeamento categoria do Bling -> nó
-- (apaga os 11 atuais e grava 65); (3) tira de "Motor" os produtos da categoria 1072643
-- (sem categoria); (4) aplica o mapeamento aos produtos categorizados.
-- Projeto Supabase: conecta-ia (dsfzhsrudriqkumtlqwj). Confirme o projeto antes de executar.

do $$
declare
  v_loja uuid := 'cd9d7570-f095-44f2-be28-b9b9cba6578e';
  r record; v_pai uuid; v_no uuid; v_novos int := 0; v_map int := 0; v_nulos int := 0; v_apl int := 0;
begin
  -- 1) nós novos (propostos), sob o grupo indicado
  for r in select * from (values
    ('Arrefecimento','Mangueiras','mangueiras'),('Arrefecimento','Reservatórios','reservatorios'),
    ('Motor','Blocos e motores completos','blocos-motores'),('Motor','Virabrequins','virabrequins'),
    ('Motor','Bronzinas de mancal','bronzinas-mancal'),('Motor','Bronzinas de biela','bronzinas-biela'),
    ('Motor','Camisas de cilindro','camisas-cilindro'),('Motor','Turbocompressores','turbocompressores'),
    ('Alimentação e injeção','Injeção diesel','injecao-diesel'),
    ('Freios','Pinças','pincas'),('Freios','Servo freio','servo-freio'),
    ('Suspensão e direção','Bandejas','bandejas'),('Suspensão e direção','Bieletas','bieletas'),
    ('Filtros','Separadores de água','separadores-agua'),('Filtros','Filtros hidráulicos','filtros-hidraulicos'),
    ('Filtros','Filtros de transmissão','filtros-transmissao'),('Filtros','Filtros desumidificadores','filtros-desumidificadores'),
    ('Elétrica e ignição','Alternadores','alternadores'),('Elétrica e ignição','Motores de partida','motores-partida'),
    ('Elétrica e ignição','Chicotes elétricos','chicotes-eletricos'),
    ('Carroceria e acabamento','Maçanetas','macanetas'),('Carroceria e acabamento','Suportes','suportes'),
    ('Lubrificantes e fluidos','Óleos de transmissão','oleos-transmissao'),('Lubrificantes e fluidos','Aditivos','aditivos')
  ) t(pai, nome, slug) loop
    select id into v_pai from taxonomia_nos where perfil_ramo='autopecas' and pai_id is null and nome=r.pai;
    if v_pai is null then raise exception 'grupo não encontrado: %', r.pai; end if;
    insert into taxonomia_nos(perfil_ramo, pai_id, nome, slug, ordem, status)
    values ('autopecas', v_pai, r.nome, r.slug, 0, 'proposto')
    on conflict (perfil_ramo, slug) do nothing;
    if found then v_novos := v_novos + 1; end if;
  end loop;

  -- 2) mapeamento categoria do Bling -> nó (substitui os atuais da loja)
  delete from bling_categoria_taxonomia where loja_id = v_loja;
  for r in select * from (values
    ('14668450',null,'Arrefecimento'),('14668453',null,'Elétrica e ignição'),('14668454',null,'Filtros'),
    ('14668456',null,'Iluminação'),('14668457',null,'Suspensão e direção'),('14668460',null,'Motor'),
    ('14668461',null,'Carroceria e acabamento'),('14668462',null,'Freios'),('14668463',null,'Lubrificantes e fluidos'),
    ('14668464','Arrefecimento','Embreagens viscosas'),('14670618','Arrefecimento','Bombas d''água'),
    ('14676555','Arrefecimento','Radiadores'),('14676556','Arrefecimento','Válvulas termostáticas'),
    ('14676557','Arrefecimento','Mangueiras'),('14676559','Arrefecimento','Reservatórios'),
    ('14676530','Motor','Blocos e motores completos'),('14676532','Motor','Cabeçote e válvulas'),
    ('14676534','Motor','Pistões e anéis'),('14676537','Motor','Bielas'),('14676539','Motor','Virabrequins'),
    ('14676541','Motor','Bronzinas de mancal'),('14676543','Motor','Bronzinas de biela'),
    ('14676545','Motor','Camisas de cilindro'),('14676548','Motor','Cabeçote e válvulas'),
    ('14676549','Motor','Bombas de óleo'),('14676550','Motor','Correias e tensores'),
    ('14676551','Motor','Juntas e retentores'),('14676552','Motor','Turbocompressores'),
    ('14676553','Alimentação e injeção','Injeção diesel'),('14676554',null,'Embreagem e transmissão'),
    ('14676562','Freios','Discos'),('14676569','Freios','Pastilhas'),('14676570','Freios','Pinças'),
    ('14676571','Freios','Cilindros e flexíveis'),('14676572','Freios','Servo freio'),
    ('14676573','Suspensão e direção','Amortecedores'),('14676574','Suspensão e direção','Bandejas'),
    ('14676575','Suspensão e direção','Pivôs e terminais'),('14676576','Suspensão e direção','Bieletas'),
    ('14676577','Suspensão e direção','Pivôs e terminais'),('14676578','Suspensão e direção','Buchas e batentes'),
    ('14676579','Filtros','Filtros de óleo'),('14676580','Filtros','Filtros de ar'),
    ('14676581','Filtros','Filtros de combustível'),('14676582','Filtros','Separadores de água'),
    ('14676608','Filtros','Filtros de cabine'),('14676609','Filtros','Filtros hidráulicos'),
    ('14676610','Filtros','Filtros de transmissão'),('14676612','Filtros','Filtros desumidificadores'),
    ('14676583','Elétrica e ignição','Alternadores'),('14676584','Elétrica e ignição','Motores de partida'),
    ('14676585','Elétrica e ignição','Sensores'),('14676586','Elétrica e ignição','Chicotes elétricos'),
    ('14676587','Elétrica e ignição','Velas'),
    ('14676588','Iluminação','Faróis e lanternas'),('14676589','Iluminação','Faróis e lanternas'),
    ('14676590','Iluminação','Lâmpadas'),
    ('14676591','Carroceria e acabamento','Retrovisores'),('14676592','Carroceria e acabamento','Maçanetas'),
    ('14676593','Carroceria e acabamento','Suportes'),('14676594',null,'Carroceria e acabamento'),
    ('14676595','Lubrificantes e fluidos','Óleos de motor'),('14676596','Lubrificantes e fluidos','Óleos de transmissão'),
    ('14676597','Lubrificantes e fluidos','Fluidos de freio e arrefecimento'),('14676598','Lubrificantes e fluidos','Aditivos')
  ) t(bling_id, pai, nome) loop
    if r.pai is null then
      select id into v_no from taxonomia_nos where perfil_ramo='autopecas' and pai_id is null and nome=r.nome;
    else
      select n.id into v_no from taxonomia_nos n join taxonomia_nos p on p.id=n.pai_id
       where n.perfil_ramo='autopecas' and p.pai_id is null and p.nome=r.pai and n.nome=r.nome;
    end if;
    if v_no is null then raise exception 'nó não encontrado: % > %', r.pai, r.nome; end if;
    insert into bling_categoria_taxonomia(loja_id, bling_categoria_id, taxonomia_no_id) values (v_loja, r.bling_id, v_no);
    v_map := v_map + 1;
  end loop;

  -- 3) sem categoria (1072643): tira a classificação errada herdada de "Motor"
  update produtos set taxonomia_no_id = null where loja_id = v_loja and categoria_bling_id = '1072643';
  get diagnostics v_nulos = row_count;

  -- 4) aplica o novo mapeamento aos produtos categorizados
  v_apl := bling_categoria_taxonomia_aplicar(v_loja);

  -- trava: tem que haver um mapeamento para cada categoria real espelhada do Bling
  if v_map <> (select count(*) from bling_categorias where loja_id = v_loja) then
    raise exception 'mapeamento incompleto: % de %', v_map, (select count(*) from bling_categorias where loja_id = v_loja);
  end if;
  raise notice 'nós novos=% | mapeamentos=% | produtos sem categoria limpos=% | produtos reclassificados=%', v_novos, v_map, v_nulos, v_apl;
end $$;

-- Conferência (rode depois; esperado: nos=74, mapas=65, map_sem_cat=0, sem_cat_classificados=0)
select (select count(*) from taxonomia_nos) as nos,
       (select count(*) from bling_categoria_taxonomia) as mapas,
       (select count(*) from bling_categoria_taxonomia where bling_categoria_id = '1072643') as map_sem_cat,
       (select count(*) from produtos where categoria_bling_id = '1072643' and taxonomia_no_id is not null) as sem_cat_classificados;
