---
name: nano-oferta-local
description: Confirmar preço, estoque, retirada, frete, localização, parcelamento, nota fiscal, garantias e confiança de ofertas antes de SEO, Bling, PDV e feeds, sem promessas inventadas.
---

# Skill: oferta real, comércio local e confiança

**Acionar** quando usuário pede mais barato, perto de mim, retirada, parcelado, nota fiscal, garantia, frete, preço, estoque, oferta Google ou comparação de comerciantes. Não criar selo ou afirmação "menor preço" por conta própria.

## Fontes e frescor

1. Bling é fonte de **preço de venda e saldo real** por `loja_id + sku` com `sincronizado_em`. Respeitar idade máxima configurada; em janela vencida exibir "preço/estoque sujeito a confirmação" ou consultar na hora. Nunca transmitir estoque desatualizado como InStock confiável.
2. `sem estoque` não equivale a `por encomenda`. `BackOrder` só com procedimento real, compromisso de reposição, lead time e política aprovada; sem isso usar orçamento/WhatsApp, sem prometer pronta entrega.
3. Um produto só é "o mais barato" se houver comparação verificável da mesma peça, data, condições e região; título SEO não recebe superlativo permanente sem prova.
4. Para "perto de mim", confirmar endereço do estabelecimento, coordenadas e horário verdadeiros. Proximidade depende da localização consentida do comprador/CEP; sem isso não inventar distância. Retirada física não significa loja aberta ao público nem estoque físico disponível.
5. Frete, retirada, entrega, política de trocas e prazo devem vir de cadastro aprovado por loja/CEP. Caso incompleto, pedir CEP ou indicar "sob consulta".
6. Parcelamento: armazenar total, meses, valor de cada parcela, juros, vigência, limites e fonte. "Sem juros", Pix, 3x/4x/5x e garantia só quando explicitamente confirmados, refletidos na landing page e aprovados. Condições vencidas são omitidas.
7. Google Merchant Brasil: `installment` é atributo de **feed**, não um substituto genérico para JSON-LD. Usar `months`, `amount`, sem `downpayment` na América Latina conforme documento oficial e validar as condições vigentes antes do envio.
8. Dados de confiança são factuais: CNPJ, localização, telefone, políticas e NF, quando confirmados. Sem falsos depoimentos, avaliações, certificados e status de atendimento.

## Saída para todos os canais

`OfertaAprovavel {loja_id,sku,preco_total_brl?,estoque_disponivel?,estoque_lido_em?,parcelamento_confirmado?,retirada?,frete?,politicas?,origem_evidencias[],pendencias[]}`. O '?' significa campo opcional **não inventado**. A oferta pública é omitida se não tiver dados válidos, mas o cadastro técnico pode permanecer consultável conforme o canal.

## Testes negativos

- Saldo zero não vira InStock; dados atrasados não viram oferta em tempo real.
- Consulta sem CEP não gera km; frete sem regra aprovada não vira entrega grátis.
- `installment` não diverge de preço total/parcelas ou da landing page; juros não confirmados não viram "sem juros".
- Garantia não confirmada não vira condição comercial.
- Dados sigilosos (fornecedor, custo, impostos) nunca saem em textos públicos ou no PDV não autorizado.

Fonte: https://support.google.com/merchants/answer/6324474?hl=pt-BR. Não gravar dados de venda no Bling sem fluxo de aprovação por campo.
