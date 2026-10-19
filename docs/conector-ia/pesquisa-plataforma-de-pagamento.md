# Pesquisa: plataforma de pagamento e marketing digital (2026-10-19)

**Para quê:** o lojista escolher a plataforma de pagamento com boas opções para o cliente (cartão, Pix, boleto, parcelamento) e saber como ligar marketing digital. **Nada foi integrado nem contratado.** Fontes: buscas na web hoje; várias são blogs de empresas que vendem o serviço, e **as taxas divergem entre páginas da mesma empresa**, então os números abaixo são indicativos. Antes de decidir, o lojista confirma a tabela vigente na conta/proposta de cada um.

## O que as fontes permitem afirmar
| Plataforma | Cartão | Pix | Boleto | Pontos citados | Fonte |
|---|---|---|---|---|---|
| **Asaas** | tarifa fixa R$ 0,49 + % que varia por parcelas (as páginas discordam: 1,99% à vista em materiais, 2,99% na tabela de preços); até 21x só Visa/Mastercard; recebe em ~32 dias, com antecipação (a partir de 1,25% a.m.) | emissão grátis; tarifa por pagamento (R$ 0,99 nos 3 primeiros meses, R$ 1,99 depois, segundo a página de Pix) | sem taxa de emissão; R$ 0,99 promocional, depois R$ 1,99 | API e checkout (cartão e Pix); condições promocionais valem 3 meses | [preços](https://www.asaas.com/precos-e-taxas), [Pix](https://www.asaas.com/pix-asaas), [checkout](https://materiais.asaas.com/asaas-checkout) |
| **Pagar.me** | páginas com 4,19% à vista (D+1) e 4,39%/5,59% em outra versão; taxas flexíveis por contrato | 0,99% ou 1,19%, conforme a versão da página | R$ 3,49 pago (uma versão) | checkout transparente (sem redirecionar), antifraude customizável (recusa score ≥ 95 por padrão), split, Pix com expiração configurável 15–60 min | [ofertas](https://www.pagar.me/ofertas), [docs Pix](https://docs.pagar.me/reference/pix-2) |
| **Stripe (Brasil)** | 3,99% + R$ 0,39 (página em inglês com BRL) | 1,19% por Pix pago, mas a página diz **somente por convite**; outra página global diz 2% | R$ 3,45 | bom para assinaturas e operação internacional; páginas de datas diferentes | [preços BR](https://stripe.com/en-br/pricing), [Pix](https://stripe.com/br/payment-method/pix) |
| **PagBank** | 4,99% + R$ 0,40 (14 dias) ou 3,99% + R$ 0,40 (30 dias) | não informado nas fontes | não informado | pequenos negócios e lojas virtuais | [Nuvemshop](https://www.nuvemshop.com.br/blog/gateway-de-pagamento-mais-barato/) |
| **Mercado Pago** | taxas variam por produto, prazo (na hora, 14 ou 30 dias) e faturamento; **não achei a tabela oficial do checkout online** (as tabelas achadas eram de maquininha) | "sem custo adicional" segundo o blog dele; outra fonte diz que depende do produto | liberado em até 3 dias | muito usado no Brasil; ver custo real em "Seu negócio > Custos" | [Tecnoblog](https://tecnoblog.net/495463/como-receber-pelo-mercado-pago-produtos-ou-servicos/), [Nuvemshop](https://atendimento.nuvemshop.com.br/pt_BR/12332-mercado-pago/como-alterar-as-taxas-e-prazos-de-recebimento-do-mercado-pago) |
| **Iugu, InfinitePay, Nuvem Pago** | citados como baratos pela Nuvemshop, que vende o Nuvem Pago (fonte interessada); InfinitePay anuncia Pix sem taxa (afirmação do fornecedor) | — | — | não conferi páginas oficiais | [artigo](https://www.nuvemshop.com.br/blog/gateway-de-pagamento-mais-barato/) |

Contexto de mercado (fontes divergem): o Pix aparece com 44% a 49% das compras online em 2025 (EBANX/PCMI e relatório citado pela Loggi). Isso pesa a favor de quem tem Pix barato e conciliação simples.

## Como o lojista deve decidir (critérios, não uma indicação)
1. **Mix de venda:** quanto vem de Pix, cartão à vista e parcelado, boleto. Peça de autopeças tem ticket que muitas vezes pede parcelamento: compare o custo de 6x e 12x, não só à vista.
2. **Prazo de recebimento × taxa:** receber em 30 dias costuma custar menos; antecipar custa por mês. Calcule com o fluxo de caixa da loja.
3. **Custo fixo por transação** pesa em ticket baixo (R$ 0,39 a R$ 0,49 por venda).
4. **Antifraude e chargeback:** peça política e quem arca com a contestação.
5. **Conciliação com o Bling:** o Bling tem "liquidação automática dos recebíveis" por forma de pagamento (baixa na data prevista, descontando a taxa). **Não confirmei integração direta** de Mercado Pago, Pagar.me ou Asaas com o Bling; confira o app/extensão de cada um.
6. **Contrato:** taxas promocionais acabam (Asaas: 3 meses) e podem mudar sem aviso.
Sugestão de método: pedir proposta formal de 2 ou 3 (por exemplo Asaas, Pagar.me e Mercado Pago), simular com 3 vendas típicas da loja (Pix, 1x, 6x) e comparar o líquido recebido.

## Integração com marketing digital (independe do gateway)
- **Google Merchant Center:** o feed já existe (`/feed/merchant.xml`). Exigências oficiais: GTIN válido (se não existir, deixar vazio e usar marca + MPN), política de devolução **que cubra arrependimento**, acessível sem login, com prazos, métodos, frete de devolução e prazo de reembolso. O Google não processa devolução: a loja processa. Fontes: [dados do produto](https://support.google.com/merchants/answer/7052112?hl=pt-BR), [GTIN](https://support.google.com/merchants/answer/6324461?hl=pt-BR), [devolução](https://support.google.com/merchants/answer/14011730?hl=pt-br).
- **Meta (Pixel + API de Conversões):** para não contar a mesma compra duas vezes, o evento do navegador e o do servidor usam o **mesmo `event_id` e o mesmo nome**; o número do pedido serve de id; a janela de deduplicação é de 48 h. Fonte: [Meta](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events).
- **GA4 / Google Ads:** eventos de e-commerce (view_item, add_to_cart, begin_checkout, purchase). Não consegui fonte oficial nesta busca; conferir na documentação do Google antes.
- **LGPD:** pixel e remarketing exigem aviso e consentimento de cookies; a revisão jurídica é do lojista.

## O que o Conecta.IA faz e não faz
- Faz: mostrar no site **só** as formas e regras que o lojista cadastrou, aprovou e marcou como visíveis (botão mostrar/ocultar), e gerar o feed do Merchant e JSON-LD com devolução/garantia reais.
- Não faz (ainda): integrar gateway, receber pagamento, nem instalar pixels. Cada um é uma etapa com sua autorização, depois da escolha da plataforma.
