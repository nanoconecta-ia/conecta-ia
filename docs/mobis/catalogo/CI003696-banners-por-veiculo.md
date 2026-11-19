# MOBIS AUTOPEÇAS — Banner individual para cada perfil de aplicação

**Produto físico:** CI003696 · Bling ID 16719530075 · Motor parcial novo **com cabeçote**, Trim Go, 2.5 D4CB diesel 16V Euro V.

**Regra vinculante:** um banner por aplicação **aprovada** do produto, com URL exclusiva da página daquela aplicação. Todos os banners apontam ao **mesmo SKU físico** (sem duplicação de estoque, custo, compra ou nota fiscal).

| Banner independente | Imagem institucional de referência | Destino da página de aplicação após homologação | Estado atual |
|---|---|---|---|
| Hyundai HR — Motor parcial CI003696 | Imagem Hyundai HR já existente no acervo aprovado do site (não é foto da peça) | `#/a/ci003696-hyundai-hr-d4cb-16v-euro-v` | A confirmar; página não indexável |
| Kia Bongo K2500 — Motor parcial CI003696 | Imagem Kia Bongo K2500 já existente no acervo aprovado do site (não é foto da peça) | `#/a/ci003696-kia-bongo-k2500-d4cb-16v-euro-v` | A confirmar; página não indexável |

## Navegação segura

- **Enquanto a aplicação estiver em `a_confirmar`:** o carrossel pode mostrar o **banner institucional da linha** Hyundai HR / Kia Bongo, mas deve apontar à busca por veículo (`#/loja/mobis/veiculo/HR` e `#/loja/mobis/veiculo/Bongo`), jamais à página de aplicação 404 ou a um WhatsApp.
- **Depois de `status='aprovado'` + `pagina_indexavel=true` + produto físico publicado:** a API `loja-publica` fornece a página aprovada; o banner do veículo aponta **automaticamente** à sua rota exclusiva `#/a/<slug>`.
- **Com campanha aprovada do SKU CI003696:** o carrossel gera um banner para **cada aplicação aprovada**, incluindo campanhas futuras de outros SKUs. Não cria banners automáticos de produtos em prévia ou não autorizados.
- **Fotografia da peça:** a ficha física e as duas páginas de aplicação compartilham **somente** fotografia real do CI003696, em fundo branco puro e com direitos confirmados; nenhum banner de veículo é prova de compatibilidade técnica.
- **Identidade:** M-STYLE CROMO V3, logotipo oficial, grafite `#1F2327`, vermelho `#E2181A`, gelo `#EAF2F6`, aço `#A6A6A6`. Sem layout laranja, sem slogan de segmentos.
- **Preço de custo:** nunca expor; nenhuma oferta é inferida do estoque, promoções de Instagram ou cadastro de fornecedor. Preços comerciais só vêm do fluxo de publicação autorizado.
- **Auditoria:** o recurso de banner não altera API, Bling, estoque, fiscal, DNS, políticas ou status da aplicação.

## Critérios mínimos de teste

1. Sem aplicação aprovada: HR e Bongo mantêm banners distintos e filtros por veículo, sem links 404.
2. Com 2 aplicações aprovadas em um único SKU: 2 banners com URLs distintas; imagem, título e CTA do mesmo banner abrem a mesma página de aplicação.
3. O teste falha se uma aplicação pendente virar link, se um banner abrir WhatsApp ou se houver clonagem do SKU físico.
4. No celular, cada banner é responsivo e preserva a proporção do logo e a leitura do conteúdo.
