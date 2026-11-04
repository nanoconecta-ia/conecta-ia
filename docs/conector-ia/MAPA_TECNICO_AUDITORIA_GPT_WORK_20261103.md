# Mapa técnico verificável — Conecta.IA / Nano / Bling
**Levantamento por ChatGPT, 2026-11-03 (UTC).** Escopo: leitura dos conectores GitHub e Supabase e documentação oficial Bling. Documento de auditoria; não é autorização de deploy, migração ou escrita. **Fonte de verdade:** banco/Edge Functions para estado publicado, GitHub para código e propostas, Bling para dados comerciais.

## 1. Componentes e fluxo
```text
Usuário -> Painel/Assistente.tsx e Nano -> Edge Function assistente -> ferramentas e regras -> Bling API / Supabase
Agente externo -> conector-mcp (chave por loja ou OAuth; escopos leitura/propor) -> RPCs / BlingLeituraReal
Agente pareado -> conecta-gateway (sessão Pair) -> RPCs e auditoria -> dados da loja
Bling OAuth -> bling-conectar / bling-callback / bling-renovar -> bling_conexoes
Bling API -> bling-sync -> produtos e snapshots no Supabase -> catálogo/taxonomia
Bling webhook (PR #277, NÃO PUBLICADO) -> assinatura HMAC -> sync_eventos -> processador -> espelho
```
**Não criar segundo espelho:** reutilizar `produtos`, `bling_snapshots`, `bling_snapshot_produtos`, `bling_snapshot_categorias`, `bling_snapshot_contatos`, `sync_eventos` e `sync_erros`. O PR #277 prevê explicitamente reutilizar fila e espelho existentes.

## 2. Evidência de produção — Supabase projeto dsfzhsrudriqkumtlqwj
Consulta de metadados read-only `list_tables`, `list_edge_functions`, `list_migrations`. Quantidades são estimativas retornadas pelo conector, não contagem transacional:
- `produtos` 42; `produto_enriquecimento` 26; `produto_imagens` 0.
- `bling_snapshots` 9; `bling_snapshot_produtos` 378; `bling_snapshot_categorias` 585; `bling_snapshot_contatos` 27.
- `bling_conexoes` 1; `sync_eventos` 0; `sync_erros` 1; `auditoria` 562.
- `taxonomia_nos` 79; `bling_categorias` 65; `bling_categoria_taxonomia` 66; `marcas` 0; `produto_codigos` 0; `produto_aplicacoes` 0.
- `montadoras` 10; `modelos` 10; `versoes` 0; `motores` 10; `versao_motor` 0; `pecas_ref` 9; `pecas_aplicacoes_tecnicas` 4.
- `conversas` 112; `mensagens` 412; `agente_propostas` 4; `agente_chamadas_ferramenta` 17; `contexto_sessoes` 1.
- RLS aparece habilitada em todas as tabelas `public` listadas; não foi feita auditoria de políticas individuais.
- Edge Functions ACTIVE: `assistente` v23, `conecta-gateway` v6, `conector-mcp` v4, `bling-sync` v7, `bling-conectar` v6, `bling-callback` v6, `bling-renovar` v4, `ia-config` v4, entre outras.
- **Não consta** `bling-webhook` na lista de funções publicadas.
- Histórico de migrations retornado termina em `20261103000006_contexto_extensao`. **Não constam** `20261103000007_ia_gratuito` nem `20261103000008_bling_webhook`. Atenção: SQL executado manualmente pode não aparecer no histórico; conferir presença real de objetos antes de concluir ausência.
- `conector-mcp` publicado v4 apesar do comentário antigo do arquivo `index.ts` dizer "NÃO IMPLANTADA nesta fase": comentário desatualizado; verificar funcionalidade por teste autenticado, não pelo comentário.

## 3. Código e documentação verificados
- Gateway Pair: `supabase/functions/conecta-gateway/index.ts`, valida sessão, audita ferramenta, integra OAuth; `verify_jwt=false` exige autenticação própria e revisão de exposição.
- Gateway MCP: `supabase/functions/conector-mcp/index.ts`, valida hash da chave ou OAuth por recurso, traduz escopos, limita chamadas, injeta contexto de loja e porta Bling somente leitura.
- Webhook: PR #277 (rascunho) contém desenho, código, testes e migração **não aplicada**. Documento: `docs/conector-ia/DESENHO_WEBHOOK_BLING.md` na branch `docs/desenho-webhook-bling`.
- Matriz de ferramentas: PR #279 (rascunho), `docs/conector-ia/MATRIZ_COBERTURA_BLING.md` na branch `docs/matriz-cobertura-bling`.
- PR #280 integrado ao main: correção `antes={}` e proteção contra duplicidade em **testes com Bling simulado**; escrita real permanece bloqueada.
- Issue #278: documentação oficial API v3, OAuth, webhooks, vendas, estoque, fiscal, dashboards e regras de não escrita.

## 4. Lacunas e riscos priorizados
**P0 — consistência e segurança**
1. Confirmar se `bling_conexoes.bling_company_id` está preenchido; desenho do PR #277 afirma que não é populado. Sem identificação da empresa, eventos não devem ser aplicados à loja.
2. Não ligar webhook sem verificar HMAC `X-Bling-Signature-256`, isolamento de loja, deduplicação `eventId`, eventos fora de ordem e processamento <5s.
3. Verificar grants de funções SECURITY DEFINER, `verify_jwt=false`, segredos e autorização de chamadas MCP; nunca registrar tokens.
4. Não confundir `ACTIVE` com teste funcional, nem commit com deploy. Confirmar versão em produção e endpoint autenticado.
**P1 — integridade comercial**
5. Manter `bling-sync` como reconciliação e definir frescor do espelho; o Bling é fonte oficial de estoque e preço.
6. Comparar `produtos` vs snapshots antes de criar qualquer tabela/espelho novo. Não duplicar SKU, nem cadastrar em Bling sem aprovação.
7. Completar mapeamento técnico com evidência: `marcas`, `produto_codigos`, `produto_aplicacoes`, `versoes`, `versao_motor` vazios no levantamento.
**P2 — cobertura do agente**
8. Matriz PR #279 aponta estoque ao vivo, preço e pedidos como lacunas das ferramentas do Nano; validar contratos no OpenAPI antes de implementar.
9. Testar fallback gratuito com dados saneados e sem custo/fornecedor/fiscal; não pressupor migração/deploy.
10. Exigir prova ponta a ponta com SKU `CI000016` (Bling ID `16721657772`, bomba d'água HR/K2500 8V), sem alterar cadastro.

## 5. Contrato Bling webhook oficial
Fonte: https://developer.bling.com.br/webhooks (consultada 2026-11-03).
- Requer escopo do recurso; configurar servidor e recursos no aplicativo.
- HMAC SHA-256 do corpo com client secret, cabeçalho `X-Bling-Signature-256`.
- Eventos podem duplicar ou chegar fora de ordem; `eventId` é identificador do evento.
- Responder 2xx em até 5 segundos; retentativas por até 3 dias; falha persistente pode desabilitar o recurso.
- Recursos incluem `product`, `stock`, `virtual_stock`, `order`, `invoice`, etc. **Somente product e stock** no escopo inicial do PR #277.

## 6. Próximos testes de leitura (a executar; NÃO realizados nesta auditoria)
- Consultar RPC e colunas de `bling_conexoes` para presença de `bling_company_id` sem expor segredos.
- Conferir definições e grants de `sync_eventos`, `sync_erros`, `loja_por_bling_company`, `mcp_chave_validar` e `oauth_validar_para_recurso`.
- Verificar último `bling-sync` bem-sucedido, backlog, divergências de snapshots e erros.
- Validar ferramentas MCP com autenticação autorizada e resposta saneada; não criar chaves por esta auditoria.
- Comparar head dos PRs #277/#279 com main antes de merge; inspecionar CI e artefatos.
- Validar leitura real de CI000016 no Bling e comparar com espelho sem modificar o ERP.

## 7. Fontes rastreáveis
- https://github.com/nanoconecta-ia/conecta-ia/issues/278
- https://github.com/nanoconecta-ia/conecta-ia/pull/277
- https://github.com/nanoconecta-ia/conecta-ia/pull/279
- https://github.com/nanoconecta-ia/conecta-ia/pull/280
- https://github.com/nanoconecta-ia/conecta-ia/blob/main/supabase/functions/conector-mcp/index.ts
- https://github.com/nanoconecta-ia/conecta-ia/blob/main/supabase/functions/conecta-gateway/index.ts
- https://developer.bling.com.br/webhooks

**Regra:** nenhum merge, deploy, migração, escrita no Bling ou mudança de credenciais foi autorizado por este documento.