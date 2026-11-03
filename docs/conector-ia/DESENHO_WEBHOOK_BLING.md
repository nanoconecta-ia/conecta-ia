# Desenho: webhook do Bling → espelho quase em tempo real

Status: **DESENHO para revisão do dono. Nenhuma migração, função ou configuração no Bling foi feita.**
Regras do projeto: sem migração sem aprovação do desenho; sem deploy sem autorização; o Bling continua sendo só lido (nenhuma escrita).

## Objetivo
Mudou qualquer dado de produto ou estoque no Bling → o espelho, e portanto o Nano e qualquer agente (chat, MCP Claude/GPT), já enxergam em segundos, não em até 15 minutos. A varredura de 15 min (`bling-sync`) **continua** como rede de segurança contra evento perdido.

## O que a documentação do Bling garante (lida em 2026-11-03, developer.bling.com.br/webhooks)
- Recursos: `product`, `stock`, `virtual_stock`, `product_supplier`, `order`, `invoice`, `consumer_invoice`. Ações: `created`, `updated`, `deleted`.
- Alterar a situação para **excluído gera `updated`**, não `deleted`.
- Payload: `eventId`, `date`, `version`, `event` (`product.updated`), `companyId`, `data`.
- Autenticação: cabeçalho `X-Bling-Signature-256: sha256=<hex>` = HMAC-SHA256 do corpo (UTF-8) com o **client_secret do aplicativo**.
- Entrega considerada feita só com `2xx` em até **5 s**; senão retenta por até **3 dias** e depois **desabilita** o webhook daquele recurso (reativação manual no painel do app).
- Pode chegar **duplicado** (responder `2xx` nos dois) e **fora de ordem**.
- Webhook de um recurso só aparece se o aplicativo tiver o escopo correspondente.
- Estoque: o evento traz saldo, mas o espelho deve buscar o dado atual (não confiar no payload para gravar).

## O que já existe no banco (reaproveitar)
| Peça | Onde | Uso |
|---|---|---|
| Fila idempotente | `public.sync_eventos` (`origem` já inclui `'webhook'`, `unique(loja_id, chave_idempotencia)`, `versao_origem`, `status`, `tentativas`, `proxima_tentativa_em`) | Receber o evento |
| Erros | `public.sync_erros` | Falhas |
| Lookup da loja | `public.loja_por_bling_company(p_company)` + `bling_conexoes.bling_company_id` | Achar a loja pelo `companyId` |
| Segredo do app | `private.bling_apps.client_secret_cifrado` via `bling_ler_app` | Validar a assinatura |
| Aplicar produto | `mapearProduto` / `sincronizar` em `_shared/bling_sync.ts` | Gravar no espelho |

## Lacuna encontrada
`bling_conexoes.bling_company_id` **não é preenchido por nenhum código** (busca em `supabase/functions` sem resultado). Sem ele a função não sabe de qual loja é o evento.
**Correção (sem tabela nova):** na conexão (`bling-callback`) e na renovação, ler `GET /empresas/me/dados-basicos` e gravar o `id` em `bling_company_id`; para a loja Mobis já conectada, um preenchimento único pelo botão "Sincronizar agora" ou por rotina de reparo. Isso exige uma RPC de escrita pequena (função SQL, sem coluna nova).

## Fluxo proposto
```
Bling ──POST──▶ bling-webhook (Edge Function, verify_jwt=false, autenticação própria)
   1. lê o corpo cru (bytes), limite de tamanho
   2. extrai companyId → loja_por_bling_company → se desconhecido: 200 e descarta (não revela nada)
   3. lê o client_secret da loja (decifra só em memória) → HMAC-SHA256(corpo) comparado em tempo constante
        assinatura inválida → 401, nada gravado, sem log do corpo
   4. grava em sync_eventos: origem='webhook', tipo por evento, bling_id, versao_origem=date,
        chave_idempotencia = eventId  (duplicata = conflito ignorado → 200)
   5. responde 2xx IMEDIATO (< 5 s). Nada de buscar no Bling aqui.
Processador (cron de 1 min, ou disparo logo após gravar): pega pendentes → busca o produto/saldo atual no Bling
   → aplica no espelho só se a versão for mais nova (nunca regrava com dado mais antigo) → marca aplicado/ignorado/erro
   → erro: tentativas++ com espera crescente; esgotou: sync_erros + aparece no painel
```
- `product.updated` com `situacao=E` → o espelho marca excluído (o produto some da vitrine).
- `product.deleted` → mesmo tratamento do excluído.
- `stock.*` → atualiza só o saldo (busca atual via API).
- Eventos de pedido, nota e fornecedor: **ignorados** nesta fase (ficam fora de escopo; custo e fornecedor continuam proibidos no sistema do lojista).

## Limites da API do Bling (lidos em 2026-11-03, developer.bling.com.br/limites) e o que mudam no desenho
- **3 requisições por segundo e 120.000 por dia, por conta Bling, somadas em todos os módulos.** O processador do webhook, a varredura de 15 min, o chat (`bling_consultar_produto`) e as propostas **dividem o mesmo orçamento**.
  - O processador usa no máximo **1 requisição por segundo** e para quando recebe `429`, com espera crescente. Nunca dispara em rajada.
  - Evento repetido para o mesmo produto num intervalo curto vira **uma busca só** (agrupa por `bling_id`).
- **Bloqueio por IP:** 300 erros em 10 s (10 min), 600 requisições em 10 s (10 min), 20 chamadas a `/oauth/token` em 60 s (60 min). Como as Edge Functions saem por IPs compartilhados, um loop de erros bloquearia **todas as lojas**.
  - O processador tem um **disjuntor**: após uma sequência de erros, pausa por minutos e registra em `sync_erros`.
  - A renovação de token (`bling-renovar`, a cada 30 min) já fica muito abaixo de 20 por minuto; o webhook nunca renova token por conta própria.
- **Filtros por período maiores que 1 ano devolvem `400`.** A varredura incremental por `dataAlteracaoInicial` deve ficar sempre dentro de 1 ano (a varredura completa continua sem filtro de período).
- **Orçamento diário:** o painel mostra o consumo estimado do dia; ao passar de um limiar, o processador reduz o ritmo e a varredura espera.

## Segurança
- Corpo nunca é aceito sem HMAC válido; comparação em tempo constante; segredo só em memória.
- Sem token, secret, custo ou fornecedor em log nem em resposta.
- Limite de tamanho do corpo e limite de taxa por loja; resposta uniforme para companyId desconhecido.
- Isolamento por loja: o `loja_id` vem só do `companyId` verificado pela assinatura daquela loja.
- Nada escreve no Bling. Só leitura (`GET`) no processador.

## Mudanças necessárias (resumo)
1. **Função nova** `bling-webhook` (receber + validar + enfileirar).
2. **Processador** da fila (reaproveita `bling_sync.ts`): nova função `bling-sync-fila` ou um modo `fila` em `bling-sync`; cron de 1 min.
3. **Preencher `bling_company_id`** no callback/renovação + reparo para a Mobis.
4. **Migração pequena (a aprovar):** RPC para gravar `bling_company_id`, RPC para reservar eventos pendentes (`for update skip locked`), cron do processador. **Nenhuma tabela nova.**
5. **Painel:** indicador "atualizado em tempo real / por varredura" e contagem de eventos com erro (leitura).
6. **Testes:** HMAC válido/inválido, duplicata, fora de ordem, loja desconhecida, 5 s, excluído via `updated`, evento antigo não regrava, isolamento entre lojas; SQL com Postgres local.

## Passos do dono (nada é feito sem você)
1. Aprovar este desenho.
2. Depois do deploy: no painel do aplicativo no Bling, aba **Webhooks**: cadastrar a URL da função e marcar `product` e `stock` (o app precisa dos escopos de produto e estoque).
3. Aplicar a migração pelo script do repositório e aprovar o deploy.

## Riscos e limites honestos
- Se a função ficar fora do ar por mais de 3 dias, o Bling **desabilita** o webhook e precisa ser reativado à mão; a varredura de 15 min cobre o intervalo.
- Entrega fora de ordem: tratada pela data e pela busca do dado atual.
- Limite de requisições do Bling: o processador respeita o limite já usado na varredura.
- Não testado contra o Bling real até o webhook ser cadastrado; antes disso só com payloads simulados da documentação.

## Reversão
Descadastrar o webhook no Bling e desligar o cron do processador. A varredura de 15 min não é alterada e mantém o espelho correto.
