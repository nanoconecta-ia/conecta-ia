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

---

# Exemplo 2 — agregador de catálogos genuínos (EPC), página "Hyundai Parts Catalog R/V"

Fonte: texto da página colado pelo dono em 2026-10-19. Só estrutura; os dados do catálogo são de terceiros e licenciados, **não entram** no Conecta.IA sem licença (`fontes.licenciada`).

## O que a página mostra e o que adotamos
| Observação | Adoção no Conecta.IA |
|---|---|
| Catálogo com **código de edição** (`HYUNDAI202404`) | Toda consulta a catálogo de montadora grava a **edição** em `fontes.versao`. Catálogo muda; a fonte precisa dizer de qual edição veio. |
| A mesma linha de modelo aparece **por mercado**: `DOM` (Coreia), `GEN` (exportação geral), `EUR`, `HMA` (EUA), `HAC` (Canadá), `MES`, `CIS`, `AUS`, `HMI` (Índia) | **Mercado é dimensão obrigatória** da aplicação (`versoes.mercado`). Uma linha de catálogo de outro mercado **não vale** para o Brasil sem evidência de qual código de mercado o Brasil segue. Para registrar o código do catálogo: `identificadores_oficiais` com `orgao='montadora'`, `tipo='regiao_catalogo'`, `valor`, fonte e edição. |
| Linhas com **período de produção por mercado** e **planta** no nome (ex.: "CRETA 17 (BRAZIL PLANT)") | Confirma que planta e mercado mudam o período e a peça. Entra como evento por versão (`eventos_veiculo`) com fonte. A planta fica no nome/descrição da geração até ser preciso um campo próprio (**proposta, não aplicada**). |
| O mesmo veículo com **nomes diferentes** em mercados diferentes (ex.: "H-100", "Porter", "HR") | `relacoes_tecnicas` tipo `mesmo_veiculo_outro_nome`, **somente com fonte**. Não afirmo que HR = H-100 sem catálogo que prove. |
| A lista **não traz o HR nem o Bongo/K2500** | Esse catálogo é de outra família de veículos; utilitários comerciais provavelmente estão em outro catálogo, e o Kia é outra marca. Fica como lacuna a pesquisar. |
| Seletor de **marca**, depois catálogo, depois lista filtrável (total: N especificações) | Mesmo fluxo do filtro da loja: montadora ▸ modelo ▸ mercado/ano ▸ versão. |
| Área da conta com **Garagem** (veículos salvos), Pedidos, Favoritos | **"Minha garagem"** na loja: o cliente salva o veículo uma vez e a busca já filtra por ele. Resolve parte da busca por placa **sem serviço de terceiros**. |
| Páginas: Sobre, Contato, FAQ, Políticas, Termos, Notícias, Artigos | Mesma lista institucional da loja (já prevista), com FAQ e artigos para SEO. |
| Rodapé com razão social do operador | Razão social e CNPJ da loja no rodapé. |

## Consequências práticas para o agente
1. Ao usar qualquer catálogo (EPC), registrar: edição, mercado (código do catálogo), período e, se houver, planta.
2. Nunca copiar linha de catálogo de EUR/HMA/etc. para um veículo vendido no Brasil.
3. O "mesmo nome de modelo" em mercados diferentes pode ter motor, norma de emissões e peças diferentes: a aplicação é sempre por **versão + mercado**.
