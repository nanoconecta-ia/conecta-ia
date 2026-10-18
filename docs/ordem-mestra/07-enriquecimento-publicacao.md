# 7. Fluxo de enriquecimento e publicação

Os 16 passos da ordem, mapeados no que existe. Princípios: nunca inventar OEM, GTIN, compatibilidade, medida, estoque ou especificação; cada dado enriquecido guarda **fonte, data, confiança e responsável**; o lojista aprova.

| # | Passo da ordem | Estado hoje | Como (reuso) | Falta |
|---|---|---|---|---|
| 1 | Importar do Bling | ✅ | `bling-sync` → `produtos` | webhook (opcional) |
| 2 | Detectar campos ausentes | 🟡 | `ver_produto.faltando_para_publicar`; `perfis_ramo.campos_obrigatorios`; `checarCamposExigidos` | índice agregado |
| 3 | Categoria e atributos | 🟡 | `bling_categoria_taxonomia`, `agente/extrair.ts` (marca/veículo/motor do nome, confiança 0,4–0,7) | ampliar atributos |
| 4 | Pesquisar fontes confiáveis | 🟡 | `fontes`(16), plugins `api`, `buscar_imagem_web` | pesquisa textual (LLM+busca) |
| 5 | Validar fabricante e códigos | 🟡 | `fabricantes_peca`, `produto_codigos` com regras de banco (OEM/OES exige fornecimento documentado) | validação cruzada automática |
| 6 | Aplicações técnicas | 🟡 | `propor_aplicacao` → `produto_aplicacoes`; módulo automotivo | fonte técnica estruturada |
| 7 | Descrições | 🟡 | `propor_enriquecimento` (`descricao_curta/longa`) | gerador com evidência |
| 8 | Imagens licenciadas/fornecidas | 🟡 | `propor_imagem` + regras de origem/direitos (migração 9) | upload do lojista, registro de licença |
| 9 | Peso e dimensões só com evidência | ✅ | campos `peso_kg`, `dimensoes` em lista fechada; do Bling quando existe | — |
| 10 | Metadados SEO | 🔴 | — | `seo_propostas` (Fase 3) |
| 11 | Índice de qualidade | 🔴 | — | `calcular_qualidade_cadastro` (Fase 2) |
| 12 | Antes/depois | 🟡 | Fila mostra valor proposto | diff com valor atual do Bling/espelho |
| 13 | Aprovação | ✅ | `assistente` `decidir` (exige fonte+data), auditado | cartão no chat |
| 14 | Sincronizar campos autorizados | 🔴 (por decisão) | catálogo Bling com escrita `ativa:false` | Fase 2, campo a campo (doc 4) |
| 15 | Confirmar resultado | 🔴 | — | leitura após gravação |
| 16 | Preparar publicação | 🟡 | `publicar` com portão: produto só entra com campos obrigatórios; `publicado` nunca é ligado pelo sync | publicador SSR + invalidação de cache |

## Estados de um dado enriquecido
`a_confirmar → aprovado | rejeitado`; `aprovado → desatualizado` quando o `hash_origem` do Bling muda. Banco impede `aprovado` sem fonte e data (`check`).

## Portão de publicação (regra única)
Produto é publicado somente se: situação ativa no Bling · nome e SKU · preço > 0 · campos exigidos pelo perfil do ramo aprovados · imagem principal **aprovada** (real, ou ilustrativa rotulada) · aplicação/códigos só se aprovados. Produto indisponível: página permanece com status "indisponível" (`410` só se removido do ERP e sem substituto), nunca apagada sem redirecionamento.

## Imagens
Real × sintética sempre distinguidas por campo e rótulo; sintética nunca vira imagem principal sem aprovação; terceiros só como ilustrativa com origem guardada e retirada possível. Direito de uso **não é inferido** de busca web.

## Responsável
Cada linha registra quem propôs (`provedor`/agente) e, ao aprovar, o usuário (em `auditoria`). Falta coluna `aprovado_por` estruturada em `produto_enriquecimento` (incluir na migração da Fase 1/2).
