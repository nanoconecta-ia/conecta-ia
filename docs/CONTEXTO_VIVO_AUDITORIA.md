# Contexto Vivo — auditoria do PR #261 e plano de reaproveitamento

Status: **análise e proposta**. Sem migração, deploy, merge ou escrita no Bling. Complementa `docs/CONTEXTO_VIVO_MCP.md` (PR #261).

## 1. O que já existe e deve ser reaproveitado
| Necessidade do Contexto Vivo | Já existe | Observação |
|---|---|---|
| Seleção de N produtos no catálogo | `painel/src/paginas/Catalogo.tsx` (`selecionados: Set<string>`, ids internos de produto) | Hoje é estado local de React; ninguém no servidor o enxerga. |
| Publicar "o que a tela mostra" | `painel/src/lib/contextoPagina.ts` (`publicar/assinar`) | Só no navegador, só contagens/rótulos higienizados; só vira pergunta quando o lojista clica. |
| Ler a tela do ERP (Bling) | Extensão Guardião (`extensao/src/leitor-dom.ts`, `reconhecer.ts`, `mapa-produto.ts`) | Lê por rótulo/acessibilidade, permissão opcional por site, sem valores no registro. **Não observa cliques/seleção em lista.** |
| Identidade da extensão | Pareamento `pair` (`pair_sessoes`, escopos mínimos, token só como SHA-256) | Já é a sessão autenticada "do principal". |
| Identidade de agente externo | OAuth/MCP (`conector-mcp`, `conecta-gateway`) | Migração `20261103000002_oauth_recurso_mcp` **pendente** (PR #259). |
| Ferramentas de leitura MCP | `_shared/conector/registro.ts` (registro único) | Nova ferramenta entra aqui, nunca em segundo gateway. |
| Auditoria de chamadas | `agente_chamadas_ferramenta`, `agente_atividades` (90 dias) | Reusar para registrar leituras do contexto. |

## 2. Achados sobre o PR #261
1. `src/lib/contexto-vivo/contrato.ts` está numa pasta **`src/` na raiz que não existe** neste repositório (código vive em `painel/src`, `extensao/src`, `supabase/functions/_shared`). Não entra em tsc nem em teste: o redutor está sem cobertura.
2. O tipo `EventoContexto` traz `lojaId`/`usuarioId` vindos do cliente, o que contradiz o próprio documento ("não confiar em IDs declarados pelo cliente"). No servidor esses campos devem sair do contrato de entrada e vir da sessão.
3. `versao === atual + 1` fornecida pelo cliente: dois eventos concorrentes da mesma sessão (aba + extensão) fazem um deles falhar sem regra de resolução. Definir: versão atribuída pelo servidor; o cliente envia só `versaoBase` e recebe conflito explícito.
4. Falta `produto.fechado` e `produto.selecionado` na validação (só `produto.aberto` exige id ativo); `produto.salvo` não deveria ser aceito de origem cliente (só do backend após confirmação do Bling).
5. Falta pertencimento: ids de produto precisam ser validados contra a loja no servidor (FK composta `(produto_id, loja_id)`, mesmo padrão de `agente_atividades`).
6. **A premissa "clicar no produto no Bling e o Nano saber" não é viável só com o que existe**: a extensão lê a ficha aberta, não a seleção numa listagem. Isso é o PR B e precisa homologar contra a interface real do Bling, sem prometer antes.
7. Realtime: não é necessário para o critério principal. O Nano (MCP) **consulta** o contexto sob demanda; empurrar para o navegador só serve para mostrar o estado ao lojista. Recomendo adiar o Realtime e começar por gravar + ler.

## 3. Desenho mínimo proposto (para aprovação — nada criado)
**PR A (Conecta → servidor → MCP), sem Realtime:**
- Módulo puro testável em `supabase/functions/_shared/contexto/` (mover o contrato; testes de isolamento, ordem, duplicidade, expiração, limite de seleção).
- Tabela nova `contexto_sessoes` (um registro por sessão autenticada): `id`, `loja_id`, `principal` (id da sessão pair/usuário, preenchido pelo servidor), `origem`, `produto_ativo_id`, `produtos_selecionados uuid[] (≤100)`, `versao`, `atualizado_em`, `expira_em` (TTL curto, ex.: 30 min). FK composta produto/loja, RLS por loja, escrita só via função do servidor, leitura pelo MCP só da sessão do próprio principal. Eventos duplicados: dedup por `evento_id` em janela curta (sem tabela de eventos permanente).
- Rota autenticada no gateway existente para gravar; painel publica a seleção do `Catalogo` nela (opt-in visível: "Compartilhar seleção com o Nano").
- Ferramenta `conecta.contexto.produto_ativo` (leitura, LOW) no `registro.ts`; sem argumentos de loja/usuário; recusa sem sessão válida; devolve só ids, SKU, nome (sem custo, fornecedor, fiscal).
- Dependência: o MCP com OAuth só identifica o principal depois da migração do PR #259. Até lá, só chave MCP por loja (principal = a chave).

**PR B (Bling UI):** adaptador na extensão — só depois de A e com homologação por versão da tela do Bling.
**PR C (gravações confirmadas):** fora do escopo até autorização explícita; escrita no Bling segue desligada.

## 4. Decisões necessárias do dono
- C1: aprova a tabela `contexto_sessoes` (desenho acima) como migração do PR A?
- C2: o "principal" do contexto é a sessão do usuário do painel, e o agente externo lê o contexto da **loja** (modelo simples) ou só da **mesma sessão** (modelo estrito, exige OAuth do #259)?
- C3: confirma adiar o Realtime?
- C4: mover o contrato para `_shared/contexto/` (recomendado) e fechar o PR #261 como substituído, ou manter #261 e empilhar o PR A nele?

## 5. Riscos
Vazamento entre lojas/sessões (mitigação: RLS + FK composta + teste); contexto velho (TTL); agente receber dado sensível (resposta restrita à ficha saneada existente, `busca_segura/ficha.ts`); promessa de captura de clique no Bling sem homologação (PR B).
