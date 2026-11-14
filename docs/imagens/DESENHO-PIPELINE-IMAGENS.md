# Desenho: pipeline de imagens e "nós" do produto (PROPOSTA)

**Status: proposta para aprovação do dono. Nada foi implementado, gravado, migrado ou publicado.**
Origem: pedido do lojista em 14/11/2026 (chat com foto do produto, ligada ao Bling, à taxonomia, à loja e ao Google Drive; busca na web com padronização de tamanho).

## 1. O que existe hoje (lido no repositório)
- `produto_imagens`: já exige `aprovada`, marca `real`/sintética e, para imagem não real, um **cruzamento** (código que liga a foto à peça). `propor_imagem` aceita **um link https**, nasce `aprovada = false` (docs/AGENTE_PROPOE_E_IMAGENS.md).
- `buscar_imagem_web`: só para o agente integrado, por chave Google Programmable Search **da loja** (BYOK). Não grava nada.
- O Bling guarda imagens por URL (campo de mídia do produto); o produto da demonstração (099SHP190H) tem **zero** imagens.
- Faltam: baixar o arquivo, padronizar, guardar o original, várias fotos por produto, e o vínculo explícito de cada foto com seus destinos.

## 2. Nós (cada imagem aponta para os lugares onde pode ser usada)
| Nó | O que liga | Regra |
|---|---|---|
| Produto (SKU do Bling) | a foto pertence a **um produto físico** | nunca duplicar produto no Bling por foto |
| Papel da foto | principal · miniatura 1–4 · detalhe · embalagem | principal = 1 por produto |
| Taxonomia | sistema › conjunto › subconjunto › componente | a foto só ilustra; não prova aplicação |
| Aplicação | só se a foto mostrar o veículo | por padrão, **sem** vínculo |
| Destino: chat/Conecta | miniatura 96 px | automático após aprovada |
| Destino: loja | 600 px (lista) e 1200 px (produto) | só se aprovada **e** produto publicado |
| Destino: Bling | URL da imagem | **só com autorização expressa, por produto** (hoje desligado) |
| Arquivo no Google Drive | original e derivados | pasta por loja; ver §5 |

## 3. Fluxo proposto (o agente nunca aprova)
1. **Buscar** (web, texto + código do fabricante) → candidatas com URL, página de origem e data.
2. **Triagem**: descarta imagem cujo nome/legenda cite **outro código**, resolução baixa (< 800 px no menor lado), marca d'água ou miniatura de anúncio.
3. **Baixar** só de fonte permitida (§4), guardar o **original intacto**.
4. **Padronizar** (derivados): ver §6.
5. **Cruzar**: registrar o código que liga a foto à peça e a fonte.
6. **Propor** com status por campo: `a_confirmar`. A foto aparece no cartão de proposta (chat) em tamanho pequeno.
7. **Lojista aprova** (por foto). Só então os destinos (§2) são liberados, cada um com sua própria autorização.

## 4. Direitos e fonte
- Preferir: foto do próprio lojista (enviada pelo chat), catálogo/site oficial do fabricante, foto de fornecedor com autorização.
- Foto de anúncio de terceiro: **somente referência interna**; não vai para a loja nem para o Bling.
- Cada imagem guarda: URL de origem, página, data, tipo de direito (`proprio`, `fabricante`, `autorizado`, `referencia`) e quem aprovou.
- Sites que bloqueiam acesso automático (robots) **não** são contornados.

## 5. Google Drive
- Uso proposto: guardar **originais e derivados** + planilha de rastreio (SKU, fonte, direito, aprovação). Pasta por loja, acesso do conector do lojista.
- Decisão em aberto: o Drive é a **fonte** ou só **cópia de segurança**? Recomendação: cópia + rastreio; o banco continua sendo a fonte da verdade.

## 6. Padrão de tamanho (proposta, ajustável)
- Quadrado 1:1, fundo neutro, **sem esticar** (encaixa com margem; nunca recorta a peça).
- Mestre 1600×1600 WebP (qualidade ~82) + JPEG de reserva; loja 1200 e 600; chat 160 e 96.
- **Atenção (14/11):** o repositório já define variantes em `supabase/functions/_shared/imagens/variantes.ts` (site_lista 400, site_detalhe 1200, merchant 800 JPG fundo branco, og 1200×630) e regras de direitos em `regras.ts`. Esses valores vigentes prevalecem; o mestre de 1600 acima é só proposta a decidir. Falta o processador real de pixels (hoje só há um simulado) e o envio de várias fotos por produto com função de cada foto.
- Rejeitar se o menor lado < 800 px. Mostrar o motivo na proposta.
- Sem edição que mude a peça (cor, texto, logotipo). Só enquadramento, fundo e compressão.

## 7. Ferramentas que o agente precisaria (hoje não existem)
1. `buscar_imagem_web` no gateway (hoje só no agente integrado).
2. `baixar_e_preparar_imagem` (servidor): baixa, valida tipo/tamanho, gera derivados, calcula hash.
3. `propor_imagem` com **papel** (principal/miniatura), direito, fonte e cruzamento; várias por produto.
4. `propor_taxonomia` (caminho completo) e status por campo (`confirmado/ausente/não consultado/divergente`).
5. Canal do chat (ler/responder no Nano) — separado, ver design do painel.
Cada uma entra desligada, com teste de simulação, política de aprovação e auditoria.

## 8. Riscos
- Foto de outra peça (nome do arquivo ≠ código) → triagem §3.2 e aprovação humana.
- Direitos de imagem → §4. Custo de busca (Google CSE grátis só 100/dia) → limite por loja.
- Armazenamento e custo no plano gratuito do Supabase → derivados pequenos; originais no Drive.
- Vazar URL/segredo em log → nunca registrar chaves.

## 9. Decisões que preciso do dono
1. Drive = cópia + rastreio (recomendado) ou fonte?
2. Padrão de tamanho do §6 serve?
3. Foto de anúncio de terceiro: só referência interna (recomendado)?
4. Gravar imagem no Bling: manter desligado (recomendado) até teste com mock.
5. Posso criar as migrações e ferramentas do §7 em PR rascunho, uma por vez?
