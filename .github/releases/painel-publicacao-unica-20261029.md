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
