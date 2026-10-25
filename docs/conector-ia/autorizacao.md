# Modelo de autorização do Gênesis

Princípio: **autonomia controlada**. Quanto maior o risco, menor a autonomia. O agente propõe; uma pessoa autenticada decide; um executor
separado faz; o banco revalida tudo e registra evidência. Nenhuma camada confia na anterior.

## Quem pode o quê

| Ator | Consulta | Propõe | Aprova | Trava | Destrava | Executa | Libera escrita no Bling |
|---|---|---|---|---|---|---|---|
| Agente no chat (GPT/Gemini/Claude) | sim (ferramentas ativas) | sim (`propor`/`preparar`) | **nunca** | não | não | **nunca** | não |
| Cliente externo via MCP (chave por loja) | conforme escopo `leitura` | conforme escopo `propor` | **nunca** | não | não | **nunca** | não |
| Editor da loja (pessoa) | sim | sim | não | sim | não | não | não |
| Lojista da loja (pessoa) | sim | sim | sim | sim | sim | dispara `executar` do aprovado | sim, com referência da evidência |
| Executor (código) | — | — | — | — | — | só item aprovado, em modo liberado | não |
| Super admin | auditoria | — | — | — | — | — | — |

Escopos de chave MCP existentes: `leitura`, `propor`, `simular`. **Não existe** escopo de aprovar nem de executar (constraint no banco).

## O que a aprovação vincula

Uma aprovação (`agente_aprovacoes`, append-only) grava: **loja**, **usuário humano** (membro lojista da loja), **agente/provedor/modelo** que
propôs, **produtos e campos** do escopo (ids dos itens), **versão e hash sha256** do conteúdo exato (itens, antes/depois, fontes, risco,
chaves de idempotência), **risco**, **expiração** (padrão 24 h, máx. 7 dias) e as **chaves de idempotência** de cada item.

- Mudou qualquer coisa → é outra proposta (`revisar` cria a versão N+1 e **invalida** a anterior). Itens enviados são imutáveis (trigger).
- Na execução o banco **recalcula o hash** e compara com o aprovado (defesa contra alteração fora do fluxo) e confere prazo e trava.
- Risco `HIGH`/`CRITICAL` exige confirmação explícita no ato de aprovar.
- Aprovar a própria operação por agente é impossível: a decisão exige `user_id` de pessoa membro lojista; não há ferramenta de aprovar; chave MCP
  não alcança `conector-aprovacoes`.

## Trava por produto

Estados: `bloqueado`, `liberado_propostas`, `pendente_aprovacao`, `aprovado_execucao`, `em_execucao`, `sincronizado`, `erro_divergencia`.
Produto bloqueado pode ser consultado e **receber sugestão** (o item entra como `travado`: aparece, não é aprovável, não executa).
Travar depois do envio tira o item do escopo; destravar é só do lojista. Produto em execução não é travado nem recebe nova proposta.

## Escrita real no ERP: três chaves independentes

1. **Aprovação humana** da versão exata (acima).
2. **Liberação por loja e ferramenta** (`agente_escrita_liberar`, só lojista, exige referência da evidência de testes/escopo; revogável). Sem ela o banco recusa iniciar a execução de qualquer item `bling.*`.
3. **Estado da ferramenta no registro** (`desligada` até conferência na documentação oficial + testes + decisão do dono). Mesmo liberada e aprovada, o Policy Engine nega.

Estado atual: **as três estão fechadas**; nenhuma escrita no Bling é possível, nem em teste, a não ser por porta simulada.

## Execução e recuperação

Abrir tentativa → Policy Engine → montar corpo só com campos permitidos → enviar → **ler de volta** → comparar → só então `confirmada` (com evidência).
Timeout ou 5xx em escrita = `desconhecida` (nunca `falhou`), sem repetir às cegas: reconcilia por leitura (prova de que gravou ou de que não gravou) e
retoma com a **mesma chave de idempotência**. Parada de emergência é conferida a cada item. Leitura divergente após gravar = `falhou` + produto em `erro_divergencia`.

## Dados que o agente nunca vê nem altera

Custo, preço de compra, fornecedor, dados fiscais (NCM, CEST, tributação), preço de venda e estoque (leitura de preço/estoque pode ser exposta; **escrita não existe**), SKU, situação.
Segredos (`service_role`, token do Bling, chaves de IA) nunca chegam ao navegador, ao LLM nem a cliente externo; log e auditoria passam por `private.sanitizar_log`.

## Conteúdo externo é dado

Resultados de ferramentas, documentos, páginas e plugins são tratados como **dados**; o prompt de sistema e o separador de contexto instruem o modelo a ignorar instruções ali contidas, e nenhuma instrução embutida consegue ampliar permissões (o Policy Engine não lê texto do modelo).
