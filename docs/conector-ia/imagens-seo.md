# Imagens, SEO e feed Merchant — Fase 1 (desenho + código testado, nada implantado)

Escopo: `supabase/functions/_shared/imagens/`, `_shared/seo/`, `loja-seo/` (**não implantada**), migração `20261019000005_imagens_pipeline.sql`
(**não aplicada**), testes `imagens/imagens.test.ts`, `seo/seo.test.ts`, `supabase/tests/imagens_pipeline.sql`.

## 1. Pipeline de imagens

| Etapa | Onde | Regra |
|---|---|---|
| Produtos sem imagem | view `produtos_sem_imagem_publicavel` (RLS do usuário) / `produtosSemImagem()` | produto ativo sem nenhuma imagem **publicável** |
| Validar candidata | `validarCandidata()` | https; URL servida ≠ `url_original`; origem registrada; não-real exige cruzamento sku/ean/oem/fabricante que **confere** com os identificadores do produto; `similar`/`substituto` não provam identidade (aviso; bloqueio se for principal); IA nunca é principal |
| Aplicação | `ContextoProduto.aplicacoesAprovadas` | imagem não-real de produto sem aplicação aprovada gera aviso |
| Direitos de uso | `direitosConfirmados()` + `imagem_confirmar_direitos()` | própria/licenciada valem; fornecedor/fabricante/web pública exigem confirmação **do lojista** com referência da evidência (≥10 caracteres), auditada |
| Publicar | `podePublicar()` + view `imagens_publicaveis` + policy anon | aprovada **e** com direitos **e** não retirada. Sem direito confirmado, não aparece no público |
| Rótulo | `rotuloPublico()` | ilustrativa e gerada por IA sempre rotuladas; foto real não leva rótulo |
| Principal | `podeSerPrincipal()` / `escolherPrincipal()` | real publicável é preferida; IA nunca |
| Variantes | `VARIANTES`, `gerarVariantes()` atrás de `PortaImagem` | nomes determinísticos só com UUIDs; **sem upscaling**; só processa imagem publicável e com resolução conhecida. A implementação real de pixels **não existe** (só `ProcessadorMock`): depende de decidir o serviço |
| Canal | `validarParaCanal()` | só o mensurável por metadados bloqueia (resolução mínima); fundo branco, marca d'água, sobreposição e texto promocional vão para **verificação manual** |
| Retirada | `imagem_retirar()` | some do público e não volta; auditada |

`url_original` e `direitos_referencia` nunca saem do servidor: a visão `imagens_publicaveis` não os traz e o `anon` não tem grant nessas colunas (testado).

## 2. SEO gerado (código puro, testado)

`sitemap.xml` (+ `sitemap-N.xml` e índice acima de 50.000 URLs), `robots.txt`, `canonical`, metadados/Open Graph, JSON-LD
(`Product`+`Offer`, `BreadcrumbList`, `Organization`, `WebSite`) e páginas HTML mínimas renderizadas no servidor.
Regras: só dado real e aprovado; campo vazio fica vazio; **sem** `aggregateRating`/`review`; `Offer` só com preço **e** estoque reais; GTIN só com
dígito verificador válido; tudo escapado (HTML, XML e JSON-LD); produto despublicado/ausente/incompleto → 404 e fora do sitemap/feed; loja sem
domínio ativo → `noindex`, sem canonical, sitemap/feed indisponíveis e `robots.txt` com `Disallow: /`. O domínio das URLs vem do banco
(`dominios_ativos`), nunca da requisição.

## 3. Feed Google Merchant

RSS 2.0 com namespace `g:` (escolha de projeto por segurança de escape; **não** vem da documentação). `validarProdutoMerchant()` bloqueia com motivo
por produto: sem preço, estoque desconhecido, sem descrição, sem marca, GTIN inválido, sem GTIN válido nem MPN aprovado, sem imagem publicável,
imagem sintética, imagem pequena, não publicado, SKU duplicado. A condição (novo/usado) **não é publicada** porque o mapeamento do campo do Bling não foi conferido.

## 4. Função `loja-seo` (não implantada)

`GET /sitemap.xml`, `/sitemap-N.xml`, `/robots.txt`, `/feed/merchant.xml`, `/produto/<sku>`, `/politicas/<slug>`. Cabeçalhos: CSP restritiva, `nosniff`,
`referrer-policy`, `HSTS max-age=31536000`. Deploy: usar o mesmo contorno de função única autocontida das demais (bug do bundler multi-arquivo).

## 5. Checklist para o robô do Google

| Item | Coberto pelo código? | Depende de |
|---|---|---|
| HTTPS no domínio do cliente, certificado válido | Não | DNS/SSL/hospedagem do domínio (não será alterado sem autorização) |
| HSTS | Cabeçalho enviado pela função | Servir o domínio por HTTPS na hospedagem |
| Páginas de produto rastreáveis (URL real, sem `#`) | `/produto/<sku>` renderizado no servidor | **O painel público atual usa rota por hash (`#/p/<loja>/<sku>`), que o robô não indexa.** Precisa publicar `loja-seo` atrás do domínio do cliente ou pré-renderizar |
| Política de privacidade, trocas/devoluções, entrega, contato | Páginas e `prontidaoMerchantLoja()` | O lojista **aprovar** as políticas (`loja_politicas.status = 'aprovada'`) |
| Dados estruturados válidos | Gerados e testados localmente | Validar no teste de rich results do Google (externo, **não executado**) |
| Mobile | `viewport` e layout fluido | Teste real em dispositivo/Lighthouse (**não executado**) |
| Sitemap/robots declarados | Sim | Enviar o sitemap no Search Console (ação do lojista) |
| Feed no Merchant Center | Geração local | Conta do Merchant, verificação do domínio e envio (**nada é enviado pelo sistema**) |
| Imagens sem marca d'água / com fundo branco | Só o mensurável | Verificação manual |

## 6. NÃO CONFERIDO (documentação do Google inacessível neste ambiente)

Lista exata de atributos obrigatórios do feed; namespace `http://base.google.com/ns/1.0`; formato `900.00 BRL`; `in stock`/`out of stock`; limites de
título (150), descrição (5000) e imagens adicionais (10); imagem mínima 100×100 e recomendada 800×800; exigência de fundo branco; propriedades
obrigatórias/recomendadas do `Product` em dados estruturados; limite de 50.000 URLs por sitemap (confirmado só pelo protocolo sitemaps.org, de memória);
mapeamento do campo `condicao` do Bling. Cada ponto está marcado `conferido: false`/aviso no código. Conferir na documentação oficial antes de produção.

## 7. Dependências e riscos

1. Aplicar a migração `…0005` muda a vitrine: a policy do `anon` passa a exigir direitos confirmados. Hoje há 0 imagens reais.
2. `loja-publica` (não alterada) lê imagens por `service_role` filtrando só `aprovada = true`: deve passar a ler `imagens_publicaveis`, senão imagem aprovada sem direitos ainda vaza pela API.
3. Serviço de imagem (recorte, fundo branco, WebP/JPEG) não decidido: só há mock.
4. Preço/estoque do SEO são do espelho; antes de cobrar, o checkout revalida no Bling (regra do projeto).
