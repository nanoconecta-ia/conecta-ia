# Busca de imagens reais — implementação Nano IA (proposta)

Integrar ao PR #242 e ao catálogo existente. **Documento de requisitos; nenhuma função foi implantada.**

## Contrato
Entrada: produto real do Bling em leitura, SKU, código fabricante, OEM, GTIN, marca, aplicação, descrição. Nunca expor custos e fornecedor privado na consulta pública.
Saída: até 8 candidatos com URL de origem, URL da imagem, título, resolução, data, fabricante, código conferido, licença/permissão, evidência e status (aprovável/pendente/rejeitada).

## Implementação incremental
1. Adaptador SearXNG configurável por ambiente, com `/search?q=...&categories=images&format=json` em instância própria com JSON habilitado. Timeouts, cache, limites de taxa e retorno seguro para 403/429/5xx. Não depender de instâncias públicas.
2. Priorizar domínios oficiais e B2B autorizados; usar Crawl4AI para páginas públicas permitidas, extrair códigos e metadados das imagens; respeitar termos, licenças e limites de acesso.
3. Conferir identidade da peça por código escrito na fonte e por aplicação documentada; sem prova, não aprovar. OEM/GTIN não garantem equivalência de todas as peças.
4. Deduplicar por URL/hash perceptual, verificar dimensões, integridade, correspondência com marca e uso autorizado. Não remover marca d'água nem inventar detalhes por IA.
5. UI existente do Nano: galeria com 8 candidatos, miniatura, original e tratado lado a lado, origem, confiança e botão de selecionar; aprovação humana explícita. Imagens tratadas em fundo branco sem alteração de geometria.
6. Reutilizar armazenamento e fila existentes; não criar segundo catálogo nem gravar imagens no Bling sem autorização específica.

## Aceite
- Buscar produto real e apresentar até oito candidatos distintos com URLs e fontes verificáveis.
- Resultado errado ou código não comprovado fica pendente/rejeitado.
- Sem licença de publicação, não usar na loja.
- Falha de motor de busca não derruba chat.
- Nenhum dado sigiloso enviado a provedor público.
- Testes com CI000016 e outros produtos reais apenas em leitura; logs redigidos e evidência reproduzível.
- PR não será mesclado nem publicado sem revisão.
