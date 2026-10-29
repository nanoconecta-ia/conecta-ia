# PR #116: resumo técnico para aprovação (limpeza de `private.limite_chamadas`)

**Estado:** rascunho. Migração **não aplicada** em nenhum banco. CI verde (9/9) = testes locais, não homologação de produção.

## 1. Diff (2 arquivos, +66 linhas)
| Arquivo | O que faz |
|---|---|
| `supabase/migrations/20261028000001_limite_chamadas_limpeza.sql` | índice, função de limpeza e job condicional |
| `supabase/tests/limite_chamadas_limpeza.sql` | 13 verificações (executado pelo `rodar_local.sh` e pelo CI `banco`) |

## 2. O que a migração faz, passo a passo
1. `create index if not exists limite_chamadas_janela_idx on private.limite_chamadas (janela)`. Apagar por data não usa a chave primária `(chave, janela)`. Custo: pequeno índice extra; a tabela é pequena hoje.
2. `private.limite_chamadas_limpar(p_lote int default 10000) returns int`: apaga `janela < now() - interval '2 hours'`, ordenado por `janela`, **no máximo 10.000 linhas por chamada** (teto duro 100.000), com `for update skip locked` (não espera linhas em uso). `security definer`, `search_path = ''`, `revoke all` de `public`, `anon`, `authenticated` e `service_role`: só o dono do banco executa (o pg_cron roda como dono).
3. Job `limite-limpeza`, `7 * * * *` (uma vez por hora, minuto 7), criado **somente se `pg_cron` existir** (existe em produção: confirmado por leitura em 2026-10-28). Comando local ao banco, sem URL, JWT ou segredo.
4. **Não altera** `public.limite_chamada()` nem dado de negócio.

## 3. Retenção de 2 h: por quê, e o que isso implica
- A maior janela em uso é de 1 h (sustentado); uma linha com mais de 2 h nunca mais é lida.
- **Capacidade de limpeza:** 10.000 linhas por hora. Se a tabela crescer mais rápido que isso, o atraso aumenta. No pior caso do #112 (§4) entram ~2.500 linhas/min, ou seja ~150 mil/hora: **a rotina atual (1 lote por hora) não acompanharia**. Isso precisa de ajuste antes do #112 ativar o bloqueio (ver §4).

## 4. Achado que corrige uma estimativa anterior (precisa da sua decisão)
Simulação local (`scripts/simulacao/baldes-ip.ts`, branch do #112):
- Pior caso do #112 (uma loja atacada nos dois endpoints, 1.200 pedidos aceitos/min), com **retenção de 2 h para tudo**: ~300 mil linhas ≈ **51 MB** (170 B/linha). Isso passa do critério de parada de 20 MB.
- Eu havia dito "poucos MB" no desenho; **isso só vale para tráfego normal**, não para o pior caso.

**Emenda proposta (NÃO implementada, depende de aprovação):**
- Retenção de **10 min** para as chaves de janela curta (`pub:%:ip:rajada:%`, `pub:%:semip:%`, `pub:%:loja:%`) e de 2 h para o restante → pior caso ≈ 36,5 mil linhas ≈ **6 MB**.
- Repetir o lote dentro da execução até esvaziar (`loop` com limite de, por exemplo, 20 lotes) ou agendar a cada 10 min, para acompanhar o ritmo. 
- Alternativa: reduzir `baldesIp` (menos linhas possíveis, mais colisão).
Sem a emenda, a migração atual **é segura mas insuficiente** para o pior caso; ela atende o tráfego normal.

## 5. Rollback
```
select cron.unschedule('limite-limpeza');
drop function private.limite_chamadas_limpar(int);
drop index private.limite_chamadas_janela_idx;
```
Sem perda de dado útil (linhas apagadas eram vencidas). Testado no Postgres local descartável.

## 6. Testes e evidências (locais)
| Verificação | Resultado |
|---|---|
| Apaga só o vencido (inclusive 25 h); preserva 1 h 59 min | PASSOU |
| Respeita o lote; idempotente; lote 0 ou negativo não quebra | PASSOU |
| `limite_chamada()` segue contando e negando | PASSOU |
| `anon`, `authenticated`, `service_role` não executam; `search_path` vazio; `security definer`; índice existe | PASSOU |
| Mutação (retenção trocada para 30 min) | detectada |
| Reversão | executada sem erro |
| Suítes SQL do repositório | 40 de 40 |
| **Agendamento real no `pg_cron`** | **NÃO TESTADO** (não existe no banco de teste); conferir após aplicar |

## 7. Critérios de aprovação sugeridos
1. Decidir a emenda do §4 (retenção por tipo + esvaziar em loop) **antes** de aplicar; se aprovada, eu atualizo a migração e os testes neste mesmo PR.
2. Autorização **específica** para aplicar em produção (nada é aplicado por este resumo).
3. Janela e verificação pós-aplicação (somente leitura): job existe em `cron.job`; primeira execução em `cron.job_run_details`; contagem de linhas antes/depois; tamanho da tabela.
4. #112 só entra em produção depois disso e em modo "observar" (ver `limite-simulacao-baldes-e-observacao.md` no #112).
