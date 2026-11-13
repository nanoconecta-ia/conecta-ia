# MOBIS · Loja comercial, políticas e vínculo pai–filho

Referência: a arte da loja fornecida pelo proprietário em Claude; painel Conecta.IA é administrativo.
Este PR não publica cadastros, ativa checkout, altera DNS, Bling ou estoque.

## Três camadas, sem multiplicar estoque

1. Bling = produto físico e fiscal: um SKU, GTIN, NF, preço e saldo. Campos produtos.bling_id, pai_bling_id (legado), familia_id. Sem clone de estoque por veículo.
2. Conecta.IA = enriquecimento e revisão: produtos.id, taxonomia_no_id e produto_aplicacoes. Modelo, motor, ano, restrição e fonte por veículo. Só status=aprovado alimenta compatibilidade do cliente. Ficha interna apresenta botões Bling, Conecta e Loja.
3. Loja = projeção comercial: MESMO produto físico, publicado=true, aplicações aprovadas e fotos liberadas. Botões: Ver ficha, Adicionar à lista, WhatsApp. Nenhum identificador interno Bling nem dados fiscais sensíveis no cliente.

A lista de consulta fica apenas em sessionStorage no navegador, com no máximo dez SKUs. O cliente decide enviá-la pelo WhatsApp. Não cria pedido, carrinho de compras concluído, checkout, pagamento nem baixa estoque.

## Privacidade

Rodapé e páginas individuais apresentam cinco categorias: privacidade, trocas/devoluções, entrega, garantia e termos. Textos comerciais reais somente de loja_politicas com status=aprovada na API pública. Em rascunho, a opção aparece sinalizada Em revisão e não divulga o texto. Versão web Next também respeita a regra.
Não reutilizar política global da plataforma como política comercial Mobis.

Antes de lançamento: validar CNPJ e endereço, finalidades e bases de tratamento de dados, retenção, contato LGPD, direitos dos titulares, garantias, fretes, devoluções, termos e aprovação jurídica. Sem aprovação do responsável, não afirmar que normas estão publicadas.

## Banners flash

A vitrine recebe somente banners da RPC banners_da_vitrine, vinculados a produtos publicados, período e destaque liberados. O carrossel alterna em intervalos de 6,5 s, com pausa manual, foco e redução de movimento. Cores alternativas sobre a identidade grafite e laranja. Flash visual por CSS; não usar Adobe Flash Player.

## Gate

Situação Mobis em 13/11/2026: ambiente teste, políticas rascunho, zero produtos publicados, zero aplicações aprovadas. Um merge de código não muda esses gates.
