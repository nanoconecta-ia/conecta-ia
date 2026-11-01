# Nano.IA — catálogo automotivo para descoberta orgânica e agentes (01/11/2026)

**Status:** proposta de arquitetura e Skills de projeto. Nada implantado. Vinculado à [issue #198](https://github.com/nanoconecta-ia/conecta-ia/issues/198). Reaproveitar a Skill de fidelidade visual no PR #196, sem fazer merge sem autorização.

## Objetivo

Responder com dados verdadeiros a consultas como: "motor parcial para HR 2.5 16V mais barato em Goiânia, perto de mim, com nota, garantia, retirada e parcelamento". O Googlebot **rastreia e indexa**, não conversa com um LLM. Os agentes podem consultar páginas indexadas, buscas web, feeds de parceiros e APIs de comércio autorizadas. Classificação e vitrine são canal/esquema distintos da identidade técnica do produto.

**A regra número um é: não inventar nem prometer ranking.** A melhor página de produto é a que revela precisamente identidade, aplicação, disponibilidade e oferta real, em HTML visível e dados públicos de fácil leitura.

## Diagnóstico do repositório (conferido no código, não equivale a teste de produção)

| Camada | Artefatos existentes | Lacuna/ação |
|---|---|---|
| Fonte ERP | `CLAUDE.md`, Bling API e espelho | Bling permanece fonte de SKU, preço e estoque; sem escrita automática |
| Taxonomia | `taxonomia_nos`, `bing_categoria_taxonomia`/mapeamentos (confirmar nome correto da tabela em SQL), `docs/taxonomia/proposta-bling.md` | Não usar a navegação em árvore como única representação: 1 SKU pode ter N aplicações comprovadas |
| Busca semântica | `docs/conector-ia/descoberta-por-agentes.md` e `_shared/consulta/interpretar.ts` | Diferenciar peça, motor, variante, ano; avaliar perguntas ambíguas e negativação por restrições |
| SEO/SSR | `_shared/seo/{dados,jsonld,pagina,sitemap,rotas,feed_merchant}.ts`, `loja-seo/index.ts` | Verificar deploy e domínio de teste ao vivo; corrigir SPA por `#/` e possível `noindex` público. Nunca habilitar indexação do painel administrativo |
| Confiança e publicação | `produto_imagens`, `docs/conector-ia/imagens-seo.md`, pipeline de direitos | Imagem aprovada não implica direitos de uso; `loja-publica` deve usar somente imagens publicáveis |

### Grafo canônico (não trocar por pastas ou keywords)

- `Loja` (estabelecimento, endereço validado, políticas, canais, regimes) oferece `Oferta`.
- `Oferta` referencia `SKU da loja`, preço e estoque do Bling com `sync_timestamp`, condições verificadas (parcelas, retirada, frete, garantia).
- `SKU` representa uma peça/variante vendável, tem `Marca da peça`, `Fabricante`, MPN, GTIN válido se existente, e um conjunto de `Referencia` (OEM da montadora, código importador, equivalências com evidência e restrições).
- `Aplicacao` é relação N:M SKU ↔ veículo/versão/motor/anos, **com fontes e restrições negativas**, não string concatenada. Família D4BH/4D56 não permite deduzir equivalência sem evidência. 8V/16V são versões distintas.
- `Taxonomia` organiza categorias para navegação e termos humanos; marca/montadora/aplicação são dimensões relacionadas, não caminhos físicos exclusivos. Explicitar diferenças do Bling e da classificação enriquecida.
- `Midia` referencia SKU/aplicações e licença, com original no HD/Drive próprio do tenant e variante pública em CDN quando aprovada (issue #194).

## Pipeline, do ERP ao agente externo

```text
Bling (SKU, preço, estoque)
    ↓ sincronização / frescor / isolamento por loja
Conecta.IA (taxonomia + aplicação aprovada + evidências + direitos)
    ↓ validação determinística e aprovação
Página SSR HTML + JSON-LD + URLs HTTPS + imagem pública autorizada
    ├─ Googlebot / Search Console / Google AI Mode
    ├─ Google Merchant Center feed + listagens gratuitas/locais
    ├─ OAI-SearchBot / busca ChatGPT
    └─ ACP/Google UCP: adaptadores futuros, somente se elegíveis
```

### O que publicar e o que omitir

| Dado | Pode aparecer | Caso ausente/incerto |
|---|---|---|
| SKU, marca, MPN/OEM, especificações | Se há origem e identidade homologada | Omitir campo ou rótulo `não confirmado`; nenhuma equivalência imaginada |
| Aplicações e motores | Só versões/anos/vínculos aprovados | Não dizer que "serve" só pela aparência; pedir ano/motor |
| Foto | Fotografia real licenciada vinculada ao SKU | Sem imagem principal, produto não entra no Merchant |
| Preço | Preço de venda atual do Bling, aprovado e visível na página | Não emitir `Offer.price` com valor inventado |
| Disponibilidade | Estado verdadeiro e recente, `InStock` apenas com estoque disponível | Não anunciar pronta entrega; usar sob consulta, orçamento, e `BackOrder` somente sob encomenda de verdade |
| Parcelas | Termos verdadeiros, válidos, visíveis na página | Omitir `installment` e texto de parcela |
| Frete e retirada | Localização real, política, valor e prazo apurados | Solicitar CEP ou mostrar `a calcular`; não fabricar km, prazo ou frete grátis |
| Confiança | CNPJ e dados públicos conferidos, NF/garantia/política verificada, Perfil da Empresa real | Não inventar estrelas, selo, depoimentos, "melhor preço", garantia |
| Selos de rich result | `Product`, `Offer`, `BreadcrumbList`, `Organization/LocalBusiness` conforme suporte | Não implementar JSON-LD enganoso/oculto; passar Rich Results Test |

## MVP técnico: prioridade antes de alimentar agentes

1. **P0: 3–5 SKUs completos e homologados**. Gerar ficha técnica unívoca com preço, disponibilidade (se houver), foto própria/licenciada, aplicação e contraindicação explícitas. Pilotos possíveis: motor parcial HR 16V, CI000016 bomba d'água e CI001086 bomba óleo — somente se o cadastro e as evidências existirem.
2. **P0: páginas SSR/SSG reais**. URL por produto sem fragmento `#`, HTML inicial com H1/descrição/imagem, links indexáveis `<a href>`, canonical coerente, robots/sitemap apenas para URLs elegíveis, Search Console e Rich Results Test. Não publicar página editorial sem oferta como Merchant listing de produto comprável.
3. **P1: confiabilidade comercial e local**. Loja real/retirada, contato, horário, CEP, localização, frete e condições bancárias/card; cruzar oferta com estoque e preço do Bling por timestamp, programar alertas e retirada do feed ao expirar. Sem estoque não criar falsa listagem `in stock`.
4. **P1: feed Google Merchant**. Gerar RSS/XML com atributos oficiais checados, identificar rejeições por item, manter paridade HTML/JSON-LD/feed/ERP, liberar listagem gratuita e inventário local só quando loja/conta elegível e comprovadas.
5. **P2: descoberta ChatGPT e commerce agentic**. Permitir `OAI-SearchBot` onde desejado e não bloquear imagens publicáveis na CDN/WAF. Oferecer dados de catálogo publicamente legíveis; preparar adapter ACP *Stable* (parceiros aprovados, disponibilidade regional a confirmar) e Google UCP (lista de espera). Não iniciar checkout, cobranças ou pedidos por agente neste MVP.
6. **Medição**. Métricas por canal: URLs indexáveis e indexadas, cobertura JSON-LD, erros de feed, erro de aplicações, idade dos dados, visitas de buscas orgânicas, leads reais no WhatsApp, consultas sem resultado. Não vender "SEO garantido".

## Semântica de produtos automotivos

- JSON-LD `Product` por SKU, opcional `isAccessoryOrSparePartFor` com aplicações aprovadas — schema.org descreve essa relação, mas **não garante rich-result específico** no Google.
- `ProductGroup` apenas para **variantes reais de uma mesma família comercial**, com SKU/URL separadas e `variesBy` validado; 8V vs 16V e motores tecnicamente distintos não se tornam variantes intercambiáveis por marketing.
- Páginas por veículo só quando fornecem valor editorial único e aplicações confirmadas, com canonical correto. Não gerar milhares de páginas de combinação vazia; filtros de faceta, busca interna e URL de consulta ficam `noindex` por padrão.
- `LocalBusiness` exige dados reais por localização; proximidade é calculada pelo buscador com localização do comprador e loja, não por palavras repetidas.
- Google Merchant Brasil permite `installment` para todas as categorias no Shopping/listagens gratuitas; subatributos `months`, `amount`; **não usar `downpayment` para LATAM**. Esse atributo é de feed Merchant, **não JSON-LD**.
- Caso Mobis realize exclusivamente retirada presencial, refletir isso sem alegar entrega pronta, frete indisponível ou retirada em filiais inexistentes.

## Skills do Nano (arquivos neste PR)

1. `.claude/skills/nano-identidade-automotiva/SKILL.md`: evidência de identidade técnica e aplicação, taxonomia e variantes.
2. `.claude/skills/nano-seo-rastreavel/SKILL.md`: SSR, HTML público, JSON-LD, sitemaps e robots.
3. `.claude/skills/nano-oferta-local/SKILL.md`: estoque/preço, parcelamento, retirada, CEP, confiabilidade.
4. `.claude/skills/nano-feeds-agentes/SKILL.md`: Merchant feed, ChatGPT/ACP, Google/UCP sem conexões fictícias.
5. `.claude/skills/nano-publicacao-qa/SKILL.md`: verificação executável, matriz negativa, gates humanos, observabilidade.

**Skills instruem; não executam nem validam os fatos sozinhas.** Claude Code precisa criar contratos, testes de integração e validação determinística na lógica de backend antes de descrever capacidade como operacional.

## Links de referência

- Google AI e SEO (sem marcação especial): https://developers.google.com/search/docs/appearance/ai-features
- Google Javascript SEO e fragmentos: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google Product/Offer: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- Google ProductGroup: https://developers.google.com/search/docs/appearance/structured-data/product-variants
- Google LocalBusiness: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Merchant parcelamento Brasil: https://support.google.com/merchants/answer/6324474?hl=pt-BR
- Google listagens locais Brasil: https://support.google.com/merchants/troubleshooter/15264061?hl=pt-BR
- Google UCP (lista de espera): https://developers.google.com/merchant/ucp
- OpenAI ACP feeds (onboarding de parceiros): https://developers.openai.com/commerce/guides/get-started
- OpenAI OAI-SearchBot: https://help.openai.com/pt-br/articles/12627856-publicadores-e-desenvolvedores-faq

**Não realizar merge, deploy, mudança de DNS/Cloudflare, envio de feed Merchant, cadastro de produtos, alteração do Bling ou aprovação de ofertas sem permissão específica.**
