# CONTRATO UNIVERSAL DO PORTEIRO — 1 PRODUTO FÍSICO → N APLICAÇÕES (v1, revisão)

**Data:** 2026-11-21. **Escopo:** qualquer SKU de autopeças, qualquer cliente/loja e qualquer número de aplicações.
**Estado:** proposta versionada para revisão em PR; **não é implantação de nova trava no banco**, nem autorização de escrita, homologação ou publicação.
**Precedência:** ler junto com `AGENTS.md`, `CLAUDE.md`, `docs/conector-ia/porteiro-master-ofertas-por-aplicacao-oem-seo-bling-20261119.md`, `docs/conector-ia/porteiro-entrega-cadastro-por-sku-ou-descricao-20261119.md` e o Policy Engine; em conflito, a trava mais restritiva prevalece.

## 1. Identidade física imutável e duplicidade

- **Bling é o cadastro mestre físico/fiscal:** `loja_id + bling_id` identificam o registro; `sku` é código de busca e reconciliação, não chave globalmente única nem motivo suficiente para sobrescrever. Preservar NF de entrada, descrição original, marca da peça, SKU fornecedor, NCM/CEST/tributação (em acesso privado), GTIN real, peso/medidas verificadas, preço, estoque e situação.
- **Conecta.IA mantém uma única ficha mestre para cada produto físico autorizado** e N vínculos editoriais em `produto_aplicacoes`. `produto_aplicacoes.produto_id` sempre referencia o **mesmo** `produtos.id`; páginas, ofertas, filtros e banners não criam novo SKU, estoque, pedido, kit ou variação do Bling.
- **Duplicidade:** buscar por SKU exato incluindo ativo, inativo e excluído; verificar IDs e status. Se houver múltiplos registros, não selecionar automaticamente para escrita. Consultar ID ativo/histórico e NF; manter registro excluído como histórico, não reativar nem mesclar. Em caso de dois registros ativos conflitantes, **bloquear** proposta e enviar à revisão de identidade. Alias só depois de prova documental.
- **Produtos fisicamente diferentes:** Euro 3/5, 8/16V, interfaces, composição, fabricante ou conjunto não intercambiável podem exigir **SKUs físicos distintos** após confronto da NF, do código de fabricante e da peça real. Não presumir que duas versões são o mesmo item só por compartilhar família ou aplicação.

## 2. Camadas e campos de responsabilidade

| Camada | Campos e decisão |
| --- | --- |
| `produto_fisico` (Bling) | ID Bling, SKU, NF, NCM, GTIN, marca da peça, denominação comercial, dados logísticos, preço e estoque. Escrita de volta só por campo autorizado e com verificação pós-gravação. |
| `ficha_tecnica` (Conecta) | Composição `inclui/não_inclui`, norma de emissão comprovada, motor, cilindrada, válvulas, injeção, dimensões críticas, contraindicações, códigos do fabricante, evidências e fontes. Não confundir com o nome genérico do ERP. |
| `aplicacao[]` (Conecta) | Uma entrada por **montadora + modelo + versão + motor + ano/modelo/faixa + mercado**, inclusive regime e sistema de emissão quando relevante, OEM **da montadora por aplicação**, restrições e fonte. |
| `pagina_canal[]` (Conecta) | Título/H1, URL/slug, SEO, tags legítimas, banner por aplicação, foto verdadeira da mesma peça, política de conteúdo, indexação e autorização por canal (loja, PDV, marketplace, feed). |

**Montadora do veículo não é a marca/fabricante/importador da peça.** Hyundai/Kia identificam veículos; TRIM GO é marca comercial da peça; distribuidor/importador/país de origem devem possuir evidência própria e não aparecem em propaganda quando forem dados internos. `origem fiscal` é informação distinta de `origem comercial` e não se infere pela marca.

## 3. Algoritmo obrigatório por SKU (porteiro)

1. **Resolver identidade:** localizar `loja_id`, `bling_id`, SKU exato, situação, duplicidades e NF; identificar se automação está pausada. `pausado=true` permite pesquisa e resposta consultiva, **não** proposta/escrita por portas alternativas.
2. **Separar atributos físicos de hipóteses:** identificar o que é literalmente comprovado na peça/fabricante/NF, sem inferir `Euro`, 8/16V, OEM, origem, fabricante e composição por ano, logotipo, foto similar, NCM, anúncio de marketplace ou título sugestivo.
3. **Criar N candidaturas independentes:** para cada combinação real de montadora/modelo/versão/motor/mercado/anos, uma aplicação separada, vinculada ao mesmo `produto_id`. Nunca gravar “HR/Bongo” em um único campo de modelo. `ano_final=null` não significa “aplicável até hoje” e exige tratamento conforme o validador (não afirmar em produção sem evidência).
4. **Provar a compatibilidade específica:** consultar fonte forte (EPC/catálogo do fabricante da peça, manual da montadora, OEM documentado do **conjunto exato**); cruzamentos de juntas/filtros apenas orientam pesquisa da família de motor. Motor compartilhado, semelhança visual, código de outra peça e marca semelhante **não autorizam** a aplicação.
5. **Checar conflitos por versão:** cotejar código motor, emissões Euro, cilindrada, número de válvulas, injeção, geração, interfaces, composição e período. Se houver divergência entre o produto físico e a versão do veículo → `conflito`/`a_confirmar`, nunca “compatível”. **Não transformar a expressão “8V/Euro 3 versus 16V/Euro 5” em regra universal**; conferir cada família e ano em documentação.
6. **Verificar códigos:** separar `sku_bling`, `codigo_fabricante`, `oem_hyundai`, `oem_kia`, `similar`, `substituto` e `ean_gtin`. OEM do conjunto parcial só se a fonte provar a correspondência **dessa mesma composição**. OEM entre montadoras só é `compartilhado` se provado; sem confirmação guardar `null/a_confirmar`, jamais inventar.
7. **Fotos e logos:** usar foto **real** do SKU, com composição e licença verificadas, preservando aparência; imagem ilustrativa nunca é “foto real”. Para logomarcas, preferir os ativos originais autorizados do fabricante/montadora, mantendo versões históricas quando justificadas; não substituir marca da peça por marca da montadora. Sem foto aprovada → `foto_pendente`, sem bloquear a preparação da ficha.
8. **Propor e revisar:** `a_confirmar` por aplicação e por código, com fonte/data/revisor. Agente nunca autoaprova nem transforma hipótese em anúncio. Conteúdo de versão pendente permanece rascunho/noindex, sem alegação de compatibilidade.
9. **Projetar para canais:** dados físicos vêm do Bling; extensões técnicas ficam no Conecta e são exportadas **somente quando o canal está conectado/autorizado e o campo foi homologado**. Em `catalogo_informativo`: `preco_publico=null`, `estoque_publico=null`, sem `offers`, checkout ou feed comercial. Nunca assumir que marketplace/PDV externo recebe campos não suportados pelo Bling sem integração própria.
10. **Provar a entrega:** diferenciar `proposta_preparada`, `rascunho_real_gravado`, `aguarda_homologacao`, `aprovado`, `publicado_e_verificado` por operação real. Só declarar gravação após leitura do registro; só declarar publicação após acesso e verificação da URL.

### Explicação obrigatória ao cliente — o que o produto acompanha

Toda ficha física deve conter uma aba **"O que acompanha"**, independente das páginas de aplicação, com:
- descrição leiga do **tipo de conjunto** (motor parcial, completo, cabeçote, kit etc.), sem prometer peça pronta para funcionar se não houver comprovação;
- **itens declarados e itens comprovados separados**: componente, posição/função, quantidade, especificação/medida quando documental, estado `inclui|nao_inclui|nao_confirmado` e fonte;
- exclusões apenas quando documentadas; componente não mencionado é `nao_confirmado`, nunca uma exclusão inventada;
- texto técnico livre de invenções, cópia do fornecedor sem fonte ou generalizações da família (peça de outro SKU não compartilha automaticamente o conteúdo);
- uma composição física única reutilizada nas N páginas por veículo, com **compatibilidade separadamente homologada por versão**;
- conteúdo de composição ainda declarado apenas pelo lojista deve ficar em proposta para revisão, nunca virar `aprovado` silenciosamente.

**Exemplo específico para treinamento (não homologado):** [CI003696 — composição declarada de cabeçote, comandos, bronzinas, arruelas, jet coolers e virabrequim](../../mobis/catalogo/CI003696-ficha-proposta-web-20261119.md#declaracao-tecnica-do-lojista-em-21112026--detalhamento-do-que-acompanha-o-conjunto). A descrição do produto no site só poderá listar esses componentes como conteúdo confirmado após evidência da mesma versão física do SKU.

### Peças avulsas do mesmo fornecedor, com notas fiscais distintas

O porteiro deve suportar **vínculos de pesquisa entre produtos comerciais independentes**: cabeçotes, válvulas, comandos, bronzinas e demais peças avulsas podem ser vendidas separadamente por um fornecedor que também oferece um motor parcial montado, com notas fiscais próprias. Isso **não** os transforma em filhos de estoque do motor nem comprova que o item avulso seja o mesmo componente contido no conjunto. Comprovar separadamente: identidade e NF do avulso, OEM técnico por versão EPC, e composição/compatibilidade do SKU do motor. Cada peça mantém SKU/ID Bling/estoque/NF próprios quando efetivamente existentes; a referência externa pode ficar sem SKU no Bling, como candidato. Protocolo e testes: [peças avulsas, RPM e notas distintas](porteiro-epc-oem-por-componente-20261121.md#8-componentes-comercializados-avulsos--mesmo-fornecedor-notas-fiscais-diferentes-declaracao-do-lojista).

## 4. Contrato mínimo de saída (um registro mestre e lista de aplicações)

```json
{
  "loja_id": "<interno>",
  "produto_fisico": {
    "bling_id": "<ID real>", "sku": "<SKU existente>", "situacao": "ativo|inativo|excluido",
    "duplicidade": "nenhuma|historica|conflito",
    "marca_peca": "<documentada>", "composicao_status": "aprovada|a_confirmar"
  },
  "aplicacoes": [
    {
      "montadora": "<uma>", "modelo": "<um>", "versao": "<documentada>",
      "codigo_motor": "<documentado>", "cilindrada": "<documentada>",
      "valvulas": "<documentadas>", "emissoes": "<documentadas>",
      "ano_inicial": null, "ano_final": null, "tipo_ano": "comercializacao_brasil",
      "oem_montadora": null, "fonte_url_ou_documento": "<referencia verificavel>",
      "status": "a_confirmar", "pagina_indexavel": false,
      "seo": { "slug": "<unico>", "titulo": "<proposta>", "descricao": "<proposta>" }
    }
  ],
  "publicacao": "nao_publicado",
  "escrita_bling": "nao_executada",
  "pendencias": ["evidencias_individuais_por_aplicacao"]
}
```

**Esse JSON é um contrato de representação, não prova de endpoint já implementado.** Nunca ecoar campos financeiros, NF e fornecedor privado em resposta pública; `bling_id` pertence à camada autorizada.

## 5. Caso de regressão obrigatório — CI003696

- **Produto físico ativo de referência:** `bling_id=16719530075`, SKU `CI003696`, TRIM GO, motor parcial com cabeçote D4CB 2.5 16V Euro V. A descrição do ERP **não homologa** a aplicação completa.
- **Duplicata histórica:** `bling_id=16719458152`, registro excluído com mesmo SKU; resolver por ID/status sem reativar, fundir ou criar outro SKU.
- **Aplicação 1:** Hyundai HR D4CB 2.5 16V Euro V; rascunho com `status=a_confirmar` e slug próprio, OEM do conjunto a validar.
- **Aplicação 2:** Kia Bongo K2500 D4CB 2.5 16V Euro V; outro rascunho `a_confirmar`, slug e OEM da montadora próprios.
- **Proibido:** inferir homologação HR 2014 só porque o título diz “13/”; assumir OEM `2J0224AU00A` como equivalente; confundir foto genérica/W DIESEL com peça TRIM GO; usar ano final como fim de produção; publicar preço no modo informativo; aprovar sozinho; mover a categoria para outro motor sem prova.
- **Resultado esperado:** 1 produto físico, 2 candidaturas documentadas, 0 nova peça criada, 0 alteração no Bling, 0 aplicação publicável até homologação específica.

## 6. Matriz mínima de testes de aceite (para implementação do portão)

1. Um SKU + 2 versões comprovadas → **uma** ficha física e **duas** aplicações distintas, sem dobrar estoque.
2. Mesmo SKU com 1 registro ativo e 1 excluído → reconciliar por ID, reter histórico, não gerar erro falso de equivalência.
3. Mesmo SKU com 2 ativos inconsistentes → bloquear escrita até decisão de identidade.
4. “HR / Bongo” em um `modelo` → rejeitar; criar candidaturas separadas.
5. Descrição “Euro 5 16V” usada para propor “Euro 3 8V” sem prova do conjunto → rejeitar ou `conflito`; jamais aprovar automaticamente.
6. “Mesma junta, mesmo motor” → hipótese de família, **não** OEM nem aplicação do motor parcial.
7. OEM candidato sem fonte do conjunto → `a_confirmar`; não incluir em SEO ou anúncio.
8. Aplicação pendente → `noindex` e sem URL anunciando compatibilidade; ficha física informativa pode permanecer sem preço/foto conforme política da loja.
9. SKU em pausa → nenhuma gravação de proposta/imagem/código/aplicação; consulta permitida.
10. Foto real ausente → ficha técnica preparada sem inventar imagem.
11. Campos fiscais/estoque/custo do Bling → somente ERP/operador autorizado, jamais efeito colateral do enriquecimento.
12. Vários canais → projeções específicas sem clone físico e sem prometer integração não implementada.

## 7. Limites da presente revisão

Já existem `validarAplicacao`, `validarTextoSeo` e propostas `a_confirmar` no backend; **este documento não substitui travas de código nem altera a base**. Ainda é necessário incorporar e testar o gate **entre identificação do produto físico, cada aplicação e a aprovação/publicação**, sobretudo a verificação cruzada da composição e versão Euro, e assegurar que a fila do painel exiba/aprove `produto_aplicacoes` por SKU. Antes de liberar, testar com 2 SKUs de famílias diferentes e revisão humana, sem publicar.

## Fallback de identidade técnica: SKU de nota fiscal ou OEM (não são equivalentes)

Quando uma peça avulsa não possuir SKU conhecido, o porteiro deve pesquisar o SKU no Bling/RPM e na NF; o SKU só tem precedência quando **conferido**. Se não existir SKU fiscal confirmado, poderá criar um **alias de índice técnico** `OEM:<codigo>` exclusivamente para o componente/variante identificado em EPC com fonte, contexto de veículo, mercado, motor, ano-modelo, diagrama e posição. Esse alias **não** é SKU no Bling, NCM, GTIN, garantia de estoque, equivalência com o motor parcial, nem autorização para publicar. OEMs alternativos (junta de espessura diferente, classe de bronzina, revisão de comando) permanecem como candidatos separados até uma decisão técnica.

Um OEM de componente **nunca** substitui o OEM do conjunto montado. Cada linha de composição mantém relação de inclusão independente. O modelo de resolução, sem efeitos colaterais, está em `supabase/functions/_shared/aplicacoes/identidade_componente.ts`; a pesquisa inicial (não homologada) do CI003696 está em `docs/mobis/catalogo/CI003696-indice-rastreabilidade-oem-20261121.json`.
