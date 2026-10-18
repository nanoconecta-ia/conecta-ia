# Conecta.IA — arquitetura (rascunho para validação)

Estado: **rascunho**. O site é o próprio Conecta.IA e ainda não existe código. Stack proposta (a aprovar): Next.js + TypeScript + Supabase; hospedagem do front em aberto. Nada aqui foi implementado.

## 1. Visão

O lojista mantém o cadastro no Bling. O Conecta.IA espelha o catálogo e o publica no site do cliente, sem recadastro. Mudou uma vírgula no Bling, muda no site.

```
Bling (fonte única) ──webhook / varredura──▶ Sincronizador ──▶ Espelho (somente leitura) ──▶ Site no domínio do cliente
                                                                   │
                                                  fila de tarefas de enriquecimento
                                                   │                          │
                                       Agente integrado do site      Agente NanoShell (navegador)
                                                   └────────────┬────────────┘
                                                      camada de enriquecimento (mesma para os dois)
```

Os dois agentes são caminhos equivalentes: se um falhar, o outro assume e o cliente continua. O NanoShell **não** é pré-requisito para o site funcionar.

## 2. Sincronização com o Bling (fluxo principal)

- **Conexão por loja:** o cliente autoriza o Conecta.IA no Bling (OAuth). Tokens cifrados, só no servidor, renovação automática, header `enable-jwt: 1` (ver seção 7).
- **Detecção de mudança:** webhook do Bling em tempo real, **se confirmado na documentação**; senão consulta periódica incremental. Em qualquer caso, uma **varredura periódica de segurança** corrige perdas de evento.
- **Aplicação:** evento entra numa fila **idempotente**; busca o produto no Bling; aplica no espelho respeitando a **ordem pela data de alteração** (nunca regrava com dado mais antigo); respeita os limites de requisição do Bling com espera crescente.
- **Espelho somente leitura:** ninguém edita produto no site. O lojista edita só o que é do site (banners, páginas, SEO, tema, regras de venda).
- **Falhou?** mantém o último estado válido, registra o erro e tenta de novo. O site nunca depende do Bling para abrir.
- **Registro:** origem, data e versão de cada gravação, com histórico de erros visível no painel.
- **Divergência:** quando o espelho e o Bling discordam depois de uma sincronização, ou quando um dado enriquecido contradiz o Bling, o caso é **registrado e aparece no painel** para decisão. Até a decisão, **o Bling prevalece**.

**Campos espelhados (mínimo a aprovar):** nome, código (SKU), preço, estoque, situação, imagens, categoria, marca, GTIN, descrição, peso e medidas.

## 3. Publicação

- Produto só é publicado se tiver os campos obrigatórios (lista a definir com o lojista).
- Campo vazio fica vazio na página. Nada é inventado.
- Produto inativo ou removido no ERP é despublicado, não apagado.
- Último catálogo válido continua no ar se o Bling ficar fora do ar.

## 4. Controle de venda

Ordem de avaliação de uma compra, no servidor:
1. A loja está em modo que permite checkout? (`catalogo` bloqueia)
2. A UF do CEP de entrega é permitida pelo **super admin**?
3. A UF é permitida pelo **lojista**?
4. O tipo de comprador (PF/PJ, pelo CPF/CNPJ) é permitido pelo lojista?
5. Preço e estoque estão frescos e válidos?

Se qualquer passo falhar: a compra é recusada com motivo claro e o cliente é levado ao WhatsApp (exceto em loja só catálogo).

Papéis: `super_admin` (plataforma), `lojista` (por loja). Cada um com login próprio; super admin com verificação em duas etapas. Auditoria de toda mudança de regra.

## 5. Isolamento e segurança

- Toda tabela de dados da loja carrega o identificador da loja. Acesso filtrado no servidor **e** no banco (RLS no Postgres/Supabase).
- Chave por loja só atua na própria loja.
- Segredos fora do código e do navegador.
- Backups: plano gratuito do Supabase não tem backup diário. Exportação periódica do catálogo para outro lugar antes de abrir ao público.

## 6. Frescor de preço e estoque

- O sincronizador guarda `atualizado_em` e a data/versão de origem do Bling em cada produto, e o horário da última sincronização bem-sucedida da loja.
- **Antes de cobrar**, o Conecta.IA consulta o Bling na hora. Se o Bling não responder e a última sincronização bem-sucedida for mais velha que a idade máxima (sugestão: 15 min), a compra é bloqueada e o cliente vai ao WhatsApp.
- Produto parado há muito tempo não é erro: a idade máxima se refere à **saúde da sincronização**, não à última alteração do produto.

## 7. Enriquecimento próprio e autenticação do Bling (JWT)

**Enriquecimento: dois provedores, uma fila**
- Quando o cadastro é insuficiente (campos faltando, qualidade baixa) ou quando o lojista pede, o Conecta.IA cria uma **tarefa de enriquecimento** (produto, campos a melhorar, hash dos campos de origem).
- **Preferência por loja:** `integrado`, `nanoshell` ou `automático`. No automático, a tarefa é oferecida ao NanoShell e, **se não for reivindicada ou concluída dentro do prazo** (sugestão: 10 min), passa ao agente integrado.
- **Agente integrado:** roda no servidor do Conecta.IA, com limite de uso por loja e registro de cada execução (custo e quem acionou).
- **Agente NanoShell:** roda no navegador, então **busca** tarefas na API (chave por loja, só rotas da fila), reivindica uma por vez com prazo de validade (para duas execuções não pegarem a mesma) e devolve o resultado.
- **Resultado dos dois** passa pela mesma validação e entra na camada de enriquecimento: campo, valor, **fonte, data, nível de confiança**, provedor que gerou e o `hash` dos campos de origem. Se o Bling mudar esses campos, o enriquecimento fica **desatualizado** e a tarefa pode ser refeita.
- **Etapas do enriquecimento (iguais nos dois agentes):**
  1. Receber os dados do Bling (cadastro; ver decisão sobre XML).
  2. Buscar e enriquecer: catálogos técnicos, compatibilidade, especificações, imagens, taxonomia.
  3. Validar imagens e dados: identidade do produto, referência e **direito de uso**.
  4. Aplicar regras por canal: título, descrição, atributos, SEO e formatos (canais ficam para a Fase 4).
  5. Revisar e aprovar: o lojista confere os campos incertos.
  6. Sincronizar e publicar nos canais autorizados, com histórico.
- **Etapas especializadas dentro do agente integrado:** indexador de produtos, validador de aplicações (compatibilidade), otimizador de conteúdo, gerador de SEO.
- **Imagens:** cada imagem guarda tipo, origem, **direitos de uso** e resolução. Imagem de terceiros só entra com direito registrado. **Imagem gerada por IA nunca é apresentada como a foto real do produto** e não vira imagem principal sem aprovação do lojista.
- Nunca inventa. Sem evidência, fica "a confirmar" ou vazio. Nunca sobrescreve dado já aprovado.
- **Perfil de enriquecimento por ramo e por loja**, nunca global. Ex.: perfil "autopeças" para a Mobis. As regras fiscais de qualquer perfil devem ser **validadas pelo contador** antes de entrar em produção.
- Escrita de volta no Bling: padrão é **não escrever**.

**Autenticação do Bling** (fonte: guia "Migração para autenticação JWT" da documentação do Bling)
- O Bling está descontinuando tokens opacos; a data do bloqueio está em definição.
- Header `enable-jwt: 1` na obtenção do token, na renovação e em todas as requisições. O JWT tem ~1.500 a ~3.000 caracteres: colunas e headers precisam comportar isso.
- Credenciais por cliente, cifradas, só no servidor, renovação automática, isolamento por loja.
- **Ler antes de implementar** (páginas da documentação do Bling): "Webhooks", "Limites" e "Publicando um aplicativo". Não presumir comportamento.

## 8. Domínio próprio por cliente (proposta)

Cada cliente usa o próprio domínio. O piloto é `www.mobisautoparts.com.br`, hoje hospedado na Locaweb.

- **Resolução:** o domínio da requisição identifica a loja, **no servidor**. Domínio desconhecido responde 404 sem revelar nada de nenhuma loja.
- **Cadastro do domínio (conceito, nenhuma tabela criada ainda):** domínio, loja, principal ou alias, status da verificação de DNS, status do SSL, datas.
- **Fluxo de ativação:**
  1. O cliente informa o domínio no painel.
  2. O Conecta.IA mostra os registros de DNS a criar (um registro de verificação e o apontamento para o destino da plataforma).
  3. O Conecta.IA verifica o DNS sozinho.
  4. O certificado SSL é emitido e renovado automaticamente.
  5. O corte só acontece depois de validar o site novo, com **plano de volta**: o site atual continua no ar, com TTL do DNS reduzido antes da troca.
- **SEO por domínio:** `canonical`, `sitemap.xml`, `robots.txt` e dados estruturados usam o domínio do cliente e só dados reais dele.
- **Piloto Mobis:** nada muda no DNS nem na Locaweb até haver autorização explícita. O site novo é validado antes, em endereço de teste, e o corte é um passo separado.
- **Hospedagem do front multi-domínio (a decidir):** a hospedagem compartilhada da Locaweb não costuma servir vários domínios de clientes com SSL automático e lógica de servidor. Opções a avaliar, com custo e moeda: serviço gerenciado de front com domínios personalizados, ou servidor próprio (VPS) com certificado automático. O Render está descartado.

## 9. Fases e marcos

**Fase 0 — Auditoria (concluída).** O repositório tinha só um README e o projeto Supabase `conecta-ia` estava vazio: não havia código nem dados a reaproveitar. Nada de produção foi criado.

**Fase 1 — Piloto de leitura, 20 a 50 produtos da Mobis.** Só leitura do Bling, site em modo WhatsApp, sem checkout e **sem escrever no Bling**.

> **Marco 1 — três provas a demonstrar antes de seguir:**
> 1. **Identificar sem duplicar:** cada produto do Bling é reconhecido por ID e SKU; sincronizar de novo não cria cópia.
> 2. **Enriquecer com evidência:** todo dado enriquecido traz fonte e data, e o sistema distingue **confirmado** de **hipótese** ("a confirmar").
> 3. **Sincronizar com segurança:** detecta alteração, trata conflito (dado mais antigo é ignorado, divergência é registrada) e se recupera de falha sem corromper o catálogo, mantendo o último catálogo válido no ar.

> **Sobre o cronograma do documento-base** (planejamento 1–2 semanas, integração com o Bling 2–4, IA e enriquecimento 4–8, canais 6–10, testes e piloto 10–12, go live 12+): é uma estimativa do responsável, não um compromisso. **Proposta:** antecipar o piloto de leitura (Fase 1) para validar a arquitetura **antes** de construir canais e marketplaces.

**Fase 2 — Painel do lojista.** Dados, pendências, divergências, aprovações do enriquecimento e histórico, em desktop e celular.

**Fase 3 — Escritas controladas no Bling.** Só depois de testes, aprovação humana, regras por campo e mecanismo de recuperação.

**Fase 4 — Publicar e expandir.** Site próprio no domínio do cliente primeiro; depois marketplaces, feeds, SEO e campanhas.

## 10. Decisões tomadas

1. **Custo de IA é do cliente (chave própria).** Cada lojista escolhe o agente/provedor e cadastra a própria chave de API no Conecta.IA. A chave fica cifrada, só no servidor, isolada por loja, nunca em log nem no navegador. O Conecta.IA mede o uso por loja.
2. **O Conecta.IA guarda só a memória de gerenciamento dos ERPs** (espelho, fila, vínculos, auditoria). Quem trabalha é o agente do Conecta.IA; o agente NanoShell fica como segunda via (ver seção 7).
3. **Plano Supabase Pro previsto para produção** (backup diário, sem pausa). Contratação ou alteração de plano exige autorização específica do titular; o merge deste documento não altera a cobrança.
4. **Teste primeiro com URL do Supabase/app**, depois o domínio da Mobis. O domínio só entra com DNS e SSL verificados e autorização explícita.
5. **Painel administrativo:** login por e-mail/senha e Google; visualização ao vivo do site (pré-visualização) para ver como está ficando; área de desenvolvimento e administração total (super admin, com MFA), no modelo SaaS.
6. **Conexão com o Bling automática:** fluxo OAuth guiado (o lojista clica em "Conectar ao Bling"), renovação automática do token, sem copiar chave à mão. Acompanhar as mudanças do Bling na documentação.
7. **Escrita no Bling (Fase 3):** depois dos testes de leitura, o Conecta.IA passa a poder atualizar o cadastro no Bling, **por campo, com autorização explícita do cliente**, com registro de antes/depois e opção de desfazer. Até lá, somente leitura.
8. Já aprovados antes: campos espelhados (nome, SKU, preço, estoque, situação, imagens, categoria, marca, GTIN, descrição, peso, medidas, embalagem e volumes); imagem gerada por IA nunca é apresentada como foto real nem vira principal sem aprovação; fonte do cadastro é a API do Bling.
9. **O Conecta.IA expõe um servidor MCP**, para que agentes (o do próprio Conecta.IA, o NanoShell e outros compatíveis) operem a plataforma por ferramentas padronizadas. Regras: credencial **por loja** que só alcança a própria loja (nunca a de pessoa nem a service role); ferramentas de leitura primeiro (catálogo, estado da sincronização, fila de enriquecimento); ferramentas de escrita passam pelas mesmas regras do painel (restrições por UF, autorização por campo, auditoria, limite de uso de IA); escrita no Bling só na Fase 3. Lista exata de ferramentas e forma de autenticação ficam para desenho antes de implementar.

## 11. Decisões em aberto

1. Stack aprovada? Proposta: Next.js + TypeScript + Supabase.
2. Campos obrigatórios para publicar um produto.
3. Detalhes do Bling (webhooks, limites, publicação do aplicativo): ler a documentação antes de implementar.
4. Quais UFs o super admin pode bloquear e como o lojista as vê.
5. Formas de pagamento do checkout (o piloto começa só em modo WhatsApp).
6. Provedores de IA aceitos para a chave do cliente e limite de uso por loja.
7. Onde roda o front multi-domínio e como o certificado de cada domínio é emitido (custo em reais, limite de domínios).
8. Para a Mobis: onde está o registro do domínio e o DNS hoje (Locaweb?) e quem tem acesso.
9. Prazo para o NanoShell reivindicar uma tarefa antes de cair para o integrado (sugestão: 10 min).
10. Perfil de enriquecimento da Mobis (autopeças) e validação das regras fiscais pelo contador.
11. "Recursos mais modernos": lista concreta, sem prometer ranking.

## 12. Visão da plataforma (SaaS) e módulos

Direção dada pelo dono do produto, registrada no desenho original. O estado de implementação em 18/10/2026 está em `chat-operacional/ENTREGA.md`, `estudio-agente/ESCOPO.md` e `conecta-pair/OPERACAO-AGENTE.md`; módulos futuros abaixo continuam sujeitos a implementação e validação.

### Quem usa
- **Desenvolvedor / super admin (dono do SaaS):** área própria, com MFA. Cadastra lojas, planos e cobrança futura, define os **modelos globais de agentes LLM** disponíveis, vê uso e custo por loja, bloqueia vendas por UF e administra a plataforma inteira.
- **Lojista (ex.: Mobis Autopeças):** painel da própria loja: conexão com o Bling, catálogo indexado, taxonomia, imagens, enriquecimento, regras de venda, aparência do site, integrações e métricas. Só vê a própria loja.
- **Cliente final:** vitrine responsiva (celular primeiro), catálogo, WhatsApp e, quando liberado, checkout.

### Abertura para agentes (MCP + API)
- API própria e servidor MCP (ver decisão 9) para conectar agentes como o Claude e o NanoShell. O NanoShell continua **independente**: tem as próprias regras e memória e usa a mesma API/MCP quando o dono criar a credencial dele.
- **Chave de IA do cliente:** o lojista pode cadastrar a chave da própria conta (ex.: Anthropic) para o agente do Conecta.IA. Custo dele, medido por loja.
- **Agente nativo do Conecta.IA:** conhece o ecossistema do Bling (campos, regras, limites) e faz indexação, enriquecimento de catálogo e melhorias no site a pedido do lojista (fontes, cabeçalho, filtros, cascata de cores etc.). Mudança de aparência passa por **pré-visualização e aprovação do lojista** antes de publicar, com opção de desfazer.

### Vitrine e SEO técnico (para o Google não penalizar)
O que dá para garantir por construção (sem prometer posição):
- HTTPS em todos os domínios, `sitemap.xml`, `robots.txt`, URLs canônicas, um `h1` por página, páginas rápidas (Core Web Vitals), imagens otimizadas com texto alternativo, sem conteúdo duplicado entre produtos.
- Dados estruturados (schema.org) `Product`/`Offer` com preço e estoque **iguais aos da página**, `Organization` e `LocalBusiness` com endereço.
- Feed de produtos para o Google Merchant Center e catálogos para Pinterest e Meta, gerados a partir do espelho. Preço, estoque e GTIN do feed vêm do Bling, nunca inventados.
- Endereço, telefone e horário iguais aos do Perfil da Empresa no Google (Maps). Cadastro e verificação do perfil são do lojista.
- Páginas de produto incompletas não são publicadas; produto removido vira indisponível, não 404 solto.
- Regras e políticas do Google e das redes mudam: conferir a documentação oficial de cada uma antes de implementar.

### Análise e estratégia (dentro do painel do lojista)
Somente leitura e com consentimento do lojista (OAuth da conta dele): Google Search Console, Google Analytics, Google Trends. Mostrar resumo e sugestões; nada é alterado nas contas do lojista.

### WhatsApp Business
Conexão pela API oficial (WhatsApp Business Platform), com número, aprovação e custos da Meta por conta do lojista. Primeiro uso: link com produto (já no piloto). Atendimento e mensagens automáticas ficam para fase posterior.

### Taxonomia e imagens (proposta, aguarda aprovação antes de virar migração)
- `categorias` por loja: árvore (pai, nome, slug), `bling_categoria_id` quando existir, e correspondência opcional com a categoria de produto do Google. Categoria nova sugerida pelo agente fica "a confirmar".
- `atributos_categoria` e valores por produto (ex.: autopeças: aplicação, lado, material), cada valor com fonte/data/confiança como no enriquecimento.
- Imagens: já modeladas (tipo real/gerada/ilustrativa, direitos, resolução, aprovação); acrescentar variantes otimizadas (largura, formato) e texto alternativo.
- Produto aponta para uma categoria; mudança de categoria no Bling atualiza o espelho, e a taxonomia própria só complementa.

### Cadastro de produto
O Bling continua sendo a origem. Criar produto a partir do Conecta.IA só na Fase 3, por API do Bling, por campo e com autorização (decisão 7).

### Ordem sugerida
1. Piloto de leitura Bling → espelho (Marco 1) e vitrine mínima responsiva em modo WhatsApp.
2. Painel do lojista e área do super admin (login, MFA, lojas, uso por loja).
3. Taxonomia, imagens otimizadas, SEO técnico e feeds.
4. API/MCP para agentes e chave de IA do cliente; agente nativo.
5. Integrações de análise (Search Console, Analytics, Trends) e WhatsApp.
6. Escrita no Bling e cobrança.
