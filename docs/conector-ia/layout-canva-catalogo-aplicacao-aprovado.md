# Conecta.IA — modelo visual aprovado no Canva (catálogo por aplicação)

**Referência principal (Canva editável):** https://www.canva.com/d/vfcZIrvZGwU1VMf
**Artes existentes do proprietário:** `Mobis_logo_oficial_dark.webp` (Canva `MAHawzzj2Ec`), `Mobis_logo_oficial_light.webp` (Canva `MAHaw6Ba92k`), `Mobis_banner_oficial.webp` (Canva `MAHawz0oixQ`). O logotipo dark foi exportado como `painel/public/marcas/mobis-canva-oficial.jpg` para exibição interna. Não usar versões antigas em vermelho.

## Implementação da referência visual

- `painel/src/paginas/CatalogoAplicacao.tsx`: visão integrada na página inicial da loja **Mobis**, e acessível em `#/catalogo-aplicacao` para qualquer loja autenticada;
- `painel/src/paginas/catalogo-aplicacao.css`: design isolado: tela clara, menu lateral existente, métricas, hero dark, filtros, sistemas, candidatos e portal de revisão;
- `painel/src/App.tsx`: navegação sem remover rotas antigas;
- `#/catalogo-espelho`: cadastro e gestão do espelho anterior preservados, com pesquisa de SKU via `?q=`;
- `#/studio`: função **Indexar e enriquecer** existente, apenas linkada. Não ativa operações automaticamente;
- `#/fila`, `#/taxonomia`, `#/imagens`: fluxos já presentes de revisão, taxonomia e conteúdo.

## Não publicar o HTML original diretamente

A matriz `CONECTAIA_MODELO_APROVADO_MOBIS_COM_OLHO_NANO_E02.html` contém **snapshot técnico de dados internos do Bling**. A versão HTML permanece apenas como backup e referência. A implantação usa componentes React autenticados e chamadas ao Supabase sujeitas a RLS e filtro `loja_id`. Nenhum dado de fornecedor, custo, NCM/CFOP, chassi, notas ou IDs internos do Bling é embutido nos ativos públicos.

## Regras comerciais e técnicas

- Contadores do espelho são consultados em tempo real, **não** copiados da captura; a captura mostra valores históricos/demonstrativos.
- Em novembro de 2026, o espelho Mobis tinha 275 registros, 0 aplicações homologadas e 0 produtos publicados. Estes números **não são hardcoded**.
- Resultados de busca por nome são sempre mostrados como **candidatos não homologados**. Ano, versão, tecnologia e OEM não são presumidos a partir do nome.
- Resultados da área comercial só usam produtos com `publicado=true`; filtros por veículo exigem aplicação registrada com `status='aprovado'`.
- Não há checkout, escrita no ERP, alteração de estoque, emissão de NF ou botão de publicação direta nessa tela.
- Exportação CSV tem proteção contra injeção de fórmulas e não inclui dados fiscais ou preços.
- O Nano Eye **E02** não foi substituído, redesenhado nem redescrito. O layout do Nano e seus hologramas continuam nas estruturas anteriores.
- Para a vitrine pública em `mobisautopecas.com.br`, as políticas de privacidade, publicação e homologação continuam controles separados. Esta PR **não publica** a loja.

## Homologação

1. CI TypeScript, build, testes de UX e PWA sem regressão.
2. Entrar com lojista Mobis e abrir `#/`; conferir contadores reais, hero com logo, filtros, grid 3D e triagem interna.
3. Conferir o funcionamento da rota antiga `#/catalogo-espelho` e a pesquisa por SKU.
4. Validar experiência no celular e no desktop.
5. Confirmar que o contexto do Nano E02 e as rotas de auditoria permanecem intactos.
6. Publicar apenas **painel interno autenticado** no GitHub Pages, sem HTML standalone e sem alteração no Bling.
