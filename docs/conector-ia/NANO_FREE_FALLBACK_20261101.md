# Nano.IA — modo de contingência LLM gratuito, seguro e opt-in (01/11/2026)

## Problema real

O `assistente` canônico usa Gemini por chave por loja, com limite de chamadas e erros HTTP 429/502/504. O chat persistente **não fazia failover** quando o Gemini falhava — escolher um provedor alternativo não correspondia a uma contingência automática.

## Solução desta PR, sem deploy

**Nano.IA Roteador Free (piloto controlado):** usa o roteador `openrouter/free` como alternativa gratuita e multi-modelo, aproveitando a API OpenAI-compatível já implementada no projeto. Não adiciona SDK, serviço pago, tabela, chave em frontend ou outro chatbot. A seleção interna do OpenRouter alterna modelos gratuitos disponíveis; não garante disponibilidade.

### Quando chama o gratuito

O código de `_shared/assistente/fallback_free.ts` e `_shared/assistente/chat.ts` só permite a tentativa quando **TODAS** as condições são verdadeiras:

1. O provedor selecionado pelo usuário é `gemini`, e houve uma chamada real iniciada ao provedor que falhou com status 429, 502 ou 504.
2. O usuário autorizou separadamente na interface o envio da pergunta pública ao segundo provedor (`consentimento_fallback_free=true`).
3. O servidor definiu `NANO_FREE_FALLBACK_ATIVO=1`, cadastrou a chave do OpenRouter e incluiu o UUID da loja na allowlist.
4. A pergunta corresponde **exatamente** a uma explicação de glossário mecânico de assuntos listados: `O que é motor diesel?`, `Explique o funcionamento de bomba d'água` etc. É recusada a inclusão de números, URLs, SKU, pedidos, custos, notas, listas de produtos, texto livre ou anexos.
5. Nenhuma ferramenta foi acionada no turno e nenhum fragmento do Gemini já foi transmitido via streaming.

**Dados que saem para o provedor gratuito:** somente a pergunta atual de glossário de mecânica, mais um prompt fixo público (sem nome da loja). Não sai histórico, identificador da loja, credenciais do Bling, anexos, resultados das ferramentas, custo, preço, fornecedores ou dados fiscais.

**Operação:** uma única tentativa, 200 tokens de saída, sem ferramentas, com timeout do adaptador atual. Se falhar ou vier resposta incompleta, o erro original do Gemini é preservado. Resposta no chat recebe aviso `glossário público, sem consulta ao Bling` e metadado `desfecho=contingencia_publica`, `provedor_efetivo=openrouter-free`. O provider original continua registrado para auditoria.

### Configuração (SOMENTE backend seguro, nunca frontend/Git)

```ini
NANO_FREE_FALLBACK_ATIVO=1
NANO_FREE_FALLBACK_LOJAS=<UUID_EXATO_DA_LOJA>
NANO_FREE_FALLBACK_OPENROUTER_KEY=<SEGREDO_NO_SERVIDOR>
```

**Padrão = desligado.** Chave vazia ou loja fora da allowlist bloqueia o fallback e oculta o consentimento na interface. Não inserir segredos em logs, repositório, console, chat ou histórico. A ativação de secrets/deploy exige autorização separada. Verificar rota e limites na conta OpenRouter. A página oficial informa `openrouter/free` gratuito, com restrições de velocidade/dia e disponibilidade variável. A conta Free pode permitir cerca de **50 chamadas/dia** (consultar limites atuais). Nem serviço gratuito remoto nem modelo de 8GB local garantem continuidade absoluta.

### Por que não incorporamos o FreeLLMAPI diretamente nesta etapa?

O FreeLLMAPI é um roteador de provedores free **auto-hospedado**: precisa ser executado num servidor que disponha de suas próprias chaves; a API local em `127.0.0.1` do notebook não é alcançável pelo Supabase na nuvem. Expor a porta ao público seria inseguro. Só experimentar em isolamento (dados públicos) e depois avaliar ponte NanoShell autenticada, sem abrir portas. Para testar já sem nova hospedagem, o OpenRouter `openrouter/free` entrega roteamento gratuito com API compatível.

### Limites e bloqueios

- Glossário público **não é atendimento comercial, consulta ao ERP, enriquecimento técnico de SKU, taxonomia homologada ou agente fiscal**.
- Não fazer fallback de uma consulta que acionou o Bling, incluiu histórico confidencial, anexo ou começou a responder.
- Não fazer fallback em falha de autenticação (401/403), erro de validação, falta de chave, migração, auditoria ou limite de rate-limit local.
- Uma API gratuita sempre pode retornar 429; não se deve tentar infinitamente ou prometer operação 24×7.
- A comunicação vai ao OpenRouter e seus provedores terceirizados. É **aprovação explícita em sessão** separada, desligada por padrão.
- Não há fallback de `conector-chat` ou `perguntar` legado nesta PR; apenas `chat_perguntar` persistente.
- O painel não configura a chave OpenRouter: ela é um segredo **somente de homologação no backend**, não um plano pago.

### Critérios de homologação

1. Testes `node --experimental-strip-types --test supabase/functions/_shared/assistente/fallback_free.test.ts`: autorização, isolamento por loja, bloqueio de dados sensíveis, envio só da pergunta isolada, erro 429 e falha do provedor gratuito.
2. CI e `npm run build` do painel, `scripts/gerar-autocontido.mjs` e verificação do manifesto.
3. **Teste com chave real apenas após autorização** usando pergunta pública, resposta rotulada e simulação de indisponibilidade do Gemini. Não validar com dados comerciais.
4. Só após o piloto, avaliar FreeLLMAPI hospedado numa rede privada, Ollama local no notebook (8 GB RAM, modelo pequeno, sem acesso cloud direto) e uma política de roteamento por tarefa.

**Status:** código proposto e testes com fetch injetado. Nenhum serviço externo ativado em produção, nenhuma chave gerada, nenhum deploy feito.
