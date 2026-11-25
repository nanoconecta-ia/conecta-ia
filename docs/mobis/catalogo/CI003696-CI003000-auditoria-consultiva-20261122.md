# Auditoria consultiva — CI003696 × CI003000 (22/11/2026)

**Estado:** evidências obtidas em consultas de somente leitura ao Conecta.IA. Não homologa equivalência, não executa escrita, não desbloqueia SKU pausado e **não é material de publicação da loja**.

## 1. Identidade declarada e fontes consultadas

| Campo | CI003696 | CI003000 |
|---|---|---|
| SKU | CI003696 | CI003000 |
| Bling ID do espelho consultado | 16719530075 | 16370294549 |
| Nome no catálogo | MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE - MARCA: TRIM GO | MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE |
| Marca cadastral | TRIM GO | Trim Go |
| Tipo declarado | Parcial **com cabeçote** | Parcial **com cabeçote** |
| Código do fabricante do conjunto | não fornecido pelas consultas | não fornecido pelas consultas |
| Lista do que acompanha / packing list por SKU | não fornecida pelas consultas | não fornecida pelas consultas |
| GTIN confirmado | ausente | ausente |
| Referências cruzadas diretas existentes no MCP | nenhuma | nenhuma |
| Aplicações aprovadas no grafo técnico BR | nenhuma | nenhuma |
| Bula técnica completa | false | false |
| Publicação no catálogo | false | false |

**Consulta de origem:** `conecta.catalogo.ver({sku})`, `conecta.catalogo.listar({busca:"D4CB EURO V NOVO PARCIAL"})`, `engenharia.cruzados.verificar({sku})`, `engenharia.aplicacoes.validar({sku})` e `engenharia.bula.verificar({sku})`, todas realizadas em 22/11/2026. O campo `itens_aprovados` do catálogo é uma contagem do enriquecimento e NÃO comprova homologação de aplicações, peças ou OEM.

**Divergência de identidade:** a chamada direta `bling.produtos.consultar({sku})` falhou **em ambos os SKUs** com o erro `Mais de um produto no Bling com esse SKU; resolva a duplicidade antes.`. Por outro lado, `engenharia.duplicidade.detectar({sku})` retornou apenas **um candidato no espelho** para cada SKU e nenhum grupo de duplicidade (`grupos: []`). **Não considerar o conflito resolvido.** Pode haver histórico ativo/excluído ou diferença entre origem Bling em tempo real e espelho. Não inferir segunda identidade nem unificar registros com base apenas no espelho. Exigir revisão do Bling com situação e ID real de cada ocorrência antes de propostas de escrita.

## 2. Diagnóstico do porteiro

A coincidência da família D4CB, 2.5 16V, Euro V e descrição `PARCIAL C/ CABECOTE` é **triagem de candidato**, não equivalência:
- **Produto real**: cada SKU tem `bling_id` distinto no espelho. Não converter o CI003000 em alias de estoque do CI003696.
- **Composição**: obter packing list dos dois SKUs, número do conjunto do fabricante e imagens reais verificadas; confrontar bloco, cabeçote, virabrequim, pistões, bielas, bronzinas, junta, comandos, válvulas, tuchos, revisões e quantidades. A inclusão nominal no texto do anúncio não comprova componente específico homologado.
- **Medidas/interfaces**: referências de furação, mancais, cabeçote, portas de injeção, sensores, aplicações elétricas/ECU, interfaces de acessórios e versão Euro/Proconve conforme fonte do fabricante.
- **Aplicações de fábrica por veículo**: para cada Hyundai HR e Kia Bongo K2500 (mercado Brasil) rastrear geração/projeto, revisão, código de motor, ano-modelo, período da versão, VIN/série quando disponível, documento da montadora e código original do **mesmo nível de conjunto**. Não transformar `13/` no nome em início oficialmente homologado.
- **Componentes avulsos**: procurar SKUs fiscalmente independentes por peça; OEM da posição do EPC e prova de inclusão no conjunto **são pesquisas distintas**. Nenhum SKU de avulso foi comprovado nesta consulta.
- **Marca**: o cadastro registra TRIM GO / Trim Go; confirmar fabricante efetivo, código comercial de cada conjunto e origem com documento. Mesmo nome comercial da marca não prova lote e revisão idênticos.

## 3. Saída técnica conservadora

```json
{
  "analise": "CI003696_vs_CI003000",
  "data": "2026-11-22",
  "modo": "somente_leitura",
  "registros_espelho": [
    { "sku": "CI003696", "bling_id": "16719530075", "conjunto_declarado": "motor_parcial_com_cabecote" },
    { "sku": "CI003000", "bling_id": "16370294549", "conjunto_declarado": "motor_parcial_com_cabecote" }
  ],
  "alerta_bling": "duplicidade_sinalizada_na_consulta_direta_para_ambos_os_skus",
  "grupos_duplicidade_espelho": 0,
  "relacao_proposta": "referencia_cruzada_candidata",
  "equivalencia_confirmada": false,
  "aplicacoes_confirmadas": [],
  "outros_skus_equivalentes_aprovados": [],
  "componentes_avulsos_confirmados": [],
  "itens_faltantes": [
    "reconciliar_historico_e_identidade_Bling",
    "documento_fabricante_conjunto_por_sku",
    "packing_list_fisica_de_ambos",
    "revisao_interfaces_medidas_por_geracao",
    "EPC_BR_por_versao_e_periodo",
    "prova_direta_de_equivalencia_do_nivel_de_conjunto",
    "revisao_humana_individual"
  ],
  "publicavel": false,
  "autorizado_a_escrever": false
}
```

**Ação futura:** a pessoa autorizada deve reconciliar os IDs do Bling e fornecer/corroborar documentação primária de ambos os conjuntos. O porteiro poderá então emitir a matriz de equivalência por **nível do conjunto × versão/geração × período**, permanecendo `a_confirmar` até aceite humano. Este relatório **não** aprova motor, OEM, aplicação HR/Bongo, período brasileiro, itens internos ou avulsos.

## 4. Não execução e confidencialidade

Nenhum preço de custo/venda, estoque comercial, NF ou fornecedor privado deve ser publicado por esta auditoria; as consultas foram somente leitura. Produto `CI003696` tem automação declarada pausada nos registros do PR; conferir estado real antes de qualquer proposta/escrita. A loja e Bling não foram modificados nesta revisão.
