# Contratos de ferramentas do Nano.ia

> **Gerado** por `scripts/gerar-docs-ferramentas.ts` a partir de `supabase/functions/_shared/conector/registro.ts`. Não edite: altere o registro e gere de novo.

Legenda — **estado**: `ativa` = handler implementado e testado; `planejada` = só contrato (aparece neste catálogo, nunca para o LLM); `desligada` = implementada mas travada por política (escrita no Bling).
**permissão**: `leitura`, `propor` (cria proposta, nunca altera nada), `simular`, `executar` (**só o executor**, após aprovação humana; nunca exposta a chat nem a cliente externo). `*` = campo obrigatório.
Ninguém aprova por ferramenta: a aprovação é ato de pessoa autenticada (`conector-aprovacoes`).

Resumo: 56 ferramentas — 38 ativas, 16 planejadas, 2 desligadas.

## Grupo: conecta

| Id | Estado | Permissão | Risco | Aprovação | Chat | MCP | Simulação | Idempotência | Entrada |
|---|---|---|---|---|---|---|---|---|---|
| `conecta.catalogo.resumo` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | — |
| `conecta.catalogo.listar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `apenas_nao_publicados:boolean` `busca:string` `limite:integer` |
| `conecta.catalogo.ver` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `conecta.enriquecimento.pendentes` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `limite:integer` |
| `conecta.travas.consultar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `produto_id:string` `sku:string` |
| `conecta.proposta.estado` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `proposta_id*:string` |
| `conecta.publicacao.preparar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku:string` `produto_id:string` |
| `conecta.proposta.criar` | ativa | propor | MEDIUM | não | sim | sim | sim | chave | `titulo*:string` `resumo:string` `lote:boolean` `itens*:array` |
| `conecta.enriquecimento.propor` | ativa | propor | LOW | não | sim | sim | não | chave | `sku*:string` `campo*:string` `valor*:string` `fonte*:string` `confianca:number` |
| `conecta.imagem.propor` | ativa | propor | LOW | não | sim | sim | não | chave | `sku*:string` `url*:string` `origem:string` `pagina:string` |
| `conecta.imagem.buscar_web` | ativa | leitura | LOW | não | sim | não | não | nao_se_aplica | `consulta*:string` |
| `conecta.plugins.listar` | ativa | leitura | LOW | não | sim | não | não | nao_se_aplica | — |
| `conecta.plugins.chamar` | ativa | leitura | LOW | não | sim | não | não | nao_se_aplica | `plugin*:string` `capacidade*:string` `entrada:object` |
| `conhecimento.buscar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `texto*:string` `tipo:string` `limite:integer` |
| `conecta.banners.gerenciar` | planejada | propor | LOW | não | sim | sim | não | chave | `tipo*:string` `produto_id:string` |
| `conecta.fabricante.pagina_preparar` | planejada | propor | LOW | não | sim | sim | não | chave | `fabricante*:string` |
| `conecta.seo.verificar` | planejada | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku:string` `produto_id:string` |
| `conecta.enriquecimento.definir` | ativa | executar | MEDIUM | sim | não | não | sim | chave | `sku*:string` `campos*:object` |
| `conecta.publicacao.publicar` | ativa | executar | HIGH | sim | não | não | sim | chave | `sku*:string` |

- **`conecta.catalogo.resumo`** — Totais da loja: produtos espelhados, publicados e itens aguardando aprovação.
  - *Verificação:* Contagem direta no espelho.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.catalogo.listar`** — Lista produtos da loja (nome, SKU, preço, estoque, publicado).
  - *Verificação:* Leitura do espelho.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.catalogo.ver`** — Detalhes de um produto pelo SKU e o que falta para publicar.
  - *Verificação:* Leitura do espelho.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.enriquecimento.pendentes`** — Itens de enriquecimento aguardando aprovação.
  - *Verificação:* Leitura da fila.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.travas.consultar`** — Estado operacional (trava) de produtos: bloqueado, liberado, pendente, em execução, sincronizado, divergente.
  - *Verificação:* Leitura de produto_travas.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.proposta.estado`** — Estado de uma proposta (versão, hash, aprovação, itens, operações).
  - *Verificação:* Leitura de agente_propostas.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.publicacao.preparar`** — Verifica se um produto está pronto para a página pública e lista o que falta (sem publicar).
  - *Verificação:* Cálculo sobre dados aprovados do espelho.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.proposta.criar`** — Cria uma PROPOSTA versionada (antes/depois, fontes, validações) para o lojista aprovar. Não altera nada: só a aprovação humana libera execução.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`conecta.enriquecimento.propor`** — Propõe um valor de enriquecimento para um campo do produto (entra como a_confirmar, com fonte).
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`conecta.imagem.propor`** — Propõe uma imagem candidata para o produto (pendente de aprovação; direitos ainda não confirmados).
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`conecta.imagem.buscar_web`** — Busca imagens candidatas na web (não salva nada).
  - *Verificação:* Resultado é dado a conferir.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.plugins.listar`** — Plugins ativos da loja e suas capacidades.
  - *Verificação:* Leitura.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.plugins.chamar`** — Chama um plugin ativo da loja (risco LOW, capacidade declarada). O retorno é dado a conferir.
  - *Verificação:* Retorno tratado como dado não confirmado.
  - *Recuperação:* Repetir é seguro (só leitura).
- **`conhecimento.buscar`** — Recupera conhecimento técnico com fonte e versão (documentação, validado ou hipótese), sem misturar os tipos.
  - *Verificação:* Cada item traz tipo, fonte, versão e status.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.banners.gerenciar`** — Prepara banner promocional ou de fabricante (prévia). Geração de imagem é capacidade independente e ainda não configurada.
  - *Verificação:* Prévia revisada pelo lojista.
  - *Recuperação:* Descartar a prévia.
- **`conecta.fabricante.pagina_preparar`** — Prepara a página de um fabricante com dados aprovados.
  - *Verificação:* Prévia revisada.
  - *Recuperação:* Descartar.
- **`conecta.seo.verificar`** — Executa verificações de SEO da página de um produto (título, descrição, dados estruturados, imagem).
  - *Verificação:* Regras mensuráveis; o resto marcado verificação manual.
  - *Recuperação:* Repetir.
- **`conecta.enriquecimento.definir`** — Aplica no Conecta.IA o enriquecimento aprovado (camada separada do Bling). Confere conflito com o valor anterior aprovado.
  - *Verificação:* Lê de volta os campos gravados em produto_enriquecimento.
  - *Recuperação:* Conflito => falha registrada sem sobrescrever; refazer a proposta.
- **`conecta.publicacao.publicar`** — Publica o produto no site se estiver completo (descrição, preço, SKU, imagem principal aprovada).
  - *Verificação:* Lê o produto e confere publicado=true.
  - *Recuperação:* Despublicar (publicado=false) é reversão operacional; produto incompleto nunca publica.

## Grupo: bling

| Id | Estado | Permissão | Risco | Aprovação | Chat | MCP | Simulação | Idempotência | Entrada |
|---|---|---|---|---|---|---|---|---|---|
| `bling.status.consultar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | — |
| `bling.produtos.consultar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `bling.categorias.consultar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `busca:string` |
| `bling.estoque.consultar` | planejada | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `bling.precos.consultar` | planejada | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `bling.produtos.preparar_cadastro` | planejada | propor | MEDIUM | não | sim | sim | sim | chave | `rascunho*:object` `fontes*:array` |
| `bling.produtos.preparar_atualizacao` | ativa | propor | MEDIUM | não | sim | sim | sim | chave | `sku*:string` `campos*:object` `fontes*:array` |
| `bling.categorias.preparar_alteracao_lote` | ativa | propor | MEDIUM | não | sim | não | sim | chave | `skus*:array` `escolhas:object` |
| `bling.categorias.preparar_criacao` | ativa | propor | MEDIUM | não | sim | não | sim | chave | `nome*:string` `pai_id:string` `fontes*:array` |
| `bling.produtos.criar` | desligada | executar | MEDIUM | sim | não | não | sim | chave | `corpo*:object` |
| `bling.produtos.alterar` | ativa | executar | MEDIUM | sim | não | não | sim | chave | `id*:string` `corpo*:object` |
| `bling.categorias.criar` | ativa | executar | MEDIUM | sim | não | não | sim | chave | `corpo*:object` |
| `bling.produtos.confirmar` | desligada | executar | LOW | sim | não | não | sim | chave | `id*:string` |

- **`bling.status.consultar`** — Situação da conexão com o Bling e da última sincronização.
  - *Verificação:* Leitura de bling_conexoes.
  - *Recuperação:* Repetir a leitura; é segura.
- **`bling.produtos.consultar`** — Consulta um produto no Bling pelo SKU (leitura em tempo real, sem custo nem fornecedor).
  - *Verificação:* Resposta do Bling filtrada por lista de campos permitidos.
  - *Recuperação:* Repetir a leitura; é segura.
- **`bling.categorias.consultar`** — Lista as categorias de produto do Bling.
  - *Verificação:* Resposta do Bling.
  - *Recuperação:* Repetir a leitura; é segura.
- **`bling.estoque.consultar`** — Saldo de estoque de um produto no Bling.
  - *Verificação:* Resposta do Bling.
  - *Recuperação:* Repetir a leitura; é segura.
- **`bling.precos.consultar`** — Preço atual de um produto no Bling (sem preço de compra/custo).
  - *Verificação:* Resposta do Bling.
  - *Recuperação:* Repetir a leitura; é segura.
- **`bling.produtos.preparar_cadastro`** — Prepara (sem gravar) o cadastro de um produto novo no Bling: confere duplicidade por SKU/GTIN e monta a proposta.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`bling.produtos.preparar_atualizacao`** — Prepara (sem gravar) a alteração de campos permitidos de um produto: lê o Bling agora, monta antes/depois e cria a proposta.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`bling.categorias.preparar_alteracao_lote`** — Prepara (sem gravar) a troca da categoria de produtos no Bling a partir das sugestões de categoria JÁ APROVADAS pelo lojista: lê a categoria atual no Bling agora, monta antes/depois e cria a proposta. Só a categoria; só os SKUs informados.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`bling.categorias.preparar_criacao`** — Prepara (sem gravar) a criação de uma categoria de produto no Bling: confere duplicidade e pai nas categorias do Bling agora e cria a proposta de aprovação.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`bling.produtos.criar`** — Cria produto no Bling (POST /produtos).
  - *Verificação:* Ler o produto no Bling e comparar com o enviado.
  - *Recuperação:* Timeout => desconhecido; reconciliar por SKU/GTIN antes de repetir.
- **`bling.produtos.alterar`** — Altera campos permitidos de um produto no Bling (PATCH /produtos/{id}).
  - *Verificação:* Ler o produto e comparar campo a campo.
  - *Recuperação:* Timeout => desconhecido; ler o produto e comparar antes de repetir.
- **`bling.categorias.criar`** — Cria categoria de produto no Bling (POST /categorias/produtos).
  - *Verificação:* Listar categorias e localizar a criada.
  - *Recuperação:* Timeout => desconhecido; listar e procurar pelo nome/pai antes de repetir.
- **`bling.produtos.confirmar`** — Leitura de confirmação após gravação (parte do executor).
  - *Verificação:* Compara com o esperado.
  - *Recuperação:* Repetir a leitura.

## Grupo: engenharia

| Id | Estado | Permissão | Risco | Aprovação | Chat | MCP | Simulação | Idempotência | Entrada |
|---|---|---|---|---|---|---|---|---|---|
| `engenharia.oem.buscar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `codigo*:string` `incluir_a_confirmar:boolean` |
| `conecta.codigo.propor` | ativa | propor | LOW | não | sim | sim | não | chave | `sku*:string` `tipo*:string` `valor*:string` `fonte*:string` `confianca:number` |
| `conecta.aplicacao.propor` | ativa | propor | LOW | não | sim | sim | não | chave | `sku*:string` `modelo*:string` `motorizacao:string` `ano_inicial:integer` `ano_final:integer` `fonte*:string` `confianca:number` |
| `engenharia.taxonomia.buscar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `texto*:string` |
| `engenharia.duplicidade.detectar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku:string` `gtin:string` `nome:string` |
| `engenharia.compartilhamento.sugerir` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `codigo*:string` `incluir_a_confirmar:boolean` |
| `engenharia.loja.pecas_do_veiculo` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `versao_id*:string` `ano:integer` |
| `engenharia.intercambio.listar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `codigo*:string` `incluir_a_confirmar:boolean` |
| `engenharia.bula.verificar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `engenharia.loja.filtros` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | — |
| `engenharia.consulta.interpretar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `texto*:string` |
| `engenharia.loja.condicoes` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `cep:string` |
| `engenharia.oem.pesquisar` | planejada | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku:string` `texto:string` |
| `engenharia.cruzados.verificar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `engenharia.fabricantes.identificar` | planejada | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` |
| `engenharia.aplicacoes.validar` | ativa | leitura | LOW | não | sim | sim | não | nao_se_aplica | `sku*:string` `ano:integer` |
| `engenharia.genealogia.organizar` | planejada | propor | MEDIUM | não | sim | sim | não | chave | `sku*:string` `relacoes*:array` |
| `engenharia.taxonomia.construir` | planejada | propor | MEDIUM | não | sim | sim | não | chave | `nos*:array` |
| `engenharia.classificacao.propor` | planejada | propor | LOW | não | sim | sim | não | chave | `sku*:string` `no_id:string` `fonte*:string` |

- **`engenharia.oem.buscar`** — Busca direta por código OEM: DNA da peça (classe, fabricante, fonte), aplicações por VERSÃO do veículo, modelo do motor, referências cruzadas diretas e SKUs da loja. Só dado aprovado, salvo pedido.
  - *Verificação:* Leitura do catálogo técnico global; nada é deduzido quando não há registro.
  - *Recuperação:* Repetir a leitura; é segura.
- **`conecta.codigo.propor`** — Propõe um código de referência (OEM/fabricante/cruzado) com fonte.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`conecta.aplicacao.propor`** — Propõe aplicação veicular (modelo, motor, anos) com fonte.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`engenharia.taxonomia.buscar`** — Busca nós da taxonomia de autopeças por texto.
  - *Verificação:* Leitura de taxonomia_nos.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.duplicidade.detectar`** — Detecta CANDIDATOS a duplicidade por SKU, GTIN ou nome (sem acento e sem pontuação) no espelho. Sem filtro, varre a loja. Não mescla nada.
  - *Verificação:* Comparação no espelho; variações do mesmo pai não contam.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.compartilhamento.sugerir`** — A partir de um código OEM já aprovado, sugere OUTROS veículos que usam o mesmo motor (ex.: montadoras parceiras). Resultado é HIPÓTESE: compartilhar motor não prova que a peça serve; nunca vira anúncio sem prova para a versão.
  - *Verificação:* Só aplicações aprovadas como ponto de partida; cada candidata exige prova.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.loja.pecas_do_veiculo`** — Peças da loja (publicadas, com estoque) com aplicação aprovada para uma versão de veículo, opcionalmente num ano.
  - *Verificação:* Cruza grafo do veículo com produto_pecas_ref aprovado.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.intercambio.listar`** — Lista a MESMA peça fabricada por outras marcas (relação direta, sem transitividade), com fabricante, papel (sistemista, fabricante de motor...), tipo de relação e evidência. Referência cruzada não prova equivalência.
  - *Verificação:* ref_cruzada com fonte; só aprovado por padrão.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.bula.verificar`** — Bula técnica do SKU: medidas exigidas para a família (mm, espessura, altura...) que estão aprovadas ou faltando, e contraindicações de montagem aprovadas. Sem a bula completa a peça não é 'pronta'; medida nunca é inventada.
  - *Verificação:* Medida aprovada exige fonte e valor.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.loja.filtros`** — Filtros da vitrine calculados do dado aprovado: categorias com ícone, montadoras e fabricantes dos produtos publicados com estoque.
  - *Verificação:* Só publicado, com estoque e ligação aprovada.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.consulta.interpretar`** — Interpreta uma pergunta de cliente em linguagem natural (ex.: 'qual é o motor para o HR 2011?'): reconhece veículo, ano e peça SÓ pelo cadastro, e devolve o que falta perguntar. Não inventa modelo nem peça; ambiguidade vira pergunta.
  - *Verificação:* Vocabulário vem do banco; termos desconhecidos ficam em nao_reconhecido.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.loja.condicoes`** — Condições comerciais APROVADAS da loja (formas de pagamento e regra de entrega por CEP). Sem cadastro devolve lacunas e pede o CEP; nunca promete prazo, frete ou pagamento que a loja não cadastrou.
  - *Verificação:* Só o que o lojista cadastrou e aprovou.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.oem.pesquisar`** — Pesquisa código OEM em fontes autorizadas.
  - *Verificação:* Cada resultado traz fonte e data.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.cruzados.verificar`** — Lista os códigos cruzados DIRETOS das peças ligadas ao SKU, com status e evidência. Sem transitividade; ausência de relação = não confirmado.
  - *Verificação:* Relação técnica com fonte.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.fabricantes.identificar`** — Identifica e classifica o fabricante da peça.
  - *Verificação:* Fonte registrada.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.aplicacoes.validar`** — Valida aplicações do SKU por VERSÃO do veículo no mercado BR, opcionalmente para um ano. Devolve confirmada ou nao_confirmada, nunca incompatível.
  - *Verificação:* Fonte e verificação registradas.
  - *Recuperação:* Repetir a leitura; é segura.
- **`engenharia.genealogia.organizar`** — Propõe relações da genealogia automotiva (montadora → … → componente) com procedência.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`engenharia.taxonomia.construir`** — Propõe novos nós/relacionamentos da taxonomia, sempre com fonte.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.
- **`engenharia.classificacao.propor`** — Propõe a classificação de um produto na taxonomia.
  - *Verificação:* A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.
  - *Recuperação:* Descartar o rascunho ou criar nova versão; nada externo foi alterado.

## Grupo: desenvolvimento

| Id | Estado | Permissão | Risco | Aprovação | Chat | MCP | Simulação | Idempotência | Entrada |
|---|---|---|---|---|---|---|---|---|---|
| `dev.docs.consultar` | planejada | leitura | LOW | não | não | não | não | nao_se_aplica | `texto*:string` |
| `dev.github.consultar` | planejada | leitura | LOW | não | não | não | não | nao_se_aplica | `caminho*:string` |
| `dev.codigo.preparar` | planejada | propor | HIGH | sim | não | não | não | chave | `descricao*:string` |
| `dev.pr.propor` | planejada | propor | HIGH | sim | não | não | não | chave | `titulo*:string` |
| `dev.testes.executar` | planejada | simular | MEDIUM | sim | não | não | não | nao_se_aplica | `suite*:string` |

- **`dev.docs.consultar`** — Consulta a documentação técnica versionada do projeto.
  - *Verificação:* Fonte e versão.
  - *Recuperação:* Repetir.
- **`dev.github.consultar`** — Consulta o GitHub com escopo limitado (somente leitura).
  - *Verificação:* Commit/versão.
  - *Recuperação:* Repetir.
- **`dev.codigo.preparar`** — Prepara alteração de código como proposta (não aplica).
  - *Verificação:* Revisão humana do diff.
  - *Recuperação:* Descartar a proposta.
- **`dev.pr.propor`** — Propõe um pull request de desenvolvimento (rascunho).
  - *Verificação:* Revisão humana.
  - *Recuperação:* Fechar o PR.
- **`dev.testes.executar`** — Executa testes em ambiente isolado. Nunca em produção.
  - *Verificação:* Relatório do teste.
  - *Recuperação:* Repetir no ambiente isolado.

## Campos do produto no Bling

Pode ser **alterado** pelo Nano.ia (somente após aprovação e com a escrita liberada): `nome`, `descricaoCurta`, `descricaoComplementar`, `marca`, `gtin`, `pesoLiquido`, `pesoBruto`, `dimensoes`, `categoria`.
**Nunca** é lido para o LLM nem alterado: `tributacao`, `ncm`, `cest`, `fornecedor`, `fornecedores`, `precoCusto`, `precoCompra`, `preco`, `estoque`, `codigo`, `situacao`, `formato`.

| Campo Conecta.IA | Caminho no Bling | Tipo | Conferido na documentação oficial |
|---|---|---|---|
| `nome` | `nome` | texto | **não** |
| `marca` | `marca` | texto | **não** |
| `gtin` | `gtin` | gtin | **não** — 8, 12, 13 ou 14 dígitos |
| `descricao_curta` | `descricaoCurta` | texto | **não** |
| `descricao_complementar` | `descricaoComplementar` | texto | **não** |
| `peso_kg` | `pesoBruto` | numero_positivo | **não** — o espelho lê pesoBruto antes de pesoLiquido; confirmar com o lojista qual gravar |
| `largura_cm` | `dimensoes.largura` | numero_positivo | **não** |
| `altura_cm` | `dimensoes.altura` | numero_positivo | **não** |
| `profundidade_cm` | `dimensoes.profundidade` | numero_positivo | **não** |
| `categoria_bling_id` | `categoria.id` | id_numerico | **não** — categoria precisa existir no Bling (bling_categorias) |

Campo sem equivalente no Bling (aplicação veicular, genealogia, equivalências, códigos cruzados) **não é enviado**: fica só no Conecta.IA, ligado ao identificador do produto no ERP.
