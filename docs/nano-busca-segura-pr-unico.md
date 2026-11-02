# Nano IA — especificação unificada de busca e enriquecimento (para implementação Claude Code)

Status: **proposta de arquitetura, NÃO implementada**. PR documental; não alterar deploy, ERP ou credenciais.

## Objetivo
Enriquecer catálogo e atendimento automotivo usando IA como geradora de hipóteses e verificadores determinísticos para validar evidências. Aproveitar serviços, taxonomia, fila e UI existentes; evitar segundo assistente e duplicidade de endpoints.

## Pipeline obrigatório
1. Entrada: consulta em linguagem natural, código SKU/OEM/GTIN, imagem ou XML autorizado. Normalizar grafia, fabricante, modelo, motor, anos e dimensões sem apagar texto original.
2. Resolver entidades separadamente: montadora, veículo, geração, motorização, ano, fabricante da peça, importador, marca comercial, SKU Bling, OEM e GTIN.
3. IA sugere candidatos e sinônimos (4D56/D4BH/D4BB apenas como termos candidatos, jamais equivalências universais).
4. Buscar fontes com orçamento, timeout, cache, rate limit, rastreio e deduplicação. Prioridade: fabricante e catálogo técnico oficial > distribuidor B2B autorizado > documentação técnica > marketplaces (descoberta somente). Pesquisa via provedor intercambiável Google Programmable Search ou SearXNG; sem scraping que viole acesso, robots ou termos.
5. Evidência estruturada: URL, título, editor/fabricante, data de coleta, trecho verificável, código exato e contexto da aplicação, hash, licença/permissão de imagem e grau de confiança. Ausência de prova = campo pendente.
6. Validador de código verifica identidade, especificações e aplicação independentemente. OEM/GTIN iguais não bastam para equivalência mecânica; exige catálogo de aplicação e características técnicas compatíveis. Conflitos são exibidos, não resolvidos por palpite.
7. Produzir ficha com campos propostos, campos confirmados, divergências, fontes e pendências; nenhuma escrita automática no Bling, alteração fiscal, publicação ou envio externo.
8. Aprovação humana por versão/hash e auditoria; revalidar identidade do produto antes de qualquer escrita futura autorizada.

## Regras automotivas
- 'HR 2008' identifica ano/modelo candidato, nunca motor confirmado; perguntar 8V/16V, código do motor, chassi ou peça quando necessário. Não generalizar D4BH = 4D56 para todas as peças.
- '1 pique / 2 piques' são marcações físicas cuja função varia por fabricante e junta; espessura só com tabela técnica específica, nunca por inferência.
- Referências Jusa, Sabó, Ecoparts e concorrentes são cruzamentos candidatos até comprovação; registrar direção e tipo da relação (substitui, equivalente, semelhante, incompatível).
- Medidas, material (metal/fibra), tolerâncias, versões, anos e veículos só são preenchidos com evidência verificável. SKU interno não substitui código do fabricante.
- Não misturar fornecedor/importador, fabricante real e montadora; preservar procedência e vínculo com nota sem modificar NCM/CFOP.

## Imagens (galeria de até 8 candidatas)
- Mostrar até oito candidatas distintas com fonte, código visível, resolução, ângulo, licença, evidência e estado (aprovável/pendente/rejeitada).
- Somente mesmo produto e código confirmado; ângulo alternativo rotulado. Preferir fotos próprias ou autorizadas de fabricante/distribuidor, sem marca d'água. Não remover marcas de terceiros.
- Processamento não destrutivo: original preservado, fundo branco, enquadramento, expansão de canvas, correção conservadora de luz, sem alterar geometria, inscrições, furos, dentes ou códigos. Comparação original/tratada; sem inventar detalhes por super-resolução.
- Rejeitar imagens sem licença suficiente para publicação; marketplace pode fornecer pista textual, não direito de uso.
- Aprovação separada para cada imagem; nunca publicar automaticamente.

## Integração e UX
- Reusar Assistente, Catálogo, Taxonomia, Aprovações e Bling existentes; painel desktop e smartphone com ficha completa no chat e evidências clicáveis.
- Fallback sem Gemini mostra dados reais verificados; FreeLLM/API gratuita não recebe dados fiscais, custos, fornecedores privados, credenciais ou dados pessoais. Não permitir que fallback amplie permissões.
- Cache com validade por fonte; registrar indisponibilidade e taxa de erros; resultados offline marcados como possivelmente desatualizados.
- Preços e custos internos não devem aparecer em descrições públicas, prompts de provedores gratuitos nem visualizações de cliente.

## Testes de aceite a implementar
1. HR 2008 ambíguo -> pergunta, sem motor confirmado.
2. D4BH/4D56 códigos próximos -> não afirmar equivalência sem aplicação.
3. Código OEM coincide, dimensões divergem -> rejeitar intercâmbio.
4. Marca conflitante no Bling -> bloquear proposta e mostrar evidência.
5. Piques sem tabela -> espessura pendente.
6. Imagem de peça semelhante -> rejeitada; imagem com marca d'água -> não utilizável; licença desconhecida -> não publicável.
7. Oito candidatas -> galeria sem aprovações automáticas; original intocado.
8. Fonte indisponível, 429/5xx, HTML inesperado -> falha fechada, sem inventar informação.
9. Fallback sem IA -> ficha verificada sem expor custos ou dados sensíveis.
10. Reaprovação após edição -> hash muda e invalida aprovação anterior.
11. Testes de autorização: nenhum write no Bling, deploy, merge ou publicação sem aprovação específica.
12. Evidência rastreável com URL, código, data e licença; marketplace nunca prova compatibilidade isoladamente.

## Instruções para Claude Code
- Inspecionar contratos, testes e componentes existentes antes de implementar; apresentar mapa de reaproveitamento e gaps.
- Implementar em commits pequenos **neste PR**, com testes de unidade, integração e UI; preservar retrocompatibilidade.
- Não criar segundo chat, gateway paralelo ou tabelas redundantes.
- Não declarar testes reais sem logs verificáveis.
- Não fazer merge nem deploy até revisão humana, CI verde e homologação em ambiente isolado.
- PR de especificação não representa funcionalidades concluídas.
