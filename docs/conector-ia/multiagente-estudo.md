# Engenharia multiagente do Conecta.IA — estudo comparativo (2026-10-19)

Decisão pedida: qual arquitetura de agentes usar para indexar e enriquecer autopeças. **Nenhuma dependência externa foi instalada.** Onde um número não foi medido aqui, está dito.

Legenda da evidência: **[repo]** lido no repositório/produção · **[terceiros]** resumo de busca, página original não aberta (o ambiente bloqueia sites externos) · **[estimativa]** raciocínio, não medição · **[medir]** será medido no experimento.

## 1. O que o Conecta.IA já tem **[repo]**
- Banco como fonte da verdade (Postgres/Supabase, RLS por loja, 76 tabelas), **Edge Functions** (Deno) como único runtime de servidor.
- **Registro de ferramentas** (58) com política de risco, aprovação humana versionada, idempotência e leitura de confirmação.
- **Pipeline persistente** por produto (PR #40): máquina de estados, histórico imutável, fila com limite por loja e recuo, conflitos entre fontes. Funções determinísticas para extração, comparação, período no Brasil e cadastro.
- **IA substituível**: adaptadores Claude, Gemini e compatível com OpenAI; **0 chaves ativas**.
- **Capacidades que já existem como funções convencionais, sem LLM:** duplicidade (SKU/GTIN/nome), busca por OEM, cruzados diretos, validação de aplicação por versão/mercado/ano, extração e saneamento. Só classificação em taxonomia, redação e leitura de documentos não estruturados precisam de raciocínio por LLM.

## 2. O Ruflo (referência pedida)
**O que é [terceiros]:** `ruvnet/ruflo`, ex-*Claude Flow* (renomeado em fev/2026), autodescrito como "meta-harness" para Claude Code/Codex: plugin e CLI em Node (`npx`), servidor MCP, hooks, daemon, dezenas de agentes e skills, topologias de enxame (hierárquica, Raft, Byzantine, gossip), memória de "autoaprendizagem" e federação entre máquinas. Existem forks e espelhos com a mesma descrição.

**O que se sabe sobre as alegações [terceiros], sem presumir nada:**
- Números de destaque (SWE-bench ≈ 84,8%, economia de custo/tokens, "89% de acurácia de roteamento", "150×–12.500× em busca", ~100 mil usuários mensais) vêm da **própria documentação** e não têm reprodução independente nas fontes que li.
- Uma auditoria de abril (v3.5.51) teria classificado ~290 de 300+ ferramentas como *stubs*; uma verificação posterior do próprio projeto teria confirmado ~195 de ~240 como reais, com lacunas na execução de agentes, no transporte e no runtime de workflows. Relatos dizem que a alegação de "Flash Attention 2,49×–7,47×" foi **retirada** da documentação e que havia valores de economia de tokens **fixos no código** (`+= 100`). São relatos de terceiros; **não reverifiquei no código**.
- Conclusão sobre as alegações: **tratadas como não comprovadas**. Nada do desempenho prometido entra em nenhuma conta deste estudo.

**Adequação ao Conecta.IA [estimativa]:**
- É ferramenta de **desenvolvimento** (orquestrar Claude Code numa máquina), não um runtime multi-loja. Pressupõe Node/daemon e memória local; o Conecta.IA roda em Edge Functions Deno com Postgres.
- **Isolamento por loja não existe como conceito** no projeto; teríamos de construí-lo por cima.
- **"Aprendizagem autônoma"** conflita com a regra do briefing (a IA não altera sozinha fiscal, segurança nem aplicação aprovada).
- Superfície de risco: `npx …@latest` executa código de terceiros (cadeia de suprimentos), hooks e daemon rodam comandos na máquina, servidor MCP expõe dezenas de ferramentas, memória de terceiros misturada com dado de cliente.
- Acoplamento a um fornecedor de modelo (Claude), contra a exigência de não depender de um único fornecedor.
- **Veredito:** não adotar como dependência. Ideias úteis (papéis especializados, topologia hierárquica com coordenador, memória por escopo) podem ser reimplementadas no modelo próprio e só se o experimento mostrar ganho.

## 3. As quatro alternativas
| Critério | A. Orquestração nativa atual (pipeline + registro) | B. Agentes especializados com Claude Code | C. Arquitetura inspirada no Ruflo (enxame, memória autônoma) | D. Própria, com filas persistentes no Supabase e capacidades modulares |
|---|---|---|---|---|
| Onde roda | Edge Functions + Postgres | Máquina/CI do desenvolvedor (sessões de IA) | Node/daemon + MCP + memória própria | Edge Functions + Postgres (mesmo da A) |
| Segurança | Alta: RLS, só `service_role`, aprovação humana no banco | Média: depende de permissões da sessão; bom para desenvolvimento, ruim como runtime de produção | Baixa a média: código de terceiros, hooks, daemon, memória autônoma | Alta (igual à A) |
| Isolamento entre lojas | Imposto no banco | Não existe por padrão | Não existe por padrão | Imposto no banco |
| Manutenção | Baixa (um runtime, um banco) | Média (prompts e skills versionados) | Alta (dependência externa volátil; renomeações; cobertura real incerta) | Baixa a média (mais código nosso) |
| Custo em tokens [estimativa] | Mínimo: determinístico quase todo | Alto: cada agente carrega contexto próprio | Alto: o próprio desenho multiplica chamadas | Baixo: LLM só onde há ambiguidade, com orçamento por loja |
| Latência [estimativa] | Baixa por item, serial | Alta (sessões de IA por passo) | Média/alta (coordenação entre agentes) | Baixa: pesquisas independentes em paralelo; sem LLM no caminho comum |
| Complexidade operacional | Baixa | Média | Alta | Média |
| Independência de fornecedor de IA | Sim (adaptadores) | Não (Claude Code) | Não (Claude/Codex) | Sim (adaptadores) |
| Auditabilidade | Alta | Média (transcrições) | Baixa a média | Alta (histórico imutável, custos e fontes por passo) |
| Capacidade de crescer | Média | Média | Alta em teoria; não comprovada | Alta, por capacidades plugáveis |

**Tokens:** sistemas multiagente tendem a consumir várias vezes mais tokens que uma só chamada, porque cada agente repete contexto e coordena por mensagens (a Anthropic publicou ordens de grandeza para o próprio sistema de pesquisa; cito **de memória**, sem ter reaberto a fonte aqui). Isso **é uma razão para só usar LLM onde a decisão é realmente ambígua** e para medir, não para supor.

## 4. Recomendação
**D, construída sobre A.** Capacidades especializadas como módulos com contrato único; **funções convencionais por padrão**, LLM só para o que não é determinístico (classificar em taxonomia, ler documento não estruturado, redigir); coordenador que planeja o mínimo de tarefas, paraleliza pesquisas independentes, respeita limites de API e orçamento e registra custo, fontes e decisões; filas e estado no Postgres. **B** continua como ferramenta de desenvolvimento (revisão de código, pesquisa, testes), não como runtime. **C** fica descartada como dependência; reavaliar ideias específicas depois do experimento.

## 5. Critério para ampliar
Só ampliar para mais agentes com LLM quando o experimento (20 produtos, sequencial × multiagente) mostrar ganho **medido** em precisão, erros, tempo, custo ou intervenções, em relação ao fluxo sequencial determinístico. Ver `multiagente-experimento.md`.
