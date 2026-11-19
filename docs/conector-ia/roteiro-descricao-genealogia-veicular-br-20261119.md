# MOBIS × Conecta.IA — Buscar pela descrição e reconstruir a evolução veicular brasileira
**Data:** 19/11/2026. **Status:** procedimento de pesquisa e critérios de aceite PARA IMPLEMENTAÇÃO no porteiro da PR #461; não foi implantado no serviço, não altera Bling/Supabase e não aprova homologações.

## Objetivo e frase que inicia o cadastro
O agente recebe descrições naturais, inclusive **SEM SKU**, por exemplo:
- `motor para HR 2013`
- `motor Hyundai HR diesel 16 válvulas`
- `cabeçote para Kia Bongo K2500 Euro 5`
- `motor Gol 2003 1.0`

A ausência de SKU **não é erro**: pesquisar e identificar o veículo e o motor, coletar provas, localizar produtos existentes no espelho Bling por descrição/código/NCM e sugerir relações. **Não criar um SKU físico novo** só porque encontrou uma descrição; identificar antes de cadastrar.

### Pipeline: descrição → identidade de veículo → família de motor → peça → SKU
1. Extrair campos CONHECIDOS (`tipo_peca`, `montadora`, `modelo`, `ano_digitado`, `codigo_motor`, `cilindrada`, `cilindros`, `valvulas`, `diesel/combustivel`, `sistema_injecao`, `emissoes`, `tracao`, `versao`); marcar ausentes como `desconhecido`, nunca inferir da marca ou do ano isolado.
2. Procurar primeira correspondência na árvore de **modelos brasileiros DOCUMENTADOS** e cache técnico aprovado. Se houver mais de uma versão possível no ano, retornar **alternativas**; o agente não escolhe pelo nome mais parecido.
3. Encontrar evidências: órgão oficial/montadora/importadora brasileira do PERÍODO → ficha/manual de versão → EPC/figura/posição de peça → fabricante da peça, fornecedor OE com documento → fornecedor/importador B2B e marketplace como descoberta. Documento internacional **não comprova** comercialização, configuração nem homologação no Brasil.
4. Construir a **identidade de configuração**, não só o nome comercial: mercado BR + marca + modelo + projeto/geração documentada + versão + tração + motor + emissões + período de validade + faixa VIN/chassi/série se aplicável.
5. Só depois cruzar OEM EPC, códigos de reposição, GTIN/GS1 e **NCM do produto real no Bling** como filtro auxiliar. NCM igual jamais comprova equivalência física. Identidade técnica só pode gerar **proposta**.
6. Para cada candidato de peça comparar composição incluída/excluída, medidas, interface de montagem, eletrônica/sensores/injeção, número de cilindros/válvulas, compatibilidade documental e contraindicações; registrar divergências.
7. Criar rascunho **individual** por SKU físico encontrado e ofertas distintas por veículo homologado, compartilhando estoque do mesmo SKU. Passar pela fila humana e pelas travas de produto pausado.

## Genealogia: Pai → filhos → ramos paralelos («primos»)
Não misturar árvore de **veículos** com a taxonomia **funcional de peças** e com a composição pai/filho do Bling.

- **Pai — Montadora e modelo brasileiro**: ex.: `Hyundai → HR (Brasil)`; `Volkswagen → Gol (Brasil)`. Também registrar importador/representante vigente no período, sem assumir representação única para todas as épocas.
- **Filhos — Gerações/projetos e configurações específicas**: cada filho recebe `ano_brasil_inicio`, `ano_brasil_fim` (se comprovado), `tipo_ano` (comercialização, fabricação, ano-modelo, importação), documento + URL + data, motor, cilindros, válvulas, tração, câmbio, emissões, sistemas de injeção, mudança técnica e restrições.
- **Netos — Variações dentro da versão**: ABS/sem ABS, Bosch/Delphi, Euro 3/5/6, motor 8V/16V, 4x2/4x4, transmissões, pós-modificação por faixa VIN/série quando comprovados. Nem todas as características podem ocorrer em todos os anos.
- **Primos — Ramos relacionados, mas NÃO automaticamente equivalentes**: Kia Bongo K2500 D4CB é ramo da marca Kia, relacionado ao HR por família motriz; Gol, Parati e Saveiro podem compartilhar família/plataforma em períodos específicos, mas cada modelo possui identificador e homologação próprios. Relação de família não transfere OEM, compatibilidade nem data de início/fim.
- **Árvore funcional de PEÇAS independente**: `Motor → Conjunto montado → Motor parcial com cabeçote` versus `Motor → Bloco/motor curto`, cabeçote isolado, comando etc. O estoque tem apenas um cadastro físico por peça; os «filhos» de veículo são ofertas/aplicações, não clones de estoque.

### Anos de «nascimento» e «fim» — tipos de fato que jamais se confundem
`primeiro_ano_documentado_brasil` ≠ `inicio_comercializacao_comprovado` ≠ `ano_modelo` ≠ `fabricado_ate` ≠ `fim_comercializacao_brasil` ≠ `ultimo_ano_coberto_pelo_catalogo_de_reposicao`.
- Registro deve separar `data_do_documento`, `data_do_evento` e `tipo_de_ano`.
- Quando somente o primeiro ano está comprovado, gravar `ano_inicio` com tipo/evidência; `ano_final=null`, `fim_nao_comprovado=true`; **não** declarar `em_producao=true` por falta de ano final. O validador atual poderá exigir revisão manual antes de aprovar.
- Um ano de calendário pode conter **dois ramos simultâneos** (versões antigas e novas), e geração comercial conhecida como G3/G4/G5 pode ser reestilização, não projeto independente; não forçar intervalos contínuos e não criar transição automática.
- As contraindicações devem ser documentadas positivamente: `incompatível confirmado` requer documento; sem prova = `compatibilidade não confirmada`, não declarar "não serve".

## Exemplo documentado A: «motor para HR 2013»
**Fonte brasileira CAOA** — ficha técnica HR Euro V (jan/2021):
https://www.caoa.com.br/uploads/product/2021/07/13/ficha-tecnica-hr-jan-21.pdf
**Fonte histórica de 2013:** comunicado/reprodução de ficha de 18/11/2013 (exige conferir original antes de homologar começo da versão):
https://alphaautos.com.br/2013/10/alpha-noticias-hyundai-apresenta-o-hr-com-novo-motor-na-fenatran-2013
**Catálogo de aplicação comercial Motorservice** (não prova ano final de comercialização pela montadora):
https://catweb.ms-motorservice.com.br/detalhes.php?cw_pgAtual=37&cw_produtoAtivo=CodigoProduto%3C%212%21%3E5448&retornaJSON=true

- `montadora=Hyundai`; `modelo=HR`; `mercado=BR`; `representante_da_ficha=CAOA`; `variante_documentada=HR Euro V`; `motor=D4CB / 2.5 A2 Diesel`
- `cilindros=4` **em linha**; `valvulas=16`; `cabecote=aluminio`; `diametro_mm=82`; `curso_mm=93,5`; `injecao=CRDI Delphi`; `tracao=4x2 traseira`; `cambio=manual 6 marchas`, **somente para a ficha específica da CAOA**. Não transferir os dados a toda HR, Kia Bongo, outras gerações ou versão 4x4.
- `ano_candidato_inicio=2013` apoiado por fontes nacionais históricas, **homologação por período ainda deve conferir documentação de versão**. `ano_fim_comercializacao_brasil=desconhecido`. Um catálogo Motorservice indica cobertura até 2026 em determinadas referências; isso é `ultimo_ano_coberto_pelo_catalogo`, **NÃO** encerramento de fabricação ou fim de geração.
- `CI003696` é motor parcial **COM cabeçote** Trim Go; `2J0224AU00A` aparece como `SHORT ENGINE ASSY` EPC: apenas referência candidata para comparar conjunto físico, **não equivalência aprovada**.
- Resultado correto na falta de informação: `hipotese_aplicacao` + evidências + pendências, sem foto ilustrativa publicada, sem OEM homologado, sem mudar o Bling.

## Exemplo documentado B: «motor para Gol [ano]»
Fontes da montadora: Volkswagen Newsroom, história do Gol:
https://www.vwnews.com.br/news/305
https://www.vwnews.com.br/company/7
https://newsroom-br.itd.vw.com.br/news/502
História brasileira: **início da produção em 1980 e encerramento em 2022** (fatos sobre o MODELO pai, NÃO sobre um motor/geração). Geração inicial do Gol em 1980 usava motor 1.3 **refrigerado a ar**; Gol GTi 2.0 com injeção eletrônica aparece em 1989, e o Gol Total Flex em 2003. São provas de EVOLUÇÃO do modelo, não são aplicáveis a todos os veículos Gol do ano.
- Pai `VW → Gol BR` registra duração geral do modelo; filhos são `projeto/geração + motorização + ano/mercado` com documentos individuais.
- Exemplo **de descoberta, NÃO de aplicação homologada**: consulta `motor Gol 2003` é ambígua entre opções de motorização e tecnologia; o porteiro deve trazer subopções e solicitar evidência de código de motor/versão. Nunca atribuir cilindros, válvulas, cilindrada, OEM ou GTIN por proximidade textual.
- O apelido G3/G4/G5/G6/G7 é **nome comercial/popular**, não sinônimo automático de geração mecânica; séries podem se sobrepor nos anos. Guardar `apelido` separado de `projeto_montadora`.

## Contrato de saída: pesquisa por descrição
Exemplo ilustrativo (as referências e estados devem ser checados no produto real):
```json
{
  "entrada": "motor para HR 2013",
  "tipo_entrada": "descricao_sem_sku",
  "busca_mercado": "BR",
  "veiculo_pai": "Hyundai / HR / Brasil",
  "filhos_candidatos": [
    {
      "configuracao": "HR Euro V / D4CB 2.5 A2 / 4 cilindros em linha / 16V / CRDI Delphi",
      "ano_inicio_br": {"valor": 2013, "estado": "conferir_inicio_de_comercializacao"},
      "ano_fim_br": {"valor": null, "estado": "nao_comprovado"},
      "fonte_tecnica": "https://www.caoa.com.br/uploads/product/2021/07/13/ficha-tecnica-hr-jan-21.pdf",
      "estado": "candidato_nao_homologado"
    }
  ],
  "sku_fisico": null,
  "proximos_passos": "cruzar produtos existentes no Bling por descricao e codigos; validar composicao, OEM e aplicacao antes de propor",
  "publicavel": false
}
```
`sku_fisico=null` na primeira pesquisa significa **SKU ainda não identificado**; a consulta não cria produto, preço ou estoque.

## Testes de aceite do porteiro
1. `motor para HR 2013` sem SKU encontra candidato no Brasil, **não cria novo produto**, exige versão e documento antes de aprovar.
2. Descrição sem código motor retorna candidatos/ambiguidade; nunca escolhe pelo primeiro resultado do Google.
3. O ano final de um catálogo de reposição **não** vira fim de produção/comercialização; sem documento deixa `null`.
4. `Gol 2003 motor` não devolve um único OEM ou motor sem desambiguação de versão.
5. «Primos» HR/Bongo não compartilham OEM/aplicações apenas por D4CB.
6. `4 cilindros` e `16 válvulas` são atributos da versão HR da ficha CAOA, não herdados de todo o modelo ou de gerações posteriores.
7. Uma composição `short engine` não é aprovada como `motor parcial com cabeçote`.
8. Uma consulta SKU/NCM/GS1 e outra só por descrição respeitam deadline GLOBAL de **15.000 ms** e retornam resultado parcial quando fonte demora — **requer implementação e teste no executor**.
9. `produto_automacao.pausado=true`: pesquisas consultivas permitidas; propostas/escritas/publicação bloqueadas.
10. Fontes comerciais sem documentação técnica geram `hipotese`, não `homologado`.

**Importante:** a busca na web realizada manualmente neste chat não prova que o executor Conecta.IA já consulte essas fontes automaticamente; esta PR apenas coloca a regra e o roteiro no repositório.
