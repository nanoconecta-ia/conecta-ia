# Instruções para agentes de catálogo — Conecta.IA (piloto MOBIS)

**Escopo:** este repositório apenas. Consulte `CLAUDE.md` e a arquitetura/Policy Engine existentes antes de qualquer operação. O projeto Supabase autorizado é `conecta-ia` (`dsfzhsrudriqkumtlqwj`), **nunca** `NanoShell IA`.

## Porteiro rápido: triangulação por peças de referência (regra universal)
Para QUALQUER veículo (diesel, gasolina ou flex), **não dissecar a história da montadora** antes de cadastrar uma peça. Buscar com descrição/SKU no Conecta.IA e cruzar no máximo três evidências de catálogo: **jogo de juntas, filtros e uma peça de motor** (pistão/bomba de óleo/cabeçote), com informações sobre `modelo/versão, início/fim de aplicação do catálogo no Brasil, motor/cilindrada, cilindros, válvulas, combustível, Euro 3/5/6 ou equivalente, injeção Bosch/Delphi/outra`. Reutilizar o resultado em família técnica por cache, sem nova investigação extensa por SKU. Confrontar OEM/código fabricante/descrição e composição do produto específico; **um catálogo que cruza juntas prova aplicação da junta e família motriz, não certifica automaticamente um motor montado de outro fornecedor**. Se fontes convergirem: sugerir ambas aplicações e a faixa temporal **atribuída ao catálogo**, sem chamar ano final de fim de fabricação; divergência: `a_confirmar` na versão conflitante. Se não houver foto, cadastrar rascunho e registrar `foto_pendente`; publicação mantém aprovação humana/Policy Engine. Prazo operacional visado 15s por SKU, ainda dependente de executor/testes.

## Fontes rápidas para triangulação de JUNTAS — procurar antes de pesquisar montadoras
Para encontrar ano/modelo/geração, motor, cilindros, válvulas e aplicações em poucos segundos, pesquisar por **motor + veículo BR + jogo de juntas/vedação** usando estas fontes reais de fabricante. Os catálogos são fontes de **aplicação da junta**, não homologam automaticamente o conjunto parcial de outro fabricante nem são prova do fim de fabricação do carro:
- **Ajusa (fabricante):** https://ajusa.online/br/catalogo — pesquisa por veículo, motor, chassi, referência original; jogos de juntas, juntas de cabeçote e parafusos.
- **SABÓ (fabricante):** https://www.sabo.com.br/downloads/ e https://www.sabo.com.br/institucional/catalogos-da-sabo-facilitando-o-acesso-e-a-busca-por-pecas/ — catálogos de juntas, retentores e jogos; verificar código e aplicação.
- **Taranto (fabricante):** https://www.taranto.com.br/ e https://taranto.specparts.shop/products?categories%5B%5D=SISTEMA+DE+MOTOR — juntas e jogos, aplicação por referência e motorização.
- **Vedamec:** para a família Hyundai HR/Kia Bongo D4CB há referências no catálogo Hyundai 2023 do fabricante; consultar a aplicação exata por componente: https://www.vedamec.com.br/files/catalog/HYUNDAI-2023.pdf .
- **"Eurog":** nome citado pelo lojista, **a confirmar grafia e fabricante**; não inventar catálogo, site, OEM ou equivalência. Não substituir por Elring/Euro G sem documento. Quando for confirmada, adicionar a fonte oficial.

**Consulta-padrão de 15 segundos (meta de implementação):** `"D4CB" "jogo de juntas" HR Bongo 16V Euro V site:ajusa.online`, variantes SABÓ/Taranto/Vedamec pelo código; em paralelo um catálogo de filtros e uma ficha da peça exata. Guardar de cada resultado o **código da junta**, modelo/ano inicial/final **de aplicação do catálogo**, código motor, cilindrada, 4/6 cilindros, 8V/16V, tipo diesel/gasolina/flex, injeção Bosch/Delphi e norma Euro, se documentadas. Ausência de campo = `não confirmado`. O agente deve usar o Firecrawl interno quando disponível, respeitando contrato, quotas e prazo global; caso contrário registrar ausência de provedor. Poucas fontes convergentes bastam para **candidatura técnica** e cadastro em rascunho; homologação/publicação seguem o porteiro vigente.

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
