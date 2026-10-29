# PR #116: emenda de retenção (APROVADA pelo dono em 2026-10-28; incorporada à migração do PR; NÃO aplicada em produção)

**Estado:** emenda aprovada e **incorporada** à migração `20261028000001_limite_chamadas_limpeza.sql` e ao teste `supabase/tests/limite_chamadas_limpeza.sql` (18 verificações). **Nada foi aplicado em banco real**; a aplicação em produção continua dependendo de autorização específica. Testada só num Postgres 16 local descartável (40 suítes passam). Mutações (retenção de 10 min trocada por 3 h; teto de 20 lotes trocado por 3) são detectadas.

## Por que emendar
Simulação local do #112 (`scripts/simulacao/baldes-ip.ts`, branch do #112): no pior caso (uma loja atacada nos dois endpoints, ~1.200 pedidos aceitos/min) a tabela chega a ~300 mil linhas ≈ **51 MB** com retenção de 2 h para tudo, acima do critério de parada de 20 MB. A migração atual apaga no máximo 10.000 linhas por hora, abaixo do ritmo desse pior caso.

## O que muda (diff proposto sobre a migração do PR)
1. **Retenção por tipo de chave.** Chaves de janela de 60 s (`pub:<endpoint>:ip:rajada:…`, `pub:<endpoint>:semip:…`, `pub:<endpoint>:loja:…`) saem após **10 min**; as demais (inclui o sustentado de 1 h e as chaves de outras funções) continuam com **2 h**.
2. **Lotes repetidos.** A função repete lotes de 10.000 dentro da mesma execução, no máximo **20 lotes** (200 mil linhas) por chamada.
3. **Agendamento a cada 10 minutos** (`*/10 * * * *`, ainda só se `pg_cron` existir), no lugar de 1 vez por hora.
4. **Mesma assinatura** `private.limite_chamadas_limpar(int)`: a emenda é um `create or replace`, sem segunda função (uma versão com 2 parâmetros criaria ambiguidade; foi descartada).

```sql
create or replace function private.limite_chamadas_limpar(p_lote int default 10000) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; total int := 0; i int := 0; lote int := greatest(1, least(p_lote, 100000));
begin
  loop
    with velhas as (
      select ctid from private.limite_chamadas
      where janela < now() - interval '2 hours'
         or (janela < now() - interval '10 minutes' and chave ~ '^pub:[a-z-]+:(ip:rajada:|semip:|loja:)')
      order by janela limit lote for update skip locked
    ), apagadas as (
      delete from private.limite_chamadas l using velhas v where l.ctid = v.ctid returning 1
    ) select count(*) into n from apagadas;
    total := total + n; i := i + 1;
    exit when n < lote or i >= 20;
  end loop;
  return total;
end $$;
-- agendamento: cron.schedule('limite-limpeza', '*/10 * * * *', 'select private.limite_chamadas_limpar();')
```

## Resultado esperado
| Cenário | Retenção 2 h para tudo | Com a emenda |
|---|---|---|
| Pior caso (1 loja, 2 endpoints) | ~300 mil linhas ≈ 51 MB | ~36,5 mil linhas ≈ 6 MB |
| Tráfego normal | poucos MB | poucos MB |

## Testes locais (Postgres 16 descartável, 7 verificações; passaram)
- Apaga exatamente o que a regra manda: rajada/sem-IP/loja com mais de 10 min e sustentado/`pair` com mais de 2 h (5 linhas); preserva as demais (3).
- Segunda execução apaga 0 (idempotente).
- Volume: 50.000 linhas de rajada velhas + 5.000 recentes: apaga as 50.000 em uma execução (5 lotes) e preserva as 5.000.
- Teto: 250.000 velhas: apaga 200.000 (20 lotes) e deixa 50.000 para a execução seguinte, que termina o atraso.
- Tempo total do teste (inclui inserir ~300 mil linhas): ~3,8 s.
- **Não testado:** o agendamento real no `pg_cron` de produção, latência/bloqueio com tráfego simultâneo e o custo do job a cada 10 min.

## Riscos
- **Acoplamento com o formato da chave:** a regra depende do prefixo `pub:<endpoint>:(ip:rajada|semip|loja):`. Se o guarda do #112 mudar esse formato, as chaves novas caem na regra de 2 h (falha segura, só retém mais). Convém um teste que gere a chave pelo próprio `guardarPublico` e confira o padrão (proposta, não feito).
- **Regex sobre a coluna `chave`** a cada execução: a consulta usa o índice por `janela` para limitar o intervalo; com a tabela pequena é irrelevante.
- **Job a cada 10 min** consome pouco, mas é mais frequente; rollback abaixo.

## Rollback
`select cron.unschedule('limite-limpeza');` e voltar à função da migração original (`create or replace` com a versão sem lotes), ou o rollback já documentado no resumo do PR. Sem perda de dado útil.

## Feito após a aprovação
1. Atualizo a migração do #116 com o `create or replace` acima e o agendamento a cada 10 min.
2. Estendo `supabase/tests/limite_chamadas_limpeza.sql` com as verificações acima.
3. Rodo as 40 suítes locais e o CI; o PR continua em rascunho, **sem aplicar nada em produção**.
4. A aplicação em produção continua dependendo de autorização específica sua, separada.

Perguntas para a aprovação: (a) retenção de 10 min para as chaves de 60 s está boa? (b) agendamento a cada 10 min está boa, ou prefere de hora em hora com mais lotes? (c) o teto de 20 lotes por execução está bom?
