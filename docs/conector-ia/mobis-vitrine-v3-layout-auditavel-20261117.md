# Conecta.IA — Vitrine Mobis dinâmica, versionada e auditável (V3)
Data: 17/11/2026 · PR #423 · Base: PR #422.

## Aprovação comercial
O lojista decide a ordem dos blocos já montados. Ao salvar não publica: cria uma versão
imutável com autor, data, sequência completa e intervalo do carrossel.
Há duas ações explícitas e separadas: **aprovar** e **publicar**.
Somente o papel `lojista` da loja consegue chamar as RPCs.

## O que cada bloco publica
- **Cabeçalho** (fixo): logotipo original, busca por SKU/OEM, navegação e aviso de loja em teste.
- **Banner principal** (móvel): quando existem campanhas ativas, apresenta o carrossel Flash (foto autorizada + SKU + CTA). Se não houver, exibe o banner institucional.
- **Montadoras** (móvel): escolhe modelos disponíveis no catálogo aprovado e nunca inventa equivalências.
- **Taxonomia** (móvel): nós e categorias com contagem de produtos publicados.
- **Catálogo** (móvel): filtros e cartões por SKU, sem duplicação de estoque ou peças.
- **Empresa** (móvel): informações institucionais da loja.
- **Atendimento/lista**: funções de consulta mantidas após os blocos comerciais; não criam pedido.
- **Rodapé/privacidade** (fixo): apenas políticas aprovadas, canal de atendimento e dados empresariais públicos.

## Fluxo do editor
1. Lojista abre `#/estrutura-loja` no painel Conecta.IA.
2. Escolhe um modelo Comercial, Busca primeiro ou Por veículo; opcionalmente arrasta blocos (desktop) ou usa setas (celular).
3. Ajusta o intervalo de rotação, de 4 a 15 segundos. Até 24 campanhas ativas, com ordem própria no editor de banners.
4. **Salvar nova versão**: grava apenas um snapshot na tabela `loja_layout_versoes`; site permanece inalterado.
5. **Aprovar versão**: grava `aprovado_por` e `aprovado_em` para a versão imutável.
6. **Publicar versão aprovada**: atualiza somente o ponteiro `loja_layout_publicado`.
7. **Restaurar**: inspecionar uma versão anterior aprovada e publicar novamente; nenhuma versão é apagada.

A API `loja-publica` entrega aos visitantes só
`{layout:{blocos:[...],intervalo_segundos:...}}` do ponteiro aprovado.
Sem ponteiro, a ordem padrão continua funcionando. IDs fora da whitelist são descartados.
Nem autores, nem histórico, nem documentos, nem custo, nem NF são acessíveis ao navegador público.

## Auditoria e segurança
- Cada snapshot, aprovação e alteração do ponteiro gera registros no
  `public.auditoria`, cujo UPDATE/DELETE é bloqueado por trigger append-only existente.
- O próprio layout é imutável: alteração cria outro snapshot.
- RLS restringe consulta do histórico à loja; anon não recebe SELECT/EXECUTE.
- Escrita de versões somente por RPC `layout_salvar_versao`,
  `layout_aprovar_versao`, `layout_publicar_versao` com
  `auth.uid()` e papel `lojista` validado no banco.
- Nenhum rascunho altera `produtos.publicado` ou `produto_aplicacoes.pagina_indexavel`.
- Imagens dos fornecedores exigem aprovação e direitos de publicação confirmados;
  a escolha de slide é sempre vinculada ao SKU físico.
- Bling é **somente leitura** para Mobis (política implementada no PR #422).

## Dependências para ativar na loja real
1. Integrar e auditar o PR #422 (blocos-base e portões de publicação).
2. Integrar este PR após CI e revisão técnica de banco/autorização.
3. Aplicar migração `20261117170000_mobis_layout_versionado_auditavel.sql` em ambiente controlado.
4. Implantar `loja-publica` e frontend compativeis, confirmar fallback da loja sem layout configurado.
5. Com sessão de `lojista`: salvar versão, aprovar e publicar; conferir auditoria.
6. Testar 360/390/412/1280 px, contraste, navegação teclado e acesso anon.
7. Apenas depois: liberar campanhas e produtos já aprovados **individualmente**.

**Aprovação do modelo visual não implica autorização para publicar SKUs,
liberar estoque, gravar no Bling, emitir NF, nem transformar a loja em checkout.**
