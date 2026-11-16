# MOBIS — Páginas por aplicação, imagens e códigos cruzados

**15/11/2026.** Estado: prévia consultiva em ambiente TESTE. **Não é homologação de aplicação, registro de marca nem autorização de imagem externa.**

## Fonte de verdade e hierarquia
- Cadastro físico único: `produtos.id → bling_id → sku`; preço e saldo **apenas** do Bling. Nota fiscal via `entradas_cadastro`/`produto_vinculo_nf`.
- Sistema → subcategoria → SKU na `taxonomia_nos`, preservando categorias ERP. Ícones Nano identificam o nó, **não** representam foto da peça.
- Aplicações 1:N em `produto_aplicacoes`: `modelo`, `modelo_id`, `motorizacao`, anos, `fonte`, `status`, `restricao` e `pagina_slug/titulo/descricao`. Um produto físico pode ter páginas específicas para veículos diferentes.
- A página de aplicação **nunca** cria `produtos` ou novo estoque e **nunca** usa valor/comparação de fornecedor como prova automática de compatibilidade.
- Código de importador `CI...` e OEM/códigos alternativos na `produto_codigos` com tipo e fonte, separados do SKU do PDV. Códigos de catálogos externos seguem `a_confirmar` até homologação por fornecedor/montadora.
- SEO: essas páginas são **rascunhos noindex** e não podem passar para indexável antes de aprovação de aplicação (check no banco). Para Google indexar URLs é necessário futuro renderizador HTML real no domínio (atualmente SPA hash), sitemap e canonical consistentes, além da aprovação técnica.

## Realizado na base
- 13 aplicações de rascunho e respectivas `pagina_slug`, `pagina_titulo`, `pagina_descricao` para os SKUs `CI002916`, `5074/5075/5076/5077`, `CI000220/CI000106`, conforme o relatório de passagem de 08/11 e NFs recentes.
- 15 códigos OEM/similares candidatos `a_confirmar`, apoiados no `CATÁLOGO QUATRO - COMPLETO.pdf`; atenção à divergência Bling fornecedor `CI003695` versus SKU pai `CI002916`, não declarado automaticamente equivalente.
- Cinco fotos **próprias** da Mobis para `CI002916` já estão aprovadas e podem ser herdadas por aplicações desse **mesmo** item.
- Seis recortes Quatro de bandejas já anexados **internamente**, não aprovados para venda por direitos pendentes.
- Uma fotografia adicional externa do motor 4D56/D4BH, página Dorauto `https://www.dorautoimports.com.br/motor-4d56d4bh-novo-parcial`, foi verificada visualmente (500×500, sem marca sobreposta) e armazenada em `produto_imagens` para `CI002916` como **ilustrativa interna não aprovada**; direitos não licenciados. Não remover marcas de terceiros ou reaproveitar imagens protegidas sem permissão.
- `CI003696` (D4CB Euro 5 HR/K2500) segue com `produto_automacao.pausado=true` previamente definido pelo lojista: bloqueio respeitado, nenhuma nova aplicação/imagem/código gravado nele.

## Aprovação e segurança
1. Validar por VIN/chassi/código OEM + geração/motorização e notas reais; marcar `aprovado` somente com requisitos de banco satisfeitos.
2. Confirmar direitos e origem de foto; publicar apenas `imagens_publicaveis`, nunca URL bruta sem licença.
3. Se faltar foto autorizada usar campo sem imagem de peça e ícone como **categoria** devidamente rotulado.
4. Registrar auditoria e simular a navegação em celular. Preço de prévia fica sob consulta; checkout e anúncios pagos desligados.
5. Não ativar `CI003696` automaticamente; requer decisão explícita do proprietário para reativar sua automação.
