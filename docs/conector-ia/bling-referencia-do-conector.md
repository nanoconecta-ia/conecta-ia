# Bling API v3: nota de referência do Conector (memória operacional)

Regra de trabalho: **antes de cada tarefa no Bling, reler esta nota e o changelog oficial** (https://developer.bling.com.br/changelogs). Se a nota divergir da documentação, a documentação vence e a nota é corrigida no mesmo PR. Data desta versão: 2026-10-19.

## Confirmado em uso real (conta Mobis, 2026-10-19)
- `POST /produtos` (createProduct), `PATCH /produtos/{id}` (patchProduct), `GET /produtos` e `GET /produtos/{id}` funcionam e devolvem o `id` criado.
- `POST /categorias/produtos` (createProductCategory) funciona; aceita `categoriaPai.id` para subcategoria.
- NCM é gravado formatado pelo Bling (`84133090` → `8413.30.90`).
- `tipoProducao` vem `P` (Própria) por padrão se não informado; conferir se o produto é de terceiros (`T`).
- Produto novo sem categoria recebe a categoria padrão do Bling (hoje id 1072643).
- Código (SKU) de produto excluído pode ser reutilizado em produto novo.
- Listagem com `criterio=5` inclui excluídos (`situacao = E`); inativos são `I`. A lista padrão da tela do Bling mostra só ativos.
- A listagem de categorias pela API do Bling estourou 60 s duas vezes; ler categorias pelo espelho do Conecta (`bling_categorias`) em vez da API.

## Não existe nas ferramentas disponíveis hoje
- **Tags de produto:** não há campo nem rota de tags nas ferramentas conectadas (createProduct/patchProduct não têm `tags`). A busca na documentação não achou endpoint de tags na v3; tags aparecem na ajuda só como recurso da interface. **Não confirmado**: ler a referência oficial antes de concluir.
- **Excluir ou renomear categoria:** as ferramentas conectadas só criam e listam categorias. A documentação geral da v3 descreve `PUT` e `DELETE` por entidade (a guia de homologação usa `DELETE /produtos/{id}`), mas **não foi confirmado** que `PUT`/`DELETE /categorias/produtos/{id}` existam. Rota de categoria na v3: `/categorias/produtos` (antes `/categorias`).
- Produtos na v3 são segmentados em `/produtos`, `/produtos/estruturas` e `/produtos/variacoes`.

## Por que uma chamada é negada
Duas causas diferentes, que não se misturam:
1. **Recusa do Bling** (HTTP 4xx): vem com mensagem da API; tratar pelo conteúdo.
2. **Bloqueio do classificador de permissão do Claude Code** (texto "denied by the Claude Code auto mode classifier"): a chamada **nunca chegou ao Bling**. É decisão do ambiente do agente, inconsistente entre chamadas idênticas e sem motivo informado. Não é problema de documentação nem de dado. Registrar, parar, e pedir ao dono que aprove ou execute na tela do Bling. Não repetir até passar.

## Regras do dono para o Conector (2026-10-19)
- Antes de operar no Bling, consultar esta nota e o changelog, e registrar a consulta na auditoria da tarefa.
- Se uma ferramenta nega, registrar o motivo conhecido (acima) em vez de tentar de novo às cegas.
- O dono autoriza o Conector a **excluir e refazer categorias e tags** para ajustar o Bling à taxonomia do Conecta. Implementação exigida: ferramenta própria no Policy Engine (risco MEDIUM ou mais), aprovação do dono por lote, `idempotency_key`, leitura de confirmação depois e auditoria. **Escopo limitado a categorias e tags**: nunca excluir produto, nota fiscal ou o cadastro espelhado. Ainda **não implementada**.

## Fontes consultadas (trechos de busca; páginas não abertas)
- Changelog da API: https://developer.bling.com.br/changelogs
- Visão geral e métodos REST: https://developer.bling.com.br/bling-api
- Homologação de produtos (PUT/DELETE): https://developer.bling.com.br/homologacao
- Nova versão da API (rotas renomeadas): https://blog.bling.com.br/conheca-a-nova-versao-da-api-do-bling/
- Módulo de Produtos (tags na interface): https://ajuda.bling.com.br/hc/pt-br/articles/360047475233-Entendendo-o-m%C3%B3dulo-de-Produtos
