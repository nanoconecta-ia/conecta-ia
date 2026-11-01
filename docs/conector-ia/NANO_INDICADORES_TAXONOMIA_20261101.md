# Integração visual Nano.IA × Mapa Mental × Taxonomia (proposta executável, sem deploy)

## Estado verificado em 01/11/2026
- Painel canônico: `painel/src/paginas/Assistente.tsx`, `DockAgente.tsx`, `MapaMental.tsx`, `Taxonomia.tsx`.
- O painel já possui `PontosPensando`, esfera Cristal (sem olho/íris), sprite SVG de peças (`SpriteIcones.tsx`) e mapa mental do catálogo; NÃO criar segundo chat ou segunda taxonomia.
- O Supabase de produção do Conecta.IA é `dsfzhsrudriqkumtlqwj`; foram encontrados `taxonomia_nos`, `bling_categoria_taxonomia` e `bling_categorias` com RLS. Consulta somente metadados, nenhuma escrita.
- PR #206 do Claude Code altera tela cheia, `Assistente.tsx`, `shell.css`; esta alteração evita esses arquivos para minimizar conflito. PRs #199 e #202 definem regras de catálogo e fabricantes.

## O que esta branch implementa
1. `iconeNoMapa`: classificação puramente **visual** do nó `tx:`, reaproveitando os símbolos do sprite; sem dados inventados, sem inferir compatibilidade ou identidade da peça.
2. `MapaMental.tsx`: pictograma SVG na árvore real do Catálogo, com rótulo, contagem, navegação por teclado e origem atual preservados.
3. `PontosPensando.tsx`: ícone de ferramenta para atividade genérica; ícone de catálogo na rota de Catálogo ou Taxonomia, junto às quatro bolinhas existentes. Só aparece durante uma chamada de verdade porque quem monta é o `Assistente` atual.
4. Favicon SVG opcional do **painel Conecta.IA** com esfera Cristal lisa, alinhado ao padrão já aprovado do avatar; ícone PNG anterior permanece como alternativa. Não altera a identidade da Mobis nem o bucket de logos por loja.

## Descrições Bling: contrato e limite de escopo
- `descricaoCurta` / `descricaoLonga` (nomes ilustrativos, mapear para o contrato real da API antes da implementação): **texto SEO técnico** formado só com dados confirmados (SKU, MPN, OEM, aplicação homologada, medidas, marca, garantia quando comprovada).
- O ícone é uma **representação gráfica do nó taxonômico no Conecta.IA**, não é uma foto do SKU, não é enviado como HTML/SVG/emoji às descrições do Bling.
- A imagem de produto exige foto real, licença/fonte, correspondência com SKU e aprovação. SKU, GTIN, códigos cruzados e fabricante não são deduzidos do ícone.
- Escrever descrições no Bling requer ferramenta autorizada por campo, aprovação humana, idempotência, auditoria e leitura posterior. **Nenhuma escrita neste PR.**

## Revisão para Claude Code
1. Revisar a mudança sobre o PR #206 (chat tela cheia) antes de fazer cherry-pick/merge; não substituir as peças de interface do Claude.
2. Executar `cd painel && npm run build && npm test`; inspecionar aparência a 390/768/1440 px com tema claro/escuro, contraste, teclado e `prefers-reduced-motion`.
3. Conferir via Supabase **somente leitura** o vínculo de `taxonomia_nos` ao catálogo e as situações homologadas; não confundir contagem de links com produtos classificados.
4. Testar com produto real do Bling após revisão: descrições permanecem texto, fotos exigem procedência e nenhuma escrita deve ocorrer sem aprovação.
5. Confirmar se “falco do logo” significa **favicon**; esta branch apenas propõe favicon do painel, preservando logo da loja e símbolo principal.

Sem merge, deploy, migração, mudança de DNS, upload de mídia nem edição no Bling.
