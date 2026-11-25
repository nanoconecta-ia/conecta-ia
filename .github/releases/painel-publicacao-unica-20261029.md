# Publicação pontual autorizada — Conecta.IA / 29-10-2026

Autorização explícita do proprietário: “Pode continuar e merge e publicar quando necessário.”

Este arquivo é o gatilho **único** de publicação do painel do GitHub Pages, com os workflows e flags já usados pela equipe. Ele é adicionado somente uma vez.

## Escopo deste release
- Publicar exclusivamente os arquivos estáticos gerados por `painel/`, mantendo as variáveis `VITE_PAIR_ATIVO=1` e `VITE_BACKUP_ATIVO=1`.
- Incluir código frontend aprovado até a `main` no momento do merge, como chat compacto, sidebar retrátil, Visão Geral, Catálogo avançado e paginação no espelho.
- O backend não é publicado por este workflow: **nenhuma Edge Function, migração SQL ou escrita Bling**.
- Conferir o resultado de build/deploy e o commit SHА exato do release; sem status verde não declarar site atualizado.
- Futuras mudanças no GitHub não disparam nova publicação a menos que este arquivo de marcador seja novamente alterado.

## Republicação corretiva autorizada — PR #146
- Atualizar o GitHub Pages após o merge `9789ee38324e57eda7a19c1eaa367be2f59200e4`, com seis checks aprovados e build local bem-sucedido.
- Correção de sintaxe CSS no menu mobile; sem alterações no backend, banco ou Bling.
- Esta atualização do marcador aciona o workflow de publicação já existente, sem alterar suas permissões ou flags.

## Republicação corretiva autorizada — PR #152 (30-10-2026)
- Autorização do proprietário nesta conversa: “Sim pode merge e publicar todos”; pedido posterior para aplicar ao Nano.IA o modelo de navegação e anexos apresentado em capturas do celular.
- PR #152 integrado em `fa39786f6007fbab43818b532b0e24a71cf94db6`, após **seis workflows aprovados** no commit de origem `aef96c12f9b4f68c7782c2ebac330e5d2fc356a6`.
- Publicar **somente frontend estático** da `main`: gaveta lateral de ferramentas/conversas, busca, nova conversa, botão “+” com câmera/fotos/arquivos, rolagem do histórico, correção para celular em paisagem e roteamento de comandos de produtos ao assistente.
- Preservar `VITE_PAIR_ATIVO=1` e `VITE_BACKUP_ATIVO=1`; nenhuma Edge Function, migração, credencial ou escrita no Bling é modificada.
- Conferir o resultado dos jobs build/deploy e validar versão publicada por HTTP antes de considerar o release concluído.

## Publicação real autorizada — Nano.IA com fallback gratuito e ficha sem LLM (01-11-2026)
- Autorização expressa nesta conversa: "Pode faz a camada real e ativa o fallback".
- Publicar frontend da main após merges dos PRs #219 (`1e6c387`) e #218 (`205749c`), preservando o único chat Nano.IA, o comando `/ficha SKU` e o checkbox de consentimento do fallback.
- Backend `assistente` foi publicado como versão 16 no projeto Supabase `dsfzhsrudriqkumtlqwj`; recurso de contingência depende de secrets server-only e allowlist da loja, não ativar automaticamente chamadas externas sem chave e opt-in.
- Restrições: sem alteração de registros Bling, sem escrita ERP, sem mexer em tokens, sem cobrança ou publicação comercial automática.
- Esta alteração do marcador aciona apenas `painel-pages.yml` com as flags já aprovadas, sujeita a build e verificação posterior.

## Republicação corretiva autorizada — Mobis / PR #318 (13-11-2026)

- Autorização expressa do proprietário nesta execução: finalizar e integrar o PR #318, publicar pelo workflow autorizado de GitHub Pages e validar o resultado real.
- PR #318 integrado em `d7ce2ab2e03640f5eeb7617acec65077f5a757e2`; sete workflows aprovados no head `8a3af19bcc49554d6414572c36b0590aa460681f`.
- Publicar somente o frontend da main com as flags existentes. A raiz dos dois hosts oficiais passa a selecionar LojaMobisNova; demais clientes e painel preservados.
- Testes: 394 unitários, TypeScript/build e Playwright na rota pública e nos hosts simulados, em 360/390/412/1280px; filtros em cascata e consulta WhatsApp. O workflow compara version.json ao SHA publicado e registra capturas reais após deploy.
- Loja permanece em teste, sem vendas/checkout. Sem backend, migração, escrita Bling, transferência de estoque, alteração fiscal ou DNS.
- Domínio oficial segue pendente: sem A/AAAA no domínio principal e www inexistente na consulta DNS desta execução. Esta republicação não configura DNS nem declara esse domínio homologado.

### Repetição da homologação após publicação
- A publicação `a9b8b1d` foi aplicada com sucesso, mas o runner `ubuntu-latest` passou a Ubuntu 26.04 e a instalação do Playwright 1.56.1 falhou antes das capturas.
- Fixar apenas o job de deploy/homologação em `ubuntu-24.04`, a mesma imagem aprovada na suíte visual do PR. Repetir build, publicação e homologação do frontend sem mudar o aplicativo ou permissões.

### Coleta sem cache sem alterar chamadas públicas
- O release `9a47bba` está servido e foi inspecionado em navegador real; a coleta no runner não recebeu resposta do catálogo dentro do prazo.
- Retirar o cabeçalho Cache-Control global do contexto de teste, que também era acrescentado à requisição cross-origin do catálogo. Desativar o cache somente pelo CDP do Chromium, mantendo os cabeçalhos originais da aplicação e service worker bloqueado.
- Registrar falhas de rede e capturar a página mesmo se uma asserção falhar. Repetir a homologação; nenhuma alteração no frontend ou servidor.

## Complemento de navegação homologado — PR #319 (13-11-2026)
- Na inspeção das capturas, os links do rodapé ainda alteravam o hash para âncoras antigas e podiam tirar o visitante da vitrine. Corrigir os quatro destinos somente quando a vitrine nova fornece suas seções; manter os demais clientes e o desenho.
- PR #319 integrado em `34effca5e68ae948fa7299a19dd5019d9950e1a6`, após sete workflows aprovados no head `4bcf1e4060de185b8e6b7e7b1a938d0bb6f9469a`. Playwright comprova rolagem para cada seção e permanência na rota em 360/390/412/1280px, além dos testes existentes.
- Republicação final autorizada para o mesmo escopo; gerar novamente capturas reais e comparar version.json. Domínio oficial continua pendente de hospedagem/DNS; loja em teste e sem vendas.

## Substituição administrativa completa autorizada — PR #320 (13-11-2026)
- Pedido expresso do proprietário: revisar completamente Conecta.IA e Nano.IA, retirando a apresentação anterior e aplicando o modelo aprovado.
- PR #320 integrado em c0e56921c6df02ef8084a1d308ad6e89054d21d1; oito workflows aprovados no head 9e8ac49f61676d575e43c84242d5afc113268bcb. 394 testes unitários, TypeScript/build, Playwright 360/390/412/1280, contraste AA, cache/PWA, consentimento, anexos, streaming, catálogo e ferramentas.
- Publicar somente o frontend estático, preservando flags e permissões. Nova entrada, shell, início, catálogo por aplicação e Estúdio com trabalho/conversa/Torre. Balão e dock antigos não são montados.
- Capturas administrativas usam sessão/dados SIMULADOS sobre os arquivos efetivamente publicados; não alegar login privado real. Homologação da vitrine usa o catálogo público real.
- Loja em teste sem vendas. Nenhum backend, migração, registro Bling, estoque, dado fiscal, cobrança ou DNS alterado. www continua NXDOMAIN e o domínio raiz sem A/AAAA; não declarar o domínio oficial homologado.
- Conferir build, deploy, version.json e capturas antes de declarar atualização concluída no Pages.

## Isolamento visual final da vitrine — PR #321 (13-11-2026)
- Capturas reais revelaram gradiente/sombra global do shell antigo sobre os botões comerciais e largura administrativa de 440px sobre os formulários. A especificidade global superava o CSS aprovado da vitrine.
- PR #321 integrado em 87870577bfd315be6094e81f8cfb5d0daf5ad2d4, oito workflows aprovados no head 0dfdbeecc8fc49cdfec25dcb65d27ce899041991. 394 unitários e TypeScript/build aprovados; regressão Playwright verifica cores calculadas, ausência do gradiente antigo, hover e formulários em 360/390/412/1280px.
- Excluir apenas .mobis-v2 das duas regras globais e restaurar largura própria dos formulários. Nenhum design novo; demais clientes e painel preservados.
- Republicar frontend pelo fluxo já autorizado e repetir as verificações públicas e administrativas. Comparar version.json ao SHA do release. Sem alteração de servidor, dados, vendas ou DNS; domínio oficial continua pendente.


## Publicação autorizada — Glassy Carousel V2, PR #412 (16-11-2026)
- Autorização explícita do proprietário nesta sessão: «Pode faz merge e publicar».
- PR #412 integrado na `main` em `997405c55d80a2694ba51cf19f68bf799f5d7328`; oito verificações do GitHub Actions concluídas com sucesso no head `0f9115ef9c5721cd5eb07678114ca3403eced8c6`.
- Publicar **exclusivamente o frontend estático** do painel Conecta.IA no GitHub Pages pelo workflow `painel-pages.yml`, mantendo as flags de build já existentes. A mudança visual é o carrossel Glassy V2 na galeria do Nano Studio e na revisão de fotografias, com seleção de até oito fotos e prévia local.
- Não publicar imagem candidata sem direitos e aprovação; sem modificações em migrações, Supabase, Edge Functions, Bling, preços, estoque, notas fiscais, checkout, DNS ou domínio oficial.
- A publicação é considerada comprovada somente após o workflow finalizar e conferir o `version.json`/commit e a homologação visual, inclusive no celular. Este marcador não autoriza publicar o catálogo comercial sem aprovação.


## Publicação autorizada — Glassy Carousel V2 na vitrine Mobis, PR #413 (16-11-2026)
- O proprietário autorizou prosseguir com a atualização e o site nesta sessão.
- PR #413 integrado em `c3e3eef56cf351da0e49d6a05ffcdc2552dea90a`; oito workflows aprovados no head `2a3ea0e8a581150e53599361433d3380f6fb3a04`.
- Publicar só o frontend estático em GitHub Pages pelo workflow existente. Nova seção Glassy V2 3D na vitrine Mobis com seis categorias, imagens 3D oficiais da loja, navegação por teclado e miniaturas, e buscas pelo catálogo real.
- Preservar marca, mascotes, tipografia, hero, Studio Nano, flags de build e loja em modo teste, sem ativar checkout, preços inventados ou produtos não homologados. Não alterar Bling, Supabase, migrações, funções Edge, DNS ou credenciais.
- Exigir build/deploy verde, verificação de `version.json` e testes visuais da loja antes de declarar publicação concluída.


## Publicação autorizada — Paleta branca / branco-gelo da vitrine MOBIS (16/11/2026)
- Solicitação do proprietário: "Colocar a paleta branca na loja virtual". Trabalho executado no notebook remoto Mobis, branch isolada de correção.
- PR #414 integrado na main em `168cb3c8fc1b035397da1230d12e75af01722d85` após 8 workflows de PR aprovados.
- Escopo do release: frontend estático da vitrine Mobis com tema branco #FFFFFF, branco-gelo #F5F5F5, grafite #1F2327, laranja #FF6A00, vermelho #D60000 e cinza #8A8F98. Atualizados cabeçalho com logo oficial para fundo claro, hero, destaques, categorias, busca, produtos, atendimento, rodapé e Glassy Carousel V2.
- CSS separado `painel/src/paginas/loja-mobis-branco.css` e indicador `data-mobis-palette="branco-gelo"`; testes de regressão atualizados para telas 360, 390, 412 e 1280 px. Arquivos adicionais de mascotes e banner do Drive são cópias de referência, não anúncios publicados.
- Sem alteração de Bling, Supabase, SKU/OEM, preços, estoque, DNS, checkout ou aprovação de anúncio. A vitrine mantém modo TESTE e consulta via WhatsApp.
- Homologar o GitHub Pages por version.json, teste real do domínio de publicação e screenshots antes de afirmar entrega.


## Publicação autorizada — banners Mobis e busca por referências homologadas (16/11/2026)
- O proprietário autorizou continuar as duas pendências de banners e busca OEM/SKU na vitrine comercial Mobis.
- PR #415 integrado na main (squash `677922bf379cfbb0e69b0a9dccc621329a956485`) depois de dez workflows de PR aprovados.
- Supabase Edge Function `loja-publica` v12 implantada separadamente, mantendo `verify_jwt=false` e limite de requisições existente, sem mudança de esquema. Verificado do desktop: `CI000120 → SKU 5074`, `CI000119 → SKU 5075`, `CI000117 → SKU 5076`; referência inexistente não gera item.
- Publicar apenas frontend estático do GitHub Pages pelo workflow existente. Banners institucionais usam mascotes e ícones originais da Mobis; não anunciam preço, estoque, desconto ou aplicação não homologada. A loja continua em modo TESTE, sem checkout e pagamentos.
- Novas abas: pesquisa por nome/sistema e pesquisa por código exato (SKU/código fabricante/OEM aprovado); registros pendentes não se tornam correspondências públicas. A apresentação usa branco-gelo, grafite, laranja e vermelho como detalhes.
- Não alterar Bling, estoque, notas fiscais, domínio/DNS, configuração de produção do Supabase ou quaisquer produtos. Os banners promocionais `loja_banners` permanecem sem anúncios cadastrados até aprovação comercial.
- Conferir `version.json`, Playwright publicado em quatro larguras e resposta real da API antes de declarar conclusão.


## Publicação autorizada — auditoria OEM e destaque consultivo CI003696 (16/11/2026)
- Autorização do proprietário: "pendente faz todos" após publicação de banners e busca. Somente dados com evidência foram homologados.
- PR #416 mergeado: `e8bc6a187c8ee07414212114f6b074e8eb2d66e8`; 10 verificações de PR aprovadas.
- Banco Conecta.IA `dsfzhsrudriqkumtlqwj`: oito OE corroboradas Quatro + CTR/RIW/Teknorot, total 14 códigos aprovados; nove pendentes documentados em `docs/conector-ia/mobis-homologacao-oem-banners-20261116.md`; motivos preservados no campo fonte e confiança revisada.
- API `loja-publica` v13 implantada com normalização estrita de hífens e espaços em códigos aprovados; verificado pelo desktop `54410-4B000 => SKU 5074`, `54430-4B000 => 5075`, `54510-4F000 => 5076`, códigos pendentes não revelados.
- Banco: rascunho inativo `loja_banners` para SKU CI003696, sem preço anunciado. Publicar no frontend apenas destaque de consulta, renderizado condicionalmente a produto realmente retornado pelo catálogo. Não anunciar R$ 17.800 em 3x, prazo ou estoque até conciliar Bling e confirmar vigência.
- Publicação limitada ao frontend estático; manter modo TESTE, noindex, sem checkout/pagamento. Não tocar em preços, notas, estoque, cadastro do Bling, domínios nem autorizar novos produtos.
- Exigir build, deploy, teste do site publicado por versão e comportamento antes de declarar conclusão.


## Publicação autorizada — novo layout fotográfico Mobis vermelho/branco (16/11/2026)
- Autorização explícita do proprietário: "Ok faz" após aprovar mockup com cabeçalho branco, barra vermelha, hero automotivo preto/vermelho, modelos por foto e peças por sistema.
- PR #417 integrado em `5157004794f4940987827f13e05b571beff8a1fa` após oito workflows concluídos com sucesso, incluindo teste do produto demonstrativo e mobile.
- Deploy limitado ao frontend estático: cinco fotografias **reais e licenciadas** de veículos obtidas em Wikimedia Commons (fotografia Hyundai Porter ilustra família relacionada ao HR, mas não garante versão brasileira); origens, créditos CC BY-SA 4.0 / CC0 / PD em `painel/src/assets/veiculos-reais/README.md`, links também na loja. Sem imagens externas em runtime.
- Hero escuro com banners de veículos e miniaturas, oito categorias com ícones 3D originais, navegação por SKU/OEM e paleta base branco-gelo com vermelho/grafite. Preserva logo Mobis oficial para fundo claro, mascotes originais e Glassy V2 já implantado.
- Seleção por modelos sem aplicação homologada dirige a atendimento; nunca inventa equivalência nem produto físico. Não atualiza preços, estoque, promoções, Bling, Supabase, fiscal, DNS ou anúncios pagos.
- Manter `ambiente=teste`, `venda_habilitada=false`, `noindex`, atendimento WhatsApp sem checkout. A publicação não aprova automaticamente imagens de produtos ou ofertas.
- Verificar GitHub Pages pelo `version.json`, Playwright em larguras 360/390/412/1280 e navegador real no domínio oficial antes de declarar conclusão.


## Release autorizado — MOBIS Glassy V3 e painel WCAG (17/11/2026)

- Autorização explícita do proprietário nesta conversa, após o merge do PR #427: "SIM PODE", em resposta à oferta de publicar a nova versão no domínio MOBIS.
- PR #427 integrado na `main` em `e6d0b1c3d6af27a908e19862aa178be2dfa24f2f`; os 10 workflows do PR concluídos com sucesso no head `b5f29b6cc8d98c155d1c997818c21eb7f02a9595`; os testes de push da `main` também foram aprovados.
- Escopo: republicar **somente o frontend estático** de `painel/` via workflow existente `Painel (GitHub Pages)`, com `VITE_PAIR_ATIVO=1`, `VITE_BACKUP_ATIVO=1` e `VITE_BANNERS_ATIVO=1`, mantendo todas as políticas e controles existentes.
- Inclui vitrine Glassy Carousel V3, navegação e layouts da MOBIS, painel legível e contrastes WCAG; integra tratamento de Flash Banner em rascunho, sem ativação comercial automática.
- **Não** alterar Supabase, Edge Functions, migrações SQL, domínio/DNS/SSL, Bling, produtos, anúncios, preço, estoque, notas, checkout, pagamentos ou `lojas.ambiente`. Loja permanece em TESTE.
- Verificação obrigatória pós-deploy: build, job de deploy, `version.json` com commit do release, Playwright da vitrine e do Conecta.IA, além de acesso real ao host oficial quando tecnicamente verificável.
- Domínio principal e www seguem com `dns_verificado_em` e `ssl_verificado_em` nulos na tabela `loja_dominios`: frontend publicado NÃO equivale a homologação de DNS/SSL ou liberação comercial.


## Homologação corretiva — MOBIS catálogo em prévia e paleta publicada (18/11/2026)

- Autorização do proprietário: "homologação completa do domínio e do catálogo ainda não está concluída. PODE FAZ".
- O workflow de publicação anterior (`44210497158`) implantou o frontend com êxito, mas falhou no teste visual: cartão com fundo `rgb(246,247,248)` de paleta publicada era comparado incorretamente com branco `rgb(255,255,255)`.
- `scripts/tests/loja-mobis-publicada.mjs`: teste corrigido para verificar a cor COMPUTADA da paleta aprovada na própria vitrine, preservando as verificações de catálogo real, responsividade e ausência de vendas.
- Função `loja-publica` atualizada separadamente no Supabase usando os seis arquivos versionados do repositório (deploy v17), sem alteração de esquema ou JWT, para exibir os 20 SKUs `exibicao_teste=true` SOMENTE em prévia Mobis por slug quando não há produtos publicados. Mantém preços/estoques ocultos, sem aplicações não homologadas, sem checkout, indexação ou pedidos.
- Republicar somente o frontend da `main` com as flags de segurança já existentes. Verificar `version.json` e o teste real de 360/390/412/1280 px, além do painel em sessão simulada.
- DNS/HTTPS do domínio precisam de comprovação por verificações independentes; NÃO alterar `loja_dominios` com carimbos de verificação baseados em suposições e NÃO mudar `lojas.ambiente` nem publicar produtos.

## Publicação autorizada — vitrine Mobis: carrossel, rodapé enxuto e avisos de teste removidos (18-11-2026)
- Autorização do proprietário nesta conversa: "Siga a duração do Google Drive ok mas pode liberar as edições do site e no Bling e conecta" e, depois, "Sim pode merge". Para este release, a autorização vale somente para o **site (painel estático)**.
- PR #430 integrado em `25e93af` (merge em `main`), com o commit `1c3bce6` como origem; checks do head aprovados (11 com sucesso e 1 pulado, `publicar-homologacao`).
- Publicar **somente frontend estático** da `main`: carrossel Glassy V3 sem avisos de teste, cartões em modo catálogo (preço sob consulta, WhatsApp, ficha em nova aba), rodapé Mobis enxuto e aba "Como consultar" na página institucional.
- Preservar `VITE_PAIR_ATIVO=1` e `VITE_BACKUP_ATIVO=1`. Loja segue `ambiente=teste` com noindex, sem vendas ou checkout.
- **Não inclui**: Edge Functions, migrações SQL, escrita no Bling, alteração de DNS/domínio, nem mudança no conecta.html ou no Conecta.IA.
- Conferir o resultado de build/deploy e o SHA publicado; sem status verde não declarar o site atualizado.

## Publicação autorizada — vitrine Mobis: banners de sistema, sem chat flutuante (18-11-2026, 2ª rodada)
- Autorização do proprietário nesta conversa, em resposta à pergunta de publicação: "Merge #433 e #434, publicar".
- PR #433 (remoção do botão flutuante de chat da vitrine Mobis) e PR #434 (banners de sistema interativos com página de destino da taxonomia) integrados em `main`. CI dos dois verde no head antes do merge.
- Publicar **somente frontend estático** da `main`, com as flags existentes `VITE_PAIR_ATIVO=1` e `VITE_BACKUP_ATIVO=1`.
- Loja segue `ambiente=teste` com noindex, sem vendas ou checkout.
- **Não inclui**: Edge Functions, migrações SQL, escrita no Bling, alteração de categorias, DNS ou domínio.
- Conferir o resultado de build/deploy e o SHA publicado. Sem status verde, não declarar o site atualizado.

## Publicação autorizada — vitrine Mobis: textos sem chassi, sem prévia e com independência (18-11-2026, 3ª rodada)
- Autorização do proprietário nesta conversa: "Pode faz sobe isso deixa rolar parecer e pode seguir". Para este release, a autorização vale somente para o **site (painel estático)** e não cobre parecer jurídico (INPI, classe 12), que segue em aberto.
- PRs integrados na `main`: #436 (remoção de menções a chassi), #437 (remoção de observações de teste e prévia dos textos ao cliente, mergeado em `0cb63e4`) e #438 (texto de independência conforme o manual de identidade).
- Escopo do diff desde o último marcador (`81e845b`): 5 arquivos em `painel/`, somente textos e rótulos (`BlocosCatalogoMobis.tsx`, `EmpresaMobis.tsx`, `GlassyCarouselMobisV3.tsx`, `LojaMobisNova.tsx`, `PaginaAplicacaoMobis.tsx`).
- Publicar **somente frontend estático** da `main`, com as flags existentes `VITE_PAIR_ATIVO=1`, `VITE_BACKUP_ATIVO=1` e `VITE_BANNERS_ATIVO=1`.
- **Não inclui**: Edge Functions, migrações SQL, escrita no Bling, alteração de preços, estoque ou produtos publicados, DNS ou domínio. A loja segue `ambiente=teste` com noindex, sem vendas ou checkout.
- Conferir o resultado de build/deploy, o `version.json` e o SHA publicado. Sem status verde, não declarar o site atualizado.

## Publicação autorizada — página do produto sem atendimento por chat (18-11-2026, 4ª rodada)
- Autorização do proprietário nesta conversa: "Pode publicar", após "Pode merge" para o PR #440.
- PR #440 integrado em `main` (`79444a5`), com checks do head `06d9590` verdes (demonstracao-390px re-executado após cancelamento de infraestrutura).
- Escopo desde o último marcador (`81e845b`): 6 arquivos em `painel/`. Remove o bloco de atendimento por chat da página do produto (`ProdutoPublico.tsx`), mantendo ficha técnica, aplicações aprovadas, WhatsApp e link do site; e reúne os textos de independência, chassi e prévia já integrados.
- Publicar **somente frontend estático** da `main`, com as flags existentes `VITE_PAIR_ATIVO=1`, `VITE_BACKUP_ATIVO=1` e `VITE_BANNERS_ATIVO=1`.
- **Não inclui**: Edge Functions (inclusive `vitrine-assistente`), migrações SQL, escrita no Bling, preços, estoque ou produtos publicados, DNS ou domínio. A loja segue `ambiente=teste` com noindex, sem vendas ou checkout.
- Conferir build, deploy, `version.json` e SHA publicado. Sem status verde, não declarar o site atualizado.


## Publicação autorizada — MOBIS M-STYLE CROMO V3, vitrine completa (18/11/2026)
- Autorização expressa do proprietário nesta conversa: **“Pode merge e publicar e homologar”** para a reconstrução visual integral da loja.
- PR #447 já integrada na `main` em `753fcacca3f6397ddc19c3eab7d6b8b338b76bab` (merge de 18/11/2026), oito workflows do PR com conclusão `success`. Diff `753fcac...main` idêntico no momento da autorização.
- Disparar o workflow existente `Painel (GitHub Pages)` **somente** pelo gatilho controlado de alteração deste marcador na `main`. Publicar frontend estático V3 com logo M-STYLE oficial, departamentos circulares, hero, seções de aplicação, busca por SKU/OEM, catálogo público, contato e layout responsivo.
- Preservar flags de build `VITE_PAIR_ATIVO=1`, `VITE_BACKUP_ATIVO=1` e `VITE_BANNERS_ATIVO=1`. Sem mudança em workflows, tokens, DNS, Supabase, Bling ou emissão de NF.
- **Não** alterar `lojas.ambiente` (permanece `teste`), `venda_habilitada`, RLS, preços, estoque, GTIN, OEM, compatibilidades, anúncios, checkout ou dados fiscais. Não publicar oferta não aprovada.
- Homologar após deploy: status `build/deploy`, `version.json` e commit publicado, requisição real à Edge Function `loja-publica`, navegação em desktop e celular, links e filtros, política de noindex e não exibição de dados não aprovados. Se falhar, registrar o motivo sem declarar homologação integral.
- Homologação visual do GitHub Pages **não comprova** DNS/SSL do domínio próprio, nem constitui liberação comercial. Esses controles exigem verificação independente.


## Publicação autorizada — Rodapé MOBIS M-STYLE V3 (18/11/2026)
- Autorização expressa do proprietário após conferência dos dados da empresa e aprovação do novo rodapé: **“Aprovado, pode aplicar.”**
- PR #449 integrada na `main` em `3e576214292fc13d3648bec4ac9d051a89001eb0`, seguida da correção de navegação #450 em `cc4b686d71452d56fcec89812c9018f98ecda6e5`.
- Publicar somente a interface estática do painel GitHub Pages pelo workflow `painel-pages.yml`, com as flags e verificações já definidas. Novo rodapé V3 escuro/vermelho, responsivo, nas páginas da vitrine, produtos e aplicações.
- Dados institucionais **aprovados** vêm da API pública: MOBIS DISTRIBUIDORA DE PECAS E ACESSORIOS LTDA, CNPJ 19.903.967/0001-01, Avenida T-9, nº 3492, Jardim América, **Goiânia–GO**, CEP 74255-220. WhatsApp e telefone são lidos do cadastro; não inventar contatos ou links sociais.
- Manter a loja em ambiente de **teste**, 20 SKUs na prévia e zero anúncios publicados, sem habilitar checkout. Sem escrita Bling, estoque, preço, NF, migração, Edge Functions, DNS, credenciais ou qualquer outro projeto Supabase.
- Verificar build e deploy da action, versão efetivamente servida (`version.json` com commit de release) e rodapé real no domínio oficial antes de anunciar conclusão.


## Ajuste visual autorizado — Marca MOBIS sem subtítulo no site V3 (18/11/2026)
- Após a publicação do rodapé V3, a inspeção em navegador real revelou que o logo original ainda mostrava `PICAPES • VANS • UTILITÁRIOS`, contrariando a instrução expressa do proprietário de usar apenas a marca `MOBIS AUTOPEÇAS`.
- PR #451 integrada em `6ffe7e24eb01d83d0eae00328d35014a3ad12d0d`; cria variante SVG recortada do PNG oficial V3, com identidade metálica preservada e sem a linha de segmentação, aplicada no cabeçalho, rodapé, produtos e páginas por aplicação.
- CI `Painel (verificação em PR)` aprovado, incluindo TypeScript, testes e builds normal e com flag Pair.
- Republicar apenas frontend estático via `painel-pages.yml`, mantendo loja em modo teste. Nenhuma mudança no Bling, estoque, NF, preço, banco Supabase, DNS ou outros projetos.
- Verificar o hash exato do release e o logotipo na página pública antes de declarar que a versão sem slogan está efetivamente em produção.


## Publicação autorizada — Vitrine MOBIS sem blocos duplicados (19/11/2026)
- Autorização direta do proprietário ao mostrar três capturas do modelo antigo: **“Retira este modelo”**.
- PR #452 integrada na `main` em `b2dbf0c32ab697be10449045f7b22c50dee626fc`, após sucesso do workflow de TypeScript, testes unitários e builds do painel.
- Retirar exclusivamente da loja MOBIS as seções extras de grade de nove montadoras, seis cartões de sistemas, formulário duplicado “Conte o que você procura” e lista repetida vazia. A nova vitrine mantém sete ícones no cabeçalho, busca de SKU/OEM, filtros por aplicação, carrossel/banner, catálogo individual e rodapé V3 com dados aprovados de Goiânia.
- O catálogo continua em modo **teste**, com os 20 itens de prévia e nenhum anúncio comercial publicado. Somente frontend estático do GitHub Pages: não alterar Bling, NF, preço, estoque, taxonomia técnica de banco, Edge Functions, Supabase ou DNS.
- Fazer conferência pós-publicação com `version.json`, visual em celular e ausência explícita dos nós `m2-montadoras`, `m2-taxonomia`, `m2-atendimento` e `m2-lista`; exigir os componentes V3 preservados.


## Publicação solicitada — Vitrine MOBIS sem pesquisa, abertura e contato duplicados (19/11/2026)
- O proprietário apresentou quatro capturas da vitrine móvel e pediu remover elementos repetidos: **“Este também esta repetidos”**. O pedido complementa a limpeza visual aprovada das seções anteriores.
- PR #453 integrada na `main` em `941676d3f3661bf5b7c54e307bcfb8f0b49fa961`. O workflow `Painel (verificação em PR)` passou com TypeScript, testes e builds regulares e com Pair. As verificações visuais adicionais foram iniciadas em paralelo e continuam sujeitas à auditoria pós-release.
- Atualizar exclusivamente frontend estático da loja MOBIS, sem afetar UI administrativa Conecta.IA: uma única barra de busca textual/SKU/OEM no cabeçalho com opção de código exato, um único filtro hierárquico montadora→modelo→motor→ano→sistema, apenas o carrossel V3 e um aviso compacto quando nenhum produto estiver público. Removida a hero redundante com três fotos e faixa pré-rodapé duplicada; preserva-se o rodapé oficial de Goiânia e os sete ícones V3 do cabeçalho.
- Loja continua em modo **teste**, sem checkout; o conjunto de produtos em prévia no Supabase não é alterado. Não modificar Bling, produtos, estoque, preços, fiscal, NF, banco, migrações, funções, credenciais, DNS ou outros projetos.
- Confirmar release exato via `version.json`, publicação GitHub Pages e inspeção real de celular. Se qualquer validação visual apontar regressão, corrigir em PR específica, não mascarar erro.


## Publicação autorizada — Departamentos, logos e favicon MOBIS V3 (19/11/2026)
- O proprietário confirmou diretamente **“Sim pode seguir”** e acrescentou **“E o falcon da web coloca também”**. Nova captura identificou que clicar nos ícones de sistema sem categoria publicada redirecionava indevidamente ao WhatsApp. Também solicitou remover produtos automáticos dos banners e corrigir as proporções dos logotipos.
- PR #454 integrada em `main` no commit `9232648d841b2fa3720e240d7318be2b52e7804c`. Testes de TypeScript, npm test e builds no workflow `Painel (verificação em PR)` concluídos com sucesso. Testes visuais abrangentes em execução e sujeitos à validação pós-publicação.
- Nova regra: ícones Motor, Cabeçote, Suspensão, Transmissão, Elétrica, Carroceria e Acessórios acionam o campo Sistema/Categoria e rolam ao filtro na própria vitrine, mesmo quando não há anúncio aprovado. Nunca abrem WhatsApp. Categorias sem cadastro aprovado exibem estado claramente em organização. Nenhum vínculo técnico/OEM é presumido.
- Carrossel deixa de promover automaticamente produtos ou categorias; só mostra campanhas ativas/validadas da API ou slides institucionais dos veículos de referência. Sem SKU inventado, sem preço fictício.
- Marca horizontal oficial em proporção integral 1000:330, sem linha inferior de segmentos, sem cortar placa metálica; cabeçalho, rodapé e páginas individuais. Favicon SVG no navegador com símbolo M quadrado oficial existente, fallback PNG e URL corrigida.
- Aviso de catálogo sem botão repetido do WhatsApp, sem cartão grande. O contato permanece no rodapé institucional.
- Publicação exclusivamente do frontend estático `painel-pages.yml`. Loja em teste, sem checkout; catálogo espelhado do Bling, preços/estoque/fiscal, notas fiscais, Supabase, Edge Functions, DNS e outros projetos intocados.
- Verificar release via `version.json`, 7 cliques de navegação dos departamentos, ausência de WhatsApp externo, logo/favicons sem distorção, integridade do rodapé e erros na API antes de afirmar conclusão.


## Publicação solicitada — Logotipo cromado MOBIS corrigido (19/11/2026)
- Proprietário apontou deformação dos logotipos da vitrine e apresentou amostra visual. Após a criação do novo logotipo cromado, solicitou colocá-lo no site: **“Agora consta lá jo site”**.
- PR #456 integrada na `main` no commit `0e7f4633dbbc326662e07e1ccab759bf38768e15`; substitui somente o asset de marca já compartilhado pelas páginas MOBIS por nova arte otimizada (WebP alfa em SVG), com proporção integral 1983:793 e sem slogan por segmento.
- Atualização responsiva no cabeçalho, rodapé e fichas de produto por herança do mesmo asset, sem alteração de taxonomia ou sistema de catálogo.
- Executar release exclusivamente do frontend estático via `painel-pages.yml`. Não modificar Bling, preços, estoque, dados fiscais, notas, Supabase, DNS, anúncios, gateways, outras lojas ou outros projetos.
- Build de painel validado no PR. Confirmar `version.json` e verificar presença real do novo asset no cabeçalho/rodapé em navegador após a publicação, sem distorção ou quebra da imagem. Loja continua em teste e sem checkout.


## Publicação autorizada — Tipografia M-STYLE em banners MOBIS (19/11/2026)
- O proprietário detectou erro na tipografia dos banners de Hyundai HR e Kia Bongo e solicitou correção: "A tipografia", no contexto da aprovação do modelo M-STYLE CROMO V3 por aplicação.
- PR #458 incorporada no commit `31646f3b047a82fe5acc0407351876d4ae914b36`. Ajustes somente de CSS das fontes dos banners MOBIS e do teste de regressão associado.
- Primária visual: Eurostile Next Heavy **se disponível no dispositivo**; alternativa consistente e já embutida no bundle do próprio painel: **Inter Variable Black 900**, em caixa alta, tamanho/entrelinha responsivos. Secundária: Montserrat se disponível; fallback Inter Variable. A alternativa sem dependência de CDN é necessária porque os testes do projeto bloqueiam `fonts.googleapis.com` e URLs externas, detectado e corrigido antes do merge.
- **Não** distribuir fontes proprietárias. O logotipo cromado M-STYLE aprovado permanece asset de imagem, jamais redesenho tipográfico textual.
- A tipografia é exclusivamente aplicada ao escopo `.mobis-v2.m4 .gcv3` e às variáveis do M-STYLE na vitrine pública. Não altera layout/conteúdo de outras lojas, painel Conecta.IA, Bling/ERP, estoque, preços de custo, fiscal, NF, Supabase, DNS, aplicações técnicas ou permissões de publicação.
- Os banners por veículo continuam com URLs independentes após homologação, mas o **CI003696** tem aplicações HR/Bongo no estado `a_confirmar` e `pagina_indexavel=false`: nenhum desses perfis pode ser publicado automaticamente pela mudança tipográfica. O preço R$17.600 da imagem promocional antiga não é transferido automaticamente.
- Publicação pelo fluxo **painel-pages.yml**, exclusivamente frontend estático. Após deploy, conferir `version.json`, links das linhas e tipografia no domínio oficial. A compilação principal passou; testes visuais abrangentes estavam em progresso no momento da liberação.


## Publicação solicitada — Ícones oficiais das redes sociais MOBIS (19/11/2026)
- O proprietário pediu explicitamente na loja: **“faz os ícones para todos ... em cores padrão”** após enviar captura da marca antiga/laranja em sua página no Facebook. A alteração autorizada é **somente na vitrine MOBIS**: não editar os perfis Meta por esta publicação.
- PR #459 integrada em `main`, commit `b188c10abac29d981ffbd7a9d2236b13d2e7b3ed`.
- Rodapé V3: links diretos para a página oficial do Facebook escolhida pelo proprietário **ID 119574083114811** (não perfis menores), Instagram **@mobisautopartsgoias**, WhatsApp obtido do cadastro ativo da loja; ícones SVG locais: Facebook `#1877F2`, Instagram gradiente e WhatsApp `#25D366`. Nome de marca MOBIS continua no kit cromado V3.
- Os três canais ficam juntos na seção “Redes sociais”, **sem botão WhatsApp duplicado** no rodapé. Preservar telefone, email, localização, dados legais e páginas de políticas.
- Ícone WhatsApp também substitui o símbolo genérico de contato do cabeçalho. Botões acessíveis (mínimo 44px), links HTTPS validados e `rel=noopener noreferrer`. Layout responsivo no celular.
- O componente de rodapé é compartilhado por home, ficha de produto e página de aplicação. Nenhum ícone leva a página desconhecida, e não criar YouTube/TikTok sem perfil verificado.
- Publicar exclusivamente frontend `painel-pages.yml`; não alterar Supabase, Bling, estoque, preços, NF, campanhas, Meta Ads, contas de Facebook/Instagram/WhatsApp, domínio, DNS ou outras lojas/projetos. Aplicações CI003696 continuam pendentes.
- Testes unitários e build do painel aprovados na PR; conferência visual pós-publicação obrigatória: `version.json`, ícones, cores, links da página FB 119574083114811, Instagram escolhido e WhatsApp cadastrado, em celular e desktop.

## Publicação autorizada — Apresentar Conecta.IA a outros agentes (19/11/2026) — PR #464

- Proprietário autorizou em conversa: “Pode faz” para a implementação e posteriormente “Faz vc” especificamente para publicar a atualização do Conecta.IA.
- PR #464 incorporada à `main` em `526ac0bef0af2caa7e5a6df31b3c0c2703ccf0cd`, após 11 verificações verdes do GitHub Actions (job de deploy de homologação ignorado, não é falha).
- Publicar exclusivamente o frontend estático via `painel-pages.yml` com as flags existentes, incluindo a nova seção “Apresentar Conecta.IA a outro agente” na tela Gateway MCP/API, documentação OpenAPI JSON-RPC e manifesto informativo público.
- A especificação OpenAPI descreve o MCP HTTP existente, não cria novas permissões nem endpoint REST de escrita. A2A não é anunciado como servidor implantado. Não expor chaves, tokens, dados de clientes ou informações fiscais.
- Nenhuma Edge Function, migração Supabase, Bling, estoque, preços, nota fiscal, domínio, DNS ou outra conta deve ser alterada.
- Conferir jobs build e deploy, comparar o SHA da versão pública e verificar os arquivos públicos `agentes/capacidades.json` e `agentes/openapi.json`. Sem confirmação real do deploy, não declarar o site atualizado.

## Publicação autorizada — Botão “Copiar para outro chat” visível (19/11/2026) — PR #466
- O proprietário informou que OpenAPI abria JSON e não via onde copiar a apresentação para testar com outros chats. Correção aprovada no contexto do pedido para executar a implantação do Conecta.IA.
- PR #466 incorporada em `main` em `2d3b87afdec650b800374feac03aaefeb552fbc3`.
- Publicar **somente o frontend estático** `painel-pages.yml` com as flags já existentes; novo botão “Copiar para outro chat” e texto selecionável em `#/meu-agente`, que é uma rota existente e habilitada. A rota administrativa `#/gateway` permanece oculta pela flag do conector.
- OpenAPI e manifesto técnico seguem opcionais; nenhum token entra em URL, conversa, HTML público ou repositório. Autenticação MCP continua obrigatória para acesso à loja.
- Sem mudanças em Supabase, Edge Functions, ERP Bling, contas, preço, estoque, dados fiscais, notas, DNS, domínio ou outras lojas.
- Conferir checks visuais ainda em conclusão, sucesso do build/deploy e o commit publicado em `version.json`. Verificar o botão com sessão autenticada, sem declarar validação de login real que não ocorreu.

## Publicação autorizada — Importar ficha de outra IA por JSON, somente prévia (19/11/2026) — PR #468

- Autorização expressa do proprietário: “Pode seguir e colocar o aplicativo no sistema do Conecta.IA” após receber o relatório do piloto de importação do cadastro gerado por outros agentes.
- PR #468 integrada à `main` no commit `f15226054f64f3b3d42c1beb645954b157be6f06`. Compilação, testes unitários, segurança e interface aprovados; última suíte visual de demonstração monitorada separadamente.
- Publicar exclusivamente os arquivos estáticos do painel via `painel-pages.yml`, preservando as flags já usadas (`VITE_PAIR_ATIVO=1`, `VITE_BACKUP_ATIVO=1`, `VITE_BANNERS_ATIVO=1`). A nova seção “Colar cadastro preparado por outra IA” aparece em “Conectar meu agente”, após login.
- Permitir apenas preparar prompt por SKU, colar JSON de proposta, validar limites/formato e visualizar candidaturas de OEM/aplicações. **Não salva os dados**, **não cria cadastro no Conecta.IA nem no Bling** e não publica páginas.
- Aplicações e OEM trazidos de agentes externos permanecem `a_confirmar`. A leitura do SKU/NF e o fluxo de aprovação/gravação real serão mudanças separadas após homologação e autorização; automações pausadas seguem bloqueadas.
- Sem Edge Functions, migrações, alterações no Supabase, tokens, notas, preço, estoque, dados fiscais, DNS, domínio ou outras lojas.
- Validar build/deploy, `version.json`, visualização autenticada e integridade da vitrine. Não declarar teste de login real sem evidência.


## Publicação autorizada — identidade Conecta.IA e ficha Mobis (25/11/2026)

- Proprietário autorizou a publicação da nova identidade Conecta.IA após as verificações. O PR #503 foi integrado em `b4f328ad8707885010549940885176736d5b2a90`; o frontend da main também inclui os PRs #497 e #502 de película e ficha Mobis.
- Publicar apenas o frontend estático pelo workflow existente, com as flags vigentes. Não altera Bling, banco, dados de produtos, preço, estoque, DNS ou permissões.
- Compilação, 493 testes e testes visuais simulados em celular e desktop passaram. A ficha foi verificada com OEM aprovado, referência ausente e sem preço usando dados simulados.
- Conferir build/deploy, versão no domínio e acesso ao Conecta.IA e à vitrine. A instalação e atualização do ícone em Android físico permanece pendente; não alegar homologação do aparelho sem teste real.
