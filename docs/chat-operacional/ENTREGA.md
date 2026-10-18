# Preparação do chat operacional — PR #31

Estado: implementação para revisão e testes sintéticos. Não aplicada em produção. Nenhuma credencial conectada e nenhum teste GPT/Bling real executado por esta entrega. Os scripts reais exigem confirmações explícitas e não participam dos workflows de CI.

## O que existe

O fluxo `chat_perguntar` autentica o JWT na Edge Function, confere a loja com RLS, exige provedor escolhido e consentimento, reserva o turno no banco, carrega o histórico pelo JWT do titular e consulta o provedor já configurado. Neste fluxo a única ferramenta exposta é `bling_consultar_produto`. O modo anterior por palavras-chave e as decisões M6 permanecem disponíveis.

A ferramenta resolve SKU no espelho com JWT + loja explícita, reaproveita o registry fechado `bling.produtos.obter`, o armazém cifrado e a renovação OAuth existentes. Só executa GET no endereço fixo da API. Redirecionamentos não são seguidos. Há limite por loja, três consultas por turno, prazo de oito segundos e um recuo de 250ms para erro temporário de leitura. A renovação OAuth pode fazer POST **no endpoint de tokens**, sem alterar produtos. A resposta da API deve ter o mesmo ID e SKU do espelho. São expostos somente SKU, nome, preço e estoque. Campo ausente na API permanece nulo; não é completado silenciosamente com o espelho. API indisponível gera cartão explícito de espelho com data da sincronização e motivo. Auditoria com hash deve ser gravada antes de devolver o dado ao modelo.

O painel permite abrir e excluir conversas próprias, recuperar uma pergunta com a mesma chave de idempotência, consultar mensagens anteriores e distinguir API, espelho e simulação. A exclusão pede confirmação por ser irreversível. O lojista configura retenção de 7–730 dias e, quando houver permissão, consulta uma conversa administrativa mediante código e motivo. Cada página administrativa é auditada e limitada a 100 mensagens. A voz não guarda áudio no Conecta; o texto segue a política indicada.

## Duas tabelas e reuso

`conversas` agrupa as mensagens e guarda a reserva temporária do turno. `mensagens` guarda pergunta, resposta e evidências operacionais. Nenhuma tabela existente armazena diálogo privado, encadeamento de respostas, idempotência por titular e prazo de cada mensagem: `enriquecimento_tarefas` é fila de enriquecimento; `auditoria` é imutável, tem leitores e prazo próprios e não deve conter conversas; `aprovacoes` registra decisões, não mensagens. Não existe terceira fila ou tabela de tarefas do agente.

Reutilizados: lojas e vínculos, chaves multi-provedor, limite de chamadas, contador de tokens, auditoria, recursos por loja, registry Bling, RPCs de credenciais e lease de renovação. A migração `20261018212217_chat_operacional.sql` foi nomeada pela CLI 2.81.3 no runner, não por data inventada.

## Segurança, retenção e limites

- RLS permite somente o titular vinculado à loja. Chaves compostas no banco impedem associar mensagem a conversa de outro usuário ou loja. Escritas só por RPCs restritas; mensagens são imutáveis.
- As três flags nascem desligadas. Editor não pode alterá-las. Lojista pode controlar histórico/consulta Bling da própria loja. `chat_leitura_administrativa` exige permissão individual por loja concedida pela plataforma com MFA, ou operação de serviço explicitamente autorizada. Um padrão global não concede essa leitura. O acesso administrativo também exige papel lojista, mesma loja e motivo de dez caracteres ou mais.
- Retenção inicial de 180 dias **por mensagem**, inclusive em conversa ativa. RLS oculta vencidas imediatamente; expurgo horário em lotes apaga o conteúdo no banco. Ao estender o prazo, as mensagens já vencidas são removidas antes, evitando ressurreição. O título acompanha a última pergunta. Exclusão pelo titular remove a conversa e mensagens e mantém somente metadados na auditoria. Backups/exportações precisam acompanhar a política operacional de exclusão; esta migração não promete removê-los.
- Auditoria não recebe conteúdo de conversa nem corpo da API. Mantém identificadores, motivo administrativo, origem, hash, modelo e uso. Não é expurgada por esta rotina: a política própria da auditoria continua pendente de definição pelo responsável.
- Reserva por conversa e chave idempotente serializa turnos. Reenvio de turno concluído recupera a resposta sem nova rede. Turno ativo retorna conflito. Resultado incerto após expiração da reserva **não chama o provedor novamente**. Uma nova pergunta explícita usa uma nova chave. Não há promessa de execução exatamente uma vez em sistemas externos após falha de rede/processo.
- Máximo de três passos GPT e 768 tokens de saída por passo no fluxo operacional; histórico limitado às 21 mensagens recentes, truncadas em 2.000 caracteres cada. O contador mensal existente é contábil: não é uma reserva financeira entre conversas concorrentes. Tarifação deve ser aprovada para o modelo do piloto.
- Falha de gravação final não devolve sucesso ou conteúdo não confirmado. Uso conhecido é contabilizado junto da resposta e auditoria na mesma transação. Uma falha externa/abrupta pode deixar cobrança do provedor sem total confirmado: reconciliar com o provedor antes de repetir uma pergunta incerta.
- `CHAT_AMBIENTE=sintetico` marca simulações; `real` permite evidência de piloto real. Ausência dessa configuração resulta em `nao_validado`. Um marcador sozinho não comprova o piloto: o script exige host OpenAI, ID de resposta, origem API Bling, histórico, hash em auditoria e recuperação idempotente.

## Evidências e reprodução

CI usa somente runners padrão, dados sintéticos, Postgres descartável e rede de teste interceptada. Não lê GitHub Environments nem secrets de produção, não usa projetos remotos, não executa scripts de piloto e não publica componentes.

```sh
node --experimental-vm-modules scripts/gerar-autocontido.mjs --check
node --experimental-vm-modules scripts/tests/assistente-artefato.test.mjs
node --experimental-vm-modules scripts/tests/chat-artefato.test.mjs
node --experimental-vm-modules scripts/tests/oauth-operacional.test.mjs
node supabase/functions/_shared/assistente/bling_consultar.test.ts
```

O job `banco` aplica todas as migrações suportadas ao Postgres 16 descartável, roda as suítes SQL e oito conexões simultâneas do chat (`scripts/tests/chat-concorrencia.mjs`). O job do painel verifica tipos, testes e builds Pair ligado/desligado. A demonstração do componente real em 390px intercepta **toda** rede externa, usa dados SIMULADOS e publica apenas captura sintética por sete dias.

A suíte OAuth sintética executa a lógica real do callback, verificando assinatura/expiração/replay de state, vínculo loja/usuário, papel ainda válido, CNPJ, token de 3.000 caracteres e cifragem. O callback agora tem timeout e não segue redirecionamento. Isso **não comprova o consentimento OAuth real no Bling nem o gateway de nuvem**. O M5 local anterior comprovou GoTrue/edge-runtime locais, sem essa afirmação de nuvem.

## Sequência que exige autorização específica

Projeto único permitido: `conecta-ia`, ref `dsfzhsrudriqkumtlqwj`. Nunca usar NanoShell IA. Antes de publicar, conferir o estado remoto, a lista de migrações aplicadas/pendentes e a versão atual de cada função. A migração nova tem timestamp anterior à migração Pair do repositório: não usar `db push` genérico nem aplicar migrações extras sem revisão. O arquivo de proposta em `docs/fase-1/migracao-proposta/` é histórico e **não deve ser aplicado junto**.

1. Escolher loja e SKU do piloto, identidade do usuário de teste, modelo GPT e teto de gasto; conferir os escopos do app Bling. Usar cofre/integrações existentes; nunca colar credenciais no chat, logs ou repositório.
2. Guardar cópias do arquivo autocontido atualmente publicado, callback e conectar, além da versão anterior do painel. A v5 registrada anteriormente é referência; conferir se continua sendo a versão atual antes de usá-la como rollback.
3. Após autorização específica, aplicar **somente** a migração revisada neste projeto; manter flags desligadas. Conferir índices, grants, RLS e cron. Conferir retenção e consequências em backups.
4. Após autorização específica, publicar `assistente` usando `artifacts/assistente/index.ts`, e não a fonte modular. Publicar `bling-callback` e `bling-conectar` com seus módulos e configuração JWT existente, depois o painel. Não alterar DNS. Nenhuma publicação é automática neste PR.
5. Configurar `CHAT_AMBIENTE=real` e conectar/confirmar as credenciais por canais protegidos somente após autorização. Habilitar histórico e leitura Bling somente na loja piloto. Manter leitura administrativa desligada, salvo autorização separada.
6. Executar `scripts/chat/validar-gateway.mjs` com `--executar-nuvem --confirmar-projeto=dsfzhsrudriqkumtlqwj`. Exige `CHAT_USUARIO_JWT`, `CHAT_ANON_KEY`, `CHAT_LOJA_ID`. Só testa controles de leitura: ausência de login, bearer opaco de 3.000 caracteres, CORS, JWT válido/loja e método indevido. Não chama provedor/Bling.
7. Validar OAuth real pelo painel: lojista autoriza o próprio app, retorno associa a conta pelo CNPJ; testar cancelamento/estado inválido sem reutilizar código real. Não desconectar conexão operacional sem plano de recuperação.
8. Com autorização de uso real, executar `scripts/chat/piloto-real.mjs --executar-real --confirmar-projeto=dsfzhsrudriqkumtlqwj --confirmar-loja=UUID`. Exige as variáveis anteriores mais `CHAT_SKU` e uma `CHAT_IDEMPOTENCY_KEY` preservada nas retentativas. Não usa service_role no computador. Falha se obtiver espelho, simulação ou host diferente de OpenAI. Evidência sanitizada inclui conversa, resposta do provedor, origem e hash, sem preço/estoque ou tokens de autenticação.
9. Conferir separadamente com usuários reais: editor continua recebendo 403 em decisões; um usuário não lê conversa de outro; usuário de outra loja não obtém dados. Para testes de exclusão/retenção, usar conversa descartável autorizada, nunca conversa de cliente sem autorização de exclusão.
10. Se falhar: desligar as flags da loja, reverter painel e funções para os artefatos guardados. Manter as tabelas com dados para recuperação. `REVERSAO.sql` é uma alternativa **destrutiva**, para revisão e autorização adicional, não parte da implantação padrão. Auditoria permanece intacta.

O merge do PR também não significa deploy nem libera o teste real. A conclusão operacional exige evidência desses passos no ambiente autorizado.
