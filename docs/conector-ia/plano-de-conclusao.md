# Plano de conclusão do Conecta.IA (versão operacional)

Data: 2026-10-24. Regras desta etapa: nada em produção (sem migração, deploy ou merge), sem aceitar cobrança, tudo versionado. Complementa `homologacao-relatorio.md`.

## 0. Custo e plano da organização (antes de criar `ensaio-conector`)

- Organização Supabase: **NanoConecta.ia, plano `free`** (lido com `get_organization`).
- Preço do ramo (documentação oficial de uso de Branching): US$ 0,01344 por hora no Micro, sem taxa fixa; ramos não entram no Spend Cap nem nos créditos de computação.
- **Alerta:** branching é oferecido a projetos do plano **Pro ou superior** (fonte: [anúncio oficial do Branching](https://supabase.com/blog/branching-publicly-available); a página atual de docs não repete a regra de forma explícita, então **não confirmado**). Se for o caso, o custo real inclui **subir a organização para Pro**, valor muito maior que US$ 0,32/dia. A confirmação específica da organização só aparece na tela do Supabase; **nenhuma cobrança foi aceita**.
- **Alternativa sem custo a avaliar:** um projeto Supabase gratuito separado só para homologação (Postgres 17, com `pg_cron`, Vault e `pg_net` reais). Precisa de autorização, de vaga de projeto no plano gratuito, e **nunca** o projeto NanoShell IA.

## 1. Migrações indispensáveis, por funcionalidade

Pré-requisitos já em produção: `base_lojas_acesso`, `taxonomia_codigos_autopecas`, `genealogia_tecnica`, `integracoes_ia`, `provedores_ia`, `agente_propoe_*`, `loja_tema`, `pair`, `oauth_agente`.

| Funcionalidade | Migrações (em ordem) | Depende de |
|---|---|---|
| Conector de IA + chat nativo | `20261019000001_conector_ia_estado`, `20261019000003_conector_ia_rpcs` | tabelas de produtos, `integracoes_ia` |
| Anexos do chat | `20261019000006_agente_anexos_bucket` | 0001 |
| Gateway MCP (clientes externos) | `20261019000004_mcp_gateway_chaves` | **0003** (usa `private.eh_membro` e `private.auditar`, que **não existem em produção**) |
| Banners | `20261020000001_loja_banners`, `20261020000003_banner_propor` (PR #60) | produtos, taxonomia |
| Tipo de veículo | `20261020000002_tipo_de_veiculo` | `genealogia_tecnica` |

Ordem única: **0001 → 0003 → 0006 → 0004 → 20261020000001 → 20261020000002 → 20261020000003.**

Verificado: o código do Conector e do chat **não chama nenhuma função nem tabela** das migrações opcionais (conferência por busca nas RPCs usadas por `conector-*`, `_shared/conector` e `_shared/ia`).

## 2. Revisão da `mcp_gateway_chaves` (0004)

Resultados (leitura de produção + teste em Postgres descartável, `supabase/tests/mcp_chaves_preserva_dados.sh`):

- **Compatibilidade:** produção tem `loja_mcp_chaves` com 8 colunas e **0 linhas** (sem chaves, nada a preservar, nenhuma linha viola a nova constraint). Padrão do escopo hoje: `['leitura']`.
- **Preservação com dados legados (simulados):** 3 chaves antigas ficam intactas (hash, escopos, revogação). 8 de 8 verificações passam.
- **Falha fechada:** chave legada sem `expira_em` deixa de valer (`mcp_chave_validar` exige expiração) e não conta no limite de 10. Não há abertura de acesso.
- **Atomicidade:** se algum escopo antigo fora de `leitura/propor/simular` existir, a constraint recusa a migração. Aplicada em transação única (como `apply_migration` e a CLI fazem) nada fica pela metade; com `psql` sem `-1` os `ALTER` anteriores ficariam. **Aplicar sempre pelo `apply_migration`/CLI.**
- **Dependência crítica:** as funções `mcp_chave_*` só funcionam depois da 0003. Em produção hoje `private.eh_membro` e `private.auditar` não existem. Ordem acima é obrigatória.
- **Consulta prévia antes de aplicar (somente leitura):** `select count(*) from loja_mcp_chaves where cardinality(escopos)=0 or not (escopos <@ array['leitura','propor','simular'])` deve ser 0.
- Limites e proteções já cobertos pela suíte `mcp_chaves` (20 verificações): só lojista cria e revoga, expiração de 1 min a 365 dias, no máximo 10 ativas, hash nunca vai ao navegador, escopo "aprovar/executar" não existe.

## 3. Opcionais, mantidos separados

`0009_pipeline_indexacao`, `0010_pipeline_custos`, `0012_aprendizado_controlado`: **fora** do caminho do Conector. Só aplicar depois da homologação do núcleo e com autorização própria.

## 4. O que ainda é protótipo, simulação ou incompleto

- **Ferramentas planejadas (17, só contrato, invisíveis ao LLM):** `conecta.banners.gerenciar`, `conecta.fabricante.pagina_preparar`, `conecta.seo.verificar`, `bling.estoque.consultar`, `bling.precos.consultar`, `bling.produtos.preparar_cadastro`, `bling.categorias.preparar_criacao`, `engenharia.oem.pesquisar`, `engenharia.fabricantes.identificar`, `engenharia.genealogia.organizar`, `engenharia.taxonomia.construir`, `engenharia.classificacao.propor`, `dev.docs.consultar`, `dev.github.consultar`, `dev.codigo.preparar`, `dev.pr.propor`, `dev.testes.executar`.
  - Nota: `conecta.banners.gerenciar` está **superada** pela ferramenta ativa `conecta.banner.propor` (PR #60); remover ou redefinir.
- **Escrita no Bling desligada de propósito (4):** `bling.produtos.criar`, `bling.produtos.alterar`, `bling.categorias.criar`, `bling.produtos.confirmar`. Mapeamento de campos `conferido: false`; escopos do app e idempotência do Bling não verificados.
- **Mocks:** Bling simulado (`bling_mock.ts`) e streaming de IA testado só com fixtures SSE. **Nunca rodou com LLM real** (nenhuma chave de IA cadastrada).
- **Edge Functions novas nunca executaram em Deno real** (`conector-chat`, `conector-conversas`, `conector-chaves`, `conector-aprovacoes`, `conector-mcp`).
- **Dados:** taxonomia de 49 nós sem nenhum aprovado; 7 produtos espelhados, 0 publicados; conexão Bling `pendente`; sem fonte de imagens autorizada.
- **Ficha automática (PR #58):** sem características, benefícios e foto 2; sem arte para baixar.
- **WhatsApp:** só link `wa.me`; automático pela API da Meta não existe.
- **Espelho no chat de ações do agente externo:** só aparece como registro de chamadas (Central), não como mensagens.
- **Defeito encontrado (precisa de decisão):** o espelho tem índice único `(loja_id, sku)`, mas o Bling tem SKU repetido (ex.: `03044-BREF` aparece em 2 registros). O `bling-sync` grava em lote com `upsert (loja_id, bling_id)`; **um SKU repetido ativo derruba o lote inteiro** ("falha ao gravar o espelho"). Correção proposta: detectar repetição antes do lote, gravar o primeiro e registrar o outro como conflito em `sync_erros`, sem perder o restante. Sem alterar produção.

## 5. Testes reais de integração (sem alterar dados de produção)

Fluxo: **Bling → espelho → ferramentas → agente de IA → proposta → aprovação humana → (escrita desligada)**.

Já possível agora (somente leitura):
1. **Bling ↔ espelho:** o conector Bling desta sessão lê o Bling real (confirmado hoje: lista de produtos respondeu). Comparar contagem e campos com o espelho do Conecta (7 produtos) por consulta de leitura.
2. **Agente externo ↔ gateway:** cliente MCP de teste com chave `leitura` e `propor` no ramo/projeto isolado, lendo catálogo, propondo enriquecimento e banner.

Depende de ambiente isolado: aplicar as migrações; criar loja de teste (2 lojas, para isolamento); sincronizar do Bling de teste com somente leitura; propor e aprovar no painel; conferir auditoria e travas.

Depende de ação do lojista: reconectar o Bling (conexão `pendente`), cadastrar chave de IA e limite mensal, criar chave MCP de teste.

## 6. Verificação de segurança (estado atual)

| Item | Evidência | Situação |
|---|---|---|
| Autenticação do gateway | `gateway.test.ts`: sem chave, malformada, desconhecida ou com `Origin` de navegador → recusa | testado (mock e Postgres) |
| Isolamento entre lojas | suíte `rls_isolamento` (17), `conector_ia_estado` (104), chaves compostas `(id, loja_id)` | testado local; falta ensaio no Supabase real |
| Segurança das chaves | só hash no banco, mostrada uma vez, expiração obrigatória, revogação, `service_role` só no servidor | testado local |
| Filas de aprovação | aprovação presa à versão exata, trava por produto, executor separado, agente externo nunca aprova | testado local |
| Cadastro duplicado | `unique (loja_id, bling_id)`, `unique (loja_id, sku)`, `idempotency_key` único por loja, retomada reaproveita a chave | testado local; **defeito do SKU repetido do Bling (acima)** |
| Advisors do Supabase (`get_advisors`) | não executado nesta etapa | **pendente** (rodar no ramo/projeto de homologação) |

## 7. Estado de cada componente

Legenda: **Código** = escrito e testado; **Homologado** = ensaiado em ambiente Supabase isolado; **Implantado** = em produção; **Funcionando** = usado de ponta a ponta com dado real.

| Componente | Código | Homologado | Implantado | Funcionando |
|---|---|---|---|---|
| Espelho do Bling (sync, snapshots/backup) | sim | produção | sim | **parcial** (Bling desconectado; SKU repetido) |
| Loja pública, tema, WhatsApp wa.me | sim | produção | sim (versão anterior) | sim (sem produtos publicados) |
| Identidade visual nova (#55) | sim | não | não (mesclado, não publicado) | não |
| Banners (#56) e proposta pelo agente (#60) | sim | não | não | não |
| Tipo de veículo (#57) | sim | não | não | não |
| Ficha automática (#58) | sim (etapa 1) | não | não | não |
| Conector/chat nativo | sim | não | não | não (sem chave de IA) |
| Gateway MCP | sim | não | não | não |
| Anexos do chat | sim | não | não | não |
| Escrita no Bling | sim (desligada) | não | não | **proibido por política** |
| Pipeline/custos/aprendizado | sim | não | não | fora do escopo |
| WhatsApp automático (Meta) | não | não | não | não |

## 8. O que falta para a versão operacional (objetivo)

1. **Ambiente de homologação Supabase** (decisão financeira: ramo, que pode exigir plano Pro; ou projeto gratuito separado).
2. Aplicar nele as migrações na ordem do item 1; rodar as 38 suítes, `get_advisors` e regressão.
3. Publicar nele as funções `conector-*`, `loja-publica` e `conecta-gateway` e fazer o teste de Deno real.
4. Corrigir o defeito do SKU repetido no sync e testar.
5. Lojista: reconectar o Bling, cadastrar chave de IA (com limite) e chave MCP de teste.
6. Teste ponta a ponta: Bling → espelho → agente → proposta → aprovação (sem escrita no Bling).
7. **Segunda autorização expressa** para produção, uma etapa por vez: migrações → funções → painel.
8. Depois: ficha completa (características com fonte), WhatsApp automático e escrita no Bling (cada uma com desenho e autorização própria).

## 9. Achados da revisão independente (GPT, 2026-10-24, somente leitura) e checklist

Fonte: comentário `GPT — revisão técnica` no PR #62. Registrado aqui; **nada foi aplicado**.

| # | Achado | Estado | Ação / evidência |
|---|---|---|---|
| 1 | `private.eh_membro` e `private.auditar` não existem em produção (0 linhas em `pg_proc`) | confirmado por 2 leituras independentes | A `mcp_gateway_chaves` **nunca** antes da `conector_ia_rpcs` (ordem do item 1) |
| 2 | Advisor Supabase: 6 INFO `rls_enabled_no_policy` (inclui tabelas `private`) | a avaliar | Conferir caso a caso se é intencional (tabela só do servidor) antes de homologar |
| 3 | Advisor: 1 WARN `extension_in_public` (`pg_net`) | a avaliar | Extensão instalada pela plataforma; decisão do proprietário se mover de schema |
| 4 | Advisor: 17 WARN `authenticated_security_definer_function_executable` | a revisar | Revisar grants e checagens internas função a função, **sem revogação indiscriminada**. As funções novas desta rodada (`banners_da_vitrine`, `banner_propor`, `produtos_reconciliar_identidade`, `mcp_chave_*`) revogam `public/anon/authenticated` e liberam só `service_role` (testado nas suítes) |
| 5 | Advisor: 1 WARN `auth_leaked_password_protection` | decisão do proprietário | Configuração do Auth no painel do Supabase; não alterada |
| 6 | Leituras por SKU com `maybeSingle` sem mensagem de ambiguidade | **pendente** | Próxima etapa em código: `conector/dados.ts`, `pair/gateway_dados.ts`, `ia/ferramentas.ts`, `vitrine-assistente`, com teste de SKU repetido |
| 7 | Atomicidade da despublicação e da resolução de conflitos (PR #63) | verificado por leitura do código | `produtos_reconciliar_identidade` é **uma função plpgsql = uma transação**: inserção/atualização de conflitos, resolução e despublicação ocorrem juntas ou nenhuma. Falha no meio desfaz tudo. O sync chama a função depois de gravar e, se ela falhar, registra em `sync_erros` sem desfazer o espelho. Teste direcionado a adicionar: simular erro no meio e confirmar que nada fica pela metade |
| 8 | RLS e permissões `service_role` das novas tabelas/funções | testado | `produto_conflitos`: RLS ligada, leitura só da própria loja, escrita só do servidor (suíte `identidade_produto_sku`, 22 verificações) |
| 9 | Compatibilidade dos scripts na ordem de migração | testado local | 39 suítes em PostgreSQL 17.11 aplicam na ordem do repositório; **não** equivale à homologação no Supabase |
| 10 | 949 verificações locais ≠ homologação em Supabase | reconhecido | Item 1 da lista "O que falta" permanece bloqueante |

Checklist antes de pedir qualquer publicação (cada item exige aprovação do proprietário, separada):
- [ ] Ambiente de homologação com Auth, Storage, Vault e `pg_cron` (decisão financeira ou máquina `mobis`)
- [ ] Achados 2, 3, 4 e 5 avaliados e decididos
- [ ] Achado 6 corrigido e testado
- [ ] Teste de atomicidade da reconciliação (achado 7)
- [ ] Revisão do GPT sobre ordem das migrações, `mcp_gateway_chaves` e identidade (#63)
- [ ] Autorização por etapa: migrações → funções → painel
