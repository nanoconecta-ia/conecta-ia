# Agent Gateway, Plugin SDK e modelo OAuth do Bling — proposta para aprovação

Status: **proposta**. Nada aqui foi aplicado nem publicado. NanoShell IA não é alterado: ele entra como mais um plugin, por contrato.

## 1. Revisão técnica da PR #14 (app do Bling por loja)

Direção aprovada: credencial isolada por loja, secret cifrado no servidor, nunca devolvido, auditoria, tokens do app antigo invalidados na troca.

Achados (a corrigir **antes** de aplicar a migração 21 e publicar):

| # | Achado | Gravidade | Correção proposta |
|---|---|---|---|
| 1 | `bling-app` só confere que o usuário **enxerga** a loja. O papel `editor` (enum `papel_loja`) também enxerga, então um editor poderia trocar o app e derrubar a conexão. | Alta | Exigir `papel = 'lojista'` (ou super_admin com aal2) em `bling-app` e `bling-conectar`; teste com dois papéis. |
| 2 | `state` do OAuth liga loja+usuário e expira em 10 min, mas pode ser **reutilizado** dentro da janela e o callback não reconfere o acesso do usuário à loja. | Média | Nonce de uso único em tabela com expiração; reconferir `usuarios_loja` no callback. |
| 3 | Nada impede conectar a **conta Bling errada** (ex.: de outra empresa). | Média | Após o token, ler os dados da empresa (CNPJ) e comparar com o CNPJ da loja; divergência => recusa e aviso. |
| 4 | Uma só chave de cifra global, formato `v1` sem identificador de chave: **sem rotação** possível; "guardar uma cópia" não é procedimento de recuperação. | Média | Prefixo de versão da chave (`v2.<kid>…`), duas chaves ativas na rotação, job de recifragem, procedimento escrito de backup/restauração da chave (cofre separado, dupla custódia). |
| 5 | `bling-app` sem limite de tentativas. | Baixa | Limite por loja/IP (ex.: 5/h) e registro de falhas. |
| 6 | Trocar o app apaga tokens na hora, mesmo se for o mesmo Client ID. | Baixa | Só apagar se o Client ID mudar; do contrário apenas atualizar o secret. |

Compatibilidade: hoje `bling_conexoes` e `bling_credenciais` estão **vazias** (nenhum lojista conectou), então não há conexão existente para migrar. As funções passam a ignorar `BLING_CLIENT_ID/SECRET` globais. Reversão: `drop` das 3 RPCs e da tabela `private.bling_apps` (sem dados em produção) e republicar as funções anteriores (v2 de `bling-conectar`/`bling-callback`, v1 de `bling-renovar`).
Testes a acrescentar: isolamento entre **duas lojas** (A não lê nem altera o app de B), papel `editor` recusado, `state` reutilizado recusado, CNPJ divergente recusado, recifragem com duas chaves.

## 2. Modelo OAuth do Bling: central SaaS × app por loja

| | A. App central do Conecta.IA | B. App individual por loja |
|---|---|---|
| Experiência do lojista | Clica em "Conectar Bling" e autoriza. Nada técnico. | Cria app no Bling, copia 2 chaves, cola no painel. |
| Operação | Um Client ID/Secret na plataforma; um único ponto a proteger e rotacionar. | Um secret por loja a proteger; mais suporte. |
| Risco | Segredo central é alvo único (mitigar com cofre e rotação). | Vazamento limitado a uma loja. |
| Depende do Bling | Sim: precisa que o Bling permita **um app autorizado por várias contas** (convite/publicação na Central de Extensões). | Não. Funciona hoje. |

**O que foi e não foi confirmado.** Confirmado em fonte secundária: o fluxo é OAuth 2.0 *authorization code*; o app é cadastrado em `developer.bling.com.br`; o `client_id` forma um link de convite de autorização; a instalação pela conta do cliente acontece na Central de Extensões. **Não confirmado** (o domínio oficial está bloqueado na rede deste ambiente e a busca não trouxe o texto): as regras de publicação/homologação, se existe distinção formal público × privado, e os prazos dos tokens. Quem tem login no Bling deve conferir esses três pontos em `developer.bling.com.br` antes da decisão.

**Recomendação:** suportar **os dois caminhos** atrás da mesma interface (`bling_apps` com `origem = 'central' | 'loja'`). Começar com B (já pronto, sem depender do Bling) e migrar para A quando a publicação for confirmada. Com A, `bling_apps` da loja fica vazio e o app central é lido do cofre. Nunca tornar o caminho B obrigatório para todos os clientes.

## 3. Agent Gateway universal

Camada independente do Bling e de qualquer provedor de IA. O núcleo nunca sabe qual agente executou.

```
Lojista / regras ─► Central de Agentes ─► Task Queue (Postgres) ─► Roteador ─► Plugin (NanoShell | GPT | Claude | outro)
                                                │                                │
                                          Policy Engine (risco, aprovação)   Resultado ► Verificador ► Camada de conhecimento
                                                └──────────── Auditoria imutável ◄────────────────┘
```

Peças (reaproveitam o que existe): fila `enriquecimento_tarefas` (lease, tentativas), `loja_mcp_chaves` (chave por loja que só alcança a fila), `produto_enriquecimento` (a_confirmar/aprovado, fonte/data/confiança), receitas, taxonomia, `auditoria`, `loja_chaves_ia` (BYOK, limite mensal).

Fluxo: (1) tarefa entra na fila com `tipo`, escopo e `idempotency_key`; (2) o roteador escolhe plugin por **capacidade declarada**, preferência da loja e custo; (3) plugin reivindica a tarefa (lease), trabalha **sem receber segredos do Bling** e devolve resultado por contrato; (4) o resultado passa pelo Verificador (fonte, data, evidência, formato) e vira `a_confirmar`; (5) o lojista aprova na Central; (6) fallback: plugin não responde no prazo => próximo da lista; sem plugin => tarefa fica `na_fila` com aviso.

Escrita no Bling nunca é feita pelo plugin: o plugin pede uma **ferramenta** do catálogo fechado; o servidor executa depois do Policy Engine e da aprovação.

## 4. Contratos do Plugin SDK (v1, versionados)

```ts
// Descoberta: GET /agent/v1/capabilities  (por chave de loja)
interface Manifesto { sdk: "1"; plugin: string; versao: string; capacidades: Capacidade[]; limites: { concorrencia: number; timeout_s: number } }
type Capacidade =
  | "pesquisa_produto" | "taxonomia" | "codigos_oem_equivalencias" | "validacao_aplicacoes"
  | "enriquecimento_atributos" | "imagem_tratamento" | "imagem_geracao" | "seo" | "preparo_publicacao";

// Reivindicar: POST /agent/v1/tasks/claim -> Tarefa | 204
interface Tarefa { id: string; sdk: "1"; capacidade: Capacidade; loja_id: string; idempotency_key: string;
  entrada: Record<string, unknown>;          // dados do produto/receita; nunca tokens
  permissoes: string[]; risco: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; expira_em: string }

// Concluir: POST /agent/v1/tasks/{id}/result
interface Resultado { status: "ok" | "parcial" | "falhou"; itens: Item[]; custo?: { tokens?: number }; erro?: string }
interface Item { campo: string; valor: unknown; fonte: { url?: string; documento?: string; coletado_em: string };
  confianca: number; classe_codigo?: "genuina"|"oem_primeiro_equipamento"|"oes"|"aftermarket_equivalente"|"referencia_cruzada";
  imagem?: { sintetica: boolean; direitos: string; hash: string } }   // sintética => nunca vira foto real
```

Autenticação: chave por loja **e por plugin**, só hash guardado (como `loja_mcp_chaves`), escopo = rotas da fila; revogável; nunca a mesma de pessoa. Versionamento: `sdk: "1"` no manifesto; mudança incompatível = `sdk: "2"` em rota nova, v1 mantida. Permissões: o manifesto declara capacidades; a loja habilita capacidade por plugin. Auditoria: toda reivindicação, resultado e decisão (`tenant_id`, `agent_id`, `task_id`, `tool`, `risk_level`, `approval_id`).

## 5. Memória compartilhada e controlada

Uma só camada: taxonomia, genealogia técnica (migração 18), `pecas_ref`, receitas e `produto_enriquecimento`. Nenhum plugin tem memória própria que contradiga isso: consulta e propõe pela mesma API.
Conhecimento **compartilhável** (catálogo técnico global) exige fonte, procedência, versão, confiança e aprovação; só entra aprovado pelo super admin. Dado **privado** da loja (custo, preço, estoque, fornecedor, aprovações) nunca sai da loja e nunca alimenta o catálogo global sem decisão explícita. Correção de uma loja só vira regra global pela promoção das receitas (>= 3 correções iguais de >= 2 lojas, e revisão do super admin).

## 6. Imagens e SEO

- Imagem **sintética** (banner, composição) é sempre marcada `sintetica: true`, com direitos registrados, e **nunca** substitui a foto técnica real da peça; exige aprovação do lojista.
- Foto de terceiros só como ilustrativa, com origem guardada em sigilo, cruzamento por código e retirada a qualquer momento (já modelado na migração 9).
- Tratamento de foto real (fundo, recorte) preserva a identidade da peça e guarda o original e o hash.
- SEO: título, descrição e dados estruturados só com fatos aprovados; nada de especificação inventada.

## 7. Matriz de segurança, testes e custos

| Risco | Controle | Teste |
|---|---|---|
| Plugin lê segredo do Bling | Plugin nunca recebe token; ferramenta executa no servidor | Teste: entrada da tarefa não contém credencial |
| Plugin vaza dado entre lojas | Chave por loja e plugin; RLS na fila | Duas lojas: plugin da A não reivindica tarefa da B |
| Resposta inventada | Verificador exige fonte+data+confiança; sem evidência fica vazio | Resultado sem fonte é recusado |
| Escrita indevida no Bling | Catálogo fechado + Policy Engine + aprovação + idempotência | Escrita desligada recusa mesmo com aprovação |
| Imagem sintética como foto real | Flag obrigatória, aprovação | Item `sintetica` sem aprovação não publica |
| Custo de IA descontrolado | `limite_mensal_tokens` por loja; custo por tarefa registrado; teto por plugin | Estourar o limite bloqueia novas tarefas |
| Plugin cai | Lease expira, tarefa volta à fila, próximo plugin | Simulação de timeout |

Custos: o plano gratuito do Supabase tem limites de Edge Functions e pausa por inatividade; para produção, plano Pro. Custo de IA é por loja (BYOK) e medido; sem provedor ligado, o gateway funciona com o agente integrado por palavras-chave. Sem número de custo inventado: medir no piloto.

## 8. Plano de integração (após aprovação)

1. Corrigir os achados 1–6 da PR #14 e reapresentar para aprovação (migração 21 + funções).
2. Tabelas do gateway: `agentes_plugins` (manifesto, hash de chave, habilitação por loja) e extensão de `enriquecimento_tarefas` (`capacidade`, `plugin_id`, `risco`, `aprovacao_id`).
3. Rotas `/agent/v1/*` em Edge Function única, com os contratos acima e testes de isolamento.
4. Central de Agentes real (hoje só protótipo em `#/agentes`): fila, resultado, evidências, aprovação.
5. Plugin de referência (o agente integrado) e adaptador do NanoShell por contrato, sem alterar o NanoShell.
