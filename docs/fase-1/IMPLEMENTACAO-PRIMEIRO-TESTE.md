# Implementação necessária para o primeiro teste operacional

Fluxo alvo: **Usuário → Chat Conector IA → GPT real → `bling_consultar_produto` → resposta com dados do produto → histórico e auditoria.**
Pré-requisito: aprovação de `ARQUITETURA.md` (v2). Nada abaixo foi implementado nem aplicado. Cada pacote é um PR separado, em rascunho, empilhado sobre o anterior.

## Pacotes de trabalho

| # | Pacote | Arquivos principais | Prova exigida (antes de seguir) | Autorização necessária |
|---|---|---|---|---|
| WP0 | Integrar a base: #23 → #24 → #26 (e #27) | — | CI verde na `main` após cada merge; `--check` do gerador | **merge** (sua decisão) |
| WP1 | Adaptador do provedor devolve `id`/`model` da resposta; trata `max_tokens` × `max_completion_tokens` | `_shared/ia/adaptadores.ts`, `tipos.ts`, testes com `fetch` simulado (formato real da API) | testes dos 3 adaptadores; **nenhuma** chamada real | nenhuma |
| WP2 | Migração v2 (2 tabelas + funções) promovida para `supabase/migrations` | `migracao-proposta/*` → migrações, `supabase/tests/chat_*.sql` | 42/42 + 17 suítes antigas no CI; rollback testado | **aplicar em ambiente de teste** (nunca produção direto) |
| WP3 | Persistência no `assistente` atrás de `chat_persistente` | `_shared/assistente/chat.ts`, `assistente/index.ts` | E2E Deno (como §8 do ARQUITETURA): idempotência sem 2ª chamada ao provedor, falha registrada, flag off = comportamento atual | — |
| WP4 | `bling_consultar_produto` (mock `test.*` primeiro) | `_shared/ferramentas/bling_consultar_produto.ts`, `ia/ferramentas.ts` | sucesso, timeout, 429, Bling fora → espelho com data, SKU de outra loja, flag off (**não executa**), injeção em descrição, auditoria fail-closed, teto de 3/turno | — |
| WP5 | Cartões de evidência e histórico no painel | `Assistente.tsx`, componente de cartão | 390 px, 3 papéis, rótulos REAL/SIMULADO, abrir conversa antiga, excluir conversa | — |
| WP6 | Leitura administrativa + exclusão + retenção (UI mínima) | `Configuracoes`/`Assistente` | matriz de papéis; trilha visível | — |
| WP7 | Artefato autocontido regenerado e provado | `artifacts/assistente/*` | `--check`; E2E Deno **no artefato**; comparação com a v5 (download autorizado) | **ler a v5** (só leitura) |
| WP8 | Ensaio completo com **fakes rotulados SIMULADO** | `scripts/e2e/primeiro-teste.mjs` | relatório com REAL=0; controle negativo falha o critério | — |
| WP9 | Migração + publicação em **produção** (janela, backup lógico) | — | fumaça: 401 sem token / 403 editor decidir / 200 lojista perguntar | **migração em produção e deploy** |
| WP10 | **Teste real na Mobis** (§ abaixo) | — | critério da §0 do ARQUITETURA | **credenciais, SKU e leitura no Bling** |

Ordem de risco crescente: WP1–WP8 rodam só localmente/CI. Só WP9–WP10 tocam produção.

## O teste real (WP10), passo a passo
Pré-condições, todas **suas**: (1) chave OpenAI cadastrada em *Integrações* (provedor GPT, modelo escolhido por você, limite mensal baixo, ex. 50 mil tokens); (2) recursos `chat_persistente` e `chat_consulta_bling` ligados **só** para a Mobis; (3) consentimento de envio de dados; (4) um SKU entre os 4 produtos espelhados (todos têm `bling_id`); (5) autorização para **uma** leitura (GET) no Bling.

1. No Assistente, escolher **GPT** (estado *Disponível*), marcar o consentimento e perguntar: *"Qual o preço e o estoque do SKU X agora?"*.
2. O servidor chama o GPT; o GPT pede `bling_consultar_produto{sku}`; o servidor faz **um GET** no Bling da Mobis; devolve os dados ao GPT; o GPT responde.
3. A tela mostra a resposta e o **cartão de evidência**: SKU, nome, preço, estoque, origem (**Bling ao vivo** ou **último sync em …**), horário, status.
4. Reabrir a conversa (recarregar a página): histórico intacto.
5. Conferências automáticas e manuais (tabela abaixo).

| Verificação | Como | Passa se |
|---|---|---|
| GPT é real | `mensagens.resposta_id_provedor`, `modelo`, `tokens`, `simulado=false`, host da API | id preenchido (formato do provedor), `simulado=false` |
| Bling é real | `chamadas[]`: `origem=bling_ao_vivo`, `status_http=200`, `consultado_em`; log do Bling (se disponível) | origem ao vivo + 200 |
| Dados corretos | leitura **independente** do mesmo produto no Bling (fora do Conecta.IA) no mesmo minuto | preço/estoque/situação iguais ao citado pelo GPT |
| Interpretação | a resposta cita só valores presentes na saída da ferramenta | nenhum número inventado |
| Histórico | recarregar; ler via banco | pergunta + resposta + evidências persistidas |
| Auditoria | `auditoria`: `assistente.consulta` e `bling.consulta` | uma de cada, com usuário, loja, sku, origem, **sem** conteúdo nem token |
| Isolamento | repetir como usuário de outra loja / editor | outra loja: 404; editor: consulta ok, **não** decide Fila |
| Degradação | desligar a rede do Bling no ensaio (WP4, fake) | `origem=espelho` com data real e aviso |
| Custo | `loja_chaves_ia.tokens_mes` | dentro do limite |
| Sem escrita | log de chamadas ao Bling | apenas `GET /produtos/{id}` |

## Formato do relatório de evidência (gerado por WP8 e repetido em WP10)
```
ENSAIO: SIMULADO | REAL            loja: <slug>            horário: <UTC>
GPT      [REAL|SIMULADO]  id=<resposta_id_provedor>  modelo=<m>  tokens=<n>
BLING    [REAL|SIMULADO]  origem=<ao_vivo|espelho>  status=<http>  consultado_em=<ts>  hash=<sha256>
RESPOSTA citou: preco=<x> estoque=<y>  | ferramenta devolveu: preco=<x> estoque=<y>   → coerente: sim|não
HISTÓRICO mensagens=<n> persistidas após recarregar: sim|não
AUDITORIA assistente.consulta=<n> bling.consulta=<n> conteúdo vazado=<não>
CRITÉRIO  GPT REAL ∧ BLING REAL ∧ coerente ∧ persistido ∧ auditado  →  APROVADO | REPROVADO
```
Qualquer `SIMULADO` no ensaio real reprova o critério automaticamente.

## Recuperação
- WP2/WP9: `20261020000001_fase1_conversas.rollback.sql` (não toca a auditoria).
- WP3/WP4: desligar `chat_persistente`/`chat_consulta_bling` na loja volta ao comportamento atual sem deploy.
- WP9: republicar a **v5** salva (âncora) — `assistente` é sem estado.
- WP10: desligar os recursos da Mobis; revogar/rotacionar a chave OpenAI; as mensagens do teste podem ser excluídas pelo titular (`chat_excluir`).
