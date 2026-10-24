# Relatório de homologação do Conecta.IA (2026-10-24)

Escopo: preparar a homologação do Conector, dos banners e do tipo de veículo **sem tocar a produção**. Nada foi aplicado em produção, nada foi publicado, nada foi mesclado por causa deste relatório. O ramo `ensaio-conector` **não existe**.

Projeto Supabase conferido: `conecta-ia`, ref `dsfzhsrudriqkumtlqwj`, sa-east-1, Postgres 17, `ACTIVE_HEALTHY`.

## 1. Migrações: prontas e pendentes

Produção tem 57 migrações registradas (lidas com `list_migrations`, somente leitura). O repositório (`main`) tem 52 arquivos. As diferenças de nome são só de divisão (produção aplicou algumas em partes `parteN`); comparado por conteúdo/nome base:

**Pendentes em produção (ainda não aplicadas)**

| Arquivo | Origem | Observação |
|---|---|---|
| `20261019000001_conector_ia_estado.sql` | `main` | Tipos e tabelas do chat/Conector |
| `20261019000003_conector_ia_rpcs.sql` | `main` | Máquina de estados, aprovação presa à versão |
| `20261019000004_mcp_gateway_chaves.sql` | `main` | **Altera `loja_mcp_chaves` (tabela existente)**; ensaiar antes |
| `20261019000006_agente_anexos_bucket.sql` | `main` | Bucket privado |
| `20261019000009_pipeline_indexacao.sql` | `main` | Opcional para o chat |
| `20261019000010_pipeline_custos.sql` | `main` | Opcional para o chat |
| `20261019000012_aprendizado_controlado.sql` | `main` | Opcional para o chat |
| `20261020000001_loja_banners.sql` | `main` (PR #56) | Tabela, RLS, auditoria, `banners_da_vitrine` |
| `20261020000002_tipo_de_veiculo.sql` | `main` (PR #57) | Amplia check de `modelos.categoria`; coluna `produto_aplicacoes.modelo_id` |
| `20261020000003_banner_propor.sql` | **PR #60 (não mesclado)** | Função `banner_propor`, só `service_role` |

Ordem sugerida (dependências): 0001 → 0003 → 0006 → (0004 se o MCP for usado) → 20261020000001 → 20261020000002 → 20261020000003. As opcionais (0009, 0010, 0012) ficam para depois.

**Já aplicadas em produção:** as demais (base, Bling, taxonomia, tema, IA, pair, OAuth, genealogia, busca por veículo, visibilidade, snapshots etc.).

## 2. Resultado real das 38 suítes

Executadas hoje em Postgres **16.15** local e descartável (`supabase/tests/rodar_local.sh`), sobre o branch do PR #60 mesclado com a `main`. Saída completa em `docs/conector-ia/evidencias/suites-locais-2026-10-24.txt`.

- Resultado: **38 de 38 suítes passaram, 931 verificações, 0 falhas** (código de saída 0).
- Suítes de interesse: `rls_isolamento` (17), `conector_ia_estado` (104), `mcp_chaves` (20), `conecta_pair` (182), `loja_banners` (21), `tipo_de_veiculo` (5).
- A suíte `loja_banners` tem 21 verificações porque inclui `banner_propor` (PR #60); na `main` são 17.
- Ficaram **fora** do local por dependerem de infraestrutura que só existe no Supabase: as migrações `bling_renovacao_automatica`, `plataforma_segredos_vault`, `bling_sync_cron` e a suíte `bling_renovacao`.
- Testes do código das funções (Deno-compatível via Node): 235 passam, 0 falham. Painel: 107 passam.

**Limite:** isso **não equivale** à homologação no Supabase (versão 16 local contra 17 em produção; sem `pg_cron`, Vault e `pg_net` reais; sem dados reais).

## 3. Diferenças entre produção e repositório (leitura somente)

Conferido com `SELECT` em catálogo:

| Item | Produção | Repositório espera |
|---|---|---|
| Tabelas `agente_*`, `produto_travas`, `provedor_capacidades`, `loja_banners` | não existem | existem após as migrações pendentes |
| Tipos `risco_nivel`, `agente_msg_papel`, `tarefa_estado`, `proposta_estado`, `item_estado`, `operacao_estado`, `produto_estado_op` | não existem | criados pela 0001 |
| Bucket `agente-anexos` | não existe | criado pela 0006 |
| `modelos_categoria_check` | só `picape, van, furgao, utilitario, suv` | acrescenta `passeio, caminhao, moto` |
| `produto_aplicacoes.modelo_id` | não existe | criada por `tipo_de_veiculo` |
| `loja_mcp_chaves` | 8 colunas (id, loja_id, nome, hash_chave, escopos, ultimo_uso_em, revogada_em, criado_em) | a 0004 acrescenta colunas e uma constraint |
| Funções `banners_da_vitrine`, `banner_propor` | não existem | criadas pelas migrações de banners |
| Extensões `pg_cron`, `pg_net`, `supabase_vault` | as 3 presentes | usadas por renovação, sync e backup |

Edge Functions em produção (16): `bling-conectar`, `bling-callback`, `agente`, `bling-renovar`, `assistente`, `vitrine-assistente`, `bling-app`, `bling-sync`, `diag-ambiente`, `ia-config`, `loja-publica` (v2), `loja-tema`, `pair`, `conecta-gateway` (v4), `loja-seo`, `bling-backup`. **Não publicadas:** `conector-chat`, `conector-conversas`, `conector-chaves`, `conector-aprovacoes`, `conector-mcp`. `loja-publica` e `conecta-gateway` em produção são anteriores às mudanças desta rodada (o repositório tem versões novas).

Não verificado: divergência de **conteúdo** de funções e políticas já aplicadas (só a lista de migrações e a existência de objetos foram comparadas). Recomenda-se um `diff` de esquema no ramo, quando existir.

## 4. Bloqueios técnicos

1. **Ramo `ensaio-conector` não criado.** A ferramenta de criação aguarda confirmação interativa de custo; o tempo esgota em 60 s sem resposta (tentado 2 vezes, sem efeito). A lista de ramos continua vazia.
2. **Ambiente local não cobre** `pg_cron`, Vault e `pg_net`.
3. **PowerShell do computador `mobis`** (relatado pelo GPT): sem confirmação de funcionamento; este agente não tem acesso a ele.
4. **Chave de IA e chave MCP de teste** devem ser cadastradas pelo lojista no painel; não passam por este agente.
5. Nenhuma ferramenta de escrita no Bling é ligada; o Bling segue desconectado (`pendente`) até o lojista reconectar.

## 5. Custo oficial para criar `ensaio-conector`

Fonte: documentação oficial do Supabase, [Manage Branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching).

- Branch de preview **Micro: US$ 0,01344 por hora** (cerca de US$ 0,32 por dia).
- **Não há taxa fixa**; paga-se apenas o uso. Outros itens (egress, disco, storage) são cobrados como no projeto principal.
- Exemplo da própria documentação: ramo ligado por 30 horas, cerca de US$ 1 de compute e egress.
- Não confirmado nas páginas oficiais (veio de guia de terceiros): que ramos não recebem crédito de compute e ficam fora do Spend Cap. Confirmar na página de preços antes de autorizar.
- **Estimativa para os testes:** 1 dia ligado ≈ US$ 0,32; 3 dias ≈ US$ 0,97. O ramo é apagável ao fim, e a cobrança cessa.

## 6. Próxima operação que precisa de autorização

**Criar o ramo `ensaio-conector` (custo ≈ US$ 0,32 por dia).** Autorização financeira explícita do proprietário, e a confirmação de custo deve ser dada **no painel do Supabase** (projeto `conecta-ia` → Branches → Create branch, aceitando o custo), ou no card de aprovação que o Supabase mostrar no app do Claude. Depois disso, este agente aplica as migrações **só no ramo** e roda os testes.

Até lá nada mais é executado em produção.

## 7. Como o GPT pode verificar de forma independente

Sem compartilhar sessão ou credencial, usando só leitura:

- `list_branches` no projeto deve continuar vazio até a autorização.
- `list_migrations` deve mostrar 57 migrações e **nenhuma** de `conector_ia_estado`, `loja_banners` ou `tipo_de_veiculo`.
- `list_edge_functions` não deve ter `conector-*`.
- SQL de catálogo: `select pg_get_constraintdef(oid) from pg_constraint where conname='modelos_categoria_check'` deve mostrar a lista antiga; `select count(*) from information_schema.columns where table_name='produto_aplicacoes' and column_name='modelo_id'` deve ser 0.
- Código e testes: clonar o repositório, rodar `supabase/tests/rodar_local.sh` num Postgres descartável (instruções no cabeçalho do script) e comparar com a evidência em `docs/conector-ia/evidencias/`.
