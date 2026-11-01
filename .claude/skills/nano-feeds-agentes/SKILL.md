---
name: nano-feeds-agentes
description: Gerar/validar rascunhos de feeds Merchant e catálogo legível por agentes externos, conferindo paridade do site, disponibilidade, licença de imagem e elegibilidade por canal.
---

# Skill: distribuição de catálogo para busca e agentes

**Acionar** para Google Merchant Center, listagens locais gratuitas, páginas descobertas por ChatGPT, Google AI, feeds, dados estruturados e futuras integrações agentic commerce.

## Mecanismos separados

- Google Search/AI utiliza indexação pública, links, HTML e conteúdo útil; sem arquivo de "SEO para LLM" obrigatório.
- Google Merchant Center usa um feed de produto com atributos específicos e matching com o website; enviar requer autorização e configuração da conta própria da loja.
- ChatGPT Search pode descobrir fontes públicas por mecanismos de pesquisa e OAI-SearchBot, sujeito ao controle da plataforma; não há garantia de exibição.
- Adoção de OpenAI ACP e Google UCP **não** significa integração automática: verificar disponibilidade para o país, parceria/onboarding e conformidade; preparar apenas adaptadores isolados sem credenciais reais até autorização.

## Contrato

1. Entrada: SKU único de `loja_id`, `FichaConfirmada`, `OfertaAprovavel`, mídia pública com identidade/uso aprovado, URL canônica indexável.
2. Validar pares: preço e disponibilidade no feed == página HTML == JSON-LD == dado atual do Bling; links e imagem HTTPS respondem; marca/GTIN/MPN são corretos. Data de sincronização fora do TTL gera erro antes de publicar.
3. `identifier_exists` e `condition` conforme regras oficiais, não inferir automaticamente quando não há GTIN/MPN; garantir política de entrega/devolução adequada ao canal.
4. O feed não publica dados inexistentes, custos, margens, fornecedores, dados fiscais privados ou mídia de terceiro não licenciada.
5. Sempre mostrar motivo de bloqueio por SKU e uma tarefa para corrigir o cadastro; distinguir bloqueio técnico, editorial, jurídico, comercial ou de conectividade.
6. O PDV e o WhatsApp da loja reutilizam informações aprovadas, mas **não** devem ser tratados como um feed público de acesso irrestrito. Enviar mensagens/catálogos exige API/permissão do canal e autorização separada.
7. Não forçar produtos de estoque zero a ofertas de compra com InStock; encaminhar à consulta comercial de forma transparente, se houver página adequada.
8. Limites e políticas devem ser confirmados em documentação oficial vigente antes de integrar mudanças.

## Testes

- 2 lojas com mesmo SKU: não vazar descrição/preço/mídia uma da outra.
- GTIN inválido, link expirado, URL de Drive privado, descrição sem origem, mídia sem direitos, preço divergente e estoque vencido devem bloquear envio.
- Feed pode ser gerado em dry-run; não fazer upload, publicação, ativação de canal ou cobrança sem autorização por loja.
- Raspagem de dados públicos e rota indexável não autorizam pedidos de compra automáticos.

Reutilizar: `supabase/functions/_shared/seo/{feed_merchant,jsonld,dados}.ts`, `docs/conector-ia/descoberta-por-agentes.md` e `docs/ordem-mestra/08-seo-distribuicao.md`.
