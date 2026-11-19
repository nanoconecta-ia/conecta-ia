# MOBIS — Cadastro no site sem foto, busca de imagens e conclusão posterior pelo lojista
**Data:** 2026-11-19. **Escopo:** todos os modelos/veículos, peças e SKUs da loja `mobis`; não só o CI003696.
**Status:** norma na PR #461 e correção de triagem do agente proposta nesta PR; publicação e execução de catálogo em lote dependem de integração e homologação. Não é autorização para ignorar outras travas do cadastro.

## Objetivo do lojista — fotografia não pode paralisar o catálogo
O sistema precisa aceitar todo produto **físico já identificado no Bling** no catálogo interno da loja, mesmo quando não houver fotografia, e gerar seu rascunho técnico/comercial. O agente deve procurar fotos reais; se não as localizar com precisão/direitos, **seguir com o restante do cadastro** e sinalizar `foto_pendente`. O lojista acrescenta a foto real depois, com rastreabilidade. Isso se aplica a motores, cabeçotes, filtros, correias, suspensão, transmissão, elétrica e a todos os modelos (HR, Bongo, L200, Pajero, Sprinter, Daily, Gol etc.), desde que sejam produtos reais autorizados da loja.

**Dois portões independentes:**
1. **Cadastro interno / rascunho da vitrine:** pode ser criado ou enriquecido SEM foto e SEM OEM homologado; campos sem evidência ficam `a_confirmar`; rascunhos são privados/não indexáveis, não são anúncios públicos e não são clones no Bling.
2. **Exposição pública:** para a loja MOBIS a ausência de foto NÃO é requisito bloqueante, como já configurado na função `publicar_produto` do banco em 17/11/2026 (registrado em `docs/conector-ia/mobis-foto-opcional-publicacao-20261117.sql`). Os **outros requisitos** seguem obrigatórios (identidade, preço de venda, categoria técnica aprovada, marca/código fabricante e bula exigida). Se a página disser que serve em veículo, essa aplicação precisa estar homologada. Publicar apenas após aprovação humana e políticas do canal. A exceção de foto é só da MOBIS; outras lojas preservam a própria regra.

## Ferramenta oficial: Firecrawl pelo próprio Conecta.IA
Para TODOS os SKUs da MOBIS, ler **[roteiro do porteiro para a busca de imagem existente com Firecrawl, ferramentas e MCP](porteiro-ferramentas-firecrawl-imagens-20261119.md)** antes de buscar imagem. Priorizar `conecta.imagem.buscar_web({consulta,sku})` no chat Nano.IA; também existem `buscar_imagem_web` (legado) e `nanogpt-midia` (`acao=buscar`). Propor candidatas através de `conecta.imagem.propor`, sempre em revisão. Firecrawl ativo na configuração não significa chamada comprovada; a busca do MCP externo ainda não está exposta e exige ponte autenticada. Não inventar resposta, não cobrar outra API e não deixar que foto ausente interrompa o cadastro.

## Pesquisa de fotografia — sequenciamento e confiança
1. **Primeiro: imagens já vinculadas** ao mesmo SKU/ID no Bling e no Conecta.IA, armazenamento da loja, fotos da etiqueta/embalagem enviadas pelo lojista. Não misturar `CI003696` com `CI003000` ou itens de composição distinta.
2. **Depois: catálogo oficial do fabricante da peça** identificado na ficha/etiqueta, site de importador autorizado, ficha técnica ou biblioteca de produtos do distribuidor, com correspondência EXATA de `SKU/código de fabricante + marca + conjunto físico`. Quando houver GTIN, conferir no GS1 Brasil; imagem exibida na GS1 não concede licença automaticamente.
3. **Em seguida: EPC/PartSouq e ficha de montadora** para reconhecer forma, conjunto e posição, sem confundir ilustração explodida com foto comercial e sem reproduzir imagens protegidas sem direitos.
4. **Por último: Google Imagens, B2B/e-commerce, Mercado Livre e Shopee** como pistas para localizar a fonte original. Anúncio de terceiro não demonstra autenticidade, equivalência física nem direito de copiar foto.
5. Verificar **mesmo item e composição**, resolução, fundo claro quando possível, marca, código, URL de origem, licença/direitos, data e `loja_id+produto_id`. Não gerar/renderizar peça imaginária fingindo ser a mercadoria real; banner institucional ou ícone da categoria não pode ser chamado de foto do produto.
6. **Meta global de 15 segundos por SKU:** integrar a busca de imagem ao orçamento das outras pesquisas sem reiniciar cronômetro. Prazo esgotado ou fontes indisponíveis = `foto_pendente`, não erro geral, e devolver os demais resultados. A meta é requisito de implementação e precisa de teste de tempo real no executor; não prometer 15 segundos de catálogo completo sem isso.

## Sem foto: comportamento da vitrine e da fila
- Exibir **placeholder neutro** no lugar de fotografia, com a informação `Imagem em atualização` ou `Foto disponível em breve`, sem mostrar outra peça como se fosse a certa. Não tentar carregar URL ausente ou imagem pendente.
- Manter no cadastro técnico a marca, descrição, NCM original do ERP, peso/medidas **quando fornecidos**, categoria, aplicação homologada, preço vigente e estoque **proveniente do Bling**, sujeito ao portão já existente. Nunca divulgar custos internos, fornecedor privado ou NF completa.
- Indexação: somente páginas aprovadas e publicadas; SEO sem foto pode incluir título, descrição, URL canônica e aplicações aprovadas. Se `Product.image` não existir, omitir o atributo, NÃO inventar imagem nem usar arte ilustrativa como produto real.
- Fila de enriquecimento: registrar `foto_pendente` / `sem_fonte_visual` como **estado de fluxo proposto** (não presumir coluna SQL já existente). Permitir ao lojista selecionar o SKU, anexar foto posteriormente, informar autoria/direitos e aprovar. A foto deve aparecer no mesmo SKU/ofertas do produto, sem criar estoque ou novas aplicações.
- O agente pode criar rascunhos por lote, mas não pode destravar `produto_automacao.pausado`, aprovar evidências em nome do lojista, publicar por conta própria, emitir NF ou alterar preços/campos fiscais.

## Fluxo técnico mínimo por SKU
`leitura Bling → normalizar SKU/NCM/descrição/GTIN → árvore brasileiro por veículo (se aplicável) → busca OEM/fabricante e foto com prazo global → criar/atualizar RASCUNHO existente no Conecta.IA → apresentar revisão de identidade/aplicações/SEO/logística + foto_pendente → aprovação humana e portão de publicação → página visível (com foto ou placeholder) → preenchimento posterior da foto pelo lojista`.

**Não alterar o cadastro de origem**: uma peça física, um SKU e um saldo Bling; múltiplas páginas por veículos quando aplicações aprovadas. Documentar antes/depois e fonte de cada campo. Para imagens reprovadas, manter placeholder e registrar motivo.

## Diagnóstico de implementação em 19/11/2026
- Confirmado por consulta somente leitura ao banco: `publicar_produto(uuid,boolean,uuid)` contém a exceção de imagem opcional **apenas se `lojas.slug='mobis'`**. A interface `painel/src/paginas/Loja.tsx` já apresenta `Sem foto` se `p.imagem` estiver vazio. A API e a vitrine não exigem foto para consultar item publicado.
- Esta PR corrige `supabase/functions/_shared/agente/plano.ts` e `supabase/functions/agente/index.ts`: a **triagem** de campos na receita, para produtos pertencentes à loja MOBIS confirmada no banco, deixa de marcar imagem ausente como bloqueio e retorna `foto_pendente` independente de outros campos. O banco continua sendo autoridade de publicação.
- **Não foi implantado** aqui o mecanismo automático de criação de todos os rascunhos no site, busca automática completa de imagens, relógio global de 15s, nova coluna de pendência ou novos endpoints. Esta PR não é uma declaração de que eles estão funcionando.
- O CI003696 permanece `produto_automacao.pausado=true`, `publicado=false`; nenhum código OEM/aplicação/foto foi automaticamente homologado.

## Testes de aceite da implementação completa
- Repetir com motor HR, filtro Bongo, bandeja L200 e peça Sprinter: foto ausente não bloqueia rascunho técnico; todos preservam SKU e saldo sem clones.
- Para MOBIS com todas as outras exigências satisfeitas, publicação sem foto é permitida após aprovação humana; um outro tenant com foto obrigatória continua bloqueado sem foto.
- Sem marca/código fabricante, categoria aprovada, bula ou prova da aplicação anunciada: **não** publicar apenas porque a foto é opcional.
- Busca encontra foto **de item similar**: marcar candidata/rejeitada e não publicá-la como foto real; sem resultado usa placeholder.
- Ao anexar foto depois: atualizar somente o mesmo produto, preservar URL/SEO/aplicações, exigir licença e associação com SKU.
- Lote com dezenas de SKUs: nenhuma foto ausente interrompe os demais; limite de 15 segundos é **por SKU** (com orçamento global por loja), tempo e retornos parciais auditáveis.
