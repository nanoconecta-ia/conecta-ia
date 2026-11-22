# Mobis Autopeças — Sistema mestre de showroom, versão de homologação

**Versão:** 2026-11-21 · **Estado:** código em PR separado, não publicado.

## Base visual aprovada pelo lojista
- **Logotipo MA e tipografia oficial:** reutilizar `painel/src/assets/marcas/mobis-mstyle-v3-sem-slogan.svg`, sem recompor "M" ou "MA" com texto, ícones, prompts ou outros monogramas. A palavra MOBIS AUTOPEÇAS faz parte do mesmo arquivo aprovado; nunca alterar sua geometria, cor ou proporção. Não criar outra variação.
- **Papel comercial:** Mobis Autopeças é **loja revendedora independente**, nunca fabricante nem revendedora "oficial" da montadora sem comprovação.
- **Paleta institucional:** grafite `#1F2327`, vermelho `#E2181A`, cinza `#BFC3C7`, aço `#A6A6A6`, branco `#FFFFFF`, gelo `#EAF2F6`. Marca e tipografia são independentes da versão da paleta comercial que o lojista publica em `/aparencia`.
- **Acentos:** Hyundai `#1877F2` (apenas faixa/efeito de UI) e Kia `#B70E28` (apenas faixa/efeito de UI). Usar os **arquivos originais** das montadoras e da marca da peça somente quando houver ativo autorizado em banco, nunca redesenhar ou aplicar filtro de cor sobre logotipo original.
- **Fotografia da peça:** mesma imagem real aprovada por SKU, fundo branco, `object-fit:contain`, sem gerar/substituir motor ou recortar. Sem foto aprovada, texto "Foto real da peça em preparação".
- **Veículos:** fotos são ilustrativas de linha e exigem licença/identificação do modelo antes da incorporação ao showroom. O acento/identificação de fabricante não é comprovação de aplicação.
- **Tipografia de títulos:** Inter bold/italic para texto editorial da página, sempre com o **wordmark oficial em imagem integral**, sem substituí-lo por fontes. Em dispositivos pequenos, reduzir tipografia editorial, nunca distorcer o logo.

## Contrato de dados — um SKU, 1+N banners
**Banner geral** da página `#/p/mobis/<SKU>`: logotipo Mobis intacto, foto da peça quando aprovada, nome comercial, SKU físico, marca da peça, estado de OEM e descrição aprovada. Sem fotografia identificada, manter placeholder neutro. Preço só quando fornecido por API publicada e autorizado; motor CI003696 em catálogo informativo continua sem preço.

**Banner por aplicação**: acento de montadora, nome do veículo, título técnico, SKU físico. É **clicável somente** quando a aplicação tiver `status=aprovado`, `indexavel=true` e uma página existente. Todos os banners vinculam ao mesmo SKU físico; estoque e NF não se multiplicam. Um banner não dá origem a novo produto.

**OEM do conjunto:** sem validação documental, exibir apenas "Referência OEM do conjunto em validação". OEM de junta, cabeçote, bronzina ou outro componente **não é** OEM do motor parcial completo. `2J0224AU00A` continua candidato de pesquisa, não inserir como "OEM original homologado" no anúncio.

**Marca do fabricante/importador:** usar o nome comercial documentado. Logo do fabricante só com arquivo autorizado. TRIM GO é a marca da peça; Hyundai/Kia são montadoras, não fabricantes do SKU importado.

## Componentes de código
- `componentes/MarcaMobisOficial.tsx`: única assinatura com MA/wordmark original, em cabeçalhos e showrooms.
- `componentes/ShowroomProdutoMobis.tsx`: showroom geral e bloco `FaixaAplicacaoShowroomMobis` reutilizável por produto/aplicação.
- `componentes/showroom-mobis.css`: CSS responsivo e escopado, identidade fixa + acento por montadora.
- `lib/showroomMobis.ts`: funções puras, paleta e **gate** de indexação/aprovação.
- `paginas/ProdutoPublico.tsx`: apresentação da ficha física Mobis baseada exclusivamente nos dados da API pública.
- `paginas/PaginaAplicacaoMobis.tsx`: modelo individual por montadora com a mesma assinatura de marca.
- `componentes/BannerMobis.tsx`: fallback de destaque sem monograma M improvisado.

## Aceite
1. Um arquivo MA oficial, preservado integralmente no desktop e no celular; nenhum desenho de M/N alternativo.
2. Banner geral e duas aplicações homologadas → 3 perfis visuais com 1 SKU físico, URLs de aplicação distintas, sem estoque duplicado.
3. Aplicação `a_confirmar` ou `indexavel=false` não vira link comercial.
4. Sem logo oficial de fabricante/montadora ou fotografia com direitos confirmados → não desenhar logotipo alternativo nem inventar foto.
5. Testar mobile de 320 px, tablet e desktop; contraste e texto com zoom; imagens sem filtros.
6. Verificar visualmente em ambiente de teste antes de qualquer merge/deploy. Modificações neste PR não alteram Bling, MCP, banco, imagens cadastradas, preço ou publicação.

**Para CI003696:** o padrão visual fica preparado, mas a própria aplicação Hyundai HR/Kia Bongo e o OEM completo devem continuar pendentes enquanto a homologação técnica não for concluída. O código não publica as páginas nem ativa banners sem esses requisitos.
