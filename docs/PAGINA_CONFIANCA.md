# Página de produto e loja: confiança para o Google e o consumidor

> Textos jurídicos abaixo são **modelos com lacunas** para revisão do advogado/contador do lojista. Nada aqui
> é aconselhamento jurídico, e valores de garantia de fabricante nunca são presumidos: vêm de fonte registrada.
> Regras do Google (Merchant Center, Safe Browsing) devem ser conferidas nas páginas oficiais antes de publicar.

## Descrição longa do produto (estrutura fixa gerada pelo agente)
1. **Resumo** (nome, marca da peça, linha, para que serve).
2. **Ficha técnica**: atributos da família técnica (posição, medidas, material, especificações), cada um com fonte.
3. **Códigos e equivalências**: código do fabricante (MPN), OEM da montadora, EAN/GTIN e códigos cambiados de outras
   marcas/importadores. **Só os aprovados, com fonte.** Códigos de peça não equivalente ou lista exagerada de números
   para atrair busca contam como "falsa representação" e colocam a conta do Google em risco.
4. **Aplicação**: marca, modelo, motorização e anos aprovados. Aviso: "confirme o código da peça antes da compra".
5. **Garantia e responsabilidade** (ver modelo), **troca e devolução** (ver modelo).

## Modelo de texto: garantia (revisar com advogado)
"Garantia legal: [90] dias, contados da entrega, conforme o Código de Defesa do Consumidor (Lei 8.078/1990, art. 26),
para vícios aparentes ou de fácil constatação em produto durável. Garantia do fabricante: [prazo informado pelo
fabricante, se houver; fonte: ___]. O fabricante e o comerciante respondem pelos vícios do produto nos termos da lei.
Para acionar: [canal, WhatsApp, e-mail], informando pedido, SKU e fotos. Instalação inadequada ou uso fora da
aplicação indicada pode afastar a garantia, conforme análise técnica."

## Modelo de texto: troca e devolução (revisar com advogado)
"Compras feitas à distância (site, WhatsApp, telefone): direito de arrependimento em até 7 dias corridos do recebimento
(CDC art. 49), com devolução do valor. Produto com defeito: [fluxo de troca/reparo]. Peça instalada ou com sinais de
uso não é devolvida por arrependimento. Frete de devolução: [regra]. Prazo de estorno: [prazo]."
(O arrependimento vale também para venda por WhatsApp porque é compra fora do estabelecimento; confirmar com o advogado.)

## Páginas obrigatórias da loja (perfil do site)
- Sobre/Contato com **razão social, CNPJ, endereço, telefone/WhatsApp e e-mail** reais (MOBIS DISTRIBUIDORA DE PECAS E ACESSORIOS LTDA).
- Garantia, Trocas e devoluções, Entrega/prazos, Privacidade (LGPD) e Termos, linkadas no rodapé.
- Preço e disponibilidade do site iguais aos exibidos no Google; produto sem preço/estoque válido não vai ao feed.

## Para o Google não bloquear / marcar "site perigoso"
- HTTPS válido (SSL) no domínio, sem conteúdo misto, sem redirecionamentos estranhos, sem scripts de terceiros não
  declarados. Domínio só entra em produção depois de DNS e SSL verificados.
- Nada de promessa que o dado não sustente (compatibilidade, "original", marca) e nada de imagem de outra marca
  apresentada como o produto real: imagem ilustrativa leva o rótulo "imagem ilustrativa".
- Dados estruturados `Product` com `brand`, `mpn` (código do fabricante), `gtin` (quando existir), `sku`, preço,
  disponibilidade e política de devolução coerentes com a página.
- Cadastrar o site no Search Console (somente leitura, com consentimento) para ver alertas de segurança e de cobertura.

## Onde isso vive no sistema
- Garantia por produto: campo `garantia` em `produto_enriquecimento` (valor + fonte + data); sem fonte, usa só a garantia legal.
- Textos da loja (garantia, troca, privacidade, dados da empresa): proposta de tabela `loja_politicas` na migração 11
  (aguarda autorização); enquanto isso ficam como rascunho aprovado pelo lojista.
