# Diretriz canônica — indexação Google e taxonomia individualizada por aplicação veicular (MOBIS)

**Estado:** norma canônica do porteiro. Data: 2026-11-25. Aplica a qualquer agente (Nano, GPT, Claude, MCP) e a qualquer SKU.
**Decisão do dono (2026-11-25):** adotar SEO/taxonomia/NAP/individualização/anti-alucinação **AGORA**, mas **SEM preço por ora**. `offers`/`price`/`InStock` e feed do Google Merchant/Shopping ficam **preparados e desligados** até o dono liberar preço (ver §2 — Decisão de preço).

## 1. Entidade corporativa (NAP canônico — zero variação)
Aplicar exatamente nos metadados estruturados (`AutoPartsStore`/`Organization`), rodapés, feed do Merchant e vínculo com o Perfil da Empresa no Google:
- **Nome:** Mobis Autopeças
- **CNPJ:** 19.903.967/0001-01
- **WhatsApp (E.164 / display):** +5562991654515 / (62) 99165-4515
- **Região:** Hidrolândia e Goiânia, Goiás — Brasil (idêntico ao Google Business Profile).

> **Pendência de reconciliação (confirmar com o dono):** o rodapé atual da loja mostra "Av. T-9, 3492 — Jardim América, Goiânia/GO" e não exibe o WhatsApp acima. NAP exige **zero variação** entre site, Schema e Google. Não alterar o endereço/telefone da loja no ar sem o dono confirmar qual é o **endereço postal canônico** único.

## 2. Requisitos para aparecer no Google (Busca, Maps, Shopping)

### Decisão de preço (vigente)
**Catálogo informativo SEM preço** continua valendo (regra mestra do projeto): `preco_publico=null`, `estoque_publico=null`, **nenhum `offers`/checkout** no JSON-LD. Google Merchant/Shopping e `offers`/`InStock` **não são ativados** até o dono liberar preço por produto. Quando liberar, aplicam-se as regras comerciais abaixo.

### A. Google Merchant Center + Perfil da Empresa (quando o preço for liberado)
1. Vincular o Merchant Center ao Perfil da Empresa (CNPJ) para Listagens Gratuitas Locais e "Em estoque na loja".
2. **Identificadores reais (sem alucinação):** `gtin` = EAN-13 real; sem EAN de fábrica → `identifier_exists=false` e omitir `gtin`. **Proibido gerar GTIN fictício.** `mpn` = OEM/part number. `brand` = marca real da peça (Hyundai Mobis, Kia, Bosch, Sabó, Mahle, MWM…).
3. **Google Product Category:** `Veículos e peças > Peças e acessórios para veículos > Peças para veículos motorizados` (ID 5613 ou subcategoria oficial específica).
4. **Páginas de política indexáveis antes do feed:** Troca/Devolução (CDC), Privacidade, Termos de Uso, Frete/Retirada em loja; rodapé com CNPJ e WhatsApp canônicos.

### B. Dados estruturados JSON-LD (`Product` + aplicação)
Cada página injeta JSON-LD válido (Rich Results Test sem erro):
- `@type: Product`; `sku` (código interno Bling); `mpn` (OEM/fabricante); `gtin13` **só se validado**.
- Especificação de Montadora/Modelo/Motorização/Anos/Posição via `additionalProperty`/`isSimilarTo`.
- **`offers`: só quando o preço for liberado.** Então: `priceCurrency: BRL`, `price` numérico, `availability: InStock`, `itemCondition: NewCondition`, `seller` = Mobis Autopeças (`taxID: 19.903.967/0001-01`). **Enquanto SEM preço: não emitir `offers`.**

## 3. Taxonomia: individualização por aplicação veicular (regra inviolável)
**Proibido agrupar** várias aplicações num SKU/anúncio genérico. Cada aplicação = **registro individual** com URL, título, H1, slug e metadados próprios. Mesma peça física em 2 veículos (HR 2.5 16V e Bongo K2500 2.5 16V) = **2 registros**, `codigo_oem` compartilhado, `sku` ou sufixo de aplicação diferenciando. (Alinha e reforça a regra mestra "1 SKU físico → N páginas por veículo".)

### A. Hierarquia (breadcrumb)
N1 **Sistema** (Motor, Injeção, Suspensão, Freios, Transmissão, Arrefecimento, Elétrica, Carroceria) → N2 **Subsistema/Grupo** (Bloco e Componentes Internos, Cabeçote, Turbo, Bicos/Bombas…) → N3 **Tipo de Peça** (Motor Parcial, Junta do Cabeçote, Bomba de Alta Pressão, Kit Embreagem…).

### B. Fórmula determinística de título/H1/meta (sem adjetivo promocional)
`[Tipo de Peça] + [Marca da Peça] + [Montadora] + [Modelo] + [Motorização/Válvulas/Combustível] + [Ano Inicial a Ano Final] + [Posição/Lado se houver] + [Código OEM/MPN]`
- Válido: `Motor Parcial Hyundai Mobis Hyundai HR 2.5 16V Diesel 2013 a 2024 OEM 211014A900`
- Válido (Kia, SKU/URL separados): `Motor Parcial Hyundai Mobis Kia Bongo K2500 2.5 16V Diesel 2013 a 2024 OEM 211014A900`
- **Proibido (agrupado):** `Motor Parcial Hyundai HR / Kia Bongo K2500 2.5 16V`

### C. Slug canônico
`/pecas/[sistema]/[montadora]-[modelo]-[motor]-[ano-inicio]-[ano-fim]/[tipo-peca]-[mpn]-[sku]`
- Ex.: `/pecas/motor/hyundai-hr-2-5-16v-diesel-2013-2024/motor-parcial-211014a900-sku1042`
- Só minúsculas, sem acento, hífen como separador, sem parâmetro dinâmico na canônica.

### D. Atributos obrigatórios por registro (banco/Bling/frontend) — sem nulo nem inferência sem fonte
`sku_bling` (único, imutável) · `titulo_individual` (fórmula 3.B) · `sistema` (enum) · `tipo_peca` · `marca_peca` · `codigo_oem` (+ `codigos_cruzados`) · `gtin_ean` (8/12/13/14 validado por dígito, ou null) · `veiculo_montadora` · `veiculo_modelo` · `veiculo_versao_motor` · `veiculo_ano_inicio` (int) · `veiculo_ano_fim` (int) · `posicao_aplicacao` (enum) · `condicao` (`Novo`/`Remanufaturado`) · `garantia_meses` (≥3) · `peso_bruto_kg` + `dimensoes_cm` · `url_imagem_principal` (HTTPS, fundo branco #FFFFFF, ≥800×800, sem marca d'água/texto/telefone/CNPJ).

> **Pendência de implementação:** vários atributos ainda **não existem no schema** do banco (sistema, tipo_peca, posicao_aplicacao, garantia_meses, peso/dimensões, codigos_cruzados). Isso é **migração** — mostrar o desenho e esperar aprovação do dono antes de criar.

## 4. Validação anti-bug / anti-alucinação (obrigatória para o agente)
1. **Bloqueio de não-verificado:** se `codigo_oem`, `veiculo_ano_inicio`, `veiculo_ano_fim` ou `veiculo_versao_motor` não estiverem explícitos no Bling/catálogo técnico, marcar `status: PENDENTE_REVISAO_TECNICA` e **impedir publicação**. Nunca preencher anos/motor por suposição.
2. **GTIN módulo 10:** validar checksum antes de gravar `gtin_ean`; se falhar, mover para `codigo_fabricante` e `gtin_ean = null`.
3. **Duplicidade veicular:** entrada com `/`, vírgula ou conectivo indicando mais de um modelo (`HR / Bongo`, `Hilux e SW4`, `Amarok / Ranger`) → **dividir em N registros** antes de slug/título/JSON-LD; `codigo_oem` compartilhado, `sku`/sufixo diferenciando.
4. **Sanitização de imagem:** rejeitar imagem com banner, selo de WhatsApp ou logo promocional para o feed do Shopping (viola Merchant; promocional é só para marketplaces tipo OLX).
5. **Preço/estoque:** quando o modelo comercial for ligado, `price`/`availability` do JSON-LD e do feed devem espelhar o Bling em tempo real, tolerância zero de divergência feed↔página. **Enquanto SEM preço, não há feed nem `offers`.**

## Situação atual (fato, não intenção)
- JSON-LD de aplicação já é `Product` + `mpn`, **sem `offers`** — compatível com a decisão SEM preço.
- Páginas públicas já não exibem preço nem `bling_id`.
- Falta: schema dos atributos (§3.D), fórmula de título/slug aplicada no gerador, páginas de política, reconciliação do NAP, e todo o trilho Merchant/Shopping (desligado até liberar preço).
