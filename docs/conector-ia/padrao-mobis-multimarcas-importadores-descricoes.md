# MOBIS — Padrão multimarcas, importadores, códigos comerciais e descrições

**Estado:** especificação de catálogo em revisão, anexada ao piloto CI002916; sem migração ou anúncio publicado.

## 1. Identidade física x origem comercial x aplicação
Não confundir papéis:
- **Fabricante industrial:** quem fabrica a peça; pode ser distinto de quem a embala, importa ou vende.
- **Marca comercial do produto:** o que está identificado na peça, na embalagem ou em documento válido.
- **Importador legal:** só vincular após declaração ou documento fiscal/comercial que o identifique como tal.
- **Fornecedor/distribuidor:** o vendedor da nota de entrada para a MOBIS; pode ter código próprio de catálogo e de pedido.
- **Montadora do veículo:** dona do código OEM original de referência de aplicação; não implica peça genuína.
- **Comerciante concorrente:** seus anúncios ajudam a levantar códigos *candidatos*, mas não demonstram fabricante, importador, originalidade ou intercambialidade.

Um código é uma relação **(entidade emissora, tipo de código, valor normalizado, valor original, evidência, data, status)**, não um novo SKU físico. Códigos coincidentes entre distribuidores nunca são mesclados somente por texto.

### Estado auditado
- Tabelas existentes: `produtos`, `produto_origem`, `produto_codigos`, `marca_evidencia`, `produto_enriquecimento`, `produto_aplicacoes`, `fornecedores_oem`.
- `produto_origem` possui `mestre_id`, `produto_id`, `sku_origem`, `referencia_fornecedor` e `nota_entrada`, mas **não** possui uma entidade de fornecedor normalizada. É necessário projetar esse vínculo antes de escalar.
- O `CI002916` está vinculado ao Bling, marca Trim Go; fornecedor registrado: **Quatro Distribuidora de Auto Peças Ltda. - EPP**, código do fornecedor **CI003695**, que **não está confirmado como equivalência** ao SKU. Não marcar a Quatro como fabricante ou importadora sem prova.
- `Mundo Autopeças` e `Mini Parts` são nomes fornecidos pelo lojista para pesquisa; **não estão identificados como entidades homologadas**, nem há códigos deles comprovados neste piloto.
- Não adicionar marca ou fornecedor sem razão social/identificador comercial e evidência.

## 2. Regra de cruzamento e governança
- `sku_interno`: chave do produto mestre MOBIS/Bling e estoque.
- `fabricante_ref`: referência do fabricante, verificada no catálogo oficial da marca.
- `distribuidor_ref`: referência **desse distribuidor específico**, vinculada ao documento e à entidade emissora.
- `oem_ref`: código original de montadora por aplicação/geração; não substituir por nome da marca da peça.
- `similar_ref`: candidato entre produtos de fabricantes diferentes, condicionado a equivalência dimensional e de aplicação validada.
- `gtin`: código de barras atribuído ao item verdadeiro; validar dígito/embalagem e nunca criar a partir de referência ou SKU.
- Código e origem fiscal do documento ficam privados nos sistemas internos, não em título de busca.
- Suportar N:N entre fabricante/distribuidor e produto, com histórico por nota, sem fundir estoques distintos.
- OEM e referência similar `a_confirmar` **não** podem promover página para indexável ou anúncio Google Ads.

## 3. Modelo universal de descrição do produto físico
**Nome curto (PDV/ERP):** `[TIPO] [ESPECIFICAÇÃO DECISIVA] [MARCA REAL] [CÓDIGO FABRICANTE/SKU]`.
Não transformar a descrição curta em uma lista extensa de veículos.

**Descrição técnica mestre (bloco/ERP):**
1. Tipo exato, estado e marca documentada; fabricante/importador somente se comprovados.
2. Composição real que acompanha (motor/cabeçote) **ou** construção, elemento filtrante e válvulas (filtro).
3. Medidas exatas documentadas, unidade e tolerância; não inferir medidas de embalagem como medidas da peça.
4. OEMs homologados e referências alternativas com entidade emissora, fonte, confiança e ressalva.
5. Instruções de instalação, manutenção e boletins do fabricante; sem garantias técnicas absolutas.
6. Restrições: motor, alimentação, geração, chassi, emissões, sensores, rosca, vedação, pressão de válvulas e periféricos conforme categoria.
7. Origem e registro fiscal mantidos em campos internos da nota; não sobrescrever NCM, CFOP, GTIN nem fornecedor pelo enriquecimento.
8. Atualização com revisão humana e trilha de evidências.

## 4. Descrição por aplicação — página individual
- `H1`: `[TIPO PEÇA] para [MONTADORA] [MODELO] [MOTOR] [MARCA REAL] [REF FABRICANTE]`.
- Especificar **ano inicial e final da versão HOMOLOGADA**; anos pesquisados ainda não aprovados recebem rótulo de revisão.
- Exibir OEM da montadora em destaque **somente homologado**. Código SKU próprio em seção técnica.
- Foto real autorizada do item físico como foco; foto de veículo opcional, licenciada, pequena e contextual.
- Exibir alternativas concorrentes somente com sua marca/código/preço/estoque reais e aplicação validada.
- Uma descrição distinta para o veículo, SEM afirmar equivalência não demonstrada.
- Metadados SEO com conteúdo específico; evitar criar páginas idênticas ou indexar candidatas.

## 5. Motor parcial — exemplo mestre CI002916 (somente dados documentados)
**Descrição curta:** `MOTOR PARCIAL NOVO C/ CABEÇOTE 2.5 8V 4D56/D4BH TRIM GO CI002916`.

**Descrição longa:** `Motor parcial novo com cabeçote, marca registrada Trim Go, família 4D56/D4BH 2.5 diesel 8V. Cadastro de origem informa bloco, virabrequim, bronzinas, bielas, pistões com anéis, jet cooler, cabeçote montado, parafusos e junta. Conferir composição física/nota e especificação do fabricante antes da venda. Aplicações Hyundai HR, Kia Bongo e Mitsubishi L200/Pajero sob revisão por geração e chassi; OEMs ainda não homologados. Não presumir intercambialidade de motores somente por família ou aparência.`

**Código da Quatro:** `CI003695`, armazenado como referência de fornecedor `a_confirmar`, não como novo SKU ou intercambialidade comprovada.

## 6. Filtro de óleo — padrão para marcas concorrentes
**Descrição curta modelo:** `FILTRO ÓLEO BLINDADO [ROSCA] [MARCA] [CÓDIGO]`.
**Descrição longa modelo:** `Filtro de óleo lubrificante [blindado/refil], marca [MARCA], referência [REF]. Dimensões [ALTURA × DIÂMETRO], rosca [MEDIDA], junta [MEDIDAS], pressão da válvula de desvio [DADO DOCUMENTADO], antirretorno [CONFIRMADO OU NÃO INFORMADO], GTIN [VALIDADO OU NÃO INFORMADO]. Aplicações e códigos OEM detalhados nas fichas homologadas. Verificar junta, rosca, diâmetro, válvulas, intervalo de troca e restrições por motor antes de instalar.`
**Exemplo apenas de identificação:** `MAHLE OC1224`. Não cadastrar anos amplos, OEMs candidatos, válvulas ou equivalências sem confirmação em catálogo MAHLE atual. Consultar catálogo técnico oficial: https://catalogo.mahle.com/.

## 7. Vínculo com Bling e Conecta.IA
- Bling: **fonte dos dados comerciais/fiscais** e código interno de cada produto. Nada de estoque fictício.
- Conecta.IA: **motor de relacionamentos e homologação**, sem criar clones físicos a cada aplicação.
- Vitrine: aplicação individual autorizada, marca da peça verdadeira, preço próprio de cada **produto mestre**.
- Vários fabricantes atendendo um mesmo veículo são vários SKUs físicos independentes. Preço comercial não se mistura entre eles.
- Fornecedores diferentes podem ofertar o mesmo SKU físico se for o mesmo item comprovado, sem colapsar divergências de lote, marca, versão ou procedência.

## 8. Antes de virar implementação em lote
- Identificar legalmente e documentalmente Mundo Autopeças, Mini Parts e demais distribuidores indicados pela MOBIS.
- Verificar representação/razão social, catálogo e código de cada fornecimento, sem assumir direito sobre imagens/logos externos.
- Modelar entidade de distribuidor vinculada a `produto_origem`; usar migração revisada com testes e políticas RLS antes de escrita em produção.
- Confirmar por amostra motor CI002916 + filtro real cadastrado no Bling; não criar MAHLE OC1224 somente por texto externo.
- A equipe aprova vínculos, especificações, descrições e campanhas antes de publicar.
