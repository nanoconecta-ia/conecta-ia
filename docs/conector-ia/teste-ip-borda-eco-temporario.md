# Teste do IP na borda (função temporária `eco-ip-temporario`) — registro e remoção

**Estado:** teste ENCERRADO sem conclusão final sobre falsificação. A função **ainda está implantada** e precisa ser removida pelo dono (painel do Supabase). Nenhum PR foi fechado, nada foi mesclado, implantado ou migrado por este registro.

## O que foi implantado (única mudança em produção desta atividade)
- Projeto `conecta-ia` (ref `dsfzhsrudriqkumtlqwj`, conferido antes), função `eco-ip-temporario` v1, `verify_jwt=false`, autorizada pelo dono em 2026-10-28.
- Código: sem banco, sem segredo, sem log; devolve só o valor de `cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`, `true-client-ip`, `forwarded`, `x-forwarded-proto`, `x-forwarded-host`, `cf-ipcountry`, `cf-ray` e os **nomes** dos demais cabeçalhos (nunca authorization/apikey/cookie).
- Expira sozinha (HTTP 410) às 2026-10-28T03:45:00Z. A expiração **não remove** a função.

## Resultados (IPs omitidos; fonte: relato em comentário do PR #112, executado no computador do dono — não reproduzido por mim, o proxy do meu ambiente bloqueia `supabase.co`)
| Cenário | Resultado relatado |
|---|---|
| GET normal | JSON válido; `cf-connecting-ip` presente; `x-forwarded-for` presente com vários IPs; `x-real-ip` ausente |
| GET com `X-Forwarded-For`, `CF-Connecting-IP` e `X-Real-IP` forjados juntos | `error code: 1000` devolvido antes da função (origem não identificada: borda, proxy ou outro intermediário) |

## Matriz
| Cabeçalho | Estado | Observação |
|---|---|---|
| `cf-connecting-ip` entregue pela borda | PASSOU (relatado) | presente em chamada normal |
| `cf-connecting-ip` não forjável pelo cliente | **NÃO TESTADO** | o erro 1000 veio de um teste com os 3 cabeçalhos juntos; não se sabe qual o causou |
| `x-forwarded-for` como identidade | **FALHOU para esse uso** | vem com vários IPs; o 1º item pode ser do cliente; não é usado pelo #112 |
| `x-real-ip` | NÃO USADO | ausente na chamada normal |
| IP ausente / IPv6 | coberto só por teste unitário local | não verificado na borda real |

## Consequência para o #112
O desenho já usa **somente** `cf-connecting-ip` (configurável por `LIMITE_CABECALHO_IP`) e, sem IP confiável, aplica apenas o limite por loja. Enquanto a não-falsificação não for provada, o limite por IP não deve ser tratado como proteção demonstrada; o limite por loja é a rede de segurança (com o risco de negar clientes legítimos da loja sob ataque).

## Teste que falta (um cabeçalho por vez, tráfego mínimo, enquanto a função existir)
`curl -s -i <URL> -H "CF-Connecting-IP: 5.6.7.8"`; depois `-H "X-Forwarded-For: 1.2.3.4"`; depois `-H "X-Real-IP: 9.9.9.9"`. Se o primeiro passar devolvendo `5.6.7.8`, o cabeçalho é forjável e o limite por IP sai do #112.

## Remoção (feita pelo dono; o assistente não tem ferramenta para apagar funções)
1. Painel do Supabase → projeto `conecta-ia` → Edge Functions → `eco-ip-temporario` → Delete function (confirmar digitando o nome).
2. Conferência posterior (somente leitura): listar as Edge Functions; `eco-ip-temporario` não pode constar.

### Por que a remoção não afeta o Conecta.IA operacional
- A função foi criada hoje para este teste; `git grep eco-ip-temporario` no repositório não encontra nenhuma referência (código, workflows, docs, painel).
- Nenhuma outra função, o painel ou os workflows a chamam; ela não tem tabela, política, segredo nem agendamento próprios.
- Apagar uma Edge Function remove só essa função; `loja-publica`, `vitrine-assistente`, `pair`, `conecta-gateway`, `bling-*`, `assistente` e as demais têm código e slugs distintos e seguem como estão.
- Ressalva: eu não li o catálogo de jobs do `pg_cron` nem o corpo das funções do banco (sem autorização); a garantia acima vem do repositório e do fato de a função ser nova e sem consumidores.
