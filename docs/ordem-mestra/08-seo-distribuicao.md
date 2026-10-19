# 8. Arquitetura de SEO e distribuição

## 8.1 Diagnóstico
O site público atual é uma SPA (Vite + React) no GitHub Pages: `<meta name="robots" content="noindex">`, rotas por `#/loja/<slug>` e `#/p/<loja>/<sku>`, dados via POST à Edge Function. Fragmento `#` não é indexável, e o conteúdo só existe depois de executar JS. **Isso não atende à seção 7 da ordem.** O painel deve continuar `noindex`.

## 8.2 Arquitetura-alvo (Fase 3)
```
Google/cliente ─▶ domínio da loja ─▶ Renderizador público (SSR) ─▶ Edge Function loja-publica (dados) ─▶ Postgres
                                         │ cache por loja + invalidação por evento
                                         ├─ /sitemap.xml  /robots.txt  /feeds/*
                                         └─ HTML completo + JSON-LD (+ hidratação mínima para busca/filtros)
```
- **Renderizador separado do painel** (não reutilizar a SPA do painel). Linguagem/stack **depende da decisão de hospedagem** (doc 01, decisão 1). Requisito funcional, não de marca: HTML completo no primeiro byte, TLS automático por domínio, resolução loja-por-host no servidor, 404 genérico para host desconhecido.
- **O site funciona sem o agente**: o renderizador só lê produtos publicados e fatos aprovados.
- **Resiliência**: último catálogo válido servido do cache se o banco/Bling falhar.

## 8.3 URLs estáveis (propostas)
`/` · `/fabricantes/<marca>` · `/categoria/<slug>` · `/produto/<sku-slug>-<sufixo-curto>` · `/busca?q=` (noindex) · filtros por veículo **não indexáveis** por padrão. Mudou slug ⇒ **301** para o novo; despublicado ⇒ 404/410 conforme regra do doc 7. `canonical` sempre no domínio do cliente, sem parâmetros.

## 8.4 SEO orgânico
| Item | Regra |
|---|---|
| Título/descrição | gerados só de fatos aprovados; únicos por página; proposta passa por aprovação |
| Dados estruturados | `Product` (nome, sku, marca, gtin se existir, imagem, `offers` com preço/disponibilidade **do último dado sincronizado**), `BreadcrumbList`, `Organization/LocalBusiness`. Nunca `aggregateRating` sem avaliações reais |
| Páginas por aplicação | só quando houver conteúdo útil e aplicações **aprovadas**; sem geração em massa de páginas finas (limite mínimo de conteúdo original por página antes de `index`) |
| Sitemap/robots | por domínio; só URLs 200 indexáveis; `lastmod` = `sincronizado_em`/aprovação |
| Imagens | formatos modernos, dimensões explícitas, `alt` factual, lazy abaixo da dobra |
| Desempenho | orçamento por página (LCP/CLS/INP) medido em campo e em teste sintético; falha de orçamento bloqueia a publicação de template |
| Indexação | Search Console por domínio (conexão do lojista); relatório de cobertura no painel |

Não prometer posição de ranking.

## 8.5 Google Merchant Center (conector separado)
Feed `gerar_feed_merchant`: `id`=SKU estável, `title`, `description` (texto simples), `link`, `image_link` (**imagem aprovada**), `price` (BRL), `availability`, `brand`, `gtin`/`mpn` quando existirem (senão marcar `identifier_exists=no` conforme regra do canal), frete/devolução quando exigido. **As regras atuais do canal e atributos obrigatórios por categoria precisam ser conferidas na documentação do Google antes de implementar** — não verificadas aqui. Fluxo: gerar → validar → mostrar erros → aprovar → só então enviar.

## 8.6 Google Ads e outros canais
`propor_campanha` produz rascunhos (campanhas, grupos, criativos, textos, landing pages, segmentação, orçamento). **Publicar, ativar ou mudar orçamento = HIGH, aprovação específica por ação, idempotency_key, auditoria.** Conectores separados: SEO ≠ Merchant ≠ Ads. Nenhuma credencial de Ads no repositório; OAuth por loja como o Bling.

## 8.7 Domínio piloto
`www.mobisautoparts.com.br`: **nenhuma alteração de DNS/Locaweb sem autorização explícita**. Validar o site novo em endereço de teste; corte em passo separado, com TTL reduzido antes e plano de volta (site atual permanece).
