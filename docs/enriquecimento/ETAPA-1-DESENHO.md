# Enriquecimento — Etapa 1: desenho (PARA APROVAÇÃO, nada foi aplicado)

Data: 2026-11-14. Status: **rascunho**. Nenhuma migração, deploy ou gravação no Bling foi feita.

## 1. Diagnóstico (leitura real do banco `conecta-ia`)

| Item | Estado hoje |
|---|---|
| Produtos espelhados do Bling | 275 |
| `enriquecimento_tarefas` / `enriquecimento_execucoes` | 0 / 0 (a fila nunca foi alimentada) |
| `produto_enriquecimento` | 26 campos aprovados em 25 produtos (último em 30/10) |
| `produto_aplicacoes` | 4, todas `a_confirmar` |
| `taxonomia_nos` | 571, todos `proposto` |
| `agente_tarefas` | 4 em `aguardando_aprovacao` desde 01/11 |
| `agente_atividades` | 0 |
| Receitas ativas (`receitas`) | **1** (`filtro_oleo_diesel_leve`) |
| Produtos que `classificarSlug` reconhece | **12 de 275** (só 4 regras de filtro) |

Causas:
1. Nenhum código insere em `enriquecimento_tarefas` (só leitura em `gateway_dados.ts`). A Edge Function `agente` roda por produto, sob demanda.
2. O catálogo real é de peças de motor (cabeçote, bombas, bandejas, tubos, kits de distribuição, juntas...), mas o classificador e as receitas cobrem só filtros.
3. Os passos 4–8 da receita (pesquisa de códigos, especificações, NCM/CEST, imagem, descrição) seguem pendentes: dependem de fontes e provedor de IA.

## 2. Proposta (em duas partes, nesta ordem)

### Parte A — classificar as famílias reais (sem tabela nova)
Estender `classificarSlug` (`_shared/agente/extrair.ts`) com regras por palavra do nome, **em qualquer posição** (há nomes que começam por código, como "10215 - BOMBA DE OLEO"), com ordem de prioridade para evitar confusão (ex.: "MOTOR DE PARTIDA" ≠ "MOTOR completo"; "BOMBA D'ÁGUA" ≠ "BOMBA DE ÓLEO"). Slugs já existem em `taxonomia_nos`:

| Família no catálogo (aprox.) | Slug existente |
|---|---|
| Bomba de óleo | `bomba-oleo` |
| Bomba d'água | `bombas-agua` |
| Cabeçote, balancim, tucho, comando de válvulas | `cabecote-valvulas` |
| Biela | `bielas` |
| Bloco, motor completo/parcial | `blocos-motores` |
| Junta, retentor | `juntas-retentores` |
| Correia, tensor, kit de distribuição | `correias-tensores` |
| Bandeja | `bandejas` |
| Filtros (óleo/ar/combustível/cabine) | `filtro-oleo`, `filtro-ar`, `filtro-combustivel`, `filtro-cabine` |
| Motor de partida | `motores-partida` |
| Óleo de motor | `oleos-motor` |

Regra de segurança: sem correspondência clara, `null` (o agente não chuta). A classificação por nome vale como **"a confirmar"**; não deduz compatibilidade veicular.
Famílias sem slug (tubo de refrigeração, turbina, radiador de óleo, arruelas, pistão/anel/bronzina, embreagem, suspensão/direção, freio) entram como "taxonomia a propor" para sua decisão.

### Parte B — fila automática (produtor + consumidor)
- **Produtor:** ação `enfileirar` (dry-run por padrão: lista o que entraria; só grava com `confirmar: true`). Cria tarefa para produto com tipo reconhecido, receita ativa e `campos_exigidos` vazios. Idempotente: não duplica tarefa `na_fila`/`reivindicada` do mesmo produto e tipo.
- **Relatório sem receita:** produtos classificados mas sem receita, e produtos sem tipo, saem em lista separada para etapa de taxonomia/receitas.
- **Relatório de cadastro (pedido de 14/11):** aponta o que falta ou diverge no cadastro vindo do Bling (GTIN, NCM, categoria, imagem, descrição; nomes com marcador "confirmar", que parecem cadastro provisório). **Só lê e propõe.** Gravar no Bling segue desligado e exige aprovação por campo (CLAUDE.md, regra 7).
- **Consumidor:** não entra nesta etapa. As tarefas ficam registradas e visíveis; a execução continua pela função `agente` (passos 1, 2, 3, 9, 10) sob demanda ou em lote pequeno, com limite de custo por loja.

## 3. Decisões que dependem de você
1. Aprovar a lista de famílias e slugs acima (e dizer quais famílias sem slug devem ganhar nó na taxonomia).
2. **Receitas novas** (dados em `receitas`, por família): campos exigidos de cada uma. Sugestão inicial para peças de motor: `nome, sku, preco, categoria, imagem_principal, marca_peca, codigo_fabricante, aplicacao_veicular`. Aplicar exige migração de dados aprovada por você.
3. Se o lote automático deve rodar sozinho (agendado) ou só quando você pedir.

## 4. Riscos e testes
- Regra de nome ambígua classifica errado: mitigado por prioridade, por `null` quando incerto e por teste unitário com os 275 nomes reais (cada família com exemplos de acerto e de exclusão).
- Fila duplicada: teste de idempotência.
- Custo de IA: limite por loja já existe (`loja_chaves_ia`); nada executa passos de IA nesta etapa.
- Nada grava no Bling; sem deploy de função nem migração antes da sua aprovação.
