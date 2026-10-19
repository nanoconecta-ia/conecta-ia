# Produtos do piloto: o que falta para aparecerem no site

Lido em produção em 2026-10-19 (somente leitura). Hoje **0 de 4** produtos podem ser publicados. Para uma peça de autopeças, o banco exige 8 itens: nome, SKU, preço, **categoria aprovada, imagem principal aprovada, código do fabricante aprovado, marca da peça aprovada e bula técnica aprovada**. Os 3 primeiros já existem nos 4 produtos (menos o SKU do radiador). Os outros 5 faltam em todos.

Nada abaixo é inventado: onde falta dado, o campo é do lojista fornecer, com fonte. A categoria é sugestão minha a confirmar.

| # | SKU | Produto | Preço | Estoque |
|---|---|---|---|---|
| 1 | 80692 | Jogo de Juntas Completo do Motor HR / K2 | R$ 900,00 | **0** (aparecerá "indisponível") |
| 2 | CI001086 | Bomba de óleo HR/K2500 2.5 16V 13/ D4CB Euro V | R$ 939,47 | 1 |
| 3 | CI003696 | Motor HR/K2500 2.5 16V 13/ D4CB Euro V | R$ 18.900,00 | 1 |
| 4 | **(sem SKU)** | Radiador de óleo HR/K2500 2.5 16V 13/ D4CB | R$ 291,88 | 1 |

## Para cada produto o lojista precisa informar
1. **Foto real** da peça (a sua, ou do fornecedor/fabricante com autorização por escrito). Imagem de terceiros só entra com direito de uso confirmado. Aprovar a identidade da peça e confirmar o direito de uso são duas decisões separadas.
2. **Marca da peça** (quem fabrica: por exemplo a marca impressa na caixa) e **código do fabricante**, exatamente como na peça ou na nota do fornecedor.
3. **Bula técnica aprovada**, com as medidas da família e a fonte (catálogo do fabricante, manual, ficha técnica). Sem fonte, fica vazio; não se estima medida. Para juntas: espessura e diâmetros; para bomba e radiador, as medidas que o catálogo trouxer.
4. **Aprovar a categoria** na tela Taxonomia (todas estão como "proposto").

## Categorias que eu sugiro aprovar (já existem na árvore da loja)
| Produto | Categoria sugerida (a confirmar) |
|---|---|
| Jogo de Juntas | Motor ▸ **Juntas e retentores** |
| Bomba de óleo | Motor ▸ **Bombas de óleo** |
| Motor completo | **Motor** (não há subcategoria para motor completo; o lojista pode pedir uma nova) |
| Radiador de óleo | Arrefecimento ▸ **Radiadores** (confirmar se "radiador de óleo" deve ficar aqui ou em Motor) |

## Ajustes que só o lojista faz no Bling (o sistema não escreve no Bling)
- **Radiador de óleo sem SKU:** preencher o SKU. Sem SKU não há como publicar nem montar o link da página.
- **Jogo de juntas com estoque 0:** repor o estoque se quiser vender; senão o site mostra "indisponível".
- Conferir o **GTIN/código de barras** de cada peça, se existir (não é exigido para publicar, mas o Google Merchant pede GTIN válido ou marca + código do fabricante).

## Depois que os dados chegarem
1. O agente monta as propostas (marca, código, aplicação, imagem, bula) e o lojista aprova na Fila.
2. Quando o produto cumprir os 8 itens, o botão **Mostrar no site** (Catálogo) libera a publicação. Se ainda faltar algo, a tela diz o quê.
3. O lojista pode **ocultar** o produto quando quiser.

## Aplicação por veículo (HR e K2500)
Para a busca por veículo funcionar, cada peça também precisa de aplicação **por versão** (HR e K2500 são cadastros diferentes, mesmo compartilhando o motor D4CB), com fonte e período no Brasil. Isso não é exigido para publicar, mas sem isso o site não mostra "Aplicações confirmadas" nem a peça aparece no filtro por veículo.
