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

---

# Atualização com as decisões do dono (rodada 2)

Decisão registrada: **corrigir os achados da PR #14 e reapresentar**. Nada de migração, deploy ou merge sem nova autorização explícita. A Central de Agentes permanece **demonstração** até que autenticação, execução, auditoria e testes estejam concluídos.

## 9. Módulos separados (nenhum conhece o outro por dentro)

| Módulo | Responsabilidade | Fala com | Nunca faz |
|---|---|---|---|
| Conector ERP Bling | OAuth por loja, leitura/escrita autorizada, renovação | Bling | Entregar token a agente ou ao navegador |
| Agent Gateway | Fila, roteamento por capacidade, contratos SDK, fallback | Plugins (NanoShell, GPT, Claude, outros) | Executar escrita no ERP |
| Motor de taxonomia e indexação | Taxonomia, genealogia, códigos, equivalências | Memória técnica | Homologar hipótese de agente |
| Memória técnica com evidências | Fonte, procedência, versão, confiança, permissões | Todos, por API | Misturar dado privado de lojas |
| Serviço de imagens | Gerar/tratar imagens, validar formatos de marketplace, marcar sintética | Gateway, armazenamento | Trocar foto técnica real por sintética |
| Serviço de SEO e publicação | Título, descrição, dados estruturados, preparo de publicação | Memória (só aprovado) | Publicar produto incompleto |

O frontend consome os módulos por **interfaces autenticadas** (Edge Functions com o JWT do usuário); nenhum segredo chega ao navegador.

## 10. Taxonomia como patrimônio técnico (não pertence a um agente)

- Vive no banco (taxonomia, genealogia da migração 18, `pecas_ref`, `ref_cruzada`). Agente pesquisa e **propõe**; só vira dado homologado com validação humana (`status: a_confirmar -> aprovado`, com fonte e data).
- Hipótese nunca vira fato: o banco já recusa aprovado sem fonte/data, OEM/OES sem fornecimento original documentado e equivalente sem evidência.
- Memória preserva evidência, procedência, versão (receitas imutáveis), histórico e permissões por loja.

## 11. Ferramenta de imagens (Central de Agentes)

Capacidades planejadas: banners comerciais, composições promocionais, melhoria de apresentação de produto, **validação de dimensões e formatos por marketplace**, conteúdo visual para SEO e campanhas.
Regras: toda imagem gerada é `sintetica: true`, com direitos registrados, hash e origem; **foto técnica real e imagem gerada ficam em campos e rótulos distintos**; a sintética nunca ocupa o lugar da foto real da peça e só publica com aprovação. Dimensões de marketplaces entram como tabela de requisitos com **fonte e data** (não inventada aqui).

## 12. OAuth do Bling — redação para não afirmar o que não foi verificado

- Caminho **por loja** (individual) está implementado e permanece como opção técnica.
- Caminho **central do Conecta.IA** (app único, autorização OAuth por loja) é **candidato**, não verificado: a documentação oficial do Bling estava inacessível. Nenhuma regra de publicação, homologação ou prazo de token é tratada como oficial neste projeto até alguém conferir em `developer.bling.com.br`.

## 13. Fluxo completo de uma tarefa executada por agente

1. Lojista abre um produto na Central e escolhe "Enriquecer cadastro e taxonomia" (ou o gatilho automático detecta cadastro insuficiente).
2. Servidor cria a tarefa (`enriquecimento_tarefas`) com `capacidade`, `idempotency_key`, risco e escopo; Policy Engine classifica o risco (leitura LOW; escrita MEDIUM+ exige aprovação).
3. Roteador escolhe o plugin habilitado para a capacidade (preferência da loja, custo, disponibilidade); fallback se não responder no prazo.
4. Plugin reivindica a tarefa (lease), recebe **só dados do produto e a receita**, nunca tokens.
5. Plugin pesquisa e devolve itens com fonte, data e confiança por contrato.
6. Verificador recusa o que não tem evidência ou formato; o restante entra `a_confirmar`.
7. Lojista vê na Central: resultado, evidências e diferenças; aprova ou rejeita item a item (auditado).
8. Aprovado vira dado da loja; a taxonomia/memória global só muda por promoção revisada pelo super admin.
9. Se houver escrita no Bling: ferramenta do catálogo fechado, só ativa e com `aprovacao_id`, com `idempotency_key`, e leitura de confirmação depois (timeout em escrita => estado desconhecido, nunca repetir às cegas).
10. Auditoria encadeada: tenant, agente, tarefa, ferramenta, risco, resultado, aprovação.

## 14. Plano de testes de segurança e integração

| Área | Teste | Tipo |
|---|---|---|
| Isolamento | Plugin/usuário da loja A não lê, reivindica nem altera nada da B (fila, memória, app do Bling) | SQL com duas lojas + função |
| Privilégio | `editor` não altera integração, não aprova escrita; super_admin só com aal2 | SQL + função |
| OAuth | state de uso único, expirado, de outra loja, de usuário que perdeu o papel; CNPJ divergente | função com Bling simulado |
| Segredos | Nenhum token/secret em resposta, log, erro ou entrada de tarefa | teste + varredura de segredos no CI |
| Contrato SDK | Manifesto, tarefa e resultado inválidos são recusados; versão desconhecida recusada | Node |
| Evidência | Item sem fonte/data/confiança recusado; sintética sem rótulo recusada | Node + SQL |
| Escrita | Ferramenta desligada recusa mesmo com aprovação; sem `idempotency_key` recusa; timeout => desconhecido | Node |
| Fallback | Lease expira, tarefa volta à fila, segundo plugin assume | Node |
| Custo | Estourar `limite_mensal_tokens` bloqueia novas tarefas | SQL |
| Integração | Demonstração ponta a ponta em **ambiente de teste** com os produtos da Mobis (sem escrever no Bling) | roteiro manual + captura |

## 15. Plano de implantação com rollback

Ordem (cada passo exige autorização explícita; nenhum está autorizado hoje):
1. Corrigir/aprovar PR #14 → aplicar migração 21 → publicar `bling-app`, `bling-conectar`, `bling-callback`, `bling-renovar`. **Rollback:** bloco ROLLBACK da migração + republicar versões anteriores.
2. Tabelas e rotas do gateway (`/agent/v1/*`) em ambiente de teste. **Rollback:** desligar o roteador; tarefas ficam na fila; remover rotas.
3. Central de Agentes real, atrás de flag por loja. **Rollback:** desligar a flag; volta a demonstração.
4. Plugin de referência (agente integrado) → NanoShell por contrato → GPT/Claude. **Rollback:** desabilitar o plugin por loja (sem apagar histórico).
5. Serviço de imagens e SEO, depois publicação. **Rollback:** despublicar; originais preservados.

Marco de demonstração (ambiente de teste): escolher um produto da Mobis, pedir enriquecimento a um agente, ver taxonomia e evidências, gerar uma imagem comercial **rotulada como sintética**, preparar o SEO — tudo com revisão antes de publicar e sem escrita no Bling.
