# MOBIS / Conecta.IA — REGRA MESTRE DO CATÁLOGO ENRIQUECIDO
Data: 19/11/2026. Escopo: todos os SKUs e todas as famílias técnicas da loja MOBIS. Esta regra prevalece sobre normas anteriores que tratem a ausência de foto/preço como impedimento de toda visibilidade; os requisitos de **oferta comercial** e a política de aprovação continuam distintos.

## Decisão do lojista (obrigatória para todos os agentes)
**Um produto físico real do Bling pode ter uma página pública de CATÁLOGO ENRIQUECIDO / INFORMATIVO SEM FOTO e SEM PREÇO.** O agente completa o máximo possível da ficha técnica documentada; se não achar imagem confiável e licenciada, registra `foto_pendente`. O proprietário fornece/adiciona preço de venda e imagem posteriormente, quando desejar transformar a ficha em oferta comercial. Não utilizar custo como preço, nunca zerar/sobrescrever o preço do Bling. Não duplicar estoque.

Dois estados de exposição pública distintos, gerenciados por porta específica e por loja:
1. **`catalogo_informativo`** (página consultiva, sem venda): SKU, marca, nome seguro, ficha técnica comprovada e fontes. **`preco_publico=null`, `estoque_publico=null`, `oferta_comercial=false`, `botao_comprar=false`**. Fotos opcionais; se ausentes, usar ícone/placeholder neutro e o texto `Imagem em atualização`. Não exibir preço do Bling só porque está cadastrado no ERP. O contato/WhatsApp serve apenas para esclarecer dados, sem criar pedido implícito. Não gerar `Product.offers`, anúncios de shopping/merchant feed ou disponibilidade. Não anunciar aplicações veiculares pendentes.
2. **`oferta_comercial`**: preço de venda **liberado explicitamente pelo lojista**, imagem aprovada quando houver, produto e aplicações homologados, políticas e portão `publicar_produto` cumpridos, venda habilitada somente se o ambiente permitir. Foto pode continuar ausente na MOBIS sem impedir oferta **após** as demais aprovações, mas o estado informativo não vira oferta por si só.

O cadastro informativo **não se confunde com o campo `produtos.publicado`**. A função de publicação comercial do banco exige preço e outros dados; não remover essas travas para criar o novo canal. Preferir estado/visibilidade informativa separado, com ativação por produto e por loja, auditoria e aprovação autorizada. O agente pode sugerir entrada informativa; quem decide exposição pública de ficha ou oferta é o lojista ou um fluxo de aprovação explicitamente autorizado.

## Comportamento do agente / porteiro
1. Receber SKU ou descrição; localizar **produto físico preexistente** no Bling e no Conecta.IA.
2. Enriquecer nome, marca, códigos de fabricante, OEM separados por tipo, ficha e versões brasileiras por triangulação rápida: juntas Ajusa/SABÓ/Taranto/Vedamec, filtros e peça-chave; cache por família. Valores sem prova ficam pendentes e **não** aparecem como fatos públicos.
3. Imagem pelo `conecta.imagem.buscar_web` (preferência MOBIS Firecrawl) e `conecta.imagem.propor` para candidata válida; se não houver, continuar e marcar `foto_pendente`. API de busca não está diretamente exposta ao MCP externo; não inventar chamada.
4. Entregar ficha informativa com campos públicos comprovados, produto único, status `aguarda_liberacao_informativa` ou `catalogo_informativo_ativo` só após verificar a gravação/autorização. Aplicação `a_confirmar` não gera página veicular nem filtros por veículo; mostrar apenas dados técnicos da peça comprovados sem prometer encaixe.
5. **Nunca usar `produto_automacao.pausado` como permissão de escrita:** se pausado, pesquisar e entregar proposta fora do cadastro. A publicação informativa previamente autorizada pode continuar visível mesmo com automação pausada; a pausa impede trabalho do agente, não reescreve decisão humana de exposição.
6. O lojista, posteriormente, pode adicionar preço público e fotografia, aprovar ou corrigir aplicações e solicitar promoção para oferta comercial, sem alterar o SKU/estoque e sem publicar automaticamente após um único preenchimento.

## UX pública e SEO
- Cartão: título seguro, SKU, marca, informações técnicas documentadas, `Catálogo informativo · sem preço`, ícone de categoria neutro se não houver imagem, `Dados e aplicações sujeitos a confirmação` quando houver informações limitadas; botão `Ver ficha técnica`, sem `Comprar` ou promessa de estoque.
- Ficha: metadados `noindex` até a política de indexação ser aprovada; campos pendentes não aparecem como compatibilidades válidas.
- JSON-LD informativo não pode conter `offers` nem `price` nem `availability`; não entrar em Google Merchant Center, campanha Shopping ou feed de produtos comercializáveis.
- Dados que permanecem **internos**: preço do Bling (até autorização de exibição), custo, margem, fornecedores, documentos fiscais e saldo real. **Sem preço público não significa preço zero.**

## Situação concreta CI003696 — estado confirmado em leitura em 19/11/2026
- O Bling guarda preço de venda R$ 18.900,00 **interno**, sem imagem. Conecta.IA tem `publicado=false`, `exibicao_teste=true`, `produto_automacao.pausado=true`, aplicações HR/Bongo `a_confirmar`.
- O backend `loja-publica` **já possui prévia informativa MOBIS** em ambiente `teste` por slug quando não há produtos publicados: usa `exibicao_teste=true` e zera apenas a **resposta pública** `preco/estoque`, sem alterar o Bling. A loja está em ambiente `teste`, com 0 publicados e 1 item em prévia, que é CI003696. Essa prévia **não é** a implementação permanente do estado informativo de produção. Não declarar publicada a oferta comercial.
- Para tornar a regra universal e duradoura, implementar fluxo de catálogo informativo separado do modo de teste, com permissão por item e revisão de UX/SEO/backend antes de deploy. Não ativar milhares de produtos antigos em massa apenas por estarem no espelho.

## Critérios de aceite (antes de dizer que está funcionando em produção)
- Exibir um produto CI003696 em modo informativo, preço e estoque ausentes no payload público mesmo quando existem no Bling; imagem ausente sem placeholder enganoso; sem checkout, sem oferta de SEO.
- Mesmo que a loja passe a ter produtos comerciais publicados, **as fichas informativas explicitamente ativadas continuam visíveis**, mas não se tornam vendas. Ambiente de produção também respeita o estado separado.
- Não exibir aplicação de Hyundai HR ou Kia Bongo enquanto `a_confirmar`; ainda é possível apresentar o motor identificado como D4CB tecnicamente.
- Uma foto encontrada sem direito comprovado não aparece no site; o lojista consegue adicionar a imagem e preço depois.
- Produto pausado continua sem escrita por agente e a ficha informativa existente não é apagada por isso.
- Não alterar outras lojas. Verificar SQL/RLS, leitura pública, testes de preço ausente e impedir Merchant feed; avaliar segurança antes de executar migração/deploy.
