# Arquitetura multiagente de indexação automotiva — Conecta.IA

Decisão e justificativa: `multiagente-estudo.md` (comparação das alternativas) e `multiagente-experimento.md` (medição). Esta página descreve o que foi construído. Tudo vive em Postgres + Edge Functions do Conecta.IA; **não há dependência do NanoShell IA** (nenhum arquivo, tabela, projeto Supabase ou credencial dele é lido ou escrito) nem de orquestrador externo.

## 1. Seis capacidades (`supabase/functions/_shared/multiagente/`)
| Capacidade | Tipo | O que faz | Onde usa LLM |
|---|---|---|---|
| **Identificador** | determinística | SKU, OEM (formato XXXXX-XXXXX com confiança), GTIN (dígito verificador), marca da peça × montadora, classe da peça com evidência, **duplicidades** (SKU/GTIN/nome sem acento) | nunca |
| **Pesquisador** | API | consulta conectores **autorizados** em paralelo, com limite de concorrência, **limite de taxa por fonte** e **orçamento**; sanea conteúdo externo; nunca contorna autenticação | nunca |
| **Taxonomista** | regras + LLM opcional | classifica na árvore **fechada** (Sistema ▸ Subsistema ▸ Família): regras aprendidas aprovadas › regras-base › modelo (só se houver orçamento; resposta fora da árvore é descartada) | só quando nenhuma regra serve |
| **Compatibilidade** | determinística | aplicação por **versão** (modelo + motor + período); "confirmada" exige fonte oficial consistente **e** início no Brasil com fonte **e** nenhum conflito aberto; ausência de prova = "não confirmada", nunca "incompatível"; o que o cadastro exclui nunca vira aplicação | nunca |
| **Enriquecedor** | determinística | cadastro só com dado que tem fonte (nome padronizado, descrição técnica, SEO, medidas do Bling); redação por modelo fica fora desta etapa | opcional futuro |
| **Auditor** | determinística | atributo sem procedência, campo fiscal/custo/fornecedor, classe sem evidência, fonte suspeita com confiança alta, tarefa que tentou executar antes da aprovação; devolve qualidade das evidências e cobertura. **Bloqueio vira conflito "auditoria"** (revisão humana) | nunca |

## 2. Orquestrador (`orquestrador.ts`)
`planejar` → só as tarefas necessárias (pula pesquisa sem OEM/GTIN, sem conector autorizado, categoria já definida; **cada pulo registra o motivo**) → `processarItemMultiagente` executa pesquisa e classificação **em paralelo**, consolida em dados estruturados, encaminha conflitos e bloqueios ao lojista, e **para em `aguardando_aprovacao`**. Registra custo por capacidade/tarefa (`pipeline_custos`), com **reserva atômica de orçamento por loja** (`pipeline_custo_tentar`). Usa a mesma máquina de estados persistente do pipeline (PR #40): idempotência, isolamento por loja, histórico imutável, fila com recuo. Nada aprova, sincroniza ou publica.

## 3. Grafo técnico
Tabelas de relação (decisão: sem banco de grafo): montadora → plataforma → modelo → geração → versão → motor (`versao_motor`, com intervalo) → peça (`pecas_aplicacoes_tecnicas`, por **versão ou motor**, com intervalo) → fabricante → referência (`ref_cruzada`, direta, sem transitividade). Consulta `grafo_do_veiculo(versão, ano)` devolve motores e peças vigentes no ano; peça por motor vem marcada **"não prova a versão"**. Muitos-para-muitos testados (mesmo motor em dois veículos; veículo com dois motores em períodos diferentes).

**Relações e classes** (`relacoes.ts`): cada tipo de relação tem um **teto** pela evidência (descrição ou evidência sem fonte/data → só *hipótese*; catálogo → *referência cruzada*; especificação → *equivalência funcional*; ensaio → *equivalente validado*; homologação → *substituto homologado*). Semelhança de descrição **nunca** vira relação. Classe da peça (genuína, OEM primeiro equipamento/OES, aftermarket) exige a evidência da própria classe.

## 4. Aprendizagem controlada (`aprendizado_controlado.sql`, `aprendizagem.ts`)
O agente **propõe**; só o lojista **ativa, rejeita ou reverte**. Regra aprendida tem versão, procedência obrigatória, conteúdo imutável; reverter restaura a versão anterior; tudo vai para a auditoria. Barreiras no banco: escopos fiscal, de segurança e de aplicação técnica **não existem**; valores com NCM, CST, permissão, preço, aplicação etc. são recusados; registros aprovados do catálogo técnico **não são alterados, apagados nem re-aprovados** por quem opera o agente (só rebaixados para "desatualizado").

## 5. Restrições respeitadas
Sem merge, deploy, migração em produção ou escrita no Bling. Produção apenas lida. Nada instalado. Branch separada (`feat/engenharia-multiagente`) e PR em rascunho (#41), empilhado em #40 e #39.

## 6. Riscos abertos e ações que exigem autorização
- **Não distinguível no banco: agente × humano com a mesma credencial.** Hoje o agente e as telas usam `service_role`. As barreiras acima fecham o que dá para fechar (escopos, imutabilidade, rebaixar só), mas **aprovar `a_confirmar → aprovado` no catálogo técnico** continua possível a quem tem `service_role`. A mitigação real é dar ao agente um **papel de banco próprio**, sem permissão de aprovar. **Pede decisão e migração: não feito.**
- O trigger `protege_aprovado` muda o comportamento de tabelas do catálogo técnico do outro agente (hoje com 0 registros aprovados). Revisar com ele antes de aplicar.
- Migrações novas, **não aplicadas em produção**: `…0010` (custos e orçamento), `…0011` (grafo), `…0012` (aprendizado e proteção). Cada uma pede autorização específica; ver também R6 em `motor-riscos-e-autorizacoes.md` (reconciliar `agente_*` com `aprovacoes`/`conversas` antes).
- **Conjunto cego real** (produtos da Mobis com gabarito humano) é pré-requisito para qualquer ampliação com LLM.
- Política de orçamento por prioridade (55% dos itens retidos com orçamento apertado).
- Conectores reais exigem licença/termos de cada fonte; navegação automatizada só onde permitida.
