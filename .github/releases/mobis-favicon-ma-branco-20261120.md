# Release pontual MOBIS — favicon MA com base branca

Data: 20/11/2026

## Autorização do proprietário
"Ok pode faz as etapas e aplica ... e não se esqueça do falcon colocar em destaque o m em fundo branco para se destacar n web etc".

## Escopo autorizado
- Manter a loja no **Modelo 02 Técnico** já integrado pelo PR #476, com opções 01 Oficial e 03 Impacto disponíveis para o lojista
- Destacar o **símbolo M/MA original** no favicon web sobre um fundo branco com contorno suave, sem redesenhar nem deformar a marca
- Usar a versão SVG em navegadores compatíveis e manter os PNG de compatibilidade e instalação pré-existentes
- Realizar CI do painel e publicação pontual de frontend após homologação

## Limites de governança
- Não executar comandos de aprovação/publicação no Supabase em nome do lojista sem sessão autenticada
- Não modificar tabelas, RLS, Edge Functions, estoque, Bling, notas fiscais, dados de preços, imagens de produtos, banners, OEM ou aplicações
- Não alterar identidade PWA independente do Conecta.IA
- A versão de layout existente no banco **não foi formalmente publicada**; o Modelo 02 segue como fallback técnico auditado até aprovação e publicação pelo editor autenticado
- Se CI falhar, não prosseguir para deploy
