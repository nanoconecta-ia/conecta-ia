# Conecta.IA — WhatsApp Business MCP (proposta de implementação)

Status: design inicial, não implantado. Branch isolada `feature/whatsapp-business-mcp`.

## Objetivo
Integrar o WhatsApp Business Platform da Meta ao Gateway Conecta.IA, mantendo o Bling como fonte oficial de produtos, preços e estoque. Não substituir o aplicativo WhatsApp Business do número comercial sem verificar elegibilidade à coexistência.

## Pré-requisitos de ativação
- Identificar e validar o aplicativo Meta Conecta.IA e seu vínculo ao portfólio empresarial correto.
- Confirmar WABA ID, phone_number_id, permissões e coexistência do número existente antes de registrar/migrar.
- Configurar webhook HTTPS com validação de assinatura `X-Hub-Signature-256`, challenge de verificação e deduplicação de eventos.
- Guardar tokens exclusivamente no servidor (cofre/segredos); nunca em GitHub, frontend ou logs.
- Validar requisitos e preços atuais da Meta antes de habilitar envios.

## Ferramentas MCP propostas
- `whatsapp_connection_status`: consulta metadados não sensíveis e estado de conexão.
- `whatsapp_catalog_list`: lista catálogo vinculado à conta Meta, somente leitura.
- `bling_products_search`: consulta produtos via conector existente, somente leitura.
- `catalog_sync_preview`: gera diff de produtos elegíveis, sem publicar ou editar.
- `whatsapp_message_draft`: prepara resposta para aprovação, sem enviar.
- `whatsapp_message_send`: desabilitada por padrão; exige escopo específico, consentimento, validação de política/janela ou template, confirmação humana e chave de idempotência.
- `catalog_publish`: desabilitada por padrão; exige revisão de dados, aprovação por produto, auditoria e idempotência.

## Regras de segurança
- Resolver `loja_id` pela identidade autenticada no servidor, jamais confiar em `loja_id` enviado pelo agente.
- Segregar tokens e recursos por loja; bloquear acesso cruzado; mínimo privilégio.
- Preservar SKU, GTIN, NCM, CFOP, preço e estoque do Bling. Não inventar aplicações de veículos.
- Não publicar produto incompleto, sem imagem real aprovada ou dados essenciais verificados.
- Registrar ator, recurso, diff, decisão, horário, idempotency_key e resultado sem dados sensíveis.
- Não enviar mensagens em massa sem consentimento e conformidade com regras da Meta/LGPD.

## Sequência de entrega
1. Auditar o Gateway e os adaptadores já existentes; mapear interfaces e testes.
2. Implementar leitura de status Meta e validação de webhook com testes locais e mocks.
3. Implementar prévia de sincronização Bling → Meta, com deduplicação por SKU e identificadores.
4. Implementar drafts de atendimento, depois operações de escrita atrás de aprovação humana.
5. Testar isolamento multiempresa, assinaturas inválidas, replays, rate limit e falhas externas.
6. Submeter PR rascunho. Sem merge, migração ou deploy sem autorização explícita.

## Critérios de aceite
- Testes automatizados e evidências para fluxos válidos e inválidos.
- Nenhum segredo exposto e nenhuma alteração no Bling, Meta ou Supabase de produção durante desenvolvimento.
- Plugin MCP registrado e autorizado pelo usuário na interface compatível do ChatGPT antes de declarar operação pelo chat.
