# Central universal de agentes — auditoria, arquitetura e plano (somente análise)

> Data: 2026-11-02. **Nada foi implementado, migrado nem publicado por esta especificação.** Tudo o que não pôde ser provado está marcado **não verificado**. Fontes de terceiros sobre planos dos provedores estão listadas e podem estar desatualizadas.

## 1. Diagnóstico: produção × GitHub (verificado hoje)

Projeto Supabase `dsfzhsrudriqkumtlqwj` (conecta-ia). `main` = `2a6c609`.

| Função | Versão em produção | Atualizada em | Relação com a `main` |
|---|---|---|---|
| `conector-mcp` | **3** | hoje 22:18 UTC | **Idêntica**: 49 de 49 arquivos do pacote publicado são iguais aos da `main` (comparados byte a byte) |
| `assistente` | **20** | hoje 22:18 UTC | Publicada pelo deploy nº 9 do commit `2a6c609`; **bundle não comparado** (resposta grande demais) — sucesso do deploy visto só no GitHub |
| `conecta-gateway` | **5** | 19/10 (fora de dia) | **DEFASADA**: pacote publicado tem 92 KB; o artefato da `main` tem 145 KB. Faltam, por exemplo, o validador de aplicação (#204), a ficha base do Bling sem LLM (#219) e a verificação de imagem (#255). OAuth e `tools/list` existem nos dois |
| `conector-chaves` | 2 | 23/10 | não comparada |
| `conector-aprovacoes` | 3 | 28/10 | não comparada |
| `conector-conversas` | 2 | 23/10 | não comparada |

**Conclusão:** o `conector-mcp` publicado é o código da `main`. O `conecta-gateway` **não é**: roda código de 19/10. Quem o usa (extensão Guardião e pareamento) não recebe as correções feitas desde então. Republicá-lo é uma decisão separada, com ordem do dono e plano de volta.

Não verificado: o que `tools/list` devolve em produção (exige uma chave MCP real). Pelo registro do código: **23 ferramentas** visíveis com escopo `leitura`; **31** com `leitura` + `propor` (grupos: conecta 12, engenharia 14, bling 5). Ferramentas locais (Windows) aparecem só se houver agente desktop pareado. O registro tem 60 definições, das quais só parte está ativa e exposta ao MCP.

## 2. Matriz de compatibilidade (não verificada na prática)

| Cliente | Servidor MCP remoto próprio | Autenticação aceita | Planos | Situação |
|---|---|---|---|---|
| ChatGPT | Sim, como "conector personalizado" no modo desenvolvedor; só servidor remoto (stdio não) | OAuth ou sem autenticação | **Fontes divergem** (Pro/Team/Enterprise/Edu × Plus/Pro/Business/…); em Business/Enterprise um administrador pode precisar liberar | **Não verificado**; não anunciar como disponível ao lojista |
| Claude | Sim, "conector personalizado" (Configurações → Conectores); a conexão sai da nuvem da Anthropic, então o servidor precisa ser público | OAuth 2.1 + PKCE ou sem autenticação | **Fontes divergem** sobre o plano gratuito; Team/Enterprise: o dono da organização adiciona e cada membro autentica | **Não verificado** |
| Gemini (app) | **Nada encontrado** sobre servidor MCP remoto próprio | — | — | **Não anunciar** |
| Gemini CLI | Sim, remoto por SSE/HTTP | OAuth 2.0 com registro dinâmico quando o servidor suporta | Uso técnico, sem navegador não autentica | Só para usuário técnico |
| MCP genérico | Sim | Bearer (hoje, `conector-mcp`) ou OAuth (a construir) | — | Funciona **hoje** com chave, fora do navegador |

Fontes consultadas (terceiros, parte de documentação de fornecedores; não são páginas oficiais da OpenAI/Google): zuplo.com/docs/mcp-gateway/connect-clients/chatgpt, auth0.com/blog/add-remote-mcp-server-chatgpt, claude.com/docs/connectors/custom/remote-mcp, geminicli.com/docs/tools/mcp-server. **Antes de qualquer mensagem ao lojista, conferir cada plano na ajuda oficial do provedor.**

## 3. Arquitetura de autenticação proposta

### 3.1 O que existe
- **`conecta-gateway`**: OAuth 2.1 de cliente público já implementado e publicado (registro dinâmico assinado por HMAC, PKCE S256 obrigatório, consentimento nativo no painel `#/autorizar-agente`, código de uso único, token opaco, refresh com rotação e detecção de replay, revogação). Reaproveita `pair_sessoes` (escopos, expiração 15 min, teto de duração, revogação, auditoria). **Nunca foi provado com um cliente real.**
- **`conector-mcp`**: aceita só chave Bearer (`mcp_chave_validar` por hash; escopos `leitura|propor|simular`; limite 120/min).

### 3.2 O problema (por que não basta "aceitar o token do outro")
1. **Sem audiência**: o servidor OAuth confere `resource == conecta-gateway`, mas **não grava a audiência na sessão**. Um token do `conecta-gateway` aceito pelo `conector-mcp` seria reuso entre serviços — exatamente o que a especificação proíbe.
2. **Escopos de nomes diferentes**: o OAuth fala `produtos:ler`, `enriquecimento:propor`…; o `conector-mcp` fala `leitura`/`propor`.
3. **Os tokens do OAuth identificam sessão Pair/dispositivo**, e o `conector-mcp` identifica uma *chave* (criada por um usuário). A auditoria e o limite de chamadas hoje usam `chave_id`.

### 3.3 Recomendação (Opção A, a de menor risco)
Reusar o servidor OAuth existente como único emissor de identidade e consentimento e **acrescentar um segundo recurso protegido**:
- O cliente pede `resource=<URL do conector-mcp>`. O servidor passa a aceitar uma **lista fechada** de recursos (`conecta-gateway`, `conector-mcp`) e **grava o recurso na sessão**.
- `conector-mcp` expõe `/.well-known/oauth-protected-resource` (apontando para o emissor) e, ao receber um token que não é chave `mcp_…`, valida por uma **RPC nova** `oauth_validar_para_recurso(token_hash, sal_hash, recurso)` que confere: sessão ativa, não revogada, não expirada, empresa ativa, usuário ainda com papel, **recurso igual**, e devolve escopos já traduzidos.
- `pair_validar` (usado pelo `conecta-gateway`) passa a **recusar** sessões cujo recurso seja outro. Assim, nenhum token vale nos dois serviços.
- **Escopos**: criar escopos próprios `mcp:leitura` e `mcp:propor` (e, depois, `mcp:simular` só em homologação) no emissor, com rótulos em linguagem simples. Nenhum escopo contém `aprovar|executar|admin` (a constraint de `pair_sessoes` já barra).
- **Auditoria**: `despachar` já grava `p_mcp_chave`; acrescentar `p_sessao_oauth` (ou reutilizar o campo com prefixo) para auditar por sessão. Limite de chamadas por sessão.
- **Chave Bearer continua funcionando** (cliente genérico, scripts, ChatGPT sem OAuth), sem mudança de comportamento.

Alternativas descartadas por ora: **B** (fundir os dois gateways: mexe no Guardião e aumenta o risco); **C** (token JWT autoassinado: perde revogação imediata e é divergente do desenho opaco existente).

### 3.4 Requisitos × situação
| Requisito | Hoje | Com a proposta |
|---|---|---|
| PKCE S256 obrigatório | sim (gateway) | herdado |
| Validar emissor, audiência, expiração, sessão, empresa, escopos | **audiência não** | audiência por recurso gravada e conferida |
| Token opaco | sim | mantido |
| Revogação efetiva | sim (por sessão) | herdada; validação a cada chamada |
| Rotação de refresh | sim | herdada |
| Isolamento por loja | sim | `loja_id` da sessão define o contexto |
| Auditoria por ferramenta | por chave | por chave **ou** sessão |
| Menor privilégio | escopos Pair | escopos `mcp:*` mínimos |
| Sem `service_role`/token Bling/segredo de IA ao agente | sim | mantido |

### 3.5 Mudanças necessárias (todas dependem de aprovação do dono)
- **Migração**: coluna `recurso` em `pair_sessoes` (e no payload `pair_desafios.oauth`); atualizar `oauth_pair_iniciar/trocar/renovar` e `pair_validar`; nova RPC de validação por recurso; novos escopos em `pair_escopos_validos()`.
- **Código**: `pair/oauth.ts` (lista de recursos), `pair/escopos.ts`, `conector-mcp` (ramo OAuth + metadata), tradução de escopos, testes.
- **Painel**: tela de consentimento mostra o recurso e os escopos `mcp:*`.
- **Publicação**: `conecta-gateway` **precisa ser republicado** (hoje defasado) junto, o que traz as correções acumuladas: avaliar impacto no Guardião antes.

## 4. Adaptadores de conexão (mecanismos diferentes)

| Adaptador | Para quê | Autenticação | Estado |
|---|---|---|---|
| **MCP remoto** | agentes que aceitam servidor MCP externo | OAuth (a construir) ou chave Bearer | Bearer **publicado**; OAuth **proposto** |
| **API REST** | aplicações/agentes que só falam HTTP | chave com escopo e limites próprios | **Não existe** como produto; as Edge Functions atuais são internas ao painel. Exigiria contratos (OpenAPI), limites e versionamento |
| **Webhooks de entrada** | receber eventos externos | assinatura HMAC, anti-replay (timestamp + nonce), idempotência por `idempotency_key` | Existe para Bling (callback/OAuth); **genérico não existe** |
| **Plugins/conectores nativos** | instalação guiada em cada provedor | depende do provedor | Só descrever passos; nunca fingir instalação automática |

Regra: o painel escolhe o adaptador **pela capacidade verificada do cliente**, nunca pelo nome da marca.

## 5. Catálogo de ferramentas (agrupamento para o lojista)
Contagem exibida sempre vinda de `tools/list` da chave/sessão em uso, nunca fixa. Grupos: Produtos e estoque; Consulta ao Bling (leitura, sem custo/fornecedor); Taxonomia e códigos OEM; Aplicação por veículo/motor/ano; Imagens e documentação técnica; Propostas de enriquecimento; Aprovações e histórico; Diagnóstico e tarefas locais (só com agente pareado e escopo específico). Ferramentas `planejada`/`desligada` não aparecem como disponíveis.

## 6. Experiência do lojista (resumo do fluxo)
Escolher agente → permissões em linguagem simples → prazo → **Conectar** (método compatível) → **Testar** (uma chamada de leitura real, devolve "funcionou" ou motivo) → ver ferramentas autorizadas → revogar/renovar. Sem comandos, sem JSON, sem biblioteca. Botão "copiar endereço" quando a conexão for manual; segredo nunca exibido de novo. Mensagens: "Seu agente ainda não está autorizado." / "A autorização venceu." / "O serviço está temporariamente indisponível." / "Esta tarefa precisa da sua aprovação." O erro técnico fica em "detalhes".

Protótipo: **não construído** (a especificação proíbe implementar). A base seria a página existente `Conectar meu agente` (5 cartões de estado) + o assistente do Gateway MCP já publicado.

## 7. Matriz de segurança
| Risco | Mitigação |
|---|---|
| Token de um serviço aceito por outro | audiência gravada e conferida; `pair_validar` recusa sessão de outro recurso |
| Escopo excessivo | só `mcp:leitura` e `mcp:propor`; nenhum escopo aprova/executa/administra |
| Cliente malicioso com nome conhecido | consentimento mostra domínio de retorno; nome não é selo |
| Vazamento de chave | chave exibida uma vez; revogação imediata; nunca em chat/log |
| Escrita direta no Bling | desligada; `CAMPOS_ESCRITA_LIBERADOS` sem criação; exige aprovação humana + idempotência + auditoria |
| Notas fiscais, exclusão, publicação automática | bloqueadas |
| Comandos Windows irrestritos | só com agente desktop pareado, escopo específico, política e autorização humana |
| Custos/fiscal/segredos a provedor externo | filtros por lista de campos permitidos (já existem) |
| Anúncio falso de integração | selo "não verificado" até haver prova; matriz acima |
| Defasagem produção × `main` do `conecta-gateway` | republicação planejada com plano de volta |

## 8. Plano de migração sem interrupção
1. Aprovar este desenho e as migrações (aditivas: colunas novas com padrão `conecta-gateway`).
2. Banco local descartável: migração + testes SQL (recurso, validação, revogação, isolamento, replay).
3. Código + testes (unidade e integração com SDK MCP real em loopback).
4. Publicar `conecta-gateway` **primeiro** (compatível: sessões antigas têm recurso padrão `conecta-gateway`); depois `conector-mcp`. Guardar versões anteriores para reverter.
5. Homologação com cliente OAuth sintético; depois um cliente real (ChatGPT ou Claude) com a conta do dono.
6. Só então liberar o botão no painel. Rollback: restaurar a versão anterior das funções; as colunas novas são inofensivas.

## 9. Plano de testes (separar os níveis)
1. **Sintético (CI)**: descoberta (`oauth-protected-resource`, authorization-server), registro, PKCE, consentimento com escopo reduzido, listagem, recusa de escopo, expiração, revogação, replay de código e de refresh, isolamento entre lojas, **token do outro recurso recusado**, auditoria, falhas.
2. **Local**: Postgres descartável + SDK MCP.
3. **Homologação**: projeto separado ou lojas de teste; sem dado real.
4. **Real com cliente externo**: conta do dono, loja Mobis, produto CI000016, **somente leitura/proposta, sem Bling**.
Consulta de produto real pela API do Bling e proposta sem publicação são os dois testes de aceite; "discovery responde" ou "merge feito" não provam a conexão.

## 10. Complexidade e custo operacional (estimativas, sem medição)
- **Esforço**: médio-alto. Migração pequena (colunas + 1–2 RPCs), código moderado (ramo OAuth no `conector-mcp`, tradução de escopos, tela de consentimento), testes numerosos. A parte mais incerta é **o comportamento real de cada cliente** (ChatGPT/Claude) — só se descobre com cliente real.
- **Custo de execução**: Edge Functions e Postgres do plano atual; sem serviço novo. O custo de IA continua do cliente externo (a assinatura dele); o Conecta.IA só serve ferramentas. **Sem medição**: não há dado de tráfego do MCP em produção.
- **Riscos de calendário**: planos dos provedores mudam; republicar o gateway defasado pode afetar o Guardião.

## 11. Pendências e decisões do dono
1. Aprovar a Opção A (audiência por recurso + escopos `mcp:*`) e as migrações descritas.
2. Autorizar a **republicação do `conecta-gateway`** (hoje defasado) e o plano de volta.
3. Decidir a prioridade: ChatGPT primeiro ou Claude primeiro (conferir plano e liberação de administrador).
4. Confirmar que API REST e webhook genérico ficam **fora** desta fase (hoje não existem como produto).
