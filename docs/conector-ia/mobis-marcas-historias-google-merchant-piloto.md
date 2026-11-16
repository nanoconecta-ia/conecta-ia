# Piloto MOBIS — Marcas, histórias, procedência, Nano e Shopping

**Ambiente:** ramificação de revisão `feature/mobis-ficha-real-aplicacao`, PR #399. **Não publicar / não enviar Merchant até homologação.**

## Implementações
- Menu **Marcas dos produtos** com agrupamento conservador por caixa/espacos; alias somente se `marca_aliases.estado=aprovado` com evidência. Nome parecido (TRIMGO, TRIMIGO, TRIM GO) não é equivalência por si.
- Página filtrada por marca, produto físico e aplicações do mesmo SKU. Marca comercial verdadeira do item prevalece sobre montadora de aplicação.
- História editorial documentada de **montadora/modelo** e **marca da peça**, em painéis internos da ficha e no catálogo da marca. Tabelas `catalogo_historias` e `marca_identidade_publica`; conteúdos aprovados visíveis em produção, `a_confirmar` apenas em prévia.
- Rascunhos iniciais: HR (Hyundai), Bongo K2500 (Kia), L200 (Mitsubishi) e MAHLE Metal Leve. Nenhum comprova compatibilidade, fim da geração ou OEM.
- Fotografias reais de veículos e logos somente através de `veiculo_midias` com documentos/licença e aprovação. 4 modelos receberam slots de revisão; **nenhuma fotografia/logomarca foi homologada**. Fallback textual, nunca veículo 3D fictício.
- Categorias continuam com seus ícones ilustrativos. Scott Nano é guia visual de três gestos e mensagens fixas, não consultor de compatibilidade por si só. Arte humana 3D original gerada para conceito; ainda não armazenada como ativo publicável do site.
- Flash rotativo do cabeçalho reaproveita `loja_banners` para produtos e lê `marca_campanhas` somente com aprovação, datas e marca visível. Sem oferta sintética. Alterar arte não altera SKU/estoque/preço.
- `produto_procedencia`: originalidade (`genuina_montadora` / `original_fabricante` / `reposicao_independente`), condição de importação, país e importador em campos distintos. Publicar apenas quando `estado='aprovado'`. O prefixo CI não estabelece origem industrial.
- CI002916: no Bling, SKU/ID preservados. NCM 8408.90.90 copiado à tabela `produto_fiscal` com origem `bling_erp` e status `a_confirmar`; pode ser mostrado como **NCM cadastrado no ERP**. País China/importada consta somente como declaração do lojista pendente na camada interna; importador legal não homologado.
- `agente_prompts`: `nano_catalogo_mobis` v1 proposta e não ativada automaticamente.

## Fonte & marketing: regras verificadas
- Google Merchant: identificador item até 50 caracteres, título até 150 (70 recomendado), descrição até 5.000 (500–1.000 recomendados). Para conteúdo gerado por IA utilizar os atributos estruturados aplicáveis.
- A marca do feed é a **marca real da peça**, não o logotipo Hyundai/Kia/Mitsubishi usado para explicar aplicação. Não criar GTIN/MPN nem vender peça genuína sem prova.
- `googleCatalogoMobis.ts` inclui validador de formato/GTIN, aprovação, preço, disponibilidade e foto real.
- História e material educativo podem ajudar a relevância orgânica, **não garantem indexação nem menor CPC**. Fichas `#/a/` ainda precisam de URLs rastreáveis, SSR/prerender, canonical, sitemap e markup Product com foto real e Offer apenas quando disponível e comprável.

## Fontes consultadas
- Hyundai HR, lançamento no Brasil: https://www.hyundai.com.br/universo-hyundai/veiculos/veiculo-utilitario
- Kia K2500, Brasil e linha histórica: https://www.kia.com.br/kianews/kia-brasil-lanca-bongo-k2500-4x4-2024
- Mitsubishi, história corporativa e Brasil: https://www.mitsubishimotors.com.br/quem-somos
- Mitsubishi L200, produção no Brasil: https://motor1.uol.com.br/features/240969/historia-mitsubishi-l200/
- MAHLE Metal Leve: https://ri.mahle.com.br/a-empresa/historia/
- Merchant requisitos: https://support.google.com/merchants/answer/7052112?hl=pt-br
- Google Search Product/Offer: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- Lei 8.078/1990: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm

## Bloqueadores para publicar
1. Teste build/unit/DB verde no PR, navegação e acessibilidade desktop/celular.
2. Fotografias PNG reais e logos originais com identidade correta, geração/ano e direitos confirmados. Não incorporar logos de B2B concorrente sem verificar fonte/uso.
3. Corrigir modelos faltantes (Pajero Sport) e separação de FKs marcas versus montadoras.
4. Homologar OEM por versão e códigos cruzados; nenhum dos 17 vínculos de aplicações aprovado ainda.
5. Vincular notas de entrada ao produto fiscal e procedência; validar país de fabricação, originalidade e importador por documento.
6. Ativar prompt do Nano apenas após revisão humana, não executar gravações fiscais ou estoque.
7. Publicação de catálogo, anúncios e banners só com autorização explícita após homologação, disponibilidade e preços consistentes.

**Sem alterações no Bling de estoque, NF, SKU, preço ou tributos neste incremento.**
