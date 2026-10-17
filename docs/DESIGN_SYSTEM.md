# Design System do Conecta.IA — proposta integrada

> **Aviso:** o PDF "Design System Avançado — Conecta.IA (7 páginas)" citado na decisão **não chegou à sessão** (não há anexo acessível). Esta proposta parte dos tokens já implementados em `painel/src/styles.css` e do padrão do projeto irmão (tokens semânticos, componentes reaproveitados, responsivo nativo). Quando o PDF for enviado, comparo página a página e ajusto; nada abaixo depende dele.

## 1. Princípio
Um único conjunto de tokens, tipografia, componentes e navegação para **todos** os módulos. Nenhuma tela com estilo próprio. Mobile-first: o layout base é o do celular; `@media` ajusta para tablet/desktop. Nunca existe versão "mobile" separada de um componente.

## 2. Tokens (implementados em `styles.css`)
| Grupo | Tokens |
|---|---|
| Superfície | `--fundo`, `--cartao`, `--realce`, `--borda` |
| Texto | `--texto`, `--suave` |
| Marca | `--marca` (laranja), `--marca-forte`, `--marca-texto` |
| Estado | `--ok`, `--atencao`, `--erro` (contraste validado em claro e escuro) |
| Forma | `--raio`, `--sombra` |
| Tipografia | `--titulo` (Space Grotesk), `--fonte` (IBM Plex Sans), `--mono` (JetBrains Mono: SKU, NCM, códigos, timestamps) |

Regras: nunca cor solta (sempre token); estado só com `ok/atencao/erro`; tema escuro por `prefers-color-scheme`; foco visível; alvo de toque mínimo ≥ 40 px.
Pendência: as três fontes ainda caem para fontes do sistema (não estão self-hosted). Self-hosting é uma etapa de implantação (arquivos WOFF2 no repositório).

## 3. Componentes (mapa)
| Componente | Estado | Onde aparece |
|---|---|---|
| Topo com marca + menu rolável | existe | todas |
| Cartão | existe | todas |
| Selo de estado (`ok/atencao/erro`) | existe | conexão, aprovação, risco |
| Botão primário / secundário / perigo | existe | todas |
| Formulário com rótulo e campo | existe | integrações, login |
| Tabela com rolagem lateral | existe | fila, catálogo |
| Árvore recolhível | existe | taxonomia |
| Chat (bolhas) | existe | assistentes |
| Seção retrátil com status (go/warn/stop) | **a criar** (padrão do projeto irmão) | gestão de produtos, editor |
| Cartão de evidência (fonte, data, confiança) | **a criar** | fila, Central, produto |
| Selo "imagem real" × "sintética" | **a criar** | editor de imagens, vitrine |
| Estado vazio / carregando / erro | **a padronizar** | todas |
| Cartão de produto da vitrine | **a criar** | loja pública |

## 4. Mapa de telas (todas sobre os mesmos tokens e navegação)
| Área | Rota | Situação |
|---|---|---|
| Painel administrativo (visão geral) | `#/` | real |
| Central de Agentes | `#/agentes` | **demonstração** |
| Gestão de produtos / fila de aprovação | `#/catalogo`, `#/fila` | real (catálogo básico) |
| Explorador de taxonomia | `#/taxonomia` | real |
| Editor de imagens e SEO | `#/imagens` | **demonstração** |
| Configuração de integrações | `#/bling` | real (PR #14 pendente) |
| Loja pública Mobis Auto Peças | `#/demo/vitrine`, `#/p/<loja>/<sku>` | vitrine **demonstração**; página de produto real |
| Referência do Design System | `#/design` | real (guia vivo) |

Navegação em celular: menu horizontal rolável (já implementado), conteúdo em coluna única, tabelas com rolagem lateral só dentro do cartão, nenhuma rolagem lateral na página (verificado por captura em 390 px).

## 5. Fluxo de implantação do visual
1. Aprovar tokens e mapa (esta proposta). 2. Self-host das fontes. 3. Componentes "a criar". 4. Migrar cada tela para os componentes. 5. Conferir contraste e captura em 390 px e 1100 px por tela.
