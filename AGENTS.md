# Instruções para agentes de catálogo — Conecta.IA (piloto MOBIS)

**Escopo:** este repositório apenas. Consulte `CLAUDE.md` e a arquitetura/Policy Engine existentes antes de qualquer operação. O projeto Supabase autorizado é `conecta-ia` (`dsfzhsrudriqkumtlqwj`), **nunca** `NanoShell IA`.

## Buscador existente da MOBIS — Firecrawl
LER PRIMEIRO [ferramentas oficiais de imagem e configuração Firecrawl](docs/conector-ia/porteiro-ferramentas-firecrawl-imagens-20261119.md): `conecta.imagem.buscar_web({consulta,sku})` / `buscar_imagem_web` (chat) → `conecta.imagem.propor` (fila). Adaptador único `ProvedorBusca`, sem nova API. MOBIS tem Firecrawl ativo, mas não há comprovação de chamada real. **MCP externo não recebe atualmente a ferramenta de busca**; não alegar acesso ou burlar permissão. Foto ausente fica como pendência não bloqueante da ficha.

## Todos os SKUs e modelos: cadastrar mesmo sem fotografia
Ler [fluxo de cadastro MOBIS sem foto, busca de imagens e complementação posterior](docs/conector-ia/mobis-cadastro-sem-foto-todos-skus-20261119.md). Imagem não encontrada dentro de 15s, sem fonte ou sem licença não trava cadastro técnico/rascunho: registrar `foto_pendente`, usar placeholder e continuar a próxima peça. Para MOBIS, a publicação SEM FOTO é permitida **somente após os demais portões e aprovação humana**; nunca publicar aplicação a confirmar. Não transferir essa exceção a outras lojas, nem a produto com automação pausada. Não usar foto de item similar como real.

## Entrada por descrição e árvore de versões brasileiras
Antes de assumir um SKU, leia [busca por descrição e árvore pai/filhos/primos (casos Hyundai HR e VW Gol)](docs/conector-ia/roteiro-descricao-genealogia-veicular-br-20261119.md). Aceite `motor para HR 2013` sem SKU; documente primeiro versão, cilindros, válvulas, início/fim no Brasil e fonte. Ausência de ano final comprovado **não** significa versão ainda fabricada. Não propague aplicação/OEM dos «primos» nem transforme ano de catálogo aftermarket em fim de comercialização.

## Encontrar peças sem consumir tempo do lojista
**LER PRIMEIRO**
1. [Mapa de fontes oficiais para SKU + GTIN/GS1 + NCM + EPC + CAOA/Hyundai + Kia KMB + fabricantes/fornecedores OE + importadores B2B + Mercado Livre/Shopee](docs/conector-ia/fontes-pesquisa-rapida-sku-ncm-gs1-20261119.md)
2. [Norma do porteiro e cadastro individual em lotes](docs/conector-ia/mobis-porteiro-cadastro-em-lotes-20261119.md)

Use o SKU real do Bling, descrição, GTIN quando presente e o NCM da NF **somente como pista**. GS1 Brasil confirma identidade comercial pelo GTIN, não aplicação; EPC identifica peças genuínas por figura/versão, não prova equivalência de conjunto de reposição. Para motor curto, bloco montado com cabeçote ou motor completo, diferencie composição. Consulte histórico de importadora/distribuidora brasileira **por montadora, versão e época**, não apenas ficha internacional. Não classifique anúncios como OEM homologado. Fotos precisam de vínculo e direitos.

**Orçamento operacional especificado:** 15.000 ms **TOTAIS por SKU** em execução, incluindo consultas, cache, comparação e resposta parcial. Essa limitação requer implementação determinística no gateway e teste; atualmente esta documentação sozinha **não cria execução automática nem garante deadline**.

**Autorização:** somente ler/pesquisar/propor conforme escopo. Aprovação humana para cadastro e publicação; sem merge/deploy, emissão de NF, mudanças em dados fiscais, preço, estoque, SKU, perfis ou permissões sem autorização específica. Produto pausado continua pausado. Um item físico por SKU, várias ofertas independentes por veículo, todas compartilham o mesmo saldo Bling.

## Verificação antes de declarar concluído
Mostrar fontes e data, códigos candidatos separados dos homologados, aplicações brasileiras e contraindicações, dados faltantes, testes executados e bloqueios. Não alegar acesso ativo à GS1 API/PartSouq, nem pesquisa real em 15s, sem prova de chamada e permissão.
