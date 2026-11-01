---
name: nano-conteudo-multicanal
description: Criar uma única ficha técnica canônica e versões aprováveis de descrição curta e complementar do ERP Bling, consulta de PDV, site/SEO, Google Merchant e futuros conteúdos para WhatsApp Business e redes sociais.
---

# Skill: descrições Bling, PDV e comunicação multicanal

## Princípio

**Um SKU por loja, uma ficha factual homologada, múltiplas apresentações por canal.** O Nano deve produzir rascunhos especializados por destino a partir de `FichaConfirmada`, sem duplicar SKU, repetir campos internos no site, nem copiar automaticamente texto publicitário para o ERP. Os campos do Bling são fonte/ponto de controle da operação; enriquecimento e versões ficam no Conecta.IA até aprovação por campo.

**Documentação Bling:** descrição curta = descrição principal do produto na loja; algumas integrações não aceitam formatação; descrição complementar pode aparecer em **pedidos, propostas comerciais e pedidos de compra**. Portanto as duas são textos potencialmente públicos, mesmo que o vendedor os enxergue no PDV. Fonte: https://ajuda.bling.com.br/hc/pt-br/articles/360036756914-Como-cadastrar-produtos

## Modelo de conteúdo (sem inventar fatos)

1. `FichaMestra`: `loja_id + bling_id + sku`, marca real da peça, MPN fabricante, OEM montadora distinto, GTIN se validado, categoria taxonomia homologada, medidas e características confirmadas, aplicações N:M com restrições, mídia licenciada, fontes/data/estado por campo e versão.
2. `descricao_curta_bling`: 1 a 2 frases **objetivas, em texto simples**, com peça, marca, código fabricante comprovado, motor/aplicação apenas quando confirmados e até a principal diferença técnica útil. Evitar excesso de palavras-chave, HTML, emojis, script, preço, condições e promessas. Não preencher campos vazios por inferência.
3. `descricao_complementar_bling`: texto técnico organizado para uso em loja, **pedido, proposta e compra**: identificação, referências tipadas, ficha técnica comprovada, lista de aplicações aprovadas com anos/versões e restrições, conteúdo do kit (quando confirmado), observações de instalação com fonte. **Nunca** custo, margem, fornecedor B2B, condição fiscal, observações internas, nota para agente, segredos ou garantias não confirmadas. Preferir linhas legíveis em sistemas que removem formatação; não embutir JSON-LD.
4. `resumo_pdv`: linha operacional rápida por SKU + peça + código de fabricante + aplicação/reserva + alerta de variante incompatível; drill-down para especificações e origem. O PDV consome a ficha mestra/dados do Bling, não uma cópia divergente de um post.
5. `seo_site`: título, URL, meta description, H1, ficha detalhada, FAQ **somente se houver perguntas reais com respostas comprovadas**; JSON-LD `Product/Offer`, canonical e breadcrumbs são gerados pelo renderizador do site, **não** dentro das descrições no Bling. O Google exige paridade do schema com o conteúdo visível.
6. `merchant_feed`: representação própria para o Google Merchant Center; price/availability da leitura do Bling com data, mídia pública autorizada, IDs, GTIN/MPN e políticas conformes.
7. `social_post` e `whatsapp_catalogo` (**futuro, rascunho**): texto breve para anúncio/post/status/catálogo, imagem real preservada, CTA/link, condições de venda atualizadas e autorizadas. WhatsApp Business App, catálogo Meta e WhatsApp Business Platform são **canais diferentes**: verificar mecanismo permitido e acesso para cada um; não prometer envio automático via WhatsApp Web ou API sem conexão oficial/consentimento.
8. Anexar `proveniencia[], data_aprovacao, versao_conteudo, hash_conteudo` a cada versão. Quando a ficha/ERP muda, **invalidar só os derivados afetados** e notificar antes de reeditar no Bling ou disparar campanha.
9. Manter original do Bling no comparador lado a lado. `propor -> diff por campo -> revisão -> autorização de escrita -> leitura pós-escrita`. Em erro de autorização, ficar rascunho e nunca contornar via automação de tela.

## Contrato sugerido ao executor (não implementado ainda)

```ts
type PublicacaoRascunho = {
  loja_id: string;
  bling_id: string;
  sku: string;
  ficha_hash: string;
  canais: {
    descricao_curta_bling?: { texto: string; status: "rascunho" | "aguardando_aprovacao" };
    descricao_complementar_bling?: { texto: string; status: "rascunho" | "aguardando_aprovacao" };
    resumo_pdv?: { texto: string; status: "rascunho" | "aguardando_aprovacao" };
    seo_site?: { title: string; description: string; status: "rascunho" | "aguardando_aprovacao" };
    whatsapp?: { texto: string; status: "rascunho" | "aguardando_aprovacao" };
    social?: { texto: string; status: "rascunho" | "aguardando_aprovacao" };
  };
  evidencias: Array<{campo:string;url_ou_documento:string;conferido_em:string}>;
  pendencias: string[];
};
```

## Exemplo de molde, NÃO produto homologado

**Curta:** `[Tipo da peça] [Marca fabricante] [MPN]. Aplicação: [veículo, motor, anos aprovados]. SKU [código da loja].`

**Complementar:**
```text
Peça: [tipo e nome real]
Fabricante da peça: [marca homologada]
Referência fabricante (MPN): [código confirmado]
Código OEM da montadora: [somente se comprovado]
Aplicação: [montadora/modelo/versão/motor/anos confirmados]
Especificações: [apenas medidas e características com fonte]
Conteúdo do conjunto: [somente itens comprovados]
Restrições: [variantes que NÃO servem, se verificadas]
Antes da compra: conferir referência, ano e motorização com atendimento
```

**PDV:** `[SKU] • [peça] • [motor/versão aprovados] • [código] • verificar restrições`.

## Critérios de aceite do Claude Code

- Preencher `descricaoCurta` e `descricaoComplementar` apenas como **proposta** até autorização específica. Validar mapeamento v3 por testes e leitura no Bling; `supabase/functions/_shared/conector/matriz_bling.ts` já referencia campos.
- As duas descrições são diferentes, sem redundância massiva; o PDV encontra produto por SKU/OEM/MPN e mostra restrições antes de venda.
- Gerar versão site, SEO, Merchant, WhatsApp e social a partir da **mesma ficha**, nunca copiar texto de um canal como fonte de fato para outro.
- Com marca/OEM/medidas/aplicação desconhecidos, não completar por palpite. Caso com 8V/16V conflitante bloqueia aplicação no rascunho.
- Sem preço válido, não gerar `Offer` ou promoção; sem estoque, não prometer pronta-entrega; nenhum código de HTML/JSON-LD dentro do ERP.
- `descricaoComplementar` não pode conter custo, fornecedor sigiloso, margem, token ou observação interna. Checar formato que a integração real aceita (algumas descartam HTML).
- WhatsApp/Meta só após conexão, permissão, opt-in e aprovação por destino. Rascunho não equivale a envio.
- Testes com 2 lojas diferentes usando o mesmo SKU, sem vazamento de dados e sem duplicação no Bling.

**Dependências:** `nano-identidade-automotiva`, `nano-oferta-local`, `nano-seo-rastreavel`, `nano-publicacao-qa`, Skill fidelidade visual do PR #196, `CLAUDE.md`. Lembrar: Skill não é validador executável nem autorização de escrita.
