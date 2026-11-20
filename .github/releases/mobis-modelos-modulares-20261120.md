# Release pontual — Mobis: três layouts em módulos reais

Data: 20/11/2026
Autorização explícita do lojista: "aplicas a versão 2 na loja e as outras deixa disponíveis para o lojista aplica quando quiser".

## Resultado
- **Modelo 02 Técnico**: apresentação inicial da loja Mobis enquanto não houver layout aprovado/publicado (a tabela de publicação estava vazia na auditoria).
- Modelos **01 Oficial** e **03 Impacto** no menu **Conecta.IA > Loja > Estrutura e blocos**.
- Seletor do lojista reutiliza `loja_layout_versoes`, com fluxos já implantados `layout_salvar_versao`, `layout_aprovar_versao` e `layout_publicar_versao`. Nenhuma nova tabela ou token.
- Módulos efetivos, ligados à API pública aprovada: banner institucional/Flash, filtro do veículo, montadoras, sete categorias, catálogo e bloco institucional, com reordenação por layout publicado.
- Fotos reais das peças não são recriadas, não recebem filtro nem película; a logo MA e sua tipografia não são modificadas.
- Película gelo sobre superfícies; grafite em fundo de textos; vermelho #E2181A como CTA.
- Testes para três arranjos de módulos e fallback técnico; CSS responsivo e movimentos reduzidos.

## Exclusões de escopo
- Sem criação de campanhas não aprovadas; sem preços fictícios, estoque ou compatibilidades afirmadas sem evidência.
- Sem alteração na base Supabase, na Edge Function, no Bling, no estoque, nas aplicações, nos dados fiscais ou nas políticas de privacidade.
- Sem alteração na identidade global do Conecta.IA e de outras lojas.
- Mudança de frontend apenas, com homologação GitHub Actions e gatilho de deploy pontual desta release.

## Reversão
- A seleção do Modelo 01 ou 03 pelo lojista cria versão auditável de layout; somente a versão aprovada e publicada muda a vitrine.
- A loja mantém a versão Técnica como fallback em caso de layout ausente ou inválido.
