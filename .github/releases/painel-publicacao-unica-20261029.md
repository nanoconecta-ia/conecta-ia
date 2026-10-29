# Publicação pontual autorizada — Conecta.IA / 29-10-2026

Autorização explícita do proprietário: “Pode continuar e merge e publicar quando necessário.”

Este arquivo é o gatilho **único** de publicação do painel do GitHub Pages, com os workflows e flags já usados pela equipe. Ele é adicionado somente uma vez.

## Escopo deste release
- Publicar exclusivamente os arquivos estáticos gerados por `painel/`, mantendo as variáveis `VITE_PAIR_ATIVO=1` e `VITE_BACKUP_ATIVO=1`.
- Incluir código frontend aprovado até a `main` no momento do merge, como chat compacto, sidebar retrátil, Visão Geral, Catálogo avançado e paginação no espelho.
- O backend não é publicado por este workflow: **nenhuma Edge Function, migração SQL ou escrita Bling**.
- Conferir o resultado de build/deploy e o commit SHА exato do release; sem status verde não declarar site atualizado.
- Futuras mudanças no GitHub não disparam nova publicação a menos que este arquivo de marcador seja novamente alterado.
