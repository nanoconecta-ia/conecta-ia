# Esqueleto de categorias e tags no Bling (para a loja de autopeças)

Ordem do Bling: primeiro o **esqueleto** (grupos de tags, tags, categorias), depois a ligação aos produtos.
Onde criar: **Preferências > Suprimentos** (Gerenciar grupos de tags, Gerenciar tags, Grupos de produtos) e **Cadastros > Categorias de produtos**.
A API/ferramentas do agente criam categorias e produtos, mas **não** gerenciam tags nem grupos de tags: essa parte é feita na tela do Bling. Estado em 2026-10-19.

## 1. Categorias de produto (espelham a taxonomia do Conecta, perfil autopeças)
Estado: ✅ já criada no Bling (id) · ⬜ falta criar.

| Categoria | Estado | Subcategorias (todas ⬜, exceto onde indicado) |
|---|---|---|
| Alimentação e injeção | ⬜ | Bicos injetores, Bombas de combustível |
| Arrefecimento | ✅ 14668450 | Bombas d'água, Radiadores, Válvulas termostáticas, Embreagens viscosas (✅ 14668464) |
| Carroceria e acabamento | ✅ 14668461 | Para-lamas e para-choques, Retrovisores |
| Elétrica e ignição | ✅ 14668453 | Baterias, Sensores, Velas |
| Embreagem e transmissão | ⬜ | Kits de embreagem, Rolamentos |
| Escapamento | ⬜ | Catalisadores, Silenciosos |
| Filtros | ✅ 14668454 | Filtros de ar, de cabine, de combustível, de óleo |
| Freios | ✅ 14668462 | Cilindros e flexíveis, Discos, Lonas e tambores, Pastilhas |
| Iluminação | ✅ 14668456 | Faróis e lanternas, Lâmpadas |
| Lubrificantes e fluidos | ✅ 14668463 | Fluidos de freio e arrefecimento, Óleos de motor |
| Motor | ✅ 14668460 | Bielas, Bombas de óleo, Cabeçote e válvulas, Correias e tensores, Juntas e retentores, Pistões e anéis |
| Suspensão e direção | ✅ 14668457 | Amortecedores, Barras estabilizadoras, Buchas e batentes, Molas, Pivôs e terminais |

Todas as ✅ já estão ligadas ao nó equivalente da taxonomia do Conecta (tabela `bling_categoria_taxonomia`). Falta ligar as demais quando existirem.

## 2. Grupos de tags e tags sugeridos (filtros internos)
Só termos que já aparecem nas descrições dos fornecedores; nada inventado. Ajustar o padrão de escrita antes de criar.

| Grupo de tags | Tags |
|---|---|
| Marca da peça | Trim Go |
| Sistema | Arrefecimento, Motor, Elétrica |
| Veículo | HR, K2500, L200 |
| Motor | D4BH, D4BB, 4D56 |
| Norma de emissões | Euro III |
| Código de aplicação | K34T, K74T, K94 |

Tags por produto (da descrição do fornecedor):
- CI000016 bomba d'água: Trim Go, Arrefecimento, HR, K2500, D4BH, D4BB, 4D56, Euro III
- CI000054 embreagem viscosa: Trim Go, Arrefecimento, HR, K2500, D4BH, Euro III
- CI000211 válvula termostática: Trim Go, Arrefecimento, HR, K2500, L200, D4BH, 4D56, K34T, K74T, K94
- CI000282 flexível do alternador: Trim Go, HR, K2500, L200, K34T, K74T, K94
- CI000966 bomba de óleo: Trim Go, Motor, HR, K2500, D4BH, Euro III
- CI003695 motor parcial: Trim Go, Motor, 4D56, D4BH

## 3. Regras
- A aplicação (veículo/motor) vem do fornecedor e fica "a confirmar" até haver fonte técnica.
- Contato duplicado (Quatro, CNPJ 17.098.839/0001-07): manter o id 6994437145, mesclar ou inativar o 16307491614 no Bling.
