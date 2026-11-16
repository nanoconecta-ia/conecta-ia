# MOBIS AUTOPEÇAS | Revisão OEM, similares e banner comercial
Data: 2026-11-16. Loja `mobis` / Supabase Conecta.IA `dsfzhsrudriqkumtlqwj`.

## Base de evidências
- **Fonte primária de cadastro:** SKU físico existente no Conecta.IA e no Bling. NÃO criar SKU filho, não alterar notas, estoque, custo ou preço.
- **Fonte primária de correspondência do fornecedor:** [Catálogo Quatro Completo](https://drive.google.com/file/d/1eeXjCTJxt53DgNyq62OApp6QxfbegEnr/view), seção Bandeja Inferior/Superior e Bomba de Óleo.
- **Cruzamento independente OEM Hyundai HR/H100:** [CTR Parts Catalogue 2024](https://ctr-cdn2-e7f6e5bugjh6gfc0.z01.azurefd.net/aftermarket/files/9ca774fd8e539b5b15be693178f4f3ca.pdf) e [RIW H100 Pickup](https://www.riw.com.tr/en/catalog/HYUNDAI/H100%20PICK-UP/1997%20-%202004).
- **Cruzamento independente OEM Kia Bongo/K2500:** [Teknorot 2020](https://www.teknorot.com/wp-content/uploads/2020/01/European-Market.pdf), [RIW K2500](https://www.riw.com.tr/en/catalog/KIA/K2500) e [SWAG 2014](https://file.euroauto.ru/file/catalogs/firms/208.pdf).
- **Bomba de óleo D4BH:** [GMB oil pump catalogue](https://am.gmb.co.kr/file/catalogue/GMB-OILPUMP_Catalogue.pdf). O código 21340-42106 existe como referência OE, mas **há dois produtos na base usando a mesma referência**. Não escolher arbitrariamente um deles.
- Atenção: referências de outras marcas são elementos de **pesquisa e identificação**, NÃO prova de origem genuína ou de equivalência de todo o conjunto (buchas, pivôs e acessórios). Confirme por chassi, número OE, lado, versão e conteúdo físico.

## 8 referências OE aprovadas com trilha gravada em `produto_codigos`
| SKU existente | Referência OE | Posição | Status |
|---|---|---|---|
| 5074 | 544104B000 | HR bandeja superior LE | aprovado, confiança técnica 0,92 |
| 5075 | 544304B000 | HR bandeja superior LD | aprovado, confiança técnica 0,92 |
| 5076 | 545104B001 | HR bandeja inferior LE | aprovado, confiança técnica 0,92 |
| 5076 | 545104F000 | HR bandeja inferior LE | aprovado, confiança técnica 0,92 |
| 5077 | 545404B001 | HR bandeja inferior LD | aprovado, confiança técnica 0,92 |
| 5077 | 545404F000 | HR bandeja inferior LD | aprovado, confiança técnica 0,92 |
| CI000106 | 544204E200 | K2500/K2700 bandeja superior LD | aprovado, confiança técnica 0,92 |
| CI000220 | 544104E200 | K2500/K2700 bandeja superior LE | aprovado, confiança técnica 0,92 |

Os campos `fonte` preservam a origem anterior e acrescentam links de revisão independente. Um produto não necessariamente é `publicado` ou `exibicao_teste` após validar sua referência. Catálogo público continua respeitando essas permissões.

## 9 registros mantidos em `a_confirmar` por integridade
| SKU | Tipo | Código | Motivo / evidência faltante |
|---|---|---|---|
| 5074 | similar | BJC32017M | Quatro cruza referência, mas anúncio COFAP indica bandeja **sem pivô**, enquanto peça CI000120 Quatro anuncia **com pivô**. Verificar composição física e se referência é somente da estrutura |
| 5075 | similar | BJC32016M | Mesma divergência sobre pivô / composição física para lado direito |
| 5076 | similar | BDJ2029 | Quatro cruza o código; inspecionar configuração do pivô, batente, bucha e versão |
| 5077 | similar | BDJ2028 | Quatro cruza o código; inspecionar configuração do pivô, batente, bucha e versão |
| CI000106 | similar | BDJ2030 | Confirmar versão K2500/K2700, lado direito e componentes com catálogo fabricante ou embalagem original |
| CI000220 | similar | BDJ2031 | Confirmar versão K2500/K2700, lado esquerdo e componentes com catálogo fabricante ou embalagem original |
| 2134042106 CI000966 | OE | 21340-42106 | Código OE da bomba D4BH existe em catálogo GMB, mas o mesmo OEM aparece em outro cadastro: resolver SKU canônico com NF/lote/estoque antes de liberar pesquisa |
| CI000966 /2134042106 | OE | 21340-42106 | Mesmo bloqueio de duplicidade para o segundo cadastro; não consolidar sem conferir estoque e composição |
| CI002916 | fabricante | CI003695 | Informação de fornecedor diverge do SKU físico. Não assumir equivalência motor 4D56/D4BH; requer comprovante e foto da etiqueta |

Documentação cruzada adicional: [COFAP BJC32016M sem pivô](https://www.autopecasfama.com.br/produtos/bandeja-dianteira-hyundai-hr-superior-direita-e79z3/), [BJC32017M com/sem pivô conforme KIT](https://www.caminhoneteecia.com.br/bandeja-dianteira-esquerda-superior-hyundai-hr-2005-2020), [BDJ2028/BDJ2029](https://www.carrefour.com.br/produto/par-bandeja-balanca-inferior-hr-2004-05-06-07-08-09-10-2020-340599669), e [BDJ2030/BDJ2031 catálogo](https://storage.googleapis.com/unifort.prd.imagefiles.dynamicssales.com.br/ImagensSite/Autos/AUTOS_2020.pdf).

**Critério de saída da fila:** evidência visual de etiqueta/embalagem do produto vendido, descrição com pivô/buchas, catálogo fabricante original ou NF, e revisão humana para cada divergência. Não automatizar a mudança de status dos nove registros.

## Campanha do motor parcial CI003696
- Produto no catálogo: `CI003696`, motor parcial HR/K2500 2.5 16V D4CB Euro V, marca Trim Go, `publicado=false`, `exibicao_teste=true`; valores do catálogo consultado em 16/11/2026: **R$ 18.900**, não necessariamente preço comercial final.
- [Legenda previamente aprovada no Drive](https://drive.google.com/file/d/1UVkBDWrCCaGz8cZWMUOvFPK0UTDbyxru/view): referência histórica de **R$ 17.800 em 3x**, com confirmação de chassi e condições. Manual antigo referencia **R$ 19.600** como preço-base. Existe **divergência entre fontes de preço e sem data final da oferta**.
- Rascunho de `loja_banners`: ID `7a6a6594-a16e-4bc5-b89a-003e6686f362`, SKU `CI003696`, `ativo=false`, estilo `padrao`, chamada informativa sem preço. Banner de consulta no frontend só aparece quando o produto está na resposta pública, não promete venda ou estoque.
- **Não divulgar R$ 17.800, 3x sem juros, desconto percentual ou "últimas unidades" até validar estoque, preço vigente por canal, juros do gateway, data de início/fim e autorização final.**
- A função `banners_da_vitrine` exige `ativo=true`, `p.publicado=true` e vigência. Não contornar com publicação antecipada ou `exibicao_teste`.
- Criativos institucionais preservam os arquivos oficiais do Drive e podem ser mostrados em ambiente de consulta sem oferta enganosa.

## Verificação e próxima decisão operacional
- Recontar `produto_codigos`: 14 aprovados (8 OE + 6 fabricante), 9 pendentes (6 similares + 2 OE com possível duplicidade + 1 fabricante divergente).
- Verificar que pesquisa pública por código aprovado de SKU visível encontra um único produto físico; código pendente não retorna equivalência.
- Conferir rascunho `loja_banners` inativo e ausência de novos preços na vitrine pública.
- Coletar fotos das peças com dúvidas e dados comerciais atuais; não emitir NF, não alterar Bling, preço ou estoque automaticamente.
