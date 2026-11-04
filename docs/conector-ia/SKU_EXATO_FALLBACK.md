# Identidade do produto na recuperação sem IA

Correção de 04/11/2026 sobre a branch do PR #287. Escopo: C (reconhecimento), B (ficha estrita) e D (erros distintos).

Quando o provedor falhava, o painel escolhia a última referência textual e cortava SKUs com vários hífens. O pedido com SKU ENG-1645-05 e aplicação HR/K2500 podia consultar outro produto.

## Comportamento

- Um SKU explícito (ou /ficha, /revisar) prevalece sobre códigos de aplicação. O token inteiro é preservado, incluindo hífens.
- Mais de um SKU explícito, ou vários códigos sem alvo explícito, bloqueiam a recuperação automática. O usuário recebe orientação para informar um único SKU.
- O histórico usado para recuperação contém apenas mensagens do usuário; respostas do modelo não escolhem a identidade.
- chat_ficha_produto é uma consulta de SKU exato, com comparação literal, inclusive caixa. Referência de fabricante/GTIN continua disponível na ferramenta de busca geral bling_consultar_produto.
- A filtragem acontece antes de gerar evidência, resumo, hash e auditoria da ficha. Os candidatos aproximados não são devolvidos à tela.
- Sem candidato exato e com API completa: 404, categoria sku_nao_encontrado. Isso não comprova ausência universal no ERP.
- Sem identidade confirmada e com API incompleta: 503, categoria ferramenta. Nunca anuncia inexistência por falha de conexão.
- Mais de uma identidade com o mesmo SKU, ou busca truncada: 409, identidade_ambigua, sem ficha substituta.
- Categoria, origem e request_id sobrevivem às exceções de HTTP e streaming. Replays de turnos falhos com HTTP 200 continuam sendo reconhecidos pelo http_status registrado.
- Apenas falhas do provedor acionam a recuperação; erros de ferramenta/produto não disparam outra tentativa automática. Mensagens distintas para IA indisponível, erro de ferramenta e SKU não encontrado. Servidores anteriores sem categoria mantêm compatibilidade textual.

## Validação executada

- Painel: 385 testes aprovados; build TypeScript/Vite aprovado.
- Funções: 775 aprovados, 116 pulados por dependerem de banco local; nenhuma falha.
- Artefato autocontido: 24 testes aprovados, incluindo 429 → ENG-1645-05 → somente ficha exata, SKU inexistente, falha de auditoria e consulta incompleta.
- TypeScript das funções aprovado; artefato regenerado. Guardas de publicação: 5 testes aprovados.
- Testes usam provedor, ERP e credenciais sintéticos. Nenhum cadastro real foi lido ou alterado nesta implementação.

## Dependência e limites

Este trabalho depende do diagnóstico estruturado do PR #287 e deve ser retargetado para main depois da integração desse PR. Não houve merge nem deploy nesta execução.

O contexto estruturado de tarefa com SKU e bling_id (A), e seu registro por tarefa (E), continuam pendentes. Esta correção reduz o risco da recuperação; não implementa bloqueio de identidade em todo o fluxo de enriquecimento por LLM.

Para ativar: integrar os PRs revisados e publicar assistente e painel, com autorização do proprietário. Não exige migração de banco, mudança de credencial ou escrita no Bling.
