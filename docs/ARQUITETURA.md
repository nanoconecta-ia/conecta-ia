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

## 9. Decisões em aberto

1. Stack aprovada? Proposta: Next.js + TypeScript + Supabase.
2. Campos obrigatórios para publicar um produto e campos espelhados do Bling.
3. Detalhes do Bling (webhooks, limites, publicação do aplicativo): ler a documentação antes de implementar.
4. Quais UFs o super admin pode bloquear e como o lojista as vê.
5. Formas de pagamento do checkout (o piloto começa só em modo WhatsApp).
6. Plano do Supabase para produção (o gratuito pausa por inatividade e não tem backup diário).
7. Nome das organizações: a do Supabase e a do GitHub serão renomeadas. Não fixar nomes de organização no código.
8. Escrita de volta no Bling: nunca, ou só com autorização por campo? (recomendado: só na camada do Conecta.IA)
9. "Recursos mais modernos": lista concreta a definir com o cliente (SEO local, dados estruturados, otimização de imagem, PWA...). Sem prometer resultado de ranking.
10. Onde roda o front multi-domínio e como o certificado de cada domínio é emitido (custo, moeda, limite de domínios).
11. Quem altera o DNS de cada cliente e como registrar essa autorização.
12. Para a Mobis: onde está o registro do domínio e o DNS hoje (Locaweb?) e quem tem acesso a ele.
13. Modelo de IA do agente integrado e quem paga o custo por cliente. Proposta a medir: modelo menor para triagem e rascunho, modelo maior só para casos difíceis.
14. Prazo para o NanoShell reivindicar ou concluir uma tarefa antes de cair para o integrado (sugestão: 10 min).
15. Perfil de enriquecimento da Mobis (autopeças): conteúdo e validação das regras fiscais pelo contador.
