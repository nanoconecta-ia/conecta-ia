---
name: nano-identidade-automotiva
description: Validar identidade, referências técnicas, taxonomia e aplicação veicular por SKU antes de gerar textos, imagens, URLs ou feeds; impedir equivalências OEM e fitment inventados.
---

# Skill: identidade automotiva comprovada

**Acionar** em cadastro, enriquecimento, classificação, busca por veículo/motor, SEO por SKU, vitrine e produto destinado a agente externo. Esta Skill **não cadastra nem autoriza escrita no Bling**.

## Dados canônicos e prova

1. Ler `loja_id + bling_id/SKU` pelo conector e timestamp. SKU, código OEM de montadora, MPN do fabricante, GTIN, código de importador, códigos similares/substitutos e marca da peça são **identificadores diferentes**; sem prova não mapear um para o outro.
2. Montar **grafo tipado**, não só árvore de pastas: `SKU -> categoria do Bling -> nó taxonômico aprovado`; `SKU -> N aplicações` com montadora, modelo, motor/versão, cilindrada, válvulas, ano inicial/final, ressalvas; `SKU -> referências técnicas`; `SKU -> mídias com licença`. Navegação humana pode usar Marca → Categoria → Aplicação → Motor → Veículo → SKU, mas a relação N:M deve existir no banco.
3. Para cada afirmação técnica coletar `fonte_url/documento`, data da consulta, `tipo_codigo`, versão da evidência e estado: **confirmado / a_confirmar / conflitante / refutado**. O texto "cabe na peça" ou fotografia parecida não comprova compatibilidade.
4. Excluir generalizações perigosas: D4BH/4D56 e D4CB não são todos equivalentes; HR 8V/16V e variantes de pino, sensores, turbo, bronzinas, cárter são diferentes. Uma relação por motor não dispensa referência exata por SKU.
5. Se duas fontes se contradisserem, não escolher a mais conveniente; marcar conflito e criar proposta na fila de aprovação. Produto inexistente, SKU duplicado, aplicação genérica ou desatualizada bloqueiam publicação.
6. Nunca inventar GTIN, OEM, medidas, NCM, CEST, fabricante, montagem ou anos; dados fiscais não seguem para LLM web público. Catálogo oficial/documento homologado e dados aprovados da loja prevalecem sobre anúncio de marketplace.

## Saída obrigatória para outras Skills

Entregar objeto lógico `FichaConfirmada {loja_id,sku,produto_id,marca_peca,mpn?,gtin?,oems_com_fonte[],categoria_id,aplicacoes_aprovadas[],restricoes[],imagens_aprovadas[],pendencias[],proveniencias[]}`. Nenhuma propriedade é inferida só pela palavra-chave do título. `a_confirmar` não é `aprovado`.

## Testes de aceite

- HR 8V não recebe atributo 16V; D4BH não herda fitment D4CB; referência de fabricante não vira OEM.
- Um SKU com 2 aplicações homologadas permanece um item único. Duas peças diferentes com aplicações em comum não se tornam o mesmo SKU.
- Modelo desconhecido e foto genérica geram pendência, não alegação de compatibilidade.
- Sem fonte/sem autorização, saída ao site não contém esse atributo e a proposta fica rascunho.

**Arquivos a reutilizar:** `docs/conector-ia/descoberta-por-agentes.md`, `docs/taxonomia/proposta-bling.md`, `supabase/functions/_shared/seo/jsonld.ts`, `supabase/functions/_shared/consulta/`, `CLAUDE.md`. Implementar validadores determinísticos, não confiar apenas nesta Skill.
