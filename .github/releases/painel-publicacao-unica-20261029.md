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
