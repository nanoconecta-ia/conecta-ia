# Fase 1 — preparação autorizada em 2026-10-18

Este trabalho parte do #24, sem alterar os PRs #23, #24 ou #25. Nenhum merge, deploy,
migração de produto, acesso de produção, conexão de credenciais ou chamada ao Bling foi realizado.

## Decisões do proprietário que substituem as propostas do #25

- D1: GPT, Gemini e Claude visíveis, com disponível/não configurado/indisponível.
  Reusar `loja_chaves_ia`, `ia_chave_ativa` e os adaptadores existentes. GPT só rotula a API da OpenAI;
  outro endpoint compatível mostra seu host. Disponível significa configuração e limite aptos,
  não uma checagem paga da saúde da API. Há consentimento explícito antes de enviar o histórico visível.
- D2: mensagens e histórico operacional com padrão inicial de 180 dias, configurável,
  exclusão controlada e LGPD. A auditoria terá política própria. A retenção ainda não foi implementada.
- D3: conversas próprias por padrão. Um lojista **não ganha acesso automático** às conversas alheias:
  precisa de permissão administrativa explícita, limitada à mesma loja, e cada consulta precisa de auditoria.
  A proposta de RLS do #25 deve ser revisada antes de qualquer migração. Este PR não persiste conversas.
- D4: `bling_consultar_produto` por loja, desligada inicialmente, somente leitura, registry existente;
  saída distingue API ao vivo de espelho, com horário da sincronização. Nenhuma gravação permitida.
- D5: somente gerador autocontido e seletor nesta implementação. Sem publicação.

## Implementação e reprodução

`scripts/gerar-autocontido.mjs` usa o parser TypeScript nativo do Node e o linker ESM do V8,
valida todo o grafo e isola cada módulo para evitar colisão de nomes. É um gerador restrito ao
subconjunto documentado no script: imports/reexports nomeados e exports const/function/class.
Rejeita ciclos, formatos não suportados, imports remotos inesperados e imports dinâmicos.
O artefato tem **zero imports locais**; só mantém o SDK fixado em 2.117.3.
`artifacts/assistente/manifesto.json` contém hashes de cada fonte e do artefato. Sem timestamps ou segredos.

```sh
node --experimental-vm-modules scripts/gerar-autocontido.mjs
node --experimental-vm-modules scripts/gerar-autocontido.mjs --check
node --experimental-vm-modules scripts/tests/assistente-artefato.test.mjs
```

Usar Node 24.19.0, também fixado no CI. Os testes executam **o artefato efetivamente gerado**.
SDK, banco, identidade e rede são portas simuladas nesses testes; os adaptadores e as ferramentas
do assistente são o código real. A demonstração de três provedores consultando `ver_produto` é
**sintética**, não chama GPT ou Bling reais e não constitui validação de RLS num banco real.

O endpoint `acao=provedores` exige JWT e leitura da loja pela RLS antes de retornar metadados
permitidos. Não lê o cofre, não descriptografa nem testa chaves. Falha de leitura fecha as opções.
Uma escolha explícita sempre vira `p_provedor` na RPC existente; erro ou falta de chave não
troca de fornecedor. O modelo é obtido no servidor. `sem_ia=true` executa só as consultas locais.
A tela reinicia ao trocar de loja e não reaproveita o histórico da loja anterior.

## Evidências e limites desta sessão

- 72 testes das funções passaram, incluindo os novos testes de estados e os cinco testes M6 do #24.
- 21 testes do artefato passaram: geração determinística, imports/escopos/reexports, 401/404,
  não exposição de segredo, editor 403 nas quatro decisões, falha fechada da permissão,
  três adaptadores com ferramenta simulada, enum fechado, limite e ausência de fallback.
- Os dois testes novos do seletor no painel passaram isoladamente.
- `git diff --check` passou. Workflow de preparação: dois jobs, artefato/segurança e painel.
- Build/checagem TypeScript e suíte completa do painel **não comprovados localmente**:
  `npm ci --offline --ignore-scripts` falhou por falta de cache; o teste de voz requer React ausente.
  Os dois jobs de CI precisam ser conferidos no commit publicado antes de aprovar o PR.
- O teste antigo `assistente/assistente.test.ts` tem import quebrado já na main; a correção está no #23.
  O job desta preparação o exclui explicitamente até a integração do #23, preservando os PRs.
- A fonte v5 de produção não foi consultada nesta sessão. **Não existe prova de equivalência
  entre este artefato e a v5 publicada.** Antes de publicação futura, salvar a âncora de rollback,
  comparar a fonte obtida por leitura autorizada, revisar todas as diferenças e testar em Deno/edge-runtime.
  Não publicar este diretório com base apenas no resultado dos testes simulados.

## Próximo teste operacional — implementação ainda necessária

Fluxo pretendido: usuário → Chat Conector IA → GPT real → `bling_consultar_produto` → resposta → histórico/auditoria.

1. Revisar o schema antes de gerar qualquer migração. `loja_chaves_ia`, `auditoria`, `loja_recursos`,
   `produtos` e `enriquecimento_tarefas` já atendem configuração, rastreio, flags, espelho e fila.
   Nenhuma tabela nova foi criada. Conversas/mensagens persistentes não existem nas migrações atuais;
   justificar somente o armazenamento e os índices que faltam para autoria, paginação,
   idempotência e retenção. Reavaliar se um registro de turno exige tabela própria ou cabe no histórico
   operacional existente; não duplicar a fila. Separar retenção de conversas e auditoria.
2. Propor autorização administrativa explícita para leitura de conversas de outro usuário da mesma loja.
   Testar dono, editor alheio, administrador sem/com permissão, loja externa, revogação e trilha de leitura.
   Nunca aceitar apenas `papel=lojista` como autorização suficiente.
3. Implementar a ferramenta com entrada `{sku}`. Resolver o produto e `bling_id` pelo JWT e loja,
   usar `bling.produtos.obter`/Policy do registry e `blingFetch` somente com GET. Sem URLs ou IDs de loja
   livres fornecidos pelo modelo. Flag por loja deve impedir anúncio **e execução** quando desligada.
   Reusar limite de taxa existente; teto de três consultas por turno e timeout curto.
4. Responder com `{sku,nome,preco,estoque,origem,consultado_em,sincronizado_em,divergencias}`.
   `origem=bling_ao_vivo` só após resposta válida da API; erro/timeout/429 devolve `origem=espelho`
   com aviso e data real, ou dado ausente. Não inventar valores; não expor custo, fornecedor ou tokens.
   Testar explicitamente sucesso, indisponibilidade, rate limit, dado antigo, injeção em descrição e loja cruzada.
5. Gravar histórico por usuário e loja e auditoria do provedor/modelo/ferramenta/origem sem credenciais
   ou payload bruto; garantir idempotência e comportamento definido se a auditoria falhar.
   A auditoria de consultas atual é de melhor esforço e precisa ser endurecida para esse marco.
6. Demonstrar primeiro com mocks identificados como **SIMULADO**, sem credenciais reais.
   Depois solicitar autorização específica para credenciais de teste, migração em ambiente autorizado
   e uma consulta piloto a um SKU. A chamada GPT real e a leitura Bling precisam aparecer como **REAL**,
   com provedor, origem e horários verificáveis. Testes locais não equivalem a aprovação para produção.

Nenhuma das permissões de credenciais, migração ou publicação é presumida pelas decisões D1–D5.
