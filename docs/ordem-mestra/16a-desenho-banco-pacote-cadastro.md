# 16A — Desenho do banco para o pacote de cadastro do Nano/GPT

**Status: PROPOSTA DE ESQUEMA — AGUARDANDO APROVAÇÃO HUMANA.**
Nenhuma tabela, migração, RPC ou escrita no Bling é criada nesta PR. Aplicar DDL só depois de aprovação, conforme CLAUDE.md. PR empilhada sobre a #400.

## 1. Modelo existente consultado no Supabase em 16/11/2026

- produtos: id uuid, loja_id uuid, bling_id text NOT NULL, sku text NULL; já existem UNIQUE(loja_id,bling_id) e UNIQUE(id,loja_id). SKU vazio é válido; não o deduzir do nome, GTIN ou OEM.
- agente_propostas: proposta-pai existente com id, loja_id, solicitante_user, versao, estado, hash e titulo; UNIQUE(id,loja_id). **Não recriar Fila ou aprovação paralela.**
- agente_proposta_itens: filhos com proposta_id, produto_id, operacao, antes, depois, fontes jsonb, validacoes jsonb, estado e idempotency_key; UNIQUE(loja_id,idempotency_key); chaves por item entre 8 e 100 caracteres.
- agente_aprovacoes: decisão humana já vinculada à proposta-pai.
- agente_proposta_criar e agente_proposta_item_adicionar usam SECURITY DEFINER. O primeiro confere private.eh_membro(loja,p_user), mas isso não substitui a autenticação real do solicitante da chamada MCP. A futura RPC **não poderá confiar em user_id enviado pela IA**.
- RLS SELECT atual de propostas e itens usa private.pode_ver_loja(loja_id); os novos registros podem incluir referência interna de NF e devem ter leitura restrita ao administrador.

**Princípio:** uma peça física no Bling, várias aplicações apenas no Conecta.IA; o pacote não modifica fiscal, preço, estoque ou identidade sem aprovação.

## 2. Três tabelas propostas — sem SQL executável nesta etapa

### Tabela A: public.pacote_cadastro

| Campo | Tipo e integridade | Função |
|---|---|---|
| id | uuid PK | Identidade do pacote |
| loja_id | uuid NOT NULL, FK lojas(id) | Isolamento por loja |
| produto_id | uuid NOT NULL, FK composta (produto_id,loja_id) -> produtos(id,loja_id) | Peça física existente |
| bling_id | text NOT NULL, validado com produtos.bling_id | Identificador ERP do produto |
| sku_espelho | text NULL | SKU pode estar ausente |
| versao_contrato | integer, inicialmente 1 | Versão do pacote |
| idempotency_key | text NOT NULL, 8–100 caracteres | UNIQUE(loja_id,idempotency_key) |
| payload_hash | char(64), SHA-256 | Hash canônico calculado no servidor |
| snapshot_espelho | jsonb | Apenas bling_id, sku, gtin, marca e sincronizado_em |
| snapshot_hash | char(64), SHA-256 | Detecta mudanças no cadastro original |
| agente, modelo | text limitado | Origem autenticada da proposta |
| estado | CHECK | recebido, pendente_revisao, divergente, cancelado |
| proposta_id | uuid NULL, FK composta (proposta_id,loja_id) -> agente_propostas(id,loja_id) | Reutiliza proposta-pai |
| criado_em, atualizado_em | timestamptz | Auditoria |

Estado de pacote nunca significa aplicação/OEM/imagem aprovados. Snapshot privado não copia fornecedor, custo, nota integral, XML, documento pessoal ou VIN.

### Tabela B: public.pacote_blocos

| Campo | Tipo e integridade | Função |
|---|---|---|
| id | uuid PK | Identidade do bloco |
| loja_id, pacote_id | uuid NOT NULL; FK composta ao pacote | Segurança multi-loja |
| tipo | CHECK | identidade, evidencias, aplicacao, taxonomia, imagem, texto_seo, logistica |
| chave_bloco | text NOT NULL | Chave interna estável por aplicação ou imagem |
| ordem | integer >= 0 | Exibição na Fila |
| estado_fonte | CHECK | confirmado_por_fonte, a_confirmar, ausente, divergente |
| valor_proposto | jsonb | Dado sugerido, nunca aprovado automaticamente |
| evidencia_chaves | text[] | IDs lógicos de evidências do MESMO pacote; a futura RPC valida todas |
| pendencias | jsonb ARRAY | Justificativas e ausências |
| item_proposta_id | uuid NULL; FK composta (item_proposta_id,loja_id) -> agente_proposta_itens(id,loja_id) | Linha existente da aprovação |
| criado_em | timestamptz | Auditoria |

UNIQUE(pacote_id,tipo,chave_bloco). Múltiplas aplicações e fotografias são permitidas; nenhuma nova peça física é criada. Confirmado_por_fonte não significa aprovado_pelo_lojista.

### Tabela C: public.pacote_evidencias

| Campo | Tipo e integridade | Função |
|---|---|---|
| id | uuid PK | Evidência versionada e não sobrescrita |
| loja_id, pacote_id | uuid NOT NULL; FK composta ao pacote | Isolamento |
| chave_evidencia | text NOT NULL | UNIQUE(pacote_id,chave_evidencia) |
| classe | CHECK | fabricante_oficial, montadora_oficial, distribuidor_b2b, epc_terceiro, referencia_cruzada, marketplace, ia_terceira, foto_estoque, nota_entrada, outra |
| url_publica | text NULL | HTTPS sanitizado, sem token/VIN/identificador pessoal |
| documento_ref_interno | text NULL | Ponteiro opaco ao documento privado, nunca XML completo |
| trecho | text NULL | Apenas fragmento mínimo, saneado |
| codigo_exato | text NULL | Código literalmente mencionado na fonte |
| identidade_emissora | text NULL | Entidade da fonte; nome declarado não equivale a domínio validado |
| dominio_verificado | boolean default false | Só servidor + cadastro homologado por pessoa |
| consultado_em | timestamptz NOT NULL | Data da coleta |
| trecho_hash | char(64) | SHA-256 do fragmento após saneamento |
| verificacao | CHECK | candidato, divergente, verificado, rejeitado |
| criado_em | timestamptz | Auditoria |

Pelo menos uma referência: URL pública HTTPS OU documento privado com identificador interno. O documento de NF e a foto física podem não ter URL pública. Proibir VIN em URL/trecho, credenciais, dados de clientes e cópia integral da NF. A mesma entidade em duas páginas não constitui duas fontes independentes.

## 3. Segurança e RLS — requisitos de implementação

1. Ativar RLS nas três tabelas ANTES de conceder SELECT.
2. anon: sem leitura e sem escrita.
3. authenticated: SELECT somente com auth.uid() validado e autorização de administrador da mesma loja (public.pode_administrar_loja(loja_id)); membros básicos não ganham acesso a referências privadas de NF.
4. Nenhum INSERT/UPDATE/DELETE direto pelo navegador ou chave MCP. Gravação somente pela transação do gateway autorizado, com escopo propor e confirmação da loja.
5. FKs compostas com loja_id nas relações com produto, proposta, item e pacote. Não permitir mudança de loja_id/produto_id/hashes após a entrega.
6. RPC privilegiada deve ficar em schema não exposto quando possível, search_path fixado, privilégio EXECUTE restrito, usuário autenticado revalidado e sem confiar no p_user do LLM.
7. Não guardar service_role no frontend, prompts, repositório nem logs.
8. Não acessar ou modificar Supabase NanoShell. Projeto permitido: dsfzhsrudriqkumtlqwj.

## 4. Futura transação pacote_entregar — ainda não implementada

- Identidade do autor e escopo do gateway autenticados; localizar produto pelo par (loja_id, bling_id), nunca por SKU presumido.
- Validar contrato puro da #400, evidências por trecho e domínio humano-verificado; comparar SKU/GTIN no espelho.
- Calcular SHA-256 canônico no servidor. Primeiro assegurar idempotência do pacote por UNIQUE(loja_id,idempotency_key).
- Reenvio MESMA chave + MESMO hash: retornar mesmo pacote/proposta, sem duplicar. MESMA chave + hash diferente: conflito 409, sem alterações.
- Criar pacote, blocos, evidências, agente_propostas e agente_proposta_itens na MESMA transação. Falha em qualquer passo implica ROLLBACK completo.
- Cada agente_proposta_itens recebe chave derivada, única por loja e bloco (máximo 100 caracteres), diferente da chave do pacote. Nunca reutilizar uma chave idêntica em vários itens.
- Aplicações exigem duas evidências verdadeiramente independentes, incluindo ao menos fabricante ou montadora verificados. PartSouq, anúncios de Mercado Livre/Alibaba e saídas Qwen são candidatos, não prova de equivalência com SKU.
- Revalidar snapshot Bling e hash/versão da proposta antes da decisão; divergência bloqueia execução até nova revisão.
- Gravar no Bling, emitir NF, transferir estoque, mudar tributos/preço ou publicar está FORA desta função. Fila exibe "pronto para conferir", jamais "publicável" automaticamente.

## 5. Testes SQL obrigatórios após aprovação — não executados

| Caso | Critério de aceite |
|---|---|
| RLS | anon não acessa; usuário de outra loja não acessa; admin acessa só sua loja |
| FK cruzada | pacote A não usa produto, proposta ou evidência da loja B |
| Identidade | aceita SKU NULL, mas exige bling_id existente e coincidente |
| Idempotência | duplicata da mesma chave/hash retorna ID existente; outro hash => conflito sem gravar |
| Concorrência | duas entregas simultâneas geram um pacote e uma proposta-pai |
| Atomicidade | falha de um item reverte pacote, blocos, evidências e proposta |
| Referências | bloco não referencia evidência ausente/de outro pacote |
| Privacidade | não retorna VIN, XML integral, fornecedor, custos ou credenciais |
| Aprovação | status do pacote não libera alterações por si só; hash antigo é recusado |
| Regressão | as propostas, a Fila e os itens existentes continuam funcionando |

**Plano posterior:** depois da aprovação do desenho, criar PR de migração + testes pgTAP/SQL; executar primeiro em ambiente de testes isolado. Migração no Supabase conectado exige autorização específica e validação.

## 6. Decisão solicitada

Aprovação ou ajustes no desenho dessas três tabelas. Este arquivo não aplica migração, não configura ferramenta MCP, não faz deploy, não publica o site e não altera o Bling.
