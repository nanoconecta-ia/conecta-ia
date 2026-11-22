# Porteiro / Conecta.IA — engenharia reversa documental de componentes OEM via EPC

**Versão:** proposta para revisão, 2026-11-21. **Situação:** design e validador puro adicionados na branch do PR #489; ainda **não** conectado ao gateway, ao banco ou à fila do painel. Nenhum catálogo, código OEM, composição ou aplicação foi gravado no produto CI003696.

## 1. Objetivo

Quando um motor parcial importado tem pouca documentação, o sistema deverá reconstruir **o mapa de referências originais dos componentes** por fonte EPC, para organizar pesquisa, taxonomia, BULA e atendimento ao cliente.

Isso NÃO significa que o importador TRIM GO forneça os mesmos componentes OEM ou que esses componentes estejam fisicamente dentro do CI003696. O mapa EPC pertence à **configuração do veículo**; a composição física pertence ao **SKU do produto importado**. Só uma prova de correspondência explícita une ambos.

A fotografia enviada pelo lojista mostra a interface do **PartSouq** com escolha de Hyundai, Kia e outras montadoras. Para localizar a peça original, a rota auditável é: montadora → mercado/região **Brasil** quando disponível → modelo → versão/motor/ano → eventualmente VIN → grupo do diagrama → posição → número de peça OEM. Se não existir catálogo BR, marcar região como diferente e procurar segunda fonte local; **não transferir automaticamente** a referência para a versão brasileira.

## 2. Hierarquia de conhecimento (reutilizar tabelas existentes)

- **Produto comercial/físico** (`produtos`, Bling `bling_id` + SKU): um estoque, marca da peça, composição comprovada ou não.
- **Aplicação comercial** (`produto_aplicacoes`): montadora/modelo/versão/ano/emissões e status, uma por veículo.
- **Peças originais e catálogo EPC** (`pecas_ref`, `pecas_aplicacoes_tecnicas`, `fontes`): código OEM por componente **do veículo**, com montadora, classe, documento, data, diagrama, versão e mercado.
- **Referências cruzadas** (`ref_cruzada`): relacionamentos diretos, com evidência; sem equivalência transitiva.
- **Produto versus peça** (`produto_pecas_ref`): **somente** para a relação do produto físico com a peça de referência que representa o mesmo objeto. **NUNCA** cadastrar cabeçote, junta ou virabrequim individual como `e_esta_peca` do **SKU do motor parcial**.
- **Nova relação lógica necessária:** `composicao_sku` e `candidatos_oem_componente`, com controle por loja/SKU e vínculo específico ao `pecas_ref`. Esquema relacional e migração requerem PR próprio, revisão RLS e aplicação controlada. Não improvisar inserções SQL para contornar a ausência dessas tabelas.

## 3. Esquema-alvo lógico — sem migração aplicada

```text
produto_fisico(loja_id, produto_id, bling_id, sku)
  1 ── N composicao_sku(
         id, produto_id, grupo_funcional, componente_nome,
         quantidade_declarada, quantidade_conferida,
         estado_fisico [declarado, confirmado_incluido, confirmado_nao_incluido, nao_confirmado],
         fonte_declaracao, evidencia_fornecedor_id,
         documento_sku, revisao, aprovado_por, aprovado_em)
             1 ── N candidatos_oem_componente(
                    id, composicao_id, peca_ref_id,
                    montadora_id, versao_id, codigo_oem,
                    finalidade [codigo_original_do_veiculo, equivalente_fisico_do_importado],
                    fonte_epc_id, grupo_diagrama, posicao_diagrama, nivel_diagrama,
                    mercado, ano_modelo, codigo_motor, norma_euro,
                    status [a_confirmar, em_revisao, aprovado, rejeitado],
                    evidencia_equivalencia, aprovado_por, aprovado_em)
```

Restrições a implementar: `loja_id` do SKU conferido com `produtos`; FKs restritas por tenant; imutabilidade de fonte após aprovação; exclusão/versão histórica em vez de sobrescrita; status `aprovado` exige revisor autorizado e fonte comprovada; imagem do diagrama somente como URI/descrição/metadado com licença. Chaves únicas devem usar `produto_id, componente, versao_id, peca_ref_id, finalidade` e considerar versões de composição e substituições.

**Separação crucial:** `codigo_original_do_veiculo` representa número original da peça no EPC daquela configuração, **não** comprovante de que o componente está no motor vendido. `equivalente_fisico_do_importado` exige evidência adicional independente do EPC (lista do fabricante/importador por SKU, inspeção, medidas/interfaces e homologação humana).

## 4. Algoritmo de pesquisa para o porteiro

1. Resolver ID Bling e SKU ativo (verificar duplicidade histórica/inativos), respeitar `produto_automacao.pausado`; consultar sem gravar quando pausado.
2. Construir a lista de partes a pesquisar a partir da **declaração** do proprietário/fornecedor, sem tratar declaração como confirmação. Agrupar: cabeçote, comandos, válvulas, tuchos, balancins, retentores, junta metálica, parafusos de cabeçote, bloco, bielas, pistões/anéis, bronzinas de biela/mancal, arruelas de encosto, jet coolers/parafusos e virabrequim.
3. Para cada aplicação **separada**, encontrar catálogo EPC da versão/mercado e pesquisar a posição de cada componente. Guardar código, nomenclatura original, figura/grupo, quantidade e intervalos de série/ano se o EPC efetivamente informar.
4. Validar: componente, montadora, modelo, código motor, 8V/16V, Euro, injeção, mercado, VIN/série (quando disponível), intervalo de aplicação; **não** generalizar do H-1 para HR sem prova, nem de um ano/mercado para outro. Referências repetidas ou substituídas mantêm histórico.
5. Criar **candidatos** independentes por peça/versão. Quando não se obtém código, marcar `codigo_oem_pendente`, sem gerar números.
6. Confrontar com a **composição física do SKU**. EPC do componente não confirma sua presença no kit. Se o fabricante não forneceu lista, solicitar inspeção/fotos/embalagem/documentação e marcar `inclusao_nao_confirmada`.
7. Revisão humana por componente/versão, preservando datas/fontes/capturas e decisões. Somente itens aprovados entram na bula pública e tags técnicas; a descrição do produto pode explicar a **natureza** do conjunto sem declarar itens não comprovados.
8. O OEM do **motor parcial inteiro** só é atribuído quando o EPC identifica o mesmo nível de **conjunto** e há prova de equivalência da composição física. **Jamais inferir um OEM de conjunto somando códigos OEM das peças internas.**
9. O mesmo mapa técnico pode apoiar várias lojas e sistemas, mas dados privados/importador/fornecedor, preço, NF, saldo e direitos de conteúdo ficam sob escopo da loja. Exportar para PDV ou marketplace apenas os campos realmente homologados e suportados por sua integração.

## 5. Exemplos de navegação EPC comprovados; NÃO seedar como compatibilidade

- PartSouq, catálogo Hyundai por VIN/modelo e região, incluindo opção `Brazil`: https://partsouq.com/catalogs/hyundai/
- PartSouq, H-100 de 2013 com motor D4CB, vista `CRANKSHAFT & PISTON`: fonte indexada na consulta, **não** prova equivalência da peça vendida à HR brasileira nem do SKU TRIM GO.
- PartSouq, Kia Bongo 2013/2014, vistas `CRANKSHAFT & PISTON` e `CAMSHAFT & VALVE`: pontos de partida para extrair **códigos por item**, a confirmar pela versão/mercado antes de gravação.
- Todo número OEM extraído precisa carregar: `fonte_url, data_consulta, montadora, modelo, ano_modelo, motor, mercado, grupo_diagrama, posicao, nivel_do_objeto`.
- O catálogo PartSouq é uma fonte terciária de consulta ao EPC. A documentação da montadora ou um EPC autorizado para a versão pode ser necessário para confirmação. Respeitar direitos de uso/termos do fornecedor da informação; não assumir permissão de raspagem massiva ou de republicação de diagramas.

**Atualização da pesquisa (21/11/2026):** o índice de revisão `docs/mobis/catalogo/CI003696-indice-rastreabilidade-oem-20261121.json` contém **21 grupos de componentes e 36 números OEM candidatos** extraídos de referências EPC de Kia Bongo D4CB 2014, todos **sem equivalência física ou aplicação brasileira aprovada**. O OEM é verificado no diagrama da configuração consultada, **não no conjunto importado CI003696**; não promover nenhum candidato a produto de estoque, SEO ou venda. Os URLs individuais do JSON são rotas de pesquisa por código; a evidência original é o diagrama do veículo e a posição informada, que precisam ser preservados na homologação.

## 6. Portão de software proposto e testes

Arquivo `supabase/functions/_shared/aplicacoes/regras_componentes_oem.ts`: validador puro `validarVinculoOemComponente`, com classes `oem_componente_veiculo`, `incluido_no_sku`, `equivalente_ao_oem`, `oem_conjunto`.

- O agente só propõe como `a_confirmar`; não aprova nem publica.
- Durante pausa, nenhuma proposta/escrita.
- Código sem fonte, data e localizador de diagrama não pode ser homologado.
- OEM do componente (ex.: bronzina) não é OEM do motor parcial.
- EPC não confirma inclusão: exige documento da composição para o mesmo SKU.
- Equivalência aftermarket exige inspeção/conferência do componente e evidência de correspondência.
- Publicação por veículo exige aplicação homologada; o porteiro não pode usar somente marca/ano para afirmar compatibilidade.

**Limitação declarada:** o novo validador ainda não foi ligado às ferramentas de escrita/SQL nem à fila de aprovações; a autenticação do aprovador, autorização do tenant e licenças de fontes precisam ser impostas no gateway e no banco. Testes `regras_componentes_oem.test.ts` são unitários: não provam integração nem homologação dos dados.

## 7. Caso de referência CI003696

- Mestre físico: **CI003696** / Bling ID **16719530075** / marca peça **TRIM GO** / descrição **motor parcial com cabeçote, D4CB 2.5 16V Euro 5**.
- Aplicação candidata 1: **Hyundai HR**, `a_confirmar`.
- Aplicação candidata 2: **Kia Bongo K2500**, `a_confirmar`.
- Composição detalhada **declarada** pelo lojista em `docs/mobis/catalogo/CI003696-ficha-proposta-web-20261119.md`.
- EPC de cada componente: **pesquisa por versão/mercado pendente de extração e homologação**. Nenhuma associação ao OEM do conjunto foi aprovada.
- Produto pausado: **não** inserir propostas no catálogo em produção, não alterar Bling, não publicar.


## 8. Componentes comercializados avulsos — mesmo fornecedor, notas fiscais diferentes (declaração do lojista)

**Informação adicional recebida em 21/11/2026:** o lojista relata que itens do conjunto como **cabeçote, válvulas e comandos** também podem ser encontrados no **RPM**, por meio do mesmo fornecedor, **em notas fiscais de aquisição diferentes** da nota do motor parcial. A existência desses registros e a identidade dos SKUs/NFs **não foram verificadas nesta revisão**: não inventar SKU, NF, OEM, fabricante ou preço; "RPM" é o nome de fonte mencionado pelo lojista e sua função exata (catálogo externo ou módulo comercial) deve ser confirmada pelo sistema antes de integrar.

### Regra de genealogia comercial/fiscal

- Um motor parcial **CI003696** é um produto comercial **individual**, com seu próprio `bling_id`, SKU, NF de entrada, marca, controle de estoque e composição declarada.
- Uma **peça avulsa** (ex.: cabeçote ou comando) encontrada no RPM/Bling deve ser outro produto físico, **somente se comprovado** seu próprio código de referência, `bling_id` (se existir), SKU e entrada fiscal individual. Ela conserva **seu próprio** estoque, NF, NCM e dados de fornecedor.
- Uma NF do componente **não** é prova de que o componente está dentro do motor parcial CI003696; tampouco obriga que o motor parcial tenha seus próprios componentes como registros de estoque filhos.
- Um fornecedor igual e uma família de motor igual **não provam** equivalência do componente com o item embutido: comparar motor, fase Euro, 8V/16V, interfaces, número de peça, fabricante, composição e versão específica.
- **Três fatos independentes:** (A) a peça avulsa existe como produto comercial, (B) o número OEM pertence a uma posição/versão EPC, (C) aquele componente físico está incluído no SKU do motor parcial. Só unir A, B e C quando houver evidências próprias de cada um.
- Cada componente avulso pode ter **N aplicações veiculares próprias**, independentes das duas candidatas HR/Bongo do conjunto. Não herdar automaticamente aplicações ou títulos SEO do motor parcial.
- Se o usuário desejar vender o motor parcial montado, **não** gerar ordem de produção, baixa de componentes, novo kit/estrutura de Bling, soma de custo ou composição de preço. Qualquer estrutura de estoque/produção exigiria autorização fiscal/operacional distinta.
- Registrar a proveniência de fornecedor e NF apenas em ambiente interno autorizado; jamais expor custo, dados fiscais internos, fornecedor privado ou números de NF ao cliente da loja.

### Relação lógica adicional do porteiro (proposta, sem migração)

```text
produto_fisico_conjunto: {loja_id, bling_id_conjunto, sku_conjunto}
  | possui_descricao_de_componente (SOMENTE pesquisa/conhecimento)
  +-- componente_declarado: {nome, posicao_funcional, estado_inclusao}
       |--- referencia_original_epc: {montadora, versao, grupo, item, OEM, fonte, status}
       +--- produto_avulso_candidato: {
              origem: RPM | BLING | fornecedor | outro,
              bling_id_avulso: opcional,
              sku_avulso: opcional,
              nf_avulsa_ref_interna: opcional,
              fornecedor_id_privado: opcional,
              status_vinculo: candidato | equivalente_comprovado | rejeitado,
              evidencia_identidade: URL/documento, revisado_por, revisado_em
            }
```

**Ponto de corte:** `status_vinculo=equivalente_comprovado` exige prova da identidade do componente **avulso** em relação ao componente presente no conjunto. O documento de entrada fiscal prova aquisição/identidade do item da NF, **não** identidade técnica, inclusão no conjunto ou adequação veicular.

### Matriz de regressão complementar

1. Motor parcial + cabeçote avulso do mesmo fornecedor, com NFs distintas → **dois produtos físicos e dois estoques**, vínculo comercial candidato.
2. Item avulso presente no RPM, ausente no Bling → apenas referência externa, **não criar SKU do Bling**.
3. Mesmo fornecedor + códigos/medidas divergentes → **não equivalente**; impedir compartilhamento de OEM e aplicação.
4. Mesma peça OEM no EPC, sem lista documentada da composição do conjunto → código EPC pesquisável, **inclusão a confirmar**.
5. Composição documentada do conjunto + produto avulso com código fabricante/medidas distintos → a inclusão do tipo de componente pode ser confirmada, mas **equivalência com produto avulso rejeitada**.
6. Aprovação individual do OEM/componente não altera estoque, NF, preço, cadastro fiscal, SKU nem aplicação de outro produto.

## 9. Camadas OEM genuíno, fornecimento homologado e independente

A montadora define a **referência OE** por versão do veículo. Uma peça genuína vendida em embalagem/canal de origem precisa de documentação de autenticidade; uma peça de fornecedor de primeiro equipamento (OEM) ou OES precisa de prova do fabricante e do escopo do fornecimento; uma peça aftermarket independente pode ter código cruzado **sem** ser original. O fato de ser importada da China ou de outro país não é critério de homologação e não invalida automaticamente sua qualidade.

Ponte de pesquisa recomendada: `codigo_montadora + componente + nivel_conjunto + motor + versao + mercado + fonte_epc` → `codigo_proprio_fabricante + documento` → `SKU_fiscal_real + fornecedor + NF` → `relacao_direta + fonte + situacao`. Produtos de fornecedores distintos têm NFs, SKUs e estoques próprios. Não se cria SKU fiscal quando só o OEM está disponível.

Relacionamentos **não são transitivos**, nem herdados por todas as versões Euro de uma família de motor. Para o CI003696, cruzamentos com outros motores importados continuam pesquisas possíveis, não vínculos aprovados. Ver `regras_cruzamento_multimarcas.ts` (validador puro) e `regras_cruzamento_multimarcas.test.ts`. Arestas aprovadas dependem de implementação do fluxo controlado e revisão humana.
