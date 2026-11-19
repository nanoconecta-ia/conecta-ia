# Conecta.IA — proposta de anexo de fotos e banners pelo plugin ChatGPT (19/11/2026)

## Objetivo e descrição para a página do plugin

**Proposta de descrição após homologação das novas ferramentas:**

> Conecta.IA — Mobis Autopeças: consulta produtos, códigos OEM e aplicações técnicas; permite anexar fotos reais de produtos e banners por veículo, preparar propostas de catálogo e marketing e submetê-las à aprovação do proprietário. O agente não publica nem altera estoque, notas ou dados fiscais sem autorização.

**Não anunciar essa descrição como capacidade já operacional.** No estado atual, o agente externo **consegue propor uma foto real por URL HTTPS** usando `conecta.imagem.propor`, mas **não** recebe arquivos anexados à conversa pelo MCP. A ferramenta `conecta.banners.gerenciar` ainda está **planejada**; o editor web de banners é um fluxo diferente do MCP.

## Matriz de capacidades

| Capacidade | Contrato / nome | Estado em 19/11/2026 |
|---|---|---|
| Propor imagem real do produto por URL HTTPS | `conecta.imagem.propor(sku,url,origem?,pagina?)` | **Ativa**, pendente de aprovação humana |
| Anexar foto real enviada pelo usuário à conversa | `conecta.midia.anexar_produto` | **Implementada na branch, em homologação**; upload privado e fila `a_confirmar`, sem implantação no servidor |
| Anexar banner a uma campanha/perfil de aplicação | `conecta.banner.anexar` | **Implementada na branch, em homologação**; banner por veículo exige página de aplicação aprovada; sem implantação no servidor |
| Preparar e gerir proposta comercial do banner por agente | `conecta.banners.gerenciar` | **Planejada**, sem geração de imagem implantada |
| Editar rascunho de banner pelo painel da loja | `painel/src/paginas/Banners.tsx` | Existe na interface, **não equivale** a ferramenta MCP |

## Fluxo proposto — fotografia real da peça

1. O agente recebe seleção de foto em ChatGPT ou URL HTTPS; identifica o SKU físico existente, sem criar um novo produto por veículo.
2. Para arquivo nativo, a ferramenta MCP declara `_meta["openai/fileParams"]` e um campo de topo `file` com as quatro propriedades `download_url`, `file_id`, `mime_type`, `file_name`; apenas as duas primeiras são obrigatórias no objeto. A integração deve reconhecer arquivos já autorizados para aquele plugin. Ver referência oficial: https://developers.openai.com/plugins/reference#file-apis
3. O backend baixa a mídia por link efêmero aprovado do host, validando tamanho máximo, tipo real JPEG/PNG/WebP, dimensões, MIME, redirecionamentos, domínio, SSRF e hash SHA-256. Jamais receber token no texto da conversa ou confiar apenas na extensão.
4. Guardar original em armazenamento privado escopado por loja; gerar prévia derivada (fundo branco opcional, **sem alterar identidade física da peça**) e metadados: `loja_id`, `sku`, `produto_id`, `hash`, `origem`, `licenca`, `autor`, `status`.
5. Apresentar comparação de imagens e identificação da peça, SKU/marca/composição, possíveis duplicatas e direitos de uso. Estado inicial `a_confirmar`, nunca `aprovada`.
6. Depois da decisão explícita do proprietário, associar a imagem à ficha no Conecta.IA; alteração no Bling, quando permitida, requer fluxo separado e conferência posterior. Nenhum ajuste fiscal/estoque/custo.

**Nome proposto:** `conecta.midia.anexar_produto`. Entradas: `sku`, `file` (ou `url`, mutuamente exclusivos), `origem`, `direitos`, `papel` (`principal` ou `galeria`). Saída: `proposta_id`, `imagem_id`, `status: a_confirmar`, `verificacao`. A ferramenta foi implementada no código da branch e é exposta no `tools/list` apenas **após implantação** e se o cliente tiver `mcp:propor`. A migração SQL e os testes de integração com o ChatGPT precisam ser homologados antes da ativação em produção.

## Fluxo proposto — banner comercial

1. Usuário ou agente anexa/banneriza uma **arte comercial** via arquivo nativo ou URL, já com direito de uso; banner pode ser sintético e deverá carregar `sintetica: true` no registro, sem se passar por foto verdadeira da peça.
2. Dados: `sku` físico único; `tipo` (institucional, oferta, campanha); `veiculo` e `aplicacao_id`/slug da aplicação **aprovada**; `titulo`, `cta`, `destino`, `periodo`, `asset_id`, `origem` e `direitos`.
3. Um **banner próprio para Hyundai HR** e outro **para Kia Bongo K2500**, quando ambos comprovadamente aplicáveis, cada qual com link para sua página de veículo; os dois utilizam o mesmo SKU CI003696 e o mesmo estoque físico. Se a aplicação ainda estiver pendente, manter como prévia institucional sem afirmar compatibilidade.
4. Guardar em rascunho, fornecer prévia responsiva, verificar tipografia/logomarca/imagem/licença e registrar aprovação humana separada para cada mídia e cada destino.
5. Nunca publicar banner, preço/oferta, anúncio ou mídia no Bling/Instagram/Facebook sem autorização específica e ferramenta de execução homologada. Os banners **não** devem criar registros duplicados de produto.

**Nome proposto:** `conecta.banner.anexar`. Entradas: `sku`, `file` ou `url`, `tipo`, `aplicacao_id`/slug, `texto`, `destino`, `sintetica`, `origem`, `direitos`. Saída: `proposta_id`, `banner_id`, `status: rascunho`, `previa`. Permissão `mcp:propor` não equivale a aprovar ou publicar. O código registra mídia privada como `a_confirmar`; **a tela de decisão de mídia ainda não foi implementada** e não há transferência automática para o editor de banners.

## Homologação antes de habilitar no plugin

- Anexar foto real JPEG/PNG/WebP a um SKU, conservando arquivo e hash; recusar outro formato, arquivo grande, link interno, URL maliciosa e imagem suspeita.
- Confirmar que o arquivo anexado **na conversa do ChatGPT** é realmente encaminhado à ferramenta por `openai/fileParams`; validar em Android e navegador.
- Impedir imagem de peça diferente, peça só semelhante, categoria errada ou sem prova de uso; separar original de arte sintética.
- Um motor CI003696, duas páginas por aplicação aprovada e dois banners independentes, sem duplicar estoque.
- Validar direitos, licença, URL de destino e revisão humano/versão; revogar, rejeitar e auditar cada ação.
- Conferir `tools/list` do MCP após implantação, com estados corretos. Atualizar descrição **na configuração do plugin ChatGPT** somente após o teste real, porque o manifesto deste repositório não modifica automaticamente a ficha de instalação no ChatGPT.
- Erro de instalação OAuth do ChatGPT é uma pendência **independente** desta ampliação de funções; não afirmar que foi resolvido.

## Segurança e fronteiras

Somente `mcp:leitura` e `mcp:propor` para agentes externos; nenhum poder para emitir NF, alterar dados fiscais, estoque, custo, excluir produtos, aprovar suas próprias propostas ou publicar automaticamente. A chave da loja e as credenciais de serviço permanecem exclusivamente no servidor, com isolamento por `loja_id`, auditoria e revogação.

## Implementação na PR #471

- `supabase/functions/_shared/conector/midias_mcp.ts`: valida arquivo vindo do host (HTTPS, MIME real, limite de 8 MB, dimensão e SHA-256), escopa ao SKU/loja e armazena em `agente-anexos`, bucket privado. Não persiste URL temporária do ChatGPT.
- `supabase/functions/_shared/conector/registro.ts` e `gateway.ts`: definem duas ferramentas com esquema de arquivo e `_meta['openai/fileParams']=['file']`, visíveis somente para `mcp:propor`.
- `supabase/functions/_shared/conector/despacho.ts`: omite URL temporária e file_id da auditoria.
- `supabase/migrations/20261119000020_mcp_midia_pendente_privada.sql`: fila da loja com leitura do proprietário e escrita do serviço, sem publicação.
- `supabase/functions/_shared/conector/midias_mcp.test.ts`: testes de isolamento, aplicação aprovada, armazenamento privado e limpeza em erro.
- **Implantação não feita.** O fluxo de revisão e aprovação visual ainda precisa ser desenvolvido e testado. Nunca marcar uma mídia `aprovada` sem decisão humana verificável.
