# MOBIS — Contrato dos blocos: Bling (leitura) → Conecta.IA (nós) → site
Data: 17/11/2026 · Proposta implementada em branch para testes e aprovação visual.

## Fonte de verdade e proibições
- **Bling:** exclusivamente leitura de cadastro físico, SKU, GTIN, preço, saldo, NFs e atributos fiscais. Os originais e vínculos de NF não são modificados, excluídos ou substituídos.
- **Portão do executor:** o backend `acoes.ts` recusa antecipadamente propostas com operação `bling.*` para o tenant Mobis. `executor.ts` aplica defesa adicional por item; nem a aprovação humana nem flags futuras podem autorizar gravação no ERP por esse agente. O UUID de loja foi confirmado por consulta somente leitura ao banco em 17/11/2026.
- **Espelho Conecta.IA:** a sincronização já existente lê o Bling e atualiza a cópia técnica no Conecta.IA. **Um produto físico = um SKU/bling_id**, sem clonar o registro quando aplicável a vários veículos.
- **Nós Conecta.IA:** taxonomia (`taxonomia_nos`), aplicações (`produto_aplicacoes`), códigos (`produto_codigos`), imagens (`produto_imagens`), banners (`loja_banners`), políticas (`loja_politicas`). Sugestões da IA precisam de origem, data, versão e aprovação humana.
- **Publicação pública:** só após o proprietário aprovar e marcar visível. Blocos usam a Edge Function `loja-publica` que filtra os registros liberados; nenhuma integração da vitrine com o Bling ou com tabela bruta é usada.
- **Bloqueio reforçado nesta etapa:** a API pública deixa de retornar `exibicao_teste` sem `publicado=true` e deixa de retornar páginas por aplicação sem `status='aprovado'` **e** `pagina_indexavel=true`, inclusive em ambiente de teste. Prévia de rascunho fica apenas no painel autenticado.
- **Pausa:** `produto_automacao` / `automacao_pausar` preservam o controle por produto e lote; propostas pausadas não são liberadas automaticamente.
- A associação textual de nome de montadora e modelo é apenas um **atalho de busca**, não prova homologação, código OEM ou compatibilidade.

## Sequência do site
| Ordem | Bloco React | Nó/campo Conecta.IA | Efeito do clique |
|---|---|---|---|
| 01 | Cabeçalho | identidade aprovada da loja | navega dentro da loja; busca SKU/OEM |
| 02 | Banner comercial | `banners_da_vitrine` → SKU publicado + imagem publicável | abre ficha do SKU em modal dentro do site |
| 03 | Montadoras | modelos da API com aplicação aprovada + opções institucionais de consulta | mostra modelos aprovados; filtra por modelo ou inicia atendimento |
| 04 | Sistemas/taxonomia | `taxonomia_nos` retornados na API com contagem de produtos | aplica o nó/categoria ao filtro da vitrine |
| 05 | Corpo: busca e produtos | `produtos` aprovados, OEM/códigos liberados, páginas de aplicação aprovadas | abre `#/p/mobis/<SKU>` e `#/a/<slug>` quando habilitados |
| 06 | Rodapé e privacidade | apenas `loja_politicas.status='aprovada'` | abre texto aprovado em diálogo; sem texto não publica política fictícia |

Os componentes `BlocoMontadorasMobis` e `BlocoTaxonomiaMobis` recebem **apenas dados públicos já filtrados**. O componente do banner mantém as fotografias reais de HR/Bongo/L200 e não duplica o seletor de montadoras. A nova estrutura substitui a seção repetida de quatro motores genéricos e a segunda navegação redundante.

## Novo cadastro e mais páginas a partir da documentação
**Permitido agora:** o Nano/Conecta.IA pesquisar documento e PROPOR campos, categorias, códigos ou novas páginas por aplicação para **SKU físico já existente**, com fonte, data e revisão. Admin → Catálogo → Estúdio do Nano / Catálogo por aplicação. A aprovação não grava no Bling.
**Não autorizado:** criação física, reativação ou atualização de SKU no Bling; publicar automaticamente; inventar OEM, marca, GTIN, preço, estoque ou usar imagens sem direito.
**Limitação atual:** `bling.produtos.preparar_cadastro` prepara uma proposta que aponta para `bling.produtos.criar`, operação desabilitada. Para **produto físico completamente novo, inexistente no Bling**, o próximo passo precisa de um tipo de rascunho *exclusivo Conecta.IA*, com verificação de duplicidade e fonte, sem executor que escreva no ERP. Não foi ativado nesse PR.
**Ofertas por aplicação:** nunca representam unidades físicas adicionais; cada uma referencia o mesmo `produto_id` e a mesma posição de estoque.

## Controles de validação
- Testar cada bloco nos formatos 360/390/412/1280 px; teclado e leitor de tela; banner com ou sem campanha.
- Marcar no DOM `data-bloco` nos seis pontos e `data-sku-fisico` nos cards.
- Ao zerar produtos publicados: montadoras permanecem caminhos de **consulta**, taxonomia institucional exibe **sem itens liberados**, catálogo vazio e nenhum produto fictício.
- Filtro de montadoras usa apenas os modelos explicitamente presentes na API; categorias têm `total>0`.
- A proteção real do portão permanece no backend e na RLS; helpers do frontend não substituem a aprovação.
- Não publicar em produção sem aprovação da renderização real. Não executar ações no Bling.
