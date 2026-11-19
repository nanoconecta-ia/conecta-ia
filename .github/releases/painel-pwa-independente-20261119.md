# Autorização pontual — Conecta.IA e MOBIS PWAs separados

Data: 19/11/2026.
Autorização explícita do proprietário em conversa: homologar aplicativos Samsung Android e realizar implantação em produção.
Mudança: PR #473 integrado à main, commit de merge db860ed5a447ebd41131ae09d24fec254370ed61.

Escopo:
- Duas entradas e identidades PWA distintas, `/` (Mobis pública) e `/conecta.html` (Conecta.IA autenticado).
- Workers e caches separados; atualização do painel sem limpar a loja.
- Links do painel para a vitrine pública fora da entrada administrativa.
- Nenhuma migração, nenhuma alteração ao Bling, estoque, fiscal, fotos, produtos, anúncios ou aprovação automática.

Testes pré-merge: 8/8 workflows aprovados no SHA 69aef02fbce872298c21a3f6a201cc3e691ad232.
Teste Chromium/instalabilidade: https://github.com/nanoconecta-ia/conecta-ia/actions/runs/44622901849

Este marcador existe apenas para acionar **uma publicação pontual do frontend**, não habilita publicação de produtos ou promoções.
O teste físico Samsung depende de acesso autorizado ao dispositivo; não declarar concluído sem execução real.
