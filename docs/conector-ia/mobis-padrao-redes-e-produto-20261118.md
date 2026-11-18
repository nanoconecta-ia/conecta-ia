# MOBIS — padrão para redes sociais e página de produto (18/11/2026)

**Situação:** templates editáveis no Google Drive; página de produto atualizada em proposta de código. Não publicado em produção.

## Pasta canônica
https://drive.google.com/drive/folders/1SIpryFYfhAB6MptRVaSl_ETa5Ig84iMx

Contém:
- Posts em SVG editável e PNG (1080 × 1080, 1080 × 1350 e 1080 × 1920)
- Sete variantes feed: Motor, Cabeçote, Suspensão, Transmissão, Elétrica, Carroceria e Acessórios
- Prévia SVG e PNG de página de produto com QR oficial e logo original
- Manifesto de SHA-256, cópia ZIP e instruções.

## Integração do site
A ficha individual \`#/p/mobis/:sku\` mantém os dados da API \`loja-publica\` e o componente \`FichaProduto\`. Apenas a Mobis ganha:
1. Cabeçalho com logotipo original e navegação/breadcrumb por SKU
2. Fundo gelo para foto, conteúdo branco, acentos vermelho e aço
3. Painel lateral com botão WhatsApp (prioridade ao link por SKU publicado na API; fallback institucional), QR original da conta Business, domínio oficial
4. Faixa visual com sete sistemas, sem classificar o SKU por simples ícone
5. Layout responsivo; outras lojas e identidade global do Conecta.IA permanecem intactos.

**QR oficial:** link testado no arquivo de referência: \`https://wa.me/mobisautopecas?src=qr\`; não substituir por geração de QR com número. Arquivo original aprovado em \`painel/public/marcas/mobis-qr-whatsapp-business-oficial.png\`.

## Controle de qualidade
- O número \`(62) 99165-4515\` e domínio \`www.mobisautopecas.com.br\` aparecem nos arquivos para redes; a página de produto usa links aprovados.
- Não inferir veículo/ano/motor, preço, desconto, disponibilidade ou estoque a partir da arte.
- Os SVGs são editáveis em formas/textos, mas logo e QR permanecem **imagens embutidas**, não curvas vetoriais autênticas.
- Não publicar anúncio ou site automaticamente; respeitar aprovação e testes.
