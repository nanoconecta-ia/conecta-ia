# Ambiente local de homologação (2026-10-24)

Objetivo: homologar sem contratar Supabase Pro e sem criar projeto novo. Nada aqui toca produção.

## O que foi reproduzido
- **PostgreSQL 17.11** (imagem `postgres:17` do Docker Hub, daemon Docker iniciado na sessão), mesma versão principal da produção.
- Todas as migrações (menos as 3 que dependem de infraestrutura do Supabase) e as **39 suítes SQL**: 949 verificações, 0 falhas. Saída em `evidencias/suites-pg17-2026-10-24.txt`.
- RLS, papéis `anon`/`authenticated`/`service_role` e `auth.uid()` por stub (`supabase/tests/stub_supabase.sql`).
- Testes do código das Edge Functions sob Node (235) e do painel (107), com artefatos autocontidos conferidos.
- Compatibilidade da nova migração de identidade com os 7 produtos atuais, em banco descartável.

## O que NÃO foi possível reproduzir (limitação real)
| Recurso | Motivo | Alternativa de teste |
|---|---|---|
| Pilha Supabase local (`supabase start`: Auth, Storage, Realtime, Edge Runtime) | O registro das imagens (`public.ecr.aws`) devolve 403 pela política de rede da sessão; só o Docker Hub baixa | Rodar `supabase start` numa máquina do proprietário (ex.: o computador `mobis`) com Docker e internet; as suítes rodam lá com o mesmo script |
| `pg_cron`, `pg_net`, Vault | Pacotes `apt` e extensões da Supabase inacessíveis (apt bloqueado); a imagem oficial não as traz | Migrações `bling_renovacao_automatica`, `plataforma_segredos_vault` e `bling_sync_cron` ficam para a máquina com a pilha completa ou para um ambiente de homologação autorizado |
| Storage (buckets, políticas de objeto) | Sem a pilha | Conferir o SQL do bucket por leitura; ensaio real depois |
| Edge Functions em Deno | Sem runtime Deno | Testes sob Node com portas reais contra Postgres; smoke test no deploy de homologação |
| Provedores de IA reais | Sem chave de IA cadastrada | Fixtures SSE hoje; teste real após o lojista cadastrar a chave |

## Como reproduzir
```
docker run -d --name pg17 -e POSTGRES_PASSWORD=postgres -p 5417:5432 postgres:17
PGUSER=postgres PGHOST=localhost PGPORT=5417 PGPASSWORD=postgres supabase/tests/rodar_local.sh
```
