# NanoIA GPT Workspace — implementação inicial e matriz de aceite

> Estado: **branch de proposta**, não publicado; **não** altera a produção, credenciais, permissões do ERP, funções implantadas ou banco.
> A UI do painel é um ambiente da loja, não a sessão privada de ChatGPT.

## Resultado nesta branch

- **Front-end**: `#/gpt-workspace`, estação responsiva que lê via JWT/RLS apenas dados da loja. Tem indicadores reais de produtos, marcas, logística, taxonomia e motor de IA configurado (o registro de configuração **não prova** saúde de inferência). Pesquisas por SKU/nome/marca e acesso às telas atuais.
- **Qualidade do catálogo**: `qualidadeProduto.ts` marca dados realmente ausentes. Não preenche GTIN, OEM, peso ou marca por dedução.
- **Qualidade da árvore**: `taxonomiaQualidade.ts` identifica nós órfãos, ciclos e `slug` repetido entre irmãos. Isto **não é homologação de aplicação**.
- **Gateway MCP**: reusa a autenticação por hash/escopo da loja e o Policy Engine existentes; oferece o recurso `ui://conecta-ia/gpt-workspace.html` e a ferramenta de leitura `conecta_render_painel`. O resultado fornece `structuredContent` e um painel sem custos, fornecedores ou dados fiscais. Continua com as outras ferramentas já existentes, conforme a permissão da chave.
- **Memória orquestradora, estágio 1**: histórico de conversa próprio do Conecta.IA; a inclusão de tarefas, propostas e conhecimento técnico no prompt fica **desligada por padrão**. O usuário ativa a opção **Contexto técnico** por sessão; `contexto_operacional: true` é necessário em cada pedido. Não há acesso à memória privada, conversas ou assinatura do ChatGPT pessoal.
- **Confiabilidade**: o despachante não apresenta êxito se a auditoria falha. Resposta truncada não é concluída. Fallback multimodelo requer autorização explícita e é bloqueado se já houve streaming ou chamadas de ferramentas.

## Arquitetura

```text
ChatGPT (plugin MCP) ── HTTPS/MCP + chave de leitura da loja
                             |
                             v
                   conector-mcp (SEM deploy)
                             |
                 gateway → Policy Engine → auditoria
                             |
       +---------------------+---------------------+
       |                     |                     |
  Produtos/Taxonomia   Bling GET escopado     Propostas versionadas
       |                                          |
  fonte + evidência                        aprovação humana
       |
NanoIA no painel: conector-chat (SEM deploy) ← provedor selecionado
       |
  contexto da conversa + memória técnica opt-in
```

A API do GPT/NanoGPT/Gemini/Claude é **motor**, não fonte de dados nem identidade do tenant. O Conecta.IA conserva IDs de produto/loja, metadados, política e auditoria. Não expor `service_role`, OAuth Bling, credenciais de custo/fornecedor, nem `NCM`/informações fiscais a provedores intermediários. Escrita permanece desligada.

## Passos para conexão no ChatGPT

1. Confirmar plano/permissão para **servidor MCP personalizado**, conforme documentação atual: https://help.openai.com/pt-br/articles/12584461-connecting-custom-mcp-servers-in-chatgpt . O suporte completo é controlado no workspace; não assumir que um plano pessoal poderá conectar.
2. Homologar e implantar `conector-mcp` **somente após aprovação**, com `verify_jwt=false` porque faz validação própria de chave por loja. Nunca deixar endpoint sem autenticação real.
3. Emitir chave MCP **somente leitura**, com expiração/revogação, no painel da loja. **Nunca colar a chave em chat, commit ou issue**.
4. Adicionar URL HTTPS de `conector-mcp` como servidor MCP personalizado nas configurações do workspace compatível; configurar autenticação e testar `initialize`, `tools/list`, `resources/list`, `tools/call`, `resources/read`.
5. Instalar o plugin e invocá-lo via `@`, quando disponível. O painel do plugin é renderização MCP Apps independente do painel web da loja. A existência do código **não instala o app automaticamente**.

## Regras da taxonomia e cadastro

Fonte do cadastro operacional: **Bling**. No Conecta.IA, dados técnicos versionados e comprovados devem respeitar:

| Identidade | Regra |
|---|---|
| Produto | Id do Bling + SKU + código fabricante/importador + GTIN quando real. Deduplicar antes de propor novo cadastro |
| Aplicação | Montadora, veículo, versão, motor, ano-modelo e período de comercialização no Brasil; fonte e data obrigatórias |
| Peça | Referência OEM, fabricantes, medidas (mm), variante, contraindicações, proveniência, fonte e homologação |
| Logística | Peso, altura, largura, profundidade e volumes positivos e comprovados; não inventar números |
| Fiscal | NCM/CFOP, fornecedor e custo ficam no sistema de origem; nenhuma mutação automática em produto com NF vinculada |
| Aprovação | Propostas antes/depois com hash e evidência; IA não aprova nem executa |

O grafo hierárquico não prova equivalência técnica. Um código de motor compartilhado não garante intercambiabilidade de peça. Todos os nós propostos permanecem pendentes de homologação humana.

## Critérios para concluir antes de merge/deploy

- [ ] Executar `npm test` / `npm run build` em `painel` e testes do backend, além do `tsc` em `supabase/functions`.
- [ ] Validar visualmente 390×844, 360×740, 1280×800; contraste, teclado e ausência de overflow.
- [ ] Simular falha de auditoria e verificar `ok=false`, sem nova chamada automática.
- [ ] Provar que fallback não replica proposta nem mistura textos de dois provedores; sem opt-in, não enviar prompt para provedor alternativo.
- [ ] Provar isolamento por duas lojas distintas e revogação imediata de chave.
- [ ] Conferir transporte MCP real e widget em host compatível (MCP Apps), com versão do protocolo, CSP e autenticação.
- [ ] Confirmar que custos, fornecedores, dados fiscais e segredos não aparecem em tool result/widget.
- [ ] Validar inclusão de contexto técnico somente com consentimento e política de retenção do histórico (atualmente há persistência no banco).
- [ ] Confirmar código publicado/hash dos artefatos; testes locais ou tipo-check **não** equivalem a produção.
- [ ] Fazer backup apropriado antes de qualquer migração de banco ou consolidação do assistente legado.

## Não entregue nesta etapa

Não há credencial GPT instalada automaticamente; não há app já conectado ao ChatGPT; não há merge nem deploy de `conector-chat`/`conector-mcp`. Não foi feita migração de histórico entre os esquemas `mensagens` e `agente_mensagens`, nem automação de escrita, catálogo completo de códigos OEM ou homologação de taxonomia. Essas tarefas exigem dados de origem, ambiente de teste e validação separada.

Próximas fases: (1) CI e homologação MCP/UI; (2) orquestração persistente com consentimento/TTL/exclusão; (3) cadastro por proposta e reconciliação no Bling; (4) enriquecimento fiscal/logístico com fontes; (5) consolidação segura do chat legado após migração verificada.
