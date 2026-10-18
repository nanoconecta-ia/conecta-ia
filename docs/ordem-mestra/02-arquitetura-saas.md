# 2. Arquitetura SaaS multiempresa (proposta)

Princípio: **evoluir, não reconstruir**. Tudo abaixo reaproveita o que existe (ver 03); o que é novo está marcado **NOVO** e depende de aprovação (regra do `CLAUDE.md`: mostrar o desenho antes de criar tabela).

## 2.1 Camadas

```
Bling (fonte operacional) ──OAuth por loja──▶ Conector ERP ──▶ ESPELHO (somente leitura) ─────────────┐
                                                                                                       ▼
Lojista ─▶ Painel (SPA) ─▶ Conector IA (admin) ─▶ Policy Engine ─▶ Tool Registry ─▶ ferramentas ─▶ CAMADA DE ENRIQUECIMENTO (a_confirmar → aprovado)
                                 │                     │                                                      │
                                 │                     └──▶ auditoria imutável                                ▼
Cliente final ─▶ Site público (SSR, NOVO) ◀── publicador ◀── só dado aprovado + produto publicado ◀──────────┘
                       └─▶ Conector IA público (fatos aprovados, sem escrita)
```

- **Provedor de IA substituível**: a camada `ia/adaptadores.ts` (Claude, Gemini, OpenAI-compatível) já esconde o provedor do núcleo. O estado (conversas, tarefas, aprovações) pertence ao Conecta.IA, nunca ao modelo.
- **Núcleo universal × módulo de segmento**: `perfis_ramo` (hoje `autopecas`) define campos obrigatórios e a taxonomia por `perfil_ramo`; `taxonomia_nos` já tem a coluna. O módulo automotivo vive em tabelas próprias (`montadoras, modelos, geracoes, versoes, motores, pecas_ref, ref_cruzada, produto_aplicacoes…`). **Regra de dependência:** o núcleo (`produtos`, `produto_enriquecimento`, `produto_imagens`, publicação, busca) **não referencia** tabelas automotivas; só o módulo referencia o núcleo. Um teste de dependência por consulta ao catálogo (`pg_depend`) entra na Fase 2.

## 2.2 Isolamento (já existente e verificado)
- `loja_id` em toda tabela de dados; RLS por `private.pode_ver_loja()`; escrita pelo servidor (`service_role`) com conferência de loja dentro das RPCs.
- Segredos em `private.*` (RLS sem policy = ninguém além do servidor), cifrados; chaves de IA/Bling por loja.
- Storage: bucket `lojas-marca` (público, só logo/ícone).
- Papéis: `lojista`, `editor` (enum `papel_loja`) e `super_admin` (`app_metadata` + MFA `aal2`).

## 2.3 O que falta para "SaaS comercial" (Fase 5) — NOVO
| Peça | Proposta | Reuso |
|---|---|---|
| Plano | `planos` (código, nome, recursos, limites) e `assinaturas` (loja, plano, estado, vigência) | `recursos_plataforma`/`loja_recursos` viram **derivados do plano** |
| Limites | `limites_uso` por loja/mês: tokens, tarefas, imagens, produtos, usuários, domínios; verificação **antes** de executar | `ia_registrar_uso`, `limite_mensal_tokens` |
| Custo | registrar tokens in/out, modelo e custo estimado **por tarefa** | `enriquecimento_execucoes` (já tem colunas) |
| Onboarding | conta → segmento → plano → identidade → Bling → importação → análise | `perfis_ramo`, `loja_tema`, `bling-conectar` |
| Cobrança | gateway a escolher (fora do escopo desta fase); webhook assinado muda `assinaturas.estado` | — |
| Admin multiempresa | tela `/plataforma` de super admin com MFA | papel `super_admin` existente |

Preços: **não definir agora** (ordem item 12). A Fase 1 instrumenta custo real por tarefa para calibrar.

## 2.4 Tabelas novas propostas (rascunho; nenhuma criada)
- `conversas(id, loja_id, usuario_id, titulo, provedor, modelo, criado_em)` e `mensagens(id, conversa_id, loja_id, papel, conteudo jsonb, tool_calls jsonb, tokens_in, tokens_out, criado_em)` — RLS `pode_ver_loja` e só o autor/lojista lê. **Fase 1.**
- `agente_tarefas(id, loja_id, usuario_id, agente, ferramenta, entrada, resultado, estado, risco, aprovacao_id, idempotency_key, custo_tokens, custo_estimado, criado_em, concluido_em)` — espelha o ciclo `RECEBIDA→PLANEJANDO→PRONTA→EXECUTANDO→VALIDANDO→CONCLUÍDA` com `REQUER_APROVAÇÃO/FALHOU/REPETINDO/CANCELADA`; alimenta o Supervisor. Estende (não substitui) `enriquecimento_tarefas`. **Fase 1.**
- `aprovacoes(id, loja_id, tarefa_id, tipo, resumo, diff jsonb, decidido_por, decisao, decidido_em)` — o "cartão de aprovação" do chat. **Fase 1/2.**
- `paginas`, `banners`, `seo_propostas`, `feeds` — Fases 3–4.
- `planos`, `assinaturas`, `limites_uso` — Fase 5.

## 2.5 Máquina de estados da tarefa (contrato)
`recebida → planejando → pronta → executando → validando → concluida`; desvios: `requer_aprovacao` (risco MEDIUM+), `falhou`, `repetindo` (só leitura), `cancelada`. Escrita no ERP que dá timeout vai a **`desconhecido`** (nunca repete às cegas; confirma por leitura). Parada de emergência: flag por loja e global verificada a cada passo do laço de ferramentas (`conversar` já limita a 6 passos).
