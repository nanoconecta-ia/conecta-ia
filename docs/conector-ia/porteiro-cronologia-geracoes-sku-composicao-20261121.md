# Porteiro — cronologia de fábrica, equivalências entre SKUs e componentes avulsos

**Escopo:** norma operacional de pesquisa e proposta, para **qualquer produto** no Conecta.IA. **Revisão documental**, não migração, publicação, homologação automática ou gravação no Bling. Complementa o contrato universal, o protocolo EPC por componente e a genealogia veicular brasileira.

## Princípio: três árvores NÃO são a mesma coisa

1. **Genealogia de fábrica (veículo):** `montadora → modelo/mercado → projeto/geração → revisão/fase → versão/ano-modelo/VIN → motor e configuração`. A mesma família motriz pode atravessar gerações com peças distintas. Anos civis sobrepostos são válidos; um ano de transição **não prova** compatibilidade de todos os veículos daquele ano.
2. **Árvore de produto comercial (SKU):** `loja/bling_id/SKU físico → marca comercial/código fabricante → escopo do conjunto → composição documentada → N candidaturas de aplicação`. Cada SKU físico mantém entrada fiscal e estoque próprios; um SKU pode servir a gerações distintas **somente com evidência para cada geração**.
3. **Grafo técnico de peças/códigos:** `OEM da posição EPC da versão → código genuíno, OEM/OES comprovado ou aftermarket independente → SKU comercial distinto`. Referência de pesquisa não é equivalência; componente interno não se transforma em motor completo; código substituto/sucessor requer documento de supersessão e sua validade.

**Proibição central:** NÃO promover `motor D4CB` ou `ano 2013` a uma homologação universal de HR, Bongo ou toda a geração. Compatibilidade é `SKU físico + nível do conjunto + versão/geração/mercado + janela temporal (e VIN quando aplicável)`, com fonte **do produto exato**, não apenas da família.

## Procedimento obrigatório do agente (ordem)

**1 — Identidade física e pausa.** Consultar `conecta.catalogo.ver`, `bling.produtos.consultar` e espelho autorizado para `loja_id + bling_id + sku`; reconciliar registros ativos/inativos/excluídos e NF sem expor custo. Se `produto_automacao.pausado=true`, o agente **somente lê e relata**: não propõe no banco, não cria SKU, não grava, não publica.

**2 — Fixar o nível da peça (escopo).** Distinguir: motor curto **sem cabeçote**, motor parcial **com cabeçote**, motor completo, cabeçote montado, bloco isolado ou outro componente avulso. Para o CI003696, o escopo declarado é `motor_parcial_com_cabecote`; não deduzir conteúdo por imagem genérica, anúncio ou referência `SHORT ENGINE ASSY`. Confrontar packing list/documento do importador, NF e foto real da unidade; marcar cada inclusão e exclusão como `declarado`, `confirmado` ou `não_confirmado`.

**3 — Construir linha do tempo da fábrica por configuração:** para **cada montadora e mercado**, levantar a árvore:

```text
montadora / modelo / país BR
  └─ projeto ou geração [ID comprovado; nome popular separado]
      └─ fase/revisão técnica [início, fim e tipo de ano]
          └─ motorização/versão [código motor, cilindrada, válvulas,
                               emissões Euro/Proconve, injeção, interfaces]
              └─ aplicação do SKU [anos-modelo, VIN/série ou transição
                                   documentada, restrições, fonte, status]
```

Registrar **separadamente** `ano_fabricacao`, `ano_modelo`, `inicio_comercializacao_BR`, `ultimo_ano_coberto_catalogo`, `fim_fabricacao` e `data_documento`. Nunca converter um no outro. `fim=null` significa **não comprovado**, não fabricação em andamento. Um mesmo ano pode ter versões de projetos antigos e novos; não construir intervalos contínuos por aproximação. Geração do fabricante, facelift comercial e revisão de motor podem ter fronteiras diferentes.

**4 — Testar a aplicação por geração, não por semelhança.** Para cada `(SKU, montadora, modelo, projeto, revisão, motor, faixa, mercado)`, confrontar normas Euro/Proconve, 8V/16V, ECU/injeção, interfaces de cabeçote/bloco, composição, código de motor, dimensões e faixa VIN/série quando aplicável. Exigir catálogo do **fabricante/importador daquela peça com código próprio** ou cruzamento direto documentado com referência original daquela versão, mais revisão humana. Um EPC da versão confirma o **OEM da posição do veículo**, mas não certifica que o motor importado esteja montado com aquelas peças. Se houver conflito ou fonte incompleta, `a_confirmar` (ou `rejeitado` se divergência demonstrada). Não inventar anos.

**5 — Identificar *outros motores importados* por SKU independente.** Pesquisar o código do conjunto, marca, código do fabricante e descrição em Bling, catálogo do fornecedor/importador e índices aprovados. Para `SKU_A ↔ SKU_B`, classificar exatamente um vínculo direto:
- `mesmo_conjunto_equivalente`: só após **mesmo escopo físico**, composição/conjunto, dimensões/interfaces e aplicações específicas serem demonstrados por documentos de **ambos** os produtos; NFs e estoques continuam separados;
- `referencia_cruzada_candidata`: catálogo anuncia correspondência, mas identidade, composição ou versão ainda sem prova;
- `sucessao_codigo_fabricante_ou_OE`: não é equivalência automática; requer boletim do titular (montadora/fabricante) com `substitui/substituido_por`, sentido da relação, revisão e **vigência por versão/mercado**;
- `nao_equivalente_por_escopo`: motor curto, cabeçote avulso ou item interno **nunca** equivalem ao motor parcial completo, mesmo compartilhando OEM de uma posição.

A relação é **direta e contextual**: `A→B` e `B→C` não autorizam `A→C`; duas peças com um OEM de componente comum não tornam dois motores equivalentes.

**6 — Localizar os componentes comercializados avulsos.** Para cada linha real da composição, identificar `posição/quantidade`, OEM EPC do **componente naquela configuração**, código próprio da marca do avulso, SKU fiscal da peça avulsa, fornecedor/documento e status de inclusão no conjunto. O avulso tem **cadastro físico, NCM, NF e estoque próprios** se existir no Bling; se só aparecer no RPM/fornecedor, é referência externa, não criar SKU. Três perguntas separadas:
- A **peça avulsa** existe como item comercial documentado?
- O **OEM EPC** corresponde àquela posição e àquela geração?
- O **componente avulso** é exatamente equivalente ao componente **realmente presente** no conjunto importado?

Aprovar uma não aprova as outras. Quando faltar packing list/foto/medida, registrar `candidato_componente`; não afirmar que o avulso vem dentro do CI003696 nem transferir suas aplicações ao motor.

**7 — Separar classe de fabricante.** Registrar `montadora`, `marca da peça`, `fabricante efetivo`, `fornecedor/importador` e `lojista` como entidades distintas. Genuíno/OE, OEM de primeiro equipamento e OES exigem prova do **fabricante, peça, versão e período de fornecimento**; importado/aftermarket pode cruzar códigos sem ser homologado pela montadora. A Mobis é **revendedora**, não fabricante. Logotipo do fabricante só com ativo original autorizado.

**8 — Entregar matriz auditável, sem alterar o catálogo por inferência.** Exigir `fonte_documental + localizador + data + mercado + geração + versão + intervalo/tipo de ano + escopo + situação + revisor` para cada aresta e candidatura. Dar resultados em três quadros separados:
- **Cronologia das aplicações** por montadora/geração/fase, com alternativas nos anos de transição e status individual;
- **Equivalências de motores completos/parciais** por SKU e marca, com mesmo nível de conjunto e evidências independentes;
- **Componentes avulsos** da composição, com seu SKU próprio, OEM por componente, vínculo ao conjunto e NF/estoque **somente no ambiente privado**.

Se só houver dados incompletos: `pesquisa_com_candidatos` e lista de documentos faltantes. Ficha geral de catálogo informativo não autoriza anúncio de compatibilidade. Não publicar OEM/geração/código candidato em SEO, banners ou WhatsApp automático. **Somente humano autorizado homologa cada aplicação e cada aresta**; aprovação de um período não propaga aos demais.

## Projeção para Conecta.IA e loja: componente avulso NÃO é item incluído na oferta

**Painel interno do porteiro (consulta/proposta):** além da cronologia, exibir uma **lista da composição do SKU**, com um registro por componente/posição. Cada linha separa: `OEM_original_do_componente_na_geracao`, `codigo_do_fabricante_avulso`, `sku_avulso_no_Bling` (opcional), `marca_do_avulso`, `quantidade_declarada/confirmada`, `incluido_no_conjunto?`, `equivalencia_direta_com_o_avulso?`, `fontes`, `status` e `revisor`. O mesmo componente pode corresponder a **múltiplos SKUs independentes de fabricantes diferentes**, com cada vínculo e fonte aprovados separadamente; escolher um deles por marca ou fornecedor comum é proibido.

**Vitrine pública (somente após os portões existentes):**
- A aba **"O que acompanha"** mostra a composição comprovada do **SKU conjunto**. Se um componente não estiver comprovado, usar `a confirmar` e nunca descrevê-lo como incluído.
- Uma aba separada **"Componentes avulsos relacionados"** poderá exibir links `#/p/mobis/<SKU_AVULSO>` **apenas** se: (a) o avulso for produto físico real e publicado no próprio tenant; (b) o vínculo direto com a **posição e geração** estiver aprovado por humano e possuir fonte documental; (c) o escopo e o nome estiverem claros como **peça vendida separadamente**. Se faltar qualquer condição, só permitir pesquisa interna, sem link público.
- Cada cartão público do avulso terá **seu próprio SKU/marca/foto/estoque/preço autorizado**. A foto do motor parcial não substitui a foto do avulso; a marca da montadora não se torna marca do fabricante da peça.
- **Nunca** contabilizar quantidade avulsa no estoque do motor, somar preços automaticamente, criar kit, compartilhar NF/GTIN/NCM, prometer que o avulso acompanha o conjunto, nem criar automaticamente banners de componentes a partir dos três banners do motor CI003696.
- Códigos OEM por componente podem aparecer apenas **no contexto técnico daquele componente e da aplicação aprovada**, nunca como OEM do motor parcial inteiro. Se o status for `a_confirmar`, não usar em anúncio, SEO, feed, filtro de compatibilidade ou CTA comercial.

**Estado:** esta é a projeção alvo contratual, **não** uma aba pública implementada. Depende de relações persistidas, licenças de mídia, revisão humana e filtros da API da loja.

## Formato de saída obrigatório (exemplo estrutural, sem anos inventados)

```json
{
  "sku_conjunto": "CI003696",
  "escopo": "motor_parcial_com_cabecote",
  "produto_automacao": "consultar_estado_real",
  "cronologia": [
    {
      "montadora": "Hyundai",
      "modelo": "HR",
      "mercado": "BR",
      "geracao_projeto": null,
      "fase_revisao": null,
      "ano_modelo_inicio": null,
      "ano_modelo_fim": null,
      "faixa_vin": null,
      "versao_motor": "D4CB 2.5 16V Euro 5 (declaração do conjunto; confronto veicular pendente)",
      "aplicacao_sku": "a_confirmar",
      "fonte": null
    },
    {
      "montadora": "Kia",
      "modelo": "Bongo K2500",
      "mercado": "BR",
      "geracao_projeto": null,
      "ano_modelo_inicio": null,
      "ano_modelo_fim": null,
      "aplicacao_sku": "a_confirmar",
      "fonte": null
    }
  ],
  "outros_skus_importados": [
    {
      "sku": "CI003000",
      "classe": "referencia_cruzada_candidata",
      "mesmo_nivel_conjunto": "verificar",
      "documentacao_de_ambos": "pendente",
      "equivalencia_aprovada": false
    }
  ],
  "componentes_avulsos": [
    {
      "componente": "cabecote_montado",
      "oem_epc_por_geracao": "a_pesquisar",
      "sku_fiscal_avulso": null,
      "composicao_real": "a_confirmar",
      "equivalencia_com_avulso": "a_confirmar"
    }
  ],
  "publicavel_como_compatibilidade": false
}
```

Os exemplos acima são **campos-modelo**, não confirmação de SKU cruzado, ano ou versão.

## Situação específica CI003696 (sem homologação nova)

- CI003696 / TRIM GO / motor parcial com cabeçote D4CB 2.5 16V Euro 5: **identidade declarada do conjunto**; aplicações HR e Bongo K2500 em `a_confirmar`.
- `CI003000`: **candidato de cruzamento do conjunto**; comparar packing list, fabricante/código, interfaces, revisão e gerações antes de afirmar equivalência.
- `3J0234AU00`: conjunto **curto sem cabeçote**, segundo descrição pesquisada; **escopo diferente** do CI003696, não cruzar como motor parcial equivalente sem outra evidência que altere essa identificação.
- `CI002916`: outra família/versão de motor, **não equivalência direta** por similaridade de veículo.
- O índice `docs/mobis/catalogo/CI003696-indice-rastreabilidade-oem-20261121.json` traz candidatos EPC **de posições de componentes** de um contexto internacional; não atribuir códigos ao conjunto TRIM GO nem à versão brasileira sem cadeia documental.
- A ferramenta `engenharia.cruzados.verificar` consulta vínculos diretos existentes; **não produz** packing list, genealogia de fábrica comprovada ou homologação do avulso por si só.

## Consulta consolidada de somente leitura — estado do PR #489

A ferramenta MCP **existente** `engenharia.cruzados.verificar({sku,incluir_a_confirmar})` ganhou no **código do PR**, ainda não implantado, uma projeção adicional de cronologia. O handler consulta em paralelo as RPCs **já existentes** `verificar_cruzados_do_sku` e `validar_aplicacoes_do_sku` da mesma loja autorizada. O resultado mantém os códigos cruzados anteriores e acrescenta:

- `cronologia_veicular.registros[]`: somente as **versões e os períodos de referência técnica** retornados pela RPC, com eventos históricos de veículo quando disponíveis. **Não** são datas de fabricação do veículo nem confirmação do motor importado. Mesmo quando a RPC responder `resultado=confirmada`, o relatório apresenta `situacao_do_conjunto=a_confirmar` porque a RPC **não verifica** a composição de cada SKU, geração/projeto exato, VIN ou packing list. Campos ausentes permanecem `null`.
- `outros_skus_importados`: não fabrica SKU com base em código OEM; a RPC de cruzamentos não retorna `bling_id`, nota de compra ou comparação física de dois motores, portanto listas de equivalentes confirmados permanecem vazias até existir vínculo fiscal/documental direto.
- `componentes_avulsos`: referências técnicas que **não** identificam o SKU físico inteiro ficam marcadas como **escopo a conferir**, não como peça comprovadamente incluída ou SKU avulso com estoque. A RPC atual não comprova ligação do item avulso ao motor.
- `pode_publicar_equivalencias_com_este_relatorio=false` sempre. Pesquisa de referências continua por arestas diretas e sem propagação entre marcas/gerações.

Por padrão, apenas registros com status aprovado são visíveis como **dados de referência**; `incluir_a_confirmar=true` mostra candidatos rotulados para o porteiro. Mesmo "aprovado no grafo" não é homologação automática do conjunto. Falha da RPC de aplicações deixa a consulta de cruzamentos disponível com diagnóstico `consulta_indisponivel`; não esconde o erro nem responde "incompatível".

**Limitações técnicas:** sem nova migração, sem vínculo fiscal entre dois motores, sem persistência das linhas de composição, sem verificador automático de geração/projeto e sem tela pública de avulsos. São etapas posteriores, dependentes de prova documental e aprovação de operação específica. Enquanto o SKU CI003696 estiver pausado, permanece **somente consulta**.

## Casos obrigatórios de regressão

1. Mesmo nome `HR`, duas gerações ou fases no mesmo ano → **duas linhas**, sem herança da compatibilidade de uma para outra.
2. Um SKU fisicamente idêntico serve duas gerações com **provas independentes** → **um produto, duas aplicações aprováveis separadamente**, sem novo estoque.
3. Só o código D4CB e o ano → hipóteses, **não** motor homologado nem OEM do conjunto.
4. SKU de motor curto comparado com parcial com cabeçote → `nao_equivalente_por_escopo`, embora compartilhem peças.
5. Dois SKUs importados com motores aparentemente idênticos e composição/medidas desconhecidas → `referencia_cruzada_candidata`; não homologar.
6. Boletim OE de substituição entre códigos com limite de período/geração → respeitar direção e validade; **não** aprovar intervalos anteriores/posteriores automaticamente.
7. Cabeçote avulso tem OEM e NF próprios → não vira produto filho de estoque do motor parcial; `incluido_no_sku` exige prova física distinta.
8. A→B e B→C → não concluir A→C; dois OEMs de componentes comuns não igualam motores.
9. `ano_final=null`, EPC de mercado GEN ou catálogo de reposição até 2026 → não atribuir fim de fabricação ou aplicação brasileira.
10. CI003696 pausado → pesquisar e relatar somente; sem proposta no ERP/Conecta, ativação de banners, preço ou publicação.

**Estado de implantação:** este contrato orienta o agente na branch em revisão; validação automática ponta a ponta, fluxo de aceite por vínculo e persistência de cronologia não ficam automaticamente implementados por este texto.
