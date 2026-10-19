# Loja — modelo de referência (estrutura observada em uma loja de autopeças de Goiânia)

Fonte: texto da página de produto do SKU 80692, colado pelo dono em 2026-10-19 (o site não abre a partir do ambiente de desenvolvimento).
Uso: **só a estrutura e a organização**. Nada de texto, imagem, preço ou dado técnico deles entra no Conecta.IA.

## Estrutura observada → equivalente no Conecta.IA
| Elemento da loja de referência | No Conecta.IA |
|---|---|
| Busca por **placa** + ano ("informe um veículo para melhorar a busca") | Filtro por veículo (montadora ▸ modelo ▸ motor ▸ ano) já existe. Placa exige serviço de consulta de terceiros e tratamento LGPD: **decisão pendente do dono**. |
| Menu por **função**: Climatização, Direção, Elétrica, Freios, Lubrificantes, Motor, Suspensão, Transmissão, Uso Geral | `sistemas_mecanicos` nível 1, com ícone. Faltam na semente do dono: Climatização, Lubrificantes, Transmissão, Uso Geral (propor ao lojista, não criar sozinho). |
| Breadcrumb de 3 níveis (Motor ▸ Jogo de juntas ▸ Motor completo) | Sistema ▸ Subsistema ▸ Família, igual à árvore aprovada. |
| Aviso "Não sabemos se este produto é compatível com seu veículo. Fale com um atendente!" quando nenhum veículo foi escolhido | Mantido como regra: sem veículo escolhido ou sem aplicação aprovada, a página **não afirma compatibilidade** e oferece WhatsApp. |
| Frete por CEP, estoque ("N unidades disponíveis"), preço à vista e parcelado | Estoque e preço vêm do Bling na hora; checkout/WhatsApp conforme o modo de venda da loja. |
| Ficha técnica: código interno, de catálogo, da indústria, popular, **original (OEM)**, peso, dimensão, unidade de venda, período, GTIN | Mapeia para SKU, código de referência, código OEM, peso/dimensões do Bling, período **no Brasil com fonte**, GTIN. |
| Campos de aplicação: categoria de veículo (pick-up/utilitários), montadora, veículo/modelo, motorização, sigla (versão), complemento ("com retentor / sem flange") | `identificadores_oficiais` + aplicação por **versão**; o complemento vira restrição da aplicação. |
| Abas Aplicações / Avaliações | Bloco de aplicações por versão (aprovadas) e "NÃO SE APLICA"; avaliações só se houver compras reais. |
| Institucional: Quem somos, Nossas lojas, Fornecedores, Fale conosco, Blog | Páginas institucionais da loja. |
| **Política de privacidade, de entrega, de trocas e devoluções** no rodapé | Obrigatórias: privacidade (LGPD), entrega, trocas/devoluções (CDC), garantia, termos, cookies. |
| Rodapé com razão social, endereço, telefones, horário e canal de denúncia | Razão social, **CNPJ**, endereço, contato e horário da própria loja (dados do Bling/cadastro, nunca inventados). |

## Lições sobre a qualidade do dado (importante)
- A página de referência mostra **peso de 87 g** e dimensões 3×17×40 cm para o jogo de juntas; o Bling da Mobis registra 2,4 kg e 12×36×70 cm. Um dos dois está errado: por isso o dado de outra loja **nunca** é fonte para o nosso cadastro.
- O campo "Código Original" está **vazio** e "Montadora" está "-". Campo sem dado fica vazio ou "a confirmar"; não se preenche por palpite.
- O período aparece como "a partir de 01/2014 até 12/2027" no título e na ficha. Nosso cadastro diz "(2013+)". As datas divergem e ambas **estão sem fonte verificada**; seguem "a confirmar" até haver documento do importador/montadora (ver `periodo-brasil-hr-k2500.md`). O "até 12/2027" parece data de campo técnico, não fato.
- O título lista um só veículo (HR) para o SKU, o que combina com a regra de anúncio por versão.

## Padrão de título sugerido (campos reais do cadastro)
`[Peça] [Veículo] [Motor] [Versão/sigla] [Período com fonte] [Complemento] [Marca] [Código]` — só com campos que tenham dado confirmado; o que faltar é omitido, nunca completado.
