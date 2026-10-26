# Proposta de taxonomia a partir da árvore REAL do Bling

**Status: PROPOSTA — nada foi gravado no banco.** Depende da aprovação do dono.

Fonte: categorias de produto do Bling lidas em 26/10/2026 pela API (somente leitura): **9 grupos e 51 subcategorias (60)**.
Destino: a taxonomia já existente no Conecta.IA (50 nós, todos hoje *propostos*): 12 grupos e 38 subgrupos.

Resultado da comparação: **42** categorias do Bling já têm nó equivalente (ou grupo); **23** pedem nó novo; 3 grupos da taxonomia não existem no Bling (Alimentação e injeção, Escapamento, e Embreagem e transmissão como grupo próprio).

## Achado importante: a categoria `1072643`

24 dos 42 produtos usam a categoria **1072643**, que **não aparece na lista de categorias do Bling** (é a categoria padrão/sem categoria). Hoje ela está mapeada para o nó **Motor**, o que joga ali peças que não são de motor (ex.: *Embreagem viscosa da hélice* CI000054, *Flexível do alternador* CI000282). **Recomendação:** remover esse mapeamento e tratar os 24 como *sem categoria*, para a IA propor a classificação de cada um (a aprovar na fila).

## Mapa categoria do Bling → nó da taxonomia

| Grupo no Bling | Categoria do Bling | Nó da taxonomia (existente ou NOVO) |
|---|---|---|
| **(grupo)** | Arrefecimento | Arrefecimento |
| **(grupo)** | Elétrica e ignição | Elétrica e ignição |
| **(grupo)** | Filtros | Filtros |
| **(grupo)** | Iluminação | Iluminação |
| **(grupo)** | Suspensão e direção | Suspensão e direção |
| **(grupo)** | Motor | Motor |
| **(grupo)** | Carroceria e acabamento | Carroceria e acabamento |
| **(grupo)** | Freios | Freios |
| **(grupo)** | Lubrificantes e fluidos | Lubrificantes e fluidos |
| Arrefecimento | Embreagens viscosas | Arrefecimento › Embreagens viscosas |
| Arrefecimento | Bombas d'água | Arrefecimento › Bombas d'água |
| Arrefecimento | Radiadores | Arrefecimento › Radiadores |
| Arrefecimento | Válvulas termostáticas | Arrefecimento › Válvulas termostáticas |
| Arrefecimento | Mangueiras | NOVO sob Arrefecimento: Mangueiras |
| Arrefecimento | Reservatórios | NOVO sob Arrefecimento: Reservatórios |
| Motor | Blocos e motores completos | NOVO sob Motor: Blocos e motores completos |
| Motor | Cabeçotes | Motor › Cabeçote e válvulas |
| Motor | Pistões e anéis | Motor › Pistões e anéis |
| Motor | Bielas | Motor › Bielas |
| Motor | Virabrequins | NOVO sob Motor: Virabrequins |
| Motor | Bronzinas de mancal | NOVO sob Motor: Bronzinas de mancal |
| Motor | Bronzinas de biela | NOVO sob Motor: Bronzinas de biela |
| Motor | Camisas de cilindro | NOVO sob Motor: Camisas de cilindro |
| Motor | Válvulas, guias e sedes | Motor › Cabeçote e válvulas |
| Motor | Bombas de óleo | Motor › Bombas de óleo |
| Motor | Distribuição | Motor › Correias e tensores |
| Motor | Juntas e retentores | Motor › Juntas e retentores |
| Motor | Turbocompressores | NOVO sob Motor: Turbocompressores |
| Motor | Injeção diesel | Alimentação e injeção (grupo) — sugerido NOVO: Injeção diesel |
| Motor | Embreagem e transmissão | Embreagem e transmissão (grupo) |
| Freios | Discos de freio | Freios › Discos |
| Freios | Pastilhas de freio | Freios › Pastilhas |
| Freios | Pinças de freio | NOVO sob Freios: Pinças |
| Freios | Cilindros de freio | Freios › Cilindros e flexíveis |
| Freios | Servo freio | NOVO sob Freios: Servo freio |
| Suspensão e direção | Amortecedores | Suspensão e direção › Amortecedores |
| Suspensão e direção | Bandejas | NOVO sob Suspensão e direção: Bandejas |
| Suspensão e direção | Pivôs | Suspensão e direção › Pivôs e terminais |
| Suspensão e direção | Bieletas | NOVO sob Suspensão e direção: Bieletas |
| Suspensão e direção | Terminais de direção | Suspensão e direção › Pivôs e terminais |
| Suspensão e direção | Buchas de suspensão | Suspensão e direção › Buchas e batentes |
| Filtros | Filtros de óleo | Filtros › Filtros de óleo |
| Filtros | Filtros de ar | Filtros › Filtros de ar |
| Filtros | Filtros de combustível | Filtros › Filtros de combustível |
| Filtros | Separadores de água | NOVO sob Filtros: Separadores de água |
| Filtros | Filtros de cabine | Filtros › Filtros de cabine |
| Filtros | Filtros hidráulicos | NOVO sob Filtros: Filtros hidráulicos |
| Filtros | Filtros de transmissão | NOVO sob Filtros: Filtros de transmissão |
| Filtros | Filtros desumidificadores | NOVO sob Filtros: Filtros desumidificadores |
| Elétrica e ignição | Alternadores | NOVO sob Elétrica e ignição: Alternadores |
| Elétrica e ignição | Motores de partida | NOVO sob Elétrica e ignição: Motores de partida |
| Elétrica e ignição | Sensores | Elétrica e ignição › Sensores |
| Elétrica e ignição | Chicotes elétricos | NOVO sob Elétrica e ignição: Chicotes elétricos |
| Elétrica e ignição | Velas aquecedoras | Elétrica e ignição › Velas |
| Iluminação | Faróis | Iluminação › Faróis e lanternas |
| Iluminação | Lanternas | Iluminação › Faróis e lanternas |
| Iluminação | Lâmpadas | Iluminação › Lâmpadas |
| Carroceria e acabamento | Retrovisores | Carroceria e acabamento › Retrovisores |
| Carroceria e acabamento | Maçanetas | NOVO sob Carroceria e acabamento: Maçanetas |
| Carroceria e acabamento | Suportes | NOVO sob Carroceria e acabamento: Suportes |
| Carroceria e acabamento | Acabamentos | (o próprio grupo) Carroceria e acabamento |
| Lubrificantes e fluidos | Óleos de motor | Lubrificantes e fluidos › Óleos de motor |
| Lubrificantes e fluidos | Óleos de transmissão | NOVO sob Lubrificantes e fluidos: Óleos de transmissão |
| Lubrificantes e fluidos | Fluidos hidráulicos | Lubrificantes e fluidos › Fluidos de freio e arrefecimento (revisar) |
| Lubrificantes e fluidos | Aditivos | NOVO sob Lubrificantes e fluidos: Aditivos |

## Como aplicar (depois da sua aprovação)
1. Sincronizar as categorias reais do Bling (PR #97, já pronto; precisa de deploy autorizado).
2. Criar os nós NOVOS acima como *propostos* (você aprova cada grupo na tela Taxonomia).
3. Gravar o mapeamento categoria → nó (substitui os 11 atuais) e **remover o mapeamento de `1072643`**.
4. Rodar a classificação dos 24 produtos sem categoria; cada sugestão cai na Fila de aprovação.

## Pontos para você decidir
- Aceita a árvore do Bling como a base (e a taxonomia só complementa)? Recomendo que sim.
- *Embreagem e transmissão* é subcategoria de Motor no Bling, mas grupo próprio na taxonomia. Manter como grupo próprio?
- *Injeção diesel* e *Turbocompressores* são subcategorias de Motor no Bling. Deixar em Motor ou usar o grupo *Alimentação e injeção*?
- *Fluidos hidráulicos* não tem nó equivalente claro (hoje só *Fluidos de freio e arrefecimento*): criar nó novo?
