-- Receitas das famílias reais do catálogo (peças de motor/suspensão), ligadas aos nós EXISTENTES da taxonomia.
-- PARA APROVAÇÃO: não aplicada. Receita é MÉTODO, não dado: nada aqui aprova, publica ou grava no Bling.
-- Cada receita herda a mesma ordem de passos da receita `filtro_oleo_diesel_leve` (v1), sem as regras específicas
-- de filtro (rosca/by-pass). Os passos 4 a 8 seguem pendentes na função `agente` (dependem de fontes e provedor de IA).
-- Idempotente: só cria se a receita ativa do mesmo código ainda não existir e se o nó da taxonomia existir.

with familias(slug, nome) as (values
  ('bomba-oleo', 'Bomba de óleo'),
  ('bombas-agua', 'Bomba d''água'),
  ('cabecote-valvulas', 'Cabeçote e válvulas'),
  ('bielas', 'Bielas'),
  ('bronzinas-biela', 'Bronzinas de biela'),
  ('blocos-motores', 'Blocos e motores completos'),
  ('juntas-retentores', 'Juntas e retentores'),
  ('correias-tensores', 'Correias, tensores e kit de distribuição'),
  ('bandejas', 'Bandejas de suspensão'),
  ('motores-partida', 'Motores de partida'),
  ('filtro-ar', 'Filtro de ar'),
  ('filtro-combustivel', 'Filtro de combustível'),
  ('filtro-cabine', 'Filtro de cabine')
),
passos(p) as (values ('[
  {"ordem":1,"acao":"ler_bling","escrita":false,"detalhe":"Ler nome, SKU, GTIN, NCM, CEST, categoria, marca, imagens e descrição. Somente leitura; custo e fornecedor não são copiados."},
  {"ordem":2,"acao":"extrair_do_nome","escrita":false,"detalhe":"Extrair do texto literal: marca da peça, veículo, motor e ano inicial. Nada que não esteja escrito; resultado entra como a_confirmar."},
  {"ordem":3,"acao":"classificar_taxonomia","escrita":false,"detalhe":"Classificar no nó da taxonomia. Se faltar nó, propor nó novo com status proposto para o lojista aprovar."},
  {"ordem":4,"acao":"buscar_codigos","escrita":true,"destino":"pecas_ref,ref_cruzada,produto_pecas_ref","detalhe":"Buscar código genuíno, do fabricante e equivalentes em catálogo de montadora, EPC, documento do fabricante ou catálogo comercial. Registrar classe, fonte, data e confiança. Sem evidência, deixar vazio. Nunca assumir equivalência transitiva."},
  {"ordem":5,"acao":"comparar_especificacoes","escrita":true,"destino":"produto_codigos,pecas_aplicacoes_tecnicas","detalhe":"Registrar especificações técnicas apenas quando a fonte trouxer; divergência entre fontes vira restrição, não é resolvida por palpite."},
  {"ordem":6,"acao":"verificar_ncm_cest","escrita":true,"destino":"fiscal","detalhe":"NCM do cadastro/nota do fabricante é intocável. Se vazio, sugerir pela tabela oficial como a_confirmar; o contador valida antes de ir ao Bling ou à página."},
  {"ordem":7,"acao":"buscar_imagem","escrita":true,"destino":"produto_imagens","detalhe":"Se não houver imagem própria, buscar imagem pública como ilustrativa, só com cruzamento por código que confirme a peça; nunca servir a URL de terceiros."},
  {"ordem":8,"acao":"montar_descricao_curta","escrita":true,"destino":"enriquecimento","detalhe":"Descrição curta só com fatos que têm fonte (aplicação, tipo, marca). Sem especificação inventada."},
  {"ordem":9,"acao":"checar_campos_exigidos","escrita":false,"detalhe":"Comparar com campos_exigidos; listar vazios em campos_vazios. Produto incompleto não publica."},
  {"ordem":10,"acao":"enviar_fila_aprovacao","escrita":false,"detalhe":"Tudo entra como a_confirmar na fila do lojista. Escrita no Bling só por campo autorizado e após aprovação por produto."}
]'::jsonb))
insert into public.receitas (perfil_ramo, codigo, versao, nome, status, taxonomia_no_id, gatilho, passos, campos_exigidos)
select 'autopecas', 'peca_' || replace(f.slug, '-', '_'), 1, f.nome, 'ativa', n.id,
       jsonb_build_object('taxonomia_slug', f.slug), p.p,
       array['nome','sku','preco','categoria','imagem_principal','marca_peca','codigo_fabricante','aplicacao_veicular']
from familias f
join public.taxonomia_nos n on n.perfil_ramo = 'autopecas' and n.slug = f.slug
cross join passos p
where not exists (
  select 1 from public.receitas r
  where r.perfil_ramo = 'autopecas' and r.codigo = 'peca_' || replace(f.slug, '-', '_') and r.status = 'ativa'
);
