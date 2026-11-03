# Contexto Vivo — espelhamento operacional Bling ↔ Conecta.IA ↔ Nano.IA

Status: proposta técnica para homologação. **Não habilitado em produção.**

## Objetivo
O lojista seleciona, abre ou edita um produto sem informar SKU ao agente. O Nano obtém o contexto **da sessão autenticada**, nunca por inferência de linguagem. Seleção e navegação são eventos efêmeros; salvar no Bling é operação persistente distinta.

## Limites e fontes de verdade
- Bling: cadastro comercial, preço, estoque, confirmação de gravação.
- Conecta: interface própria, espelho de leitura, enriquecimento separado, contexto de sessão.
- Nano via conector-mcp existente: leitura de contexto e ferramentas autorizadas. **Não criar um segundo gateway MCP.**
- Bling UI: somente por ponte autorizada de navegador; API Bling não revela automaticamente cliques.
- Não capturar CPF/CNPJ, tokens, custo, fornecedor ou conteúdo fiscal no barramento de contexto.
- Nenhuma escrita no Bling sem Policy Engine, autorização humana por campo, idempotency_key e auditoria.
- Não modificar NanoShell IA nem outro projeto Supabase.

## Contrato
Ver `src/lib/contexto-vivo/contrato.ts`. Identificadores de loja, usuário e sessão são atribuídos/verificados pelo backend; não confiar em IDs declarados pelo cliente. Os IDs de produto são referências internas de sessão; resolver o SKU somente no backend.

## Fluxo proposto
1. Frontend emite seleção completa, abertura ou fechamento de produto.
2. Endpoint autenticado valida usuário, associação à loja, produtos, origem, sequência monotônica e tamanho máximo da seleção.
3. Estado da sessão recebe nova versão com compare-and-swap; evento duplicado é ignorado por eventoId.
4. Canal privado Realtime informa apenas participantes autorizados da sessão; eventos são efêmeros, não editam o ERP.
5. Ferramenta `contexto_produto_ativo` do conector-mcp obtém sessão **vinculada ao principal autenticado**; não aceita lojaId/usuarioId arbitrários nos argumentos.
6. Nano usa IDs resolvidos para consultar as ferramentas de leitura existentes do Bling.
7. Edição em andamento é rascunho; evento `produto.salvo` só após confirmação do backend/Bling e versionamento. Alterações concorrentes geram conflito explícito.

## Integração na interface original Bling
Implementar adaptador na extensão autorizada do Chrome, restrito ao domínio Bling e ao consentimento da sessão. Preferir IDs/URLs/atributos estáveis; ao não reconhecer seleção, informar `contexto_indisponivel`, **não adivinhar**. Não fazer scraping contínuo, nem injetar credenciais. A extensão não grava no Bling.

## Banco Supabase — desenho para revisão, sem migração
Reutilizar tabelas existentes de sessão, auditoria e permissões. Se não houver suporte adequado, propor tabela `contexto_sessoes` (sessao_id, loja_id, usuario_id, origem, produto_ativo_id, produtos_selecionados, versao, atualizado_em, expira_em) e registro deduplicado de eventos. Exigir RLS por sessão e loja, TTL, índices, política de retenção, revogação e teste de isolamento. **Não executar SQL até aprovação do desenho.**

## Entregas em fases
- PR A: contexto no catálogo Conecta + ferramenta de leitura no MCP existente + testes.
- PR B: adaptador Bling na extensão com homologação por versão da interface.
- PR C: propagação de gravações confirmadas, resolução de conflitos e reconciliação.
Este PR é a base contratual e documentação; não afirma entregar as fases.

## Critérios de aceite
1. Selecionar 1 e N produtos no Conecta: Nano obtém os IDs sem pedir SKU.
2. Trocar ficha atual atualiza contexto na mesma sessão; não vaza entre duas sessões ou lojas.
3. Evento duplicado/fora de ordem não regride estado.
4. Sem sessão válida, ferramenta MCP recusa acesso.
5. Editar sem salvar não altera Bling.
6. Salvar requer autorização, confirmação e versão; sem confirmação, não anunciar sucesso.
7. Reconexão/expiração revoga contexto antigo.
8. Ponte Bling demonstra leitura de clique real, sem captura de dados sensíveis.

## Bloqueios
Não fazer merge, migração, deploy ou escrita no ERP por este PR. Validar compatibilidade com OAuth MCP pendente e infraestrutura existente antes da implementação.
