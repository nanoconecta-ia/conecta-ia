# MOBIS — confirmação de aprovação/publicação no Conecta.IA (20/11/2026)

## Contexto e autorização
O proprietário autorizou publicar Modelo 02 e paleta oficial com autenticação de lojista. A execução real em navegador autenticado salvou a paleta v14 e layout v2 mas não conseguiu aprovar, pois o browser não exibiu o diálogo nativo `window.confirm()` durante as operações.

## Correção limitada ao painel autenticado da Mobis
- Para a loja slug `mobis`, substituir `window.confirm` por confirmação explícita e acessível na própria interface de edição do layout e paleta.
- Cada aprovação e publicação continua exigindo dois cliques conscientes: ação e **Confirmar aprovação/publicação**; é possível cancelar.
- O código continua chamando as mesmas RPCs oficiais `layout_aprovar_versao`, `layout_publicar_versao`, `paleta_aprovar_versao`, `paleta_publicar_versao` com o JWT do lojista.
- A confirmação identifica a versão selecionada para evitar aprovação acidental de outra versão, respeita status e mudanças não salvas.
- Para outras lojas, o fluxo anterior com `window.confirm` permanece.
- Não modifica SQL, Supabase Auth, permissões, RLS, banco, Bling, produtos, estoque, imagens, aplicações, preços ou ambiente.

## Aceite
Aprovar PR depois de CI; deploy GitHub Pages; via navegador autenticado selecionar layout v2 e paleta v14 e acionar os botões confirmatórios; verificar os registros reais no Supabase e as cores públicas na loja. Nenhum status "publicado" deve ser afirmado antes da verificação do banco.
