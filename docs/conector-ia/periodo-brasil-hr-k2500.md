# Período no Brasil — Hyundai HR e Kia Bongo K2500 (pesquisa de 2026-10-19)

Status de todos os itens: **a_confirmar**. Nada foi gravado em `eventos_veiculo` (produção) nem no Bling.
Limite da pesquisa: o ambiente bloqueia os sites das matérias (HTTP 403), então só li **resumos de busca**, não as páginas originais.
Cada item precisa ser aberto na fonte original por uma pessoa (ou por um ambiente com acesso) antes de virar evento aprovado.

## Premissa corrigida: o HR foi MONTADO no Brasil
O cadastro assume que o veículo não é fabricado aqui. Para o **HR** isso parece não ser verdade:
| Fato (como dito no resumo da busca) | Fonte | Observação |
|---|---|---|
| A fábrica da CAOA em Anápolis (GO) fabricou o HR; a montadora foi aberta em 2007 | Wikipedia (Grupo CAOA); Ward's | O ano da 1ª unidade do HR **não** aparece nos resumos |
| O HR é montado a partir de kits CKD | Just Auto | CKD = peças importadas, montagem local |
| O último HR saiu da linha em 31/10/2025 | Vrum (2025-11); Autodata (2025-11-24) | Duas fontes concordam |
| Produção Hyundai em Anápolis parou em abril de 2025 (HB20 etc.); o HR seguiu até outubro | Autoo / B News | |
| Em 2024 o HR passou a ser vendido na rede unificada Hyundai/CAOA; a Hyundai assumiu a importação do que a CAOA importava | Autodata (2024-06-10) | |

Consequência para o agente: para o HR, "ano de fabricação no Brasil" (montagem CKD, Anápolis) e "ano-modelo" são datas diferentes da de importação. Registrar como eventos separados (`inicio_montagem_nacional`, `fim_montagem_nacional`), e não presumir importação do veículo pronto.

## Kia Bongo K2500
| Fato | Fonte | Observação |
|---|---|---|
| Terceiro modelo mais vendido da Kia no Brasil (~62 mil unidades em 30 anos de marca) | Correio (coluna "Kia completa 30 anos") | Não dá ano de início do modelo |
| Linha de montagem do Bongo K2500 em Montevidéu (Uruguai), grupo Gandini com a Nordex | mesma coluna | Ano **não** informado no resumo |
| K2500 4x4 lançado em março/2023 (modelo 2024), substituindo a 4x2; atualização 2025 em março/2024 | TNH1; Autopapo; Mecânica Online | |
| Motor 2.5 turbo diesel intercooler, 16V, Common Rail, 130,5 cv a 3.800 rpm, 26 kgf·m a 1.250 rpm | TNH1 / Autopapo | Não cita o código D4CB nem a norma Euro |

## O que NÃO foi encontrado (não preencher)
- Ano em que o HR começou a ser montado em Anápolis.
- Ano em que o Bongo K2500 passou a ser vendido no Brasil e o ano do Bongo com motor D4CB.
- Data de entrada da norma de emissões (PROCONVE P7 / "Euro V") para HR e K2500, e se coincide com "2013".
- Qualquer confirmação de que o código do motor era D4CB em cada geração. Isso vem do cadastro do SKU 80692 (texto do lojista), não de fonte independente.

Por isso o "(2013+)" do SKU 80692 segue **sem evidência**: nenhuma fonte encontrada confirma 2013 como início do HR/K2500 com D4CB Euro V no Brasil.

## Fontes consultadas (resumos de busca; páginas originais não abertas)
- https://www.autodata.com.br/noticias/2025/11/24/caoa-produz-o-ultimo-hr-e-encerra-etapa-hyundai-em-anapolis/97309/
- https://www.vrum.com.br/noticias/2025/11/7302402-caoa-encerra-producao-da-hyundai-em-anapolis-e-inicia-nova-fase.html
- https://www.autodata.com.br/noticias/2024/06/10/hr-e-o-primeiro-hyundai-vendido-na-rede-unificada-com-a-caoa/73497/
- https://www.autoo.com.br/caoa-deixou-de-produzir-carros-da-hyundai-no-brasil/
- https://www.wikipedia.org/wiki/Grupo_Caoa
- https://www.just-auto.com/?p=26003
- https://www.correio24horas.com.br/colunistas/autos-e-etc/kia-completa-30-anos-no-pais-relembre-a-historia-da-besta-e-conheca-os-novos-lancamentos-0923
- https://www.tnh1.com.br/noticia/nid/kia-brasil-lanca-bongo-k2500-2024-com-tracao-4x4/
- https://autopapo.com.br/curta/kia-bongo-k2500-4x4-2025/

## Próximo passo sugerido
Fontes que fecham as lacunas: catálogo/EPC da Hyundai e da Kia para o Brasil, boletim técnico do importador, homologação (Inmetro/IBAMA-PROCONVE) e a Tabela FIPE por ano-modelo (os anos que a FIPE lista para cada versão já dão um primeiro limite, a conferir).
