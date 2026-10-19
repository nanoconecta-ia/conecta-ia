# Plano de validação do produto piloto (Mobis Auto Peças)

Objetivo: provar o fluxo completo com **um produto real**, em passos pequenos e com evidência, **sem escrever no Bling até a decisão do dono**.
Nada deste plano foi executado em produção.

## Escolha do produto
Candidato: **SKU 80692** (Jogo de Juntas Completo do Motor HR / K2500 2.5 16V D4CB, marca Sabó) — é o produto com mais dados reais no Bling
(marca, GTIN, descrição curta com referências cruzadas, peso e dimensões). O dono confirma o produto antes (pode ser o cabeçote, se existir no Bling;
dos 4 espelhados hoje, `CI003696` inclui cabeçote no nome).

## Fases (cada uma termina com evidência anexada ao PR/relatório)
| Fase | O que acontece | Escreve em algo? | Evidência |
|---|---|---|---|
| P0 | Homologação: aplicar migrações num projeto descartável; implantar funções; colar chave de IA | só homologação | `docs/conector-ia/capturas`, log de deploy |
| P1 | Chat → consulta ao Bling (leitura) → catálogo → taxonomia | não | trecho do log `agente_chamadas_ferramenta` |
| P2 | Pesquisa técnica e classificação automotiva com **fontes** (OEM/aplicações) | só propostas | proposta com fontes e confiança; nada inventado (campo sem evidência fica vazio) |
| P3 | Enriquecimento + mapeamento nativo (campos do Bling vs camada Conecta.IA) | só propostas | matriz aplicada ao produto; campos sem equivalente ficam só no Conecta.IA |
| P4 | Prévia antes/depois, banner e página pública (sem imagem de terceiros) | não | capturas desktop/mobile da prévia |
| P5 | Aprovação versionada pelo lojista (e teste de que mudar a proposta invalida) | decisão registrada | linha em `agente_aprovacoes` + hash |
| P6 | **Ensaio** (simulação) contra o produto real lido (leitura) | `agente_simulacoes` apenas | relatório do ensaio |
| P7 | Execução **interna** aprovada (enriquecimento no Conecta.IA) + publicação no site de teste | camada Conecta.IA | `agente_operacoes` com evidência de leitura |
| P8 | *(Só com autorização específica do dono)* liberar `bling.produtos.alterar` para **um** campo não fiscal, produto de teste, e conferir por leitura | **Bling** | liberação com referência; leitura de confirmação; plano de reversão |

P8 só começa quando: mapeamento do campo conferido na documentação oficial, escopo do app confirmado, teste com mock verde, reversão desenhada (valor anterior guardado em `antes`) e o dono escrever a autorização.

## Verificações obrigatórias em cada fase
- O Bling recebeu **somente** campos permitidos (conferir `agente_operacoes.requisicao`).
- Nenhum link de imagem de fornecedor/concorrente aparece no catálogo público.
- Produto incompleto não publica; imagem sem direitos não publica.
- A troca de modelo no meio do fluxo não perde tarefa, proposta nem auditoria.

## Critérios de abortar
Qualquer dado inventado; qualquer campo fiscal/custo/fornecedor visível ao LLM; qualquer escrita não aprovada; divergência entre a leitura do Bling e o `antes`; hash divergente na execução.
