# Provedor gratuito (OpenRouter) no mesmo lugar do Gemini

Decisão do dono (2026-11-03): o gratuito vira provedor de verdade, junto do Gemini, com três modos, e quando assume vê **só dados da loja já saneados, em leitura**.

## Diagnóstico que motivou
- Só havia o Gemini cadastrado (`gemini-3.6-flash`). Na última semana, **59 de 138 turnos concluídos falharam** (desfecho `falhou`).
- O "gratuito" antigo só respondia glossário público (ex.: "o que é turbocompressor"), dependia de um segredo de servidor (`freellm`/`NANO_FREE_FALLBACK_OPENROUTER_KEY`), de lista de lojas e de consentimento por sessão. **Nunca foi acionado**, por isso "não respondia".

## Modos (Integrações de IA → Gratuito (OpenRouter))
| Modo | Efeito |
|---|---|
| Desligado | Não responde nem aparece na lista de modelos. A chave cifrada é mantida. |
| Manual | Aparece na lista de modelos do chat; só responde se for escolhido. |
| Automático | Se o modelo escolhido falhar por sobrecarga/limite (429), falha do provedor (502) ou tempo (504), o Nano troca **na mesma pergunta** para o gratuito e informa qual modelo respondeu. |

A chave `sk-or-v1-...` é guardada **cifrada no servidor** (como a do Gemini); o formato é validado para nunca enviar outra credencial ao OpenRouter. Ligar manual/automático pede a **autorização explícita** do dono (registrada na auditoria).

## O que o gratuito vê e faz
- **Só leitura:** apenas `bling_consultar_produto`. **Nenhuma** proposta, gravação, pesquisa externa ou anexo.
- Dados já saneados; nunca custo, fornecedor, dado fiscal ou credenciais. Perguntas estruturadas (produto ativo, seleção) continuam respondidas direto do banco, sem IA.
- O OpenRouter gratuito pode registrar as conversas (aviso mostrado ao dono).

## Quando a troca automática NÃO acontece
Modo manual/desligado; erro de configuração (chave recusada 401, provedor não configurado); falha antes de chamar o provedor; texto já mostrado ao lojista; qualquer **proposta** já criada no turno; turno com **anexo**.

## Registro
`desfecho = contingencia_automatica`, `provedor = openrouter_free`, `provedor_efetivo = openrouter-free`, `troca_de`, `troca_motivo`; o consumo de tokens vai para o gratuito.

## Aplicação (nada feito até o aval)
1. `Preparar-Aplicacao.ps1 -Etapa ia-gratuito` (SQL Editor). **Antes** de publicar `assistente` e `ia-config`.
2. Deploy de `assistente` e `ia-config` (cliques do dono).
3. Painel (`painel-pages`).
4. Em Integrações de IA: colar a chave do OpenRouter, **Salvar**, **Testar chave**, escolher o modo.
Reversão: `IA_GRATUITO_REVERSAO.sql` (bloqueia se ainda houver chave do gratuito).

## Teste real
1. Salvar a chave e escolher **Manual**; no chat escolher "Gratuito (OpenRouter)" e perguntar "qual o filtro do OC1224?". Deve responder e mostrar "OpenRouter Free · modelo".
2. Escolher **Automático**, voltar ao Gemini e fazer perguntas até ele falhar (ou usar uma chave inválida de limite): a resposta deve vir com o aviso "respondi com o modelo gratuito".
3. Pedir uma alteração no modo gratuito: deve dizer que só consulta.
