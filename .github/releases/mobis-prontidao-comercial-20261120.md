# MOBIS — prontidão comercial integrada ao editor de layout (20/11/2026)

## Autorização
Proprietário solicitou integrar liberação comercial do catálogo e aprimorar a estrutura do Modelo 02 dentro do Conecta.IA. Os dados comerciais existentes continuam sob as travas e permissões atuais.

## Evidências de auditoria
- Layout Técnico versão 2 e paleta Oficial MA versão 14 aprovados/publicados via autenticação de lojista.
- Espelho Conecta.IA: 1.263 produtos; 0 publicados na verificação.
- Seis produtos com saldo, preço, foto principal aprovada e verificação "pronto: true": SKUs 5074, 5109, 5077, 5076, 5108, 5075.
- CI003696 não está pronto para venda comercial: falta fotografia principal aprovada.
- Tentativa de publicar seis itens via navegador foi interrompida por ausência de sessão autenticada; não houve publicação. Nenhuma publicação por bypass SQL.

## Implementação
- Novo painel no próprio editor da vitrine (Mobis) com indicadores de leitura em tempo real: produtos publicados, ativos com saldo e preço, imagens principais aprovadas, aplicações aprovadas e banners ativos.
- Exposição explícita de que números isolados NÃO são critérios finais de publicação.
- Atalhos para Catálogo, Aplicações, Carrossel Flash e Identidade visual, na mesma estrutura modular.
- Layout responsivo para celular e desktop, identidade gelo/grafite/vermelho.
- Consultas somente leitura, sem migrações, sem ampliar permissões, sem publicar itens, sem alteração de estoque, preço, NF, Bling ou ambiente.

## Aceite
Build e testes GitHub Actions antes de merge; deploy GitHub Pages; conferir presença da navegação e contagens no editor autenticado. A efetiva publicação dos seis produtos permanece pendente de renovação da sessão do lojista e da execução pela RPC oficial.
