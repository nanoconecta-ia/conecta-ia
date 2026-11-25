# Diretriz canônica — indexação Google e taxonomia individualizada por aplicação veicular (MOBIS)

**Estado:** norma canônica do porteiro. Data: 2026-11-25. Aplica a qualquer agente (Nano, GPT, Claude, MCP) e a qualquer SKU.
**Decisão do dono (2026-11-25):** adotar SEO/taxonomia/NAP/individualização/anti-alucinação **AGORA**, mas **SEM preço por ora**. `offers`/`price`/`InStock` e feed do Google Merchant/Shopping ficam **preparados e desligados** até o dono liberar preço (ver §2 — Decisão de preço).

## 1. Entidade corporativa (NAP — proposta pendente de confirmação postal)
Após confirmação pelo dono, aplicar exatamente nos metadados estruturados (`AutoPartsStore`/`Organization`), rodapés, feed do Merchant e vínculo com o Perfil da Empresa no Google:
- **Nome:** Mobis Autopeças
- **CNPJ:** 19.903.967/0001-01
- **WhatsApp (E.164 / display):** +5562991654515 / (62) 99165-4515
- **Região:** Hidrolândia e Goiânia, Goiás — Brasil (reconciliar com o Google Business Profile; não presumir equivalência).

> **Pendência de reconciliação (confirmar com o dono):** o rodapé atual da loja mostra "Av. T-9, 3492 — Jardim América, Goiânia/GO" e não exibe o WhatsApp acima. NAP exige **zero variação** entre site, Schema e Google. Não alterar o endereço/telefone da loja no ar sem o dono confirmar qual é o **endereço postal canônico** único.

## 2. Requisitos para aparecer no Google (Busca, Maps, Shopping)

### Decisão de preço (vigente)
**Catálogo informativo SEM preço** continua valendo (regra mestra do projeto): `preco_publico=null`, `estoque_publico=null`, **nenhum `offers`/checkout** no JSON-LD. Google Merchant/Shopping e `offers`/`InStock` **não são ativados** até o dono liberar preço por produto. Quando liberar, aplicam-se as regras comerciais abaixo.

### A. Google Merchant Center + Perfil da Empresa (quando o preço for liberado)
1. Vincular o Merchant Center ao Perfil da Empresa (CNPJ) para Listagens Gratuitas Locais e "Em estoque na loja".
2. **Identificadores reais (sem alucinação):** `gtin` = GTIN real, comprovado e válido; sem GTIN comprovado, omitir `gtin`. `identifier_exists=false` somente quando a peça realmente não possuir os identificadores comerciais exigidos, conforme regras vigentes do Merchant; não usar para contornar dados faltantes. **Proibido gerar GTIN fictício.** `mpn` = código da peça atribuído pelo seu fabricante, não automaticamente uma referência OEM cruzada. `brand` = marca real da peça (Hyundai Mobis, Kia, Bosch, Sabó, Mahle, MWM…).
3. **Google Product Category:** `Veículos e peças > Peças e acessórios para veículos > Peças para veículos motorizados` (ID 5613 ou subcategoria oficial específica).
4. **Páginas de política indexáveis antes do feed:** Troca/Devolução (CDC), Privacidade, Termos de Uso, Frete/Retirada em loja; rodapé com CNPJ e WhatsApp canônicos.

### B. Dados estruturados JSON-LD (`Product` + aplicação)
Cada página deve emitir JSON-LD semanticamente válido. Testar a sintaxe e distinguir validade de elegibilidade a resultados avançados; o catálogo sem preço não garante rich results:
- `@type: Product`; `sku` (código interno Bling); `mpn` (código comprovado do fabricante da peça); `gtin8`/`gtin12`/`gtin13`/`gtin14` conforme comprimento, **só se comprovado e validado**.
- Especificação de Montadora/Modelo/Motorização/Anos/Posição via `additionalProperty`/`isSimilarTo`.
- **`offers`: só quando o preço for liberado.** Então: `priceCurrency: BRL`, `price` numérico, `availability` conforme estoque real autorizado e `itemCondition` conforme condição documentada, `seller` = Mobis Autopeças (`taxID: 19.903.967/0001-01`). **Enquanto SEM preço: não emitir `offers`.**

## 3. Taxonomia: individualização por aplicação veicular (regra inviolável)
**Proibido agrupar** várias aplicações homologadas numa página genérica de compatibilidade. Cada aplicação = **registro individual** com URL, título, H1, slug e metadados próprios, vinculado ao mesmo SKU físico e saldo único no Bling. Uma peça comprovadamente compatível com HR e Bongo = 2 registros de aplicação, não 2 produtos físicos. OEM por montadora; compartilhar referência apenas com evidência da equivalência. Identificador da aplicação distinto do SKU Bling.

### A. Hierarquia (breadcrumb)
N1 **Sistema** (Motor, Injeção, Suspensão, Freios, Transmissão, Arrefecimento, Elétrica, Carroceria) → N2 **Subsistema/Grupo** (Bloco e Componentes Internos, Cabeçote, Turbo, Bicos/Bombas…) → N3 **Tipo de Peça** (Motor Parcial, Junta do Cabeçote, Bomba de Alta Pressão, Kit Embreagem…).

### B. Fórmula determinística de título/H1/meta (sem adjetivo promocional)
`[Tipo de Peça] + [Marca da Peça] + [Montadora] + [Modelo] + [Motorização/Válvulas/Combustível] + [Ano Inicial a Ano Final] + [Posição/Lado se houver] + [Código OEM/MPN]`
- Exemplo de formato (não é homologação): `Motor Parcial [marca comprovada] Hyundai HR [motor comprovado] [anos comprovados] OEM [OEM Hyundai comprovado]`
- Exemplo de formato separado (não é homologação): `Motor Parcial [marca comprovada] Kia Bongo K2500 [motor comprovado] [anos comprovados] OEM [OEM Kia comprovado]`
- **Proibido (agrupado):** `Motor Parcial Hyundai HR / Kia Bongo K2500 2.5 16V`

### C. Slug canônico
`/pecas/[sistema]/[montadora]-[modelo]-[motor]-[ano-inicio]-[ano-fim]/[tipo-peca]-[mpn]-[sku]`
- Ex.: `/pecas/motor/hyundai-hr-motor-validado-ano-inicio-ano-fim/motor-parcial-mpn-validado-sku`
- Só minúsculas, sem acento, hífen como separador, sem parâmetro dinâmico na canônica.

### D. Atributos-alvo por registro (banco/Bling/frontend) — sem inferência sem fonte; ausência = pendência
`sku_bling` (identificador único e imutável da peça física, compartilhado pelas aplicações) · identificador próprio de aplicação · `titulo_individual` (fórmula 3.B) · `sistema` (enum) · `tipo_peca` · `marca_peca` · `codigo_oem` (+ `codigos_cruzados`) · `gtin_ean` (8/12/13/14 validado por dígito, ou null) · `veiculo_montadora` · `veiculo_modelo` · `veiculo_versao_motor` · `veiculo_ano_inicio` (int) · `veiculo_ano_fim` (int) · `posicao_aplicacao` (enum) · `condicao` (`Novo`/`Remanufaturado`) · `garantia_meses` (documentada, sem inventar garantia comercial; observar direitos legais) · `peso_bruto_kg` + `dimensoes_cm` · `url_imagem_principal` (opcional no catálogo informativo MOBIS; quando presente, imagem real com direitos, HTTPS, fundo branco #FFFFFF, ≥800×800 como padrão interno, sem marca d'água/texto/telefone/CNPJ).

> **Pendência de implementação:** vários atributos ainda **não existem no schema** do banco (sistema, tipo_peca, posicao_aplicacao, garantia_meses, peso/dimensões, codigos_cruzados). Isso é **migração** — mostrar o desenho e esperar aprovação do dono antes de criar.

## 4. Validação anti-bug / anti-alucinação (obrigatória para o agente)
1. **Bloqueio de não-verificado:** se `codigo_oem`, `veiculo_ano_inicio`, `veiculo_ano_fim` ou `veiculo_versao_motor` não estiverem explícitos no Bling/catálogo técnico, marcar `status: PENDENTE_REVISAO_TECNICA` e **impedir publicação da aplicação não homologada**. Ficha geral informativa sem alegação de compatibilidade somente conforme regra mestra e aprovação humana. Nunca preencher anos/motor por suposição.
2. **GTIN módulo 10:** validar comprimento, checksum e identidade da peça antes de gravar `gtin_ean`; se falhar, manter valor bruto como evidência pendente e `gtin_ean = null`. Nunca reclassificar automaticamente como código de fabricante.
3. **Duplicidade veicular:** entrada com `/`, vírgula ou conectivo indicando mais de um modelo (`HR / Bongo`, `Hilux e SW4`, `Amarok / Ranger`) → **dividir em N registros** antes de slug/título/JSON-LD; OEM por montadora e referência compartilhada somente com evidência; identificadores de aplicação distintos, sem clonar SKU/estoque Bling.
4. **Sanitização de imagem:** rejeitar imagem com banner, selo de WhatsApp ou logo promocional para o feed do Shopping (viola Merchant; promocional é só para marketplaces tipo OLX).
5. **Preço/estoque:** quando o modelo comercial for ligado, `price`/`availability` do JSON-LD e do feed devem refletir o preço público aprovado e o estoque real autorizado, sem divergência feed↔página; o preço interno do Bling não autoriza exposição. Não presumir sincronização em tempo real sem implementação e testes. **Enquanto SEM preço, não há feed nem `offers`.**

## Situação atual (fato, não intenção)
- JSON-LD de aplicação já é `Product` + `mpn`, **sem `offers`** — compatível com a decisão SEM preço.
- Páginas públicas já não exibem preço nem `bling_id`.
- Falta: schema dos atributos (§3.D), fórmula de título/slug aplicada no gerador, páginas de política, reconciliação do NAP, e todo o trilho Merchant/Shopping (desligado até liberar preço).

## Limites de execução e governança
Esta diretriz é documentação, não implantação de schema, automação, feed ou publicação. Prevalecem as regras mestras, o Policy Engine, a aprovação humana e as pausas vigentes. Confirmar os requisitos oficiais do Google antes de qualquer ativação comercial; não presumir que exemplos, checksum ou fontes de componentes homologam a peça exata. Não alterar NAP, preço, estoque, SKU, dados fiscais ou permissões sem autorização específica.
