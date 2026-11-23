# Identidade visual oficial — Mobis MA Display (referência canônica)

Referência enviada pelo proprietário em 23/11/2026 (9 pranchas do sistema "MOBIS MA DISPLAY — Identidade Tipográfica e Visual Oficial").
Este documento é a **fonte canônica** da identidade Mobis Autopeças para a loja, banners e Conecta.IA. Mudança de aparência que
dependa daqui passa por pré-visualização e aprovação (regra do projeto); nada aqui autoriza venda, preço, DNS ou escrita no Bling.

## Paleta oficial
| Nome | Hex | Uso | Já no código |
|---|---|---|---|
| Grafite Escuro | `#1F2327` | neutro-base: masthead, sidebar, texto forte | sim (122×) |
| Vermelho Mobis | `#E2181A` | acento da marca, destaques, CTA | sim (81×) |
| Cinza Claro | `#BFC3C7` | superfícies e traços secundários | sim (13×) |
| Aço Escovado | `#A6A6A6` | acabamento metálico (película brush) | sim (2×) |
| Branco | `#FFFFFF` | fundo claro, texto sobre grafite | sim |
| Gelo | `#EAF2F6` | fundo branco-gelo da vitrine | sim (24×) |
| Preto | `#000000` | contraste pontual (não substitui o grafite) | pontual |
| Azul Auxiliar | `#1877F2` (prancha definitiva) / `#004897` (variação) | **auxiliar/co-marca** (linha Hyundai e Kia); **não** é cor Mobis padrão | não |

Observação: a loja já usa a paleta Mobis padrão. O azul é auxiliar (aparece só em pranchas de variação) e **não** deve virar cor
primária da vitrine sem decisão explícita.

## Tipografia — Mobis MA Display
- Família display automotiva, **itálico dinâmico**, cantos arredondados, cortes diagonais, inclinação, alta legibilidade.
- A própria prancha diz que a base visual lembra **Eurostile Italic / Bank Gothic itálico / display automotivo customizado**, "mas os
  caracteres foram desenhados" (fonte proprietária).
- Pesos: Thin 100 · Light 300 · Regular 400 · Bold 700 · Black 900. Estilos: Normal · Itálico · Contorno · Expandido · Condensado.
- **Pendência para aplicar no site:** é preciso o **arquivo da fonte** (`.woff2`/`.otf`, com direito de uso web). As pranchas são
  imagens (PNG/JPG) e **não** podem ser usadas como webfont. Enquanto não houver o arquivo licenciado, os títulos seguem com a pilha
  atual (Space Grotesk/Inter); uma aproximação licenciável (ex.: uma display itálica no Google Fonts) só entra com aprovação.

## Películas / acabamentos (overlays)
**Padrão oficial** (confirmado pela prancha definitiva "MOBIS MA DISPLAY — Novo Padrão Película", 23/11/2026).
Quatro acabamentos oficiais para emblemas e caixas: **Brilho (glass)**, **Fosco (frosted)**, **Metálica (brush)**, **Escura (smoke)**.
São sobreposições de gradiente/reflexo sobre a peça; reproduzíveis em CSS sem imagem (gradientes + `mix-blend`/`backdrop-filter`),
preservando o emblema MA e a paleta. Aplicar como camada, nunca recolorindo o logo.

## Emblema MA
- Emblema circular com o "M" grafite/prata e o traço vermelho; variações de fundo (prata escovado, branco, grafite) e selos redondos.
- Preservar forma, ângulos e o corte dinâmico do "M"; o Olho do Nano E02 mantém a aparência aprovada.
- Assets aprovados já no projeto (ex.: `painel/src/assets/mobis-identidade-aprovada.jpg`). Novos recortes do emblema/fonte entram como
  arquivos licenciados, não extraídos das pranchas de referência.

## Pranchas de referência (enviadas 23/11/2026)
Variações do mesmo sistema (fundos prata, branco, azul, vermelho, grafite) + pranchas de "Tipografia MA" com exemplos de uso
(MOBIS · AUTOPEÇAS · MOTOR · CABEÇOTE · CATÁLOGO · CONECTA.IA). A prancha **definitiva** ("Novo Padrão Película") traz a aplicação
oficial com o emblema MA e o subtítulo "Peças para linha Hyundai e Kia". Guardadas como referência do proprietário; não publicadas na loja.
