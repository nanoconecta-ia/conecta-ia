# Nano.ia × Assistente publicado: o que existe, o que falta e o menor fluxo real

Resposta ao requisito do proprietário (relayado no PR #62): *"ele tem que proporcionar isso com o espelho desse chat GPT"*.
Estado verificado em **2026-10-25** (produção só lida; nada foi alterado).

## 1. O que "espelho" pode significar (e o que cada um promete)

| Leitura | O que entrega | O que NÃO promete | Estado |
|---|---|---|---|
| **A. Experiência parecida com a do ChatGPT dentro do Conecta** (conversa contínua, histórico, voz, anexos, ferramentas, andamento e evidências), com estado e histórico do Conecta | O produto que estamos construindo: o Nano.ia | Não herda memória nem ferramentas de outro chat | Código pronto e testado; **backend não implantado** (seção 3) |
| **B. Modelo GPT por API** como um dos motores do Nano.ia | Troca de modelo no chat, com chave e limite da própria loja | Não usa a assinatura Plus nem a memória/ferramentas do ChatGPT pessoal | Suportado pelo registro de provedores (compatível OpenAI); depende de chave cadastrada |
| **C. Agente externo autorizado via MCP/Pair** (ex.: um cliente compatível usa as ferramentas do Conecta) | Operar o Conecta a partir de fora, com chave por loja e Policy Engine | **Não** prova transporte das mensagens da sessão privada do ChatGPT para o chat do Conecta | Gateway MCP e Pair prontos; MCP não implantado, Pair publicado |
| **D. Espelhar literalmente a sessão privada do ChatGPT** | — | Não há mecanismo oficial suportado verificado. **Lacuna registrada.** Sem extração de cookies, sem reutilização oculta de sessão. | **Não oferecido** |

Conclusão prática: o que dá para entregar com segurança é **A + B + C**. D fica fora até existir mecanismo oficial.

## 2. O que o Assistente publicado faz hoje × o Nano.ia completo

| Capacidade | Assistente publicado (função `assistente` v6) | Nano.ia completo (`conector-chat`) |
|---|---|---|
| Conversar com IA da loja (Gemini já cadastrado; escolha de provedor) | ✅ | ✅ (vários provedores, troca no meio da conversa) |
| Consultar produto no espelho/API do Bling, com origem e data | ✅ (cartão de evidência) | ✅ (ferramentas do registro, 56 mapeadas, 35 ativas) |
| Histórico privado por loja, retenção e auditoria | ✅ | ✅ |
| Voz (ouvir/falar) | ✅ | ✅ |
| **Anexos** (catálogo, planilha, foto) | ❌ | ✅ (código pronto) |
| **Ferramentas reais com Policy Engine** (risco, aprovação, auditoria por chamada) | ❌ só leitura direta | ✅ |
| **Propor alteração** (antes/depois, fontes, risco) e **aprovar** versionado por hash | ❌ | ✅ (Central de Inteligência + cartões no chat) |
| **Andamento** (estados da esfera, ferramenta em execução, resultado) | parcial (pensando/falando) | ✅ (SSE com estados reais) |
| **Controle de duplicidade e timeout** (timeout ⇒ `desconhecida`, reconcilia, nunca repete às cegas) | n/a (não grava) | ✅ (testes 10a/10b/10c) |
| **MCP/Pair**: agente externo usando as mesmas ferramentas | ❌ | ✅ (Gateway MCP) |
| Escrita no Bling | ❌ | **Desligada** até autorização explícita, teste com mock e auditoria |

## 3. Bloqueios reais (por que o Nano.ia completo ainda não está no ar)

Verificado no banco de produção (somente leitura):
- **Migrações da Fase 1 do agente não aplicadas** (`20261019000001`…`000009`: tabelas `agente_*`, propostas, aprovações, chaves MCP, anexos). Hoje há 0 tabelas `agente_*`.
- **Edge Functions não implantadas:** `conector-chat`, `conector-conversas`, `conector-mcp`.
- **Painel:** as telas do Nano.ia ficam escondidas por `VITE_CONECTOR_ATIVO` até o backend existir.
- **Chave de IA:** já há 1 chave cadastrada (o Assistente usa Gemini). Para GPT/Claude é preciso cadastrar a chave da própria loja, com limite mensal.
- **Bling desconectado** (status `pendente`): sem isso não há dado real para diagnosticar.
- **Ambiente de homologação** ainda não escolhido (branch Supabase pago × stack local).

Nenhum deles é resolvido por este PR. Cada passo exige autorização separada do proprietário: migração, função, painel, credenciais, custos.

## 4. O menor fluxo real e quanto dele já está provado

`comando no chat → leitura de produto → diagnóstico fundamentado → proposta → aprovação → resultado auditável`

| Passo | Código | Prova automatizada (local, Postgres real + Bling simulado) |
|---|---|---|
| Comando no chat, ferramenta real, resultado vem do banco | `conector/chat.ts`, `despacho.ts` | `aceitacao.test.ts` 1a/1b |
| Leitura de produto sem custo/fornecedor/fiscal | `handlers.ts`, `dados.ts` | `aceitacao.test.ts` 2 |
| Espelho do Bling alimenta o agente (sync → agente) | `bling_sync.ts` | `espelho_ponta_a_ponta.test.ts` (PR #71) |
| Proposta com fonte, antes lido do Bling, campo permitido | `escrita.ts`, registro | `aceitacao.test.ts` 3/4/4b |
| Aprovação presa a versão e hash; agente não aprova | RPCs de proposta | `aceitacao.test.ts` 5/5b/6 |
| Execução (mock): lê de volta, confirma com evidência | `executor.ts` | `aceitacao.test.ts` 9/9b |
| Indisponibilidade/timeout sem duplicar | `executor.ts` | `aceitacao.test.ts` 10a/10b/10c |
| **Isolamento entre lojas** | RLS + escopo na porta de dados | `rls_isolamento.sql`, `acoes.test.ts`, `gateway.test.ts` |
| Auditoria de cada etapa | tabelas de auditoria | `aceitacao.test.ts` 12 |

Suíte de aceitação local: **85 testes, 0 falhas**. O que **não** foi feito: rodar este fluxo **com loja real autorizada em produção**, porque o backend não está implantado e o Bling está desconectado.

## 5. Próxima entrega funcional (proposta, aguardando autorizações)

1. Proprietário conecta o Bling (`#/bling`) e escolhe o ambiente de homologação.
2. Aplicar as migrações da Fase 1 **primeiro no ambiente de homologação**, rodar a suíte de aceitação e o isolamento entre duas lojas ali.
3. Implantar só `conector-chat` e `conector-conversas` e ligar `VITE_CONECTOR_ATIVO` no build de homologação.
4. Demonstrar com a loja real autorizada: *"consulte o SKU X e diga o que falta"* → diagnóstico com fonte → proposta → aprovação → execução **em mock** → auditoria.
5. Só depois, e com autorização própria, avaliar escrita real no Bling por campo.

Fora do escopo agora, por pedido: ampliar telas e recursos periféricos antes dessa validação.
