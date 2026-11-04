# Nano.IA FreeLLM — segundo provedor independente (piloto 04/11/2026)

## Motivo
A loja Mobis tem `openrouter_free` como principal e Gemini desligado. O fallback anterior só
trocava outros provedores PARA OpenRouter; quando o próprio OpenRouter falhava,
não havia segundo destino. Esta mudança reutiliza o `chat.ts` e os adaptadores
existentes — não cria chat, agente, gateway, tabelas, migrações nem secrets.
O banco vigente proíbe `failover=true` no `compativel_openai`; por isso o piloto usa
**chave ativa + host permitido + cota local conservadora + consentimento por sessão**, sem quebrar a restrição.

## Escopo entregue nesta branch
- `auxiliar_independente.ts`: política isolada e executor que só responde
  glossário mecânico público (filtro `perguntaPublica` existente).
- `chat.ts`: após falha do `openrouter_free` (429/502/504), admite UMA chamada
  a `compativel_openai` apenas quando houver segundo provedor ativo, `failover=true`,
  consentimento `consentimento_fallback_free=true` neste turno, nenhum anexo,
  nenhuma ferramenta tentada, nenhuma proposta e nenhum fragmento já transmitido.
- Somente endpoints independentes permitidos: Groq (`https://api.groq.com/openai/v1`)
  ou Cerebras (`https://api.cerebras.ai/v1`); modelos e chaves são por loja no
  cofre existente. Não confundir modelos gratuitos com garantia de cota.
- A chamada auxiliar só recebe pergunta pública atual e prompt fixo: **não** envia
  nome da loja, histórico, custos, fornecedores, NF, Bling ou anexos.
- Retorna metadados do provedor efetivo, latência e causa da troca no turno;
  se auxiliar falhar, conserva erro do principal. Sem loops.
- `auxiliar_independente.test.ts` cobre recusas por dados sensíveis, falta de consentimento,
  streaming, ferramentas, configurações, URL suspeita e HTTP não elegível.

## Limites e condições
A integração fica **desligada na Mobis até haver segundo provedor independente,
com chave própria testada, modelo válido, `ativa=true`, teto local entre 1.000 e 50.000 tokens/mês e autorização por sessão**.
O painel utiliza a tela existente de Integrações de IA para cadastrar o `compativel_openai`.
O chat do Nano oferece consentimento por sessão quando o provedor configurado cumpre a política.
A coluna `failover` permanece reservada ao OpenRouter no banco; **nenhuma migração é necessária**.
Somente um provedor externo adicional é admitido por vez neste primeiro piloto.
Não alterar registros do banco diretamente ou presumir que o provedor tem cobrança zero.

A execução de inferência está limitada a perguntas públicas de glossário e
não substitui IA nas tarefas de cadastro/SEO/taxonomia. Estas permanecem
nas funções determinísticas existentes ou exigem provedor aprovado com
política de dados apropriada.

## Homologação (sem produção)
1. Validar sintaxe/typecheck e testes do módulo na CI do PR.
2. Confirmar que `chat.ts` gera pacote autocontido sem importar caminhos externos.
3. Simular erro 429 no OpenRouter e sucesso da segunda API com fetch injetado.
   Testar também falha da segunda API, 401/403, streaming parcial, anexos,
   ferramentas e duplicidade de chamadas.
4. Teste real autenticado somente com pergunta pública, com chave auxiliar
   cadastrada pelo dono no mecanismo existente; observar `request_id`,
   `latencia_provedor`, `provedor_efetivo` e consumo.
5. Revisar UI de opt-in e configuração gratuita antes de qualquer deploy.

**Proibido sem autorização específica:** merge, deploy, migração, mudança de credencial,
escrita Bling, exposição de endpoint local ou envio de dados comerciais para API gratuita.

## Revisão para merge (04/11/2026)
- A autorização para prosseguir com merge/deploy foi dada pelo dono; **a autorização não substitui os checks de CI, validação da build ou controles do ambiente de produção**.
- Na área de trabalho isolada `conecta-ia-pr291-lf`, `npm test` do painel executou **385 testes com 385 aprovações**. O `npm run build` foi iniciado, mas sua conclusão não foi confirmada no notebook.
- O pacote autocontido do assistente passou no verificador local; os cinco testes do módulo auxiliar passaram. A confirmação do CI para o SHA atual continua obrigatória.
- O provedor auxiliar não está configurado nem homologado ao vivo na Mobis. Merge de código não é ativação operacional.
