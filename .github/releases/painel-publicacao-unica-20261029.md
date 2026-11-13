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
