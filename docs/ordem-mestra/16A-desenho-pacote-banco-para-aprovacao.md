# 16A — Desenho de persistência para pacote de cadastro por SKU (REVISÃO DO LOJISTA)

**Status: proposta de arquitetura para aprovação, sem migração SQL nem implantação.**
Data de conferência: 2026-11-16. Projeto **Conecta.IA**: Supabase `dsfzhsrudriqkumtlqwj`. Não usar NanoShell IA nem alterar o Bling.
Depende da ordem-mestra 16, PR #400, e segue `CLAUDE.md` ("antes de criar tabelas ou migrações: mostrar o desenho e esperar aprovação").

## 0. O que foi verificado no banco conectado (somente leitura)

1. `produtos`: identidade física exclusiva por `UNIQUE(loja_id,bling_id)`; SKU é opcional. `id,loja_id` também é combinação única. `versao_origem` e `sincronizado_em` estão disponíveis.
2. `agente_propostas`: proposta-pai, `id,loja_id`, solicitante, agente, provedor, modelo, versão, hash, expiração e estados. Suporta `UNIQUE(id,loja_id)`.
3. `agente_proposta_itens`: operações individuais, `produto_id,loja_id`, `antes/depois`, `fontes`, `validacoes`, risco, status, `idempotency_key`. Já possui `UNIQUE(loja_id,idempotency_key)`, `UNIQUE(proposta_id,ordem)` e FKs por loja.
4. `agente_aprovacoes`: vincula proposta e loja, exige versão e hash da proposta; uma aprovação por `proposta_id`.
5. As três tabelas `pacote_*` **ainda não existem** no banco.
6. RLS das propostas e itens: consulta para `authenticated` com `private.pode_ver_loja(loja_id)`. Para o pacote, conteúdo técnico/fiscal interno pode requerer acesso **mais restritivo**.

**Decisão de arquitetura:** não duplicar a Fila nem o executor. Um pacote é agrupador de dados e evidências; sua proposta-pai e itens de alterações continuam em `agente_propostas` / `agente_proposta_itens`.

## 1. Entidades propostas e relacionamentos

```text
produtos (loja_id, id, bling_id) 1 ─── n pacote_cadastro
                                         │
                                         ├── 1:1 agente_propostas (proposta-pai, por loja)
                                         │              └── n agente_proposta_itens (antes/depois, aprovação)
                                         ├── n pacote_blocos (estado e pendências por bloco)
                                         └── n pacote_evidencias (prova por afirmação e por bloco)
```

### Tabela A — `pacote_cadastro` (cabeçalho imutável da entrega v1)

| Coluna | Tipo sugerido | Regra |
|---|---|---|
| `id` | uuid PK | Identificador do pacote |
| `loja_id` | uuid NOT NULL | FK de loja; em todas as pesquisas |
| `produto_id` | uuid NOT NULL | FK composta `(produto_id,loja_id)` para `produtos` |
| `bling_id_conferido` | text NOT NULL | Cópia do `produtos.bling_id`, verificada no servidor, nunca atribuída pelo agente |
| `sku_no_espelho` | text NULL | Pode estar vazio: não criar SKU pelo nome |
| `idempotency_key` | text NOT NULL | `UNIQUE(loja_id,idempotency_key)`, 8–128 caracteres; nunca aceita vazia |
| `hash_payload` | text NOT NULL | SHA-256 do JSON canonicalizado pelo servidor (não confiável se fornecido pelo LLM) |
| `hash_snapshot_bling` | text NOT NULL | Hash do espelho relevante à aprovação |
| `snapshot_versao_origem` | timestamptz NULL | Versão do espelho quando disponível |
| `snapshot_sincronizado_em` | timestamptz NOT NULL | Contexto de sincronização |
| `proposta_id` | uuid NULL | FK composta `(proposta_id,loja_id)` para `agente_propostas`; UNIQUE se preenchido |
| `modelo_agente` / `agente_origem` | text | Auditoria, não cria privilégios |
| `status` | text | `recebido`, `incompleto`, `divergente`, `revisao`, `encerrado` |
| `criado_em` | timestamptz | Preenchido no servidor |

**Imutabilidade:** não editar `hash_payload`, `produto_id` ou `idempotency_key` após gravação; nova entrega tem nova chave e eventual `proposta_anterior_id` no sistema existente.

**Snapshot:** hash cobre identidade física e campos técnicos lidos do Bling (ID, SKU, GTIN, marca, descrição, versão de origem) e referências da nota recebida **apenas como hashes internos, sem copiar XML ou custo**. Saldo e preço flutuam: permanecem do Bling e devem ser relidos ao vender, sem ser tratados como proposta deste pacote.

### Tabela B — `pacote_blocos` (resultados por domínio, sem duplicar aprovação)

| Coluna | Tipo sugerido | Regra |
|---|---|---|
| `id` | uuid PK | |
| `pacote_id, loja_id` | uuid, uuid | FK composta para pacote |
| `tipo` | text | Identidade, evidências, aplicações, taxonomia, imagens, texto/SEO, logística e origem |
| `chave_bloco` | text | Diferencia aplicações individuais no mesmo domínio |
| `estado` | text | `candidato`, `ausente`, `divergente`, `documentado`, `em_revisao` |
| `dados_candidatos` | jsonb | Apenas campos permitidos pelo contrato (sem dados comerciais/fiscais do ERP) |
| `pendencias` | jsonb array | Falhas, divergências, fontes faltantes |
| `item_proposta_id` | uuid NULL | FK composta para `agente_proposta_itens`; mudança efetiva e estado de aprovação continuam lá |
| `ordem` | smallint | Ordenação visual |
| `criado_em` | timestamptz | |

Unicidade proposta: `UNIQUE(pacote_id,tipo,chave_bloco)`. Um `bloco.documentado` significa apenas que há documentação analisável; **não** significa aprovado, compatível ou publicável. A eventual alteração permitida fica no item da proposta existente e depende do hash e da decisão humana.

### Tabela C — `pacote_evidencias` (uma prova associada a cada alegação)

| Coluna | Tipo sugerido | Regra |
|---|---|---|
| `id` | uuid PK | |
| `pacote_id, loja_id` | uuid, uuid | FK composta para pacote |
| `bloco_id, loja_id` | uuid, uuid | FK composta para o bloco correto |
| `classe` | text | Fabricante oficial, montadora, EPC de terceiro, B2B, marketplace, imagem própria, nota de entrada, inspeção física, IA etc. |
| `identificador_fonte` | text | URL HTTPS segura **ou** identificador de documento privado; nunca ambos vazios |
| `codigo_literal` | text | Código presente na fonte ou inspecionado |
| `trecho_resumido` | text NULL | Trecho curto documentando o fato, sem reprodução integral de material protegido |
| `hash_sha256` | text | Hash do trecho/registro construído pelo servidor |
| `consultado_em` | timestamptz | Data/validade da consulta |
| `mercado_regiao` | text NULL | Importante em EPC por mercado e geração |
| `independencia_grupo` | text NULL | Identifica mesmo fabricante/domínio, evitando contar duas páginas suas como duas fontes independentes |
| `status` | text | `candidata`, `verificada_documentalmente`, `rejeitada` |
| `verificada_por`, `verificada_em` | uuid, timestamptz | Somente revisão humana |
| `criado_em` | timestamptz | |

**Fontes físicas e NF:** peça real ou nota de entrada sem URL usa **identificador interno de documento ou inspeção**, conferido por pessoa; não exige link público. Dados de nota, fornecedor e custo não vão para a vitrine nem retornam ao gateway do agente. Não armazenar **VIN/chassi completo** nem colocar VIN em query string. Buscar por VIN no EPC não autoriza persistir identificador do cliente.

**PartSouq, Mercado Livre, Alibaba, Qwen:** entradas de descoberta ou referência, **não provam equivalência OEM ↔ produto aftermarket** por si. Marca ou modelo declarados no pacote serão conferidos na árvore e por fontes oficiais cadastradas.

## 2. Fluxo transacional futuro (NÃO implementado)

1. Gateway autentica chave curta/OAuth com escopo `propor` e vincula ao `loja_id` confiável do token; não aceita loja enviada pelo agente.
2. Valida envelope com `_shared/pacote_cadastro/contrato.ts` (PR #400) e com checagens de evidência e de aplicação do servidor; classe oficial e independente nunca é aceita apenas porque o agente afirmou.
3. Carrega `produtos` por `(loja_id,bling_id)`; confere duplicidade por GTIN, snapshot e `sku`. Desacordo no Bling → `divergente`/bloqueio. Não normalizar SKUs automaticamente.
4. Calcula **hash canônico** dos dados permitidos (excluir data de recebimento e metadados voláteis). `(loja_id,idempotency_key)` exclusivo com lock/UPSERT controlado:
   - mesma chave + mesmo hash → devolver o mesmo `pacote_id` e a mesma `proposta_id`, sem novos itens;
   - mesma chave + hash diferente → conflito sem alterar nada;
   - chave nova → inserir cabeçalho, blocos, evidências, proposta-pai e itens na **mesma transação**.
5. O executor e a Fila atuais continuam a ser a única via de decisão por `versao+hash`. Uma aprovação de pacote não equivale a aprovação coletiva indiscriminada de OEM/imagem/fiscal. Corrigir snapshot divergente antes de qualquer ação.
6. A ferramenta **nunca** grava Bling nem publica ofertas. DML de entrega usa conta de servidor com privilégios mínimos, quotas, auditoria e limites por lote.

## 3. Segurança/RLS para aprovação

- Todas as tabelas têm `loja_id` e FKs compostas garantindo que produto, pacote, bloco e proposta pertencem **à mesma loja**.
- RLS habilitada em cada tabela; `anon` sem acesso e sem política.
- Escrita das três tabelas somente pela RPC/servidor interno. `authenticated` nunca faz `INSERT/UPDATE/DELETE` direto.
- Para `SELECT` de cabeçalhos/blocos: `authenticated` com verificação real de `public.pode_administrar_loja(loja_id)`, jamais só `auth.role() = 'authenticated'`.
- Para evidência e identificadores privados de nota: priorizar leitura por RPC administrativa que **redige** referências sensíveis e nunca retorna XML ou fornecedor; considerar schema `private` em vez de expor documentação interna pela Data API.
- Nenhuma `SECURITY DEFINER` no `public` para escrever sem autorização explícita. A RPC interna deve ter `search_path` fixo e `EXECUTE` restrito.
- Evidências são append-only; correções criam versão/estado auditado, nunca apagam a origem.
- CI SQL precisa testar RLS multi-loja, UUIDs cruzados, acesso anônimo, idempotência concorrente, rollback e retenção.

## 4. Testes mínimos de aceite para a migração

1. Mesmo `bling_id` em outra loja não cruza dados; inexistente/loja errada bloqueia.
2. Duplicidade na chave idempotente bloqueia; mesma chave/hash devolve proposta anterior via RPC futura; hashes divergentes não sobrescrevem.
3. Pacote com bloco de produto de outra loja rejeitado pela FK composta.
4. Evidência sem URL nem documento interno rejeitada.
5. Usuário `anon` não lê nenhum dos três conjuntos.
6. Usuário de loja A não lê nem insere pacote da loja B; usuário `authenticated` sem administração não recebe evidência administrativa.
7. Revisor não pode converter candidato em confirmado simplesmente alterando status no cliente.
8. Transação com item inválido faz rollback integral.
9. Fonte dupla do mesmo domínio/mesmo grupo não satisfaz duas fontes independentes.
10. Dados do Bling (preço, estoque, fiscal) jamais escritos pelas três tabelas; dados privados não enviados ao GPT.

## 5. Pontos que dependem de aprovação

**A.** Adotar as três tabelas acima **como metadados de pacote**, sem duplicar `agente_propostas` e `agente_proposta_itens`.

**B.** Evidências de nota e inspeção física: guardar **somente referência interna imutável + hash**, com documentos na área privada já existente; não guardar XML/VIN em `pacote_evidencias`.

**C.** Usuário administrativo poderá consultar cabeçalhos e blocos; a evidência privada é fornecida apenas após autorização por RPC/redação de campos.

**D.** A migração real, RPC transacional, handler no gateway, Fila e teste com ChatGPT são fases distintas. **Nenhuma implantação ou abertura de permissões antes de aprovação explícita.**

> **Resumo da decisão solicitada ao lojista:** "Aprovo o desenho 16A de três tabelas complementares, com proposta/itens existentes como autoridade de aprovação, RLS por loja, fonte documental privada e implantação condicionada a testes." Até essa aprovação, apenas documentação em branch/PR de revisão.
