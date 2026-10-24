# Operar agentes pelo chat do Conecta.IA: auditoria e desenho (para revisão do proprietário)

Data: 2026-10-24. **Só desenho e auditoria.** Nada implementado, nenhuma migração, nenhum deploy, nenhuma credencial, nenhum custo, nenhuma escrita no Bling. Origem: pedido do proprietário (via GPT) no PR #62.

## 0. Três coisas que parecem uma só e não são

| Caminho | O que é | Quem paga o modelo | Credencial | Funciona hoje? |
|---|---|---|---|---|
| **A. Modelo por API (BYOK)** | O Conecta.IA chama GPT, Claude ou Gemini com a **chave de API do lojista** (cifrada no servidor). O modelo roda na nuvem do provedor. | Lojista, por token (limite mensal por loja) | Chave de API do provedor, cadastrada pelo lojista em "Integrações de IA" | **Parcial:** o Assistente publicado (`assistente`, `ia-config`) já conversa com o provedor escolhido e faz **consultas fixas** (resumo da loja, pendências, consulta ao Bling), **sem** o laço de ferramentas do Policy Engine. O chat com ferramentas (`conector-chat`) está só no código |
| **B. Agente externo via MCP/Pair** | Um agente que **já roda em outro lugar** (Claude Code, Codex, ChatGPT com conector MCP) conecta ao `conecta-gateway` por QR/OAuth e usa as ferramentas autorizadas. Usa o **próprio modelo e a própria assinatura** dele | A assinatura do próprio agente; o Conecta não cobra IA | Token de sessão do Pair (nunca no QR, nunca em chat, nunca no frontend); consentimento do lojista com escopos | **Parcial:** Pair, OAuth e `conecta-gateway` estão publicados (migrações de 18/10 aplicadas). Ferramenta de leitura do Bling disponível sob consentimento. Nenhum teste de ponta a ponta com cliente real foi registrado |
| **C. Canal GitHub assíncrono** | Comentários em PR entre GPT e Claude Code, mediados pelo proprietário | Cada plataforma na sua assinatura | Nenhuma no Conecta | Funciona para conversa técnica; **não é produto**: sem tempo real, sem isolamento por loja, sem aprovação |

**Distinção obrigatória:** usar um modelo GPT/Claude **por API** (A) **não** dá acesso à sessão privada do ChatGPT nem ao Claude Code do proprietário; e conectar um **agente externo** (B) **não** espelha a assinatura Plus nem a sessão dele: o QR autoriza **um cliente a usar as ferramentas do Conecta**, não o contrário. "Entrar com o ChatGPT" para reutilizar assinatura **não está verificado** e não entra no plano.

## 1. Auditoria: o que existe, o que está só no código, o que falta

| Peça | Estado | Evidência |
|---|---|---|
| Chat com provedor escolhido e consultas fixas (sem laço de ferramentas) | **Publicado** | Funções `assistente` (v6), `ia-config`; seletor de modelo e consentimento de envio no painel |
| Chat nativo com ferramentas, streaming e cartões de ferramenta | **Só código** (não implantado, sem chave de IA, nunca rodou com LLM real) | `conector-chat`, `chat.ts`, `ConectorIA.tsx`, eventos `ferramenta_inicio`/`ferramenta_fim` |
| Gateway MCP por chave de loja (`conector-mcp`) | **Só código** | `gateway.ts`; migração `mcp_gateway_chaves` pendente |
| **Pair + OAuth + `conecta-gateway`** (agente externo autorizado por QR) | **Publicado** | Funções `pair` v1 e `conecta-gateway` v4; tabelas `pair_dispositivos`, `pair_sessoes`, `pair_desafios` |
| Ferramentas expostas ao agente externo | **Publicado, poucas** | Espelho de produtos (leitura), propostas, `conecta.bling_consultar_produto` (só `GET`, sob consentimento `bling:consultar`) |
| Aprovações e propostas com versão exata | **Publicado (Pair)** e **só código (chat)** | `aprovacoes` (Pair); `agente_propostas`/`agente_aprovacoes` (chat nativo) |
| Fila de tarefas | **Só código** | `agente_tarefas` com estados `planejando → aguardando_aprovacao → executando → verificando → concluida | falhou | cancelada | bloqueada`; `pipeline_itens` |
| Estado de operação sem repetir por timeout | **Só código** | `agente_operacoes`: `pendente → enviada → confirmada | falhou | desconhecida` |
| **Seleção de agente no chat** (lista do que está realmente disponível) | **Falta** | Hoje só há lista de provedores de modelo (`provedor_capacidades`); não há lista de agentes/dispositivos conectados no chat |
| **Agente externo puxando tarefas do chat** (fila) | **Falta** | O gateway não tem ferramenta para o agente buscar a próxima tarefa e devolver o resultado |
| **Estado assíncrono de chamada** (`call_id`, consultar depois) | **Falta** | `despachar` é síncrono |
| Adaptador de dispositivo remoto (Desktop Commander) | **Falta e não é recomendado agora** | Nada executa comando em computador; o `pair` autoriza clientes, não roda shell |

## 2. Fluxo mínimo proposto (reusa a arquitetura; sem ponte nova de comunicação entre assistentes)

`conversa → escolher agente realmente disponível → autorização da loja → ferramenta → acompanhamento → resultado com evidência`

1. **Escolha do agente (UI):** um seletor no compositor com **duas listas honestas**: (a) *Modelos por API* (disponíveis só se há chave e limite, já existe em `provedor_capacidades`); (b) *Agentes conectados* (sessões Pair **ativas**, não revogadas, não expiradas, com atividade recente). O que não está disponível aparece desabilitado com o motivo ("sem chave", "sessão expirada"), nunca como pronto.
2. **Caminho A (modelo por API):** o turno roda em `conector-chat`: o modelo propõe chamadas, o **Policy Engine** decide, a ferramenta roda, o evento volta ao cartão de ferramenta (`solicitado → rodando → concluído/erro`). Leitura é direta; escrita vira proposta e espera sua aprovação.
3. **Caminho B (agente externo):** o chat cria uma **tarefa** em `agente_tarefas` (escopo da loja, `criada_por` o lojista) e mostra "aguardando o agente". Duas ferramentas novas no gateway, **somente leitura/proposta**: `conecta.tarefa.proxima` (o agente busca a próxima tarefa da **sua** sessão/loja) e `conecta.tarefa.concluir` (devolve resultado e evidência). O chat acompanha o estado real da tarefa. Sem agente ouvindo, a tarefa expira e o chat diz "agente indisponível"; nada é simulado.
4. **Isolamento por loja:** a loja vem **sempre da sessão** (Pair) ou do JWT do lojista; nunca de argumento do agente (já é a regra do `conecta-gateway`).
5. **Sem repetição por timeout:** chamada que não responde vira `desconhecida` e é **reconciliada** por leitura; repetir só com prova de que não gravou ou com confirmação humana.
6. **Resultado com evidência:** a resposta final é montada só da saída real (resumo, hash e hora), sem identificadores privados nem configuração completa.

## 3. Critério de aceite (demonstração pelo chat do Conecta, só leitura)

Tarefa real de **leitura** ("quantos produtos há no espelho e quais estão pendentes?"), executada por:
- **A:** modelo por API com ferramenta `conecta.catalogo.resumo`; **B:** agente externo pareado que busca a tarefa e responde.

Deve provar: (1) loja certa, e **outra loja não vê** a tarefa nem o resultado (teste com duas lojas); (2) estados verdadeiros no cartão (solicitado → aguardando → concluído); (3) resultado confere com consulta direta ao banco; (4) com o agente desligado, erro claro e nenhuma ação executada; (5) repetir o envio não duplica (chave de idempotência); (6) histórico e aprovações preservados; (7) nenhuma escrita no Bling.

## 4. O que cada caminho exige (credenciais, custo, limites)

- **A:** chave de API do provedor **cadastrada pelo lojista** na tela de Integrações (nunca em comentário, nunca no frontend); custo por token, limite mensal por loja a definir; latência e limites do provedor; o envio ao provedor exige o consentimento já existente na tela. **Bloqueio atual:** `conector-chat` e as migrações do Conector não estão em produção.
- **B:** QR aprovado pelo lojista com escopos mínimos e duração; token fica no computador do operador; revogação vale na chamada seguinte. **Limitação:** o agente só trabalha **enquanto estiver rodando** e ouvindo; o Conecta não liga nem controla o agente. Custo do modelo é da assinatura/uso dele.
- **C:** só para coordenação técnica entre assistentes; **fora do produto**.

## 5. Decisões do proprietário (antes de implementar)

1. Confirmar a ordem: **homologar o chat nativo (A)** primeiro; **B** depois, com as duas ferramentas de tarefa.
2. Aprovar o desenho das duas ferramentas de tarefa e do estado de chamada assíncrona (muda código e possivelmente o esquema de `agente_tarefas`; migração só com ensaio e autorização).
3. Decidir a política de custo e limite mensal de tokens por loja.
4. Decidir se há interesse em adaptador de dispositivo remoto (hoje não recomendado; exige desenho, consentimento por dispositivo e teste próprio).

## 6. Fora do escopo desta entrega

Implementar a ponte, instalar componentes em qualquer computador, compartilhar credenciais entre plataformas, espelhar assinatura ou sessão, captura de tela/cliques, qualquer escrita no Bling ou migração/deploy.
