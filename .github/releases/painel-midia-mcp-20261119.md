# Publicação pontual autorizada — Fila visual de anexos MCP da Mobis

**Data:** 19/11/2026  
**Aprovação do proprietário:** solicitação expressa no ChatGPT para seguir com migração, implantação da função MCP, teste de anexo e interface de aprovação visual.

## Escopo permitido neste release
- Atualizar o painel Conecta.IA publicado no GitHub Pages para apresentar, dentro de **Fila de aprovação**, o componente `MidiasPendentesMcp`.
- Listar apenas propostas de imagem/banners da loja autenticada, conforme RLS.
- Mostrar originais por URLs assinadas de 120 segundos do bucket **privado** `agente-anexos`, sem transformações.
- Permitir somente ao **lojista** registrar confirmação de direitos e decisão na tabela privada `conecta_midia_pendentes` via RPC autorizada.
- Garantir que a revisão **não** publique banners ou imagens, não altere estoque, Bling, custo, NCM, nota fiscal ou páginas públicas.

## Gates e implantação
1. CI de banco, painel, OAuth, conector e segurança aprovados na PR #472.
2. Migrações `20261119000020` e `20261119000021` verificadas no Supabase, antes de usar a tela.
3. A publicação é acionada por este **único marcador** no workflow existente `painel-pages.yml`. Outras alterações futuras na main NÃO acionam deploy por esse marcador, salvo alteração explícita neste arquivo.
4. Rollback por reversão do artefato GitHub Pages e da exposição da fila, sem apagar fotos nem tomar decisões pelo lojista.

**Esta autorização não aprova arquivos individuais.** A aprovação de qualquer foto ou banner continua exclusivamente no painel da Mobis, mediante inspeção humana.
