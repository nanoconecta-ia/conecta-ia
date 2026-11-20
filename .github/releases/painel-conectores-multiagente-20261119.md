# Autorização pontual de publicação — painel de Conectores multiagente

**Data:** 19/11/2026 (horário de Goiás).  
**Autorização expressa:** proprietário da Mobis Autopeças confirmou no ChatGPT "Ok pode" após receber diagnóstico, PR #474 e testes, autorizando homologação e implantação.

## Escopo permitido
- Integrar PR #474 à `main` após execução bem-sucedida dos testes.
- Publicar apenas a interface do Conecta.IA que mostra **Conectores e agentes**, presença, quantidade de sessões, permissões concedidas e avisos de atividade medida.
- Permitir visualização independente de ChatGPT, Claude e outros agentes; encaminhar pareamento para as telas existentes `/parear`, `/meu-agente` e `/dispositivos`.
- Preservar canais com públicos e escopos distintos: `conector-mcp` (consulta/proposta) e `conecta-gateway` (chat QR com `chat:responder`). Não apagar nem mesclar servidores.
- Corrigir o indicador de atividade para não apresentar uma autorização apenas válida como execução real.

## Proibições e isolamento
- Não ativar o registro legado `Gpt` sem endpoint/teste; não conceder `chat:responder`, não gerar chaves nem ampliar escopos de agentes.
- Não publicar produtos, imagens, banners ou campanhas, não aprovar automaticamente propostas.
- Não modificar Bling, estoque, dados fiscais, NF ou o produto CI003696 (automação pausada).
- Não ativar `VITE_CONECTOR_ATIVO` ou `VITE_CENTRAL_ATIVA`; publicação apenas da tela de monitoramento já dependente de `VITE_PAIR_ATIVO=1`.
- Não executar migrações ou publicar Edge Functions neste release.

## Gate de release
1. CI do PR #474 em verde, `tsc`, testes e build do painel aprovados.
2. Merge do PR #474 autorizado nesta conversa.
3. Este marcador é gatilho único no workflow `painel-pages.yml`, seguindo o mesmo mecanismo já adotado para releases pontuais anteriores.
4. O workflow de GitHub Pages valida publicação e testes de interface; resultados devem ser verificados antes de declarar sucesso.
5. Rollback: reverter o commit da interface e publicar o artefato anterior, sem alterar dados persistidos.

Este marcador **não** concede acesso administrativo a nenhum agente e **não** autoriza publicação de itens do catálogo.
