# REGRA MESTRE MOBIS — um produto físico no Bling; um cadastro editorial por aplicação no site
**Data:** 19/11/2026. Aplicação universal em motor, cabeçote, filtros, suspensão, transmissão e outras famílias, para diesel, gasolina ou flex.
**Status:** orientação de negócio/contrato de execução para o porteiro; não autoriza gravações no Bling, desbloqueio de automação, publicação, indexação ou atribuição OEM automática.

## Decisão de arquitetura e sua fonte
**Bling é a referência do produto físico e fonte de conhecimento documental primário**: nota fiscal de entrada, item da nota, marca, SKU/código do fornecedor, descrição do produto comprado, GTIN quando existente, custo/tributação em acesso privado, preço de venda interno, estoque real e histórico. As NFs não foram consultadas nesta definição; o agente deve conferir a nota concreta antes de citá-la como evidência.

**Conecta.IA é a fonte das páginas editoriais por aplicação, relações e evidências:** uma peça física poderá ter **N cadastros de página** para veículos diferentes, e em cada página: título próprio, descrição própria, ano/versão/motor, OEM por montadora, referência equivalente, contraindicação, características, ícones de sistema, banner por veículo, etiquetas SEO e slug/URL próprios. Todas as páginas conservam `loja_id + bling_id + sku_origem` da **MESMA peça física** e nunca duplicam saldo ou faturamento.

- **Não criar um segundo SKU de estoque no Bling só porque a peça atende duas montadoras.** O mesmo CI003696 físico origina 2 páginas de aplicação. **Se houver produtos fisicamente distintos, notas/códigos distintos, composição ou versão não intercambiável,** cada um possui seu próprio SKU e vínculo com NF real.
- **Dados de aplicação no Bling como conhecimento:** o porteiro deve sugerir texto técnico, tags/observações e aliases por veículo/código, vinculados ao cadastro de referência da peça, **mas não altera o ERP nem seus dados fiscais/estoque sem autorização expressa de campo pelo lojista**. Não converter relação de página em clonado de produto, kit, composição ou variação com saldo independente.
- Duplicados legados no ERP: registrar de-para / alias de histórico somente após comprovar equivalência, sem deletar ou juntar produtos sem aprovação. Priorizar NF/documento de fornecedor do objeto físico e EPC/OEM oficial do veículo; o nome do fornecedor pode ser incompleto.

## Regra por página independente (cada veículo/versão)
Gerar e auditar para cada aplicação:
1. **Identidade e ligação:** `loja_id,produto_fisico_id,bling_id,sku_fornecedor,nota_entrada_ref_interna,marca_peca,codigo_fabricante`, com separação entre fonte interna e exposição pública; nunca revelar NF, custo ou fornecedor privado.
2. **Veículo BR específico:** `montadora,modelo,versao,ano_inicial_aplicacao,ano_final_aplicacao,geracao,tracao,combustivel,codigo_motor,cilindrada,cilindros,valvulas,norma_emissoes,injecao` (Bosch/Delphi/outro **quando demonstrado**). O ano final do catálogo aftermarket NÃO é a data final de fabricação. Ausente = não confirmado.
3. **OEM da montadora / EPC:** entidade por `{montadora,codigo,descricao_original,desenho/conjunto,evidencia_url,pagina,ano_versao,status}`, separada de código Trim Go/fornecedor, EAN/GTIN, números de juntas/filtros e códigos de concorrentes. Comparar se **o mesmo OEM verificado corresponde ao MESMO conjunto físico** para HR e Bongo; somente então renderizar `OEM compartilhado Hyundai/Kia: [codigo]`. Se OEM diferentes: exibir cada código na página correspondente, indicar intercambialidade somente com prova de aplicação exata. **Sem código verificado: deixar OEM indisponível/a confirmar (não publicar dígitos presumidos).**
4. **Composição e compatibilidade:** declarar `inclui`, `não inclui` quando documentados; aplicação homologada, compatível sob condições ou a confirmar, e exclusões em veículos/anos/versões que não atendem. Aplicação de jogo de juntas, filtros, pistões ou bronzinas para **família** do motor não homologa automaticamente motor parcial de fornecedor diferente com cabeçote; validar interfaces/periféricos e código de conjunto.
5. **Ficha técnica e SEO únicos da página:** H1 com `peça + veículo + código motor + cilindrada + válvulas + fase de emissões + marca peça`; descrição técnica legível e original, sem repetir nomes artificialmente; slug estável por versão `[sku]-[montadora]-[modelo]-[motor]-[euro]`; título SEO, meta description até ~155 caracteres (limite editorial, não promessa Google), breadcrumbs `Montadora > Modelo > Sistema > Peça`, indexação/canonical próprio **apenas depois de aplicação aprovada e conteúdo suficientemente diferenciado**; links de variantes e SKU físico único; imagens aprovadas, imagem ALT descritiva se existir, banner específico do veículo. Termos de pesquisa são derivados de nomes comuns reais, sinônimos, `SKU`, `D4CB`, `2.5 16V`, modelo e OEM confirmado; **não usar meta-keywords, SEO por repetição, dados de OEM falsos ou páginas quase idênticas com nomes trocados**.
6. **Modo catálogo enriquecido:** página informativa pode existir SEM preço e foto; a publicação da **aplicação por veículo** requer aprovação de compatibilidade. Sem prova, fica `a_confirmar` e `noindex` e não aparece como página homologada. Ficha informativa do SKU principal pode mostrar fatos confirmados sem prometer encaixe. Preço e saldo nunca aparecem no modo informativo mesmo quando têm valor no Bling; não gerar `offers`, botão comprar, Merchant feed.
7. **Entrega verificável:** por SKU físico entregar a identidade da NF/Bling, 1 ficha mestre e todas as páginas por aplicação; por página: `titulo,h1,slug,meta_title,meta_description,termos_seo,especificacoes,oem_montadora,oem_compartilhado,refs_fabricantes,fonte,status,imagem,link`. Só dizer `pagina_gravada` ou `publicada` depois de resposta de gravação/leitura de volta/abertura da URL; documento no GitHub não é publicação.

## Exemplo CI003696 — motor parcial com cabeçote Trim Go
**Fonte do ERP verificada via Bling API 19/11/2026:** `produto.id=16719530075`, `codigo=CI003696`, nome `MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE - MARCA: TRIM GO`, NCM `8408.90.90`. Usuário digitou também `CI 0033696`; conferir na NF se for alias real, mas **não adotar outro SKU** sem confirmação; cadastro vigente é CI003696.

### Página 1 — Hyundai HR
- `slug=ci003696-hyundai-hr-d4cb-16v-euro-v`
- **H1:** Motor parcial com cabeçote Trim Go para Hyundai HR 2.5 D4CB 16V Euro 5 — CI003696
- **Título SEO candidato:** Motor parcial Hyundai HR 2.5 D4CB 16V Euro 5 | Trim Go
- **Meta description candidata:** Motor parcial com cabeçote Trim Go 2.5 D4CB 16V Euro 5 para Hyundai HR. Confira versão e código do motor. SKU CI003696 na MOBIS.
- **Termos sem duplicação:** `motor HR 16V Euro 5`, `motor parcial Hyundai HR D4CB`, `motor 2.5 HR com cabeçote`, `Trim Go CI003696`, `motor HR Euro V`.
- **Referências de configuração:** HR 2.5 D4CB e injeção Delphi **em ficha CAOA da versão**. `OEM_Hyundai_motor_parcial=pendente` (não é código de pistão/cabeçote/junta). Composição/encaixes do CI003696 a homologar antes de marcar compatível.
- `status_aplicacao=a_confirmar`, `pagina_indexavel=false` até homologação e autorização.

### Página 2 — Kia Bongo K2500
- `slug=ci003696-kia-bongo-k2500-d4cb-16v-euro-v`
- **H1:** Motor parcial com cabeçote Trim Go para Kia Bongo K2500 2.5 D4CB 16V Euro 5 — CI003696
- **Título SEO candidato:** Motor parcial Kia Bongo K2500 2.5 D4CB 16V | Trim Go
- **Meta description candidata:** Motor parcial com cabeçote Trim Go para Bongo K2500 2.5 D4CB 16V Euro 5. Consulte ano, versão e composição. SKU CI003696.
- **Termos sem duplicação:** `motor Bongo K2500 16V`, `motor parcial Kia Bongo D4CB`, `motor 2.5 Bongo Euro 5`, `motor Kia K2500 com cabeçote`, `Trim Go CI003696`.
- **Referências de configuração:** versões Bongo/K2500 podem ter injeção Bosch, dependendo da ficha/ano; registrar somente contexto correto. `OEM_Kia_motor_parcial=pendente` (não homologar com código de componente separado).
- `status_aplicacao=a_confirmar`, `pagina_indexavel=false` até homologação e autorização.

### Triangulação de aplicação — EVIDÊNCIA DE FAMÍLIA, NÃO OEM DO CONJUNTO
- Vedamec, juntas Hyundai/Kia 2023: https://www.vedamec.com.br/files/catalog/HYUNDAI-2023.pdf — `HR 2.5 16V D4CB Euro 5 13/22` e `Bongo/K2500 2.5 16V D4CB Euro 5 13/22` aparecem no mesmo agrupamento de junta.
- Juntalima catálogo Hyundai/Kia: https://www.juntalima.com.br/upload-adm/subcat/_Kia.pdf — referência da família 2.5 16V D4CB em HR e K2500.
- Motorservice KSPG: https://www.catweb.ms-motorservice.com.br/detalhes.php?cw_pgAtual=95&cw_produtoAtivo=CodigoProduto%3C%212%21%3E5395 — catálogo de peças com configurações HR/Bongo D4CB; ano final reflete o período na base deste fabricante, não término de produção.
**Resultado correto:** propostas de duas aplicações **fortemente plausíveis** da família D4CB; **nenhum OEM verificado do conjunto CI003696** nem equivalência de montagem certificada só por catálogos de junta.

## Testes de aceite aplicáveis a qualquer produto
- Bling tem 1 item físico com NF + SKU fornecedor; 2 ou N páginas só se criar e aprovar aplicações; ambas vinculadas ao mesmo saldo.
- HR e Bongo exibem títulos e tags/SEO diferentes, sem clonar texto; as duas devem aparecer em busca interna por modelo/SKU/OEM correto.
- OEM de outra peça (junta/pistão/cabeçote) não se transforma em OEM do motor parcial; sem OEM verificado campo vazio/pendente.
- Um OEM comprovadamente comum é identificado nas páginas **com fonte**; se OEM varia por montadora, não colapsar em um único suposto código.
- Código digitado divergente não substitui o SKU do Bling sem confronto com nota.
- Produto informativo sem preço ou foto permanece acessível quando autorizado, mas aplicação não homologada permanece `noindex` e sem anúncio.
- Com o agente pausado, o porteiro pode apenas apresentar proposta externa, sem editar Bling ou páginas internas por SQL.
