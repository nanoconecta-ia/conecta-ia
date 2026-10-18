# 6. Design system do site e do painel

**Vigente** (fonte: `docs/DESIGN_SYSTEM.md`, bloco "Atualização", e `painel/src/styles.css`): azul `#0864A0` (primário), verde `#04A88D` (sucesso/WhatsApp, texto grafite por contraste AA), grafite `#102335` (menu, cabeçalho, destaque), fundo `#F3F7FA`, fonte **Inter** self-hosted (`@fontsource-variable/inter`), alvo de toque ≥ 44 px, foco visível, `prefers-reduced-motion`.

O desenho laranja/IBM Plex/Space Grotesk que aparece no restante daquele arquivo é **histórico** (vem de outro produto) e não deve ser usado. As regras do `CLAUDE.md` do repositório `genesis-indexa-360-ia` **não se aplicam** ao Conecta.IA.

## 6.1 Regras
1. Tokens, nunca cor solta. Estados só `ok / atenção / erro`.
2. Mobile-first: um componente, classes responsivas; nunca versão "mobile" separada.
3. Sem valor fictício em produção: sem dado real aparece "a confirmar", "consulte" ou o bloco some.
4. Tema da loja pública vem de `loja_tema` (cores, fonte, logo, ícone) validado no servidor (`loja/tema.ts`); o painel mantém identidade própria.
5. Marca do provedor de IA nunca aparece ao cliente final: "Genesis IA" (lojista) e "assistente da loja" (vitrine).

## 6.2 Componentes
| Existe | A criar |
|---|---|
| topo + menu, cartão, selo de estado, botões, formulário, tabela com rolagem interna, árvore recolhível, bolhas de chat | seção retrátil com status go/warn/stop · cartão de evidência (fonte, data, confiança) · selo "imagem real × sintética" · estados vazio/carregando/erro · cartão de produto da vitrine (SSR) |

## 6.3 Para a Central Conector IA (Fase 1) e o Studio Visual (Fase 4)
- **Chat**: lista de conversas, seletor de modelo (Claude/Gemini/GPT por conversa, só os configurados na loja), bolhas com **cartão de ferramenta** (nome, entrada resumida, resultado, tokens/custo), **cartão de aprovação** (diff + Aprovar/Rejeitar), tabela interativa para listas, anexos e streaming (SSE) em etapa posterior.
- **Studio**: canvas com prévia desktop 1100 px / tablet 768 px / celular 390 px; proposta de IA → edição manual → aprovação → publicação; toda imagem gerada rotulada "sintética".
- **Acessibilidade**: contraste AA verificado por captura em 390 e 1100 px antes de aceitar cada tela.

## 6.4 Pendências
Self-hosting já feito para Inter; `DESIGN_SYSTEM.md` ainda contém o desenho antigo — propor mover o histórico para um apêndice (não alterei o arquivo para não misturar com decisão do dono).
