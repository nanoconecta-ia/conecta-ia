# MOBIS AUTOPEÇAS — Contrato de identidade visual vigente (18/11/2026)

**Status:** referência visual aprovada pelo proprietário. Aplicação de código permanece sujeita a CI e aprovação; este documento **não publica nem altera tema em produção**.

## Biblioteca oficial

[Google Drive — MOBIS Identidade Visual Oficial, 18/11/2026](https://drive.google.com/drive/folders/1erX6xhGuIenFWtrjRIRHV7EpnT_yrxS3)

Dentro da biblioteca:

- `00_LEIA_PRIMEIRO_E_NORMAS/CONTRATO_VISUAL_PARA_AGENTES_CONECTA_IA.md`: instruções para agentes.
- `01_REFERENCIAS_APROVADAS_IMUTAVEIS/`: arte de marca aprovada e guia original, não alterar geometricamente.
- `02_LOGOTIPOS_EDITAVEIS_SVG/`: versões SVG; reconstruções vetoriais são aproximações para homologação. Os arquivos `FIEL_PNG_EMBUTIDO` preservam o raster original em camada, não são curvas vetoriais autênticas.
- `03_AVATARES_E_REDES_SOCIAIS/`: avatares circulares.
- `04_TEMPLATES_EDITAVEIS_BANNERS_CARDS/`: modelos de banner, feed, story e card com campos.
- `05_PALETA_TIPOGRAFIA_TOKENS/`: `paleta-oficial.json` e `mobis-tokens.css`.
- `06_EXPORTACOES_PNG_PRONTAS/`: imagens de uso e prévias.
- `99_HISTORICO_NAO_USAR/`: identidades anteriores, **não usar como fonte em novos anúncios**.

## Paleta institucional

| Nome | Hex |
|---|---|
| Grafite escuro | `#1F2327` |
| Vermelho MOBIS | `#E2181A` |
| Cinza claro | `#BFC3C7` |
| Aço escovado | `#A6A6A6` |
| Branco | `#FFFFFF` |
| Branco-gelo para produtos | `#EAF2F6` |

**Revogados:** laranja, cobre e demais paletas históricas da Mobis. Este documento não altera o branding genérico da plataforma Conecta.IA.

Tipografia referencial: Eurostile Next Heavy, ou similar, para títulos; Montserrat, ou similar, para textos. O lettering da marca original é customizado; usar o arquivo-mestre aprovado para reprodução fiel.

## Estrutura inviolável do logotipo

O monograma M tem prata e vermelho em relevo, dentro de placa grafite com moldura de metal escovado sobre base externa discreta. O logo completo apresenta M à esquerda, MOBIS prateado, AUTOPEÇAS vermelho e PICAPES • VANS • UTILITÁRIOS. Avatares circulares preservam a placa retangular no centro do círculo. **Não gerar M solto, neon, anéis luminosos ou molduras extras.**

## Regras de geração de cards e anúncios

1. Resolver SKU e cadastro da peça no Bling **somente leitura**.
2. Validar fotos reais e licença, marca da peça, compatibilidade veicular por motor/ano/chassi, OEM e condições de venda.
3. Selecionar template da biblioteca; fotografia com fundo branco-gelo `#EAF2F6` por padrão, sem mudar o logotipo.
4. Gerar revisão SVG ou arte editável + PNG e armazenar versão, SKU, data e evidência.
5. Apresentar card à aprovação humana. Não publicar, não atualizar o Bling e não trocar o tema publicado automaticamente.

## Integração técnica e escopo

- Aplicar tokens apenas ao tenant/slug Mobis e respeitar o versionamento de paletas já existente em `painel/src/lib/paletaMobis.ts` e `painel/src/paginas/AparenciaMobis.tsx`.
- Mudança em `painel/src/paginas/loja-mobis-*.css` precisa de diff, revisão de contraste (WCAG AA), imagens em 390px e 1280px, e testes de não regressão.
- Manter sem alteração direitos e dados fiscais, estoque, preço, OAuth, Supabase e publicações de terceiros.
- O repositório pode usar os SVGs fornecidos para criação de arte; a logomarca institucional segue visualmente o PNG original até homologação de curvas para impressão.

## Restrição de marca

O histórico de marca contém um alerta de possível conflito de nomenclatura MOBIS no setor automotivo. Este documento não afirma disponibilidade jurídica; consultas formais ao INPI e avaliação jurídica são necessárias antes de grandes gastos irreversíveis.
