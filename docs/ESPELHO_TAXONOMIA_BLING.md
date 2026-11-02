# Espelhamento canônico Conecta.IA → Bling (piloto controlado)

## Objetivo
Transferir **somente campos técnicos homologados** da camada de enriquecimento para o produto **já existente** no Bling, mediante aprovação por campo, sem depender de Desktop Commander nem do gateway MCP próprio.

## Restrições do projeto
- Bling permanece fonte de SKU, preço, estoque, categoria oficial e tributação. Conecta.IA permanece fonte das propostas técnicas, **não** reescreve automaticamente o espelho de leitura.
- Não criar SKU ou categoria automaticamente. Resolver produto por vínculo de ID Bling + loja, validando o SKU e recusando divergência.
- Não promover nós de taxonomia com status `proposto` a categoria oficial do ERP.
- Sem equivalência OEM, aplicação, composição ou imagem sem fonte, data e evidência.
- **Sem escrita automática:** Policy Engine existente, aprovação humana por campo, `idempotency_key` e auditoria obrigatórias. Não contornar `supabase/functions/_shared/bling_ferramentas.ts`.
- Não alterar preço, estoque, NCM, CEST, CFOP, GTIN, fornecedor, custo, imagem ou categoria por enriquecimento textual.
- Não registrar segredos em frontend, logs ou GitHub; isolamento por `loja_id`.

## Mapeamento inicial

| Canônico Conecta.IA | Campo Bling | Condição |
|---|---|---|
| fabricante certificado | `marca` | Aprovação + prova de fabricante |
| nome comercial validado | `nome` | Aprovação + preservar código |
| descrição técnica | `descricaoCurta` | Aprovação + diff + evidências |
| taxonomia textual e aplicações | `descricaoComplementar` | Aprovação + status explícito do nó |
| observações de auditoria | `observacoes` | Acrescentar, jamais apagar histórico |
| categoria taxonômica | `categoria.id` | **Bloqueado** até homologação de mapeamento explícito por loja |
| códigos OEM cruzados | texto técnico | **Bloqueado** até homologação documental |
| imagens | `midia` | **Bloqueado** até identidade visual, licença e aprovação |
| preço/estoque/fiscal | respectivos campos | **Sempre fora do escopo** deste fluxo |

## Fluxo de execução
1. Ler produto Bling pelo ID vinculado e dados canônicos Conecta.IA da mesma loja.
2. Verificar status do nó, origem, data e evidências de cada campo; classificar como `homologado`, `proposto` ou `bloqueado`.
3. Gerar diff `antes/depois` campo a campo, sem valores vazios sobrescreverem dados.
4. Criar proposta no mecanismo **existente** `agente_propostas` / `agente_proposta_itens` via identidade autenticada (nunca SQL privilegiado simulando aprovação).
5. Exigir decisão explícita do lojista; enviar apenas campos aprovados pelo Policy Engine.
6. Aplicar PATCH parcial do Bling com idempotência e trilha de auditoria.
7. Reler o Bling; comparar campos autorizados e garantir que SKU, preço, estoque, fiscal e categoria não mudaram.
8. Em erro ou divergência, interromper lote, registrar falha e permitir reversão controlada dos campos alterados.

## Prova piloto: SABÓ 80692
- Bling ID: `16719464748`; SKU: `80692`; Conecta.IA nó `00e5064c-282e-4a6b-821b-80081ee63b20` (`Motor > Juntas e retentores`, **status proposto**).
- Descrição curta e complementar já foram ajustadas via conexão MCP do ChatGPT e relidas no Bling. **Não repetir escrita sem diff.**
- Pendências: composição/aplicação por ano no catálogo SABÓ, OEM, fotos originais e direitos de uso.
- A categoria Bling `14676551` permanece inalterada.
- Testes de aceite: mesmo SKU/ID, PATCH somente de campos aprovados, zero alterações fiscais/comerciais, leitura pós-PATCH igual ao diff, ausência de duplicatas, auditoria por loja, recusa de taxonomia proposta como categoria oficial.

## Critérios para integração
Implementar no código existente após localizar os adaptadores de Bling, Policy Engine, aprovação e taxonomia; não criar segundo gateway. Testar com mock, contrato e caso real somente leitura antes de liberar a primeira escrita. Este documento **não liga sincronização automática**, não publica função e não muda o banco.
