# MOBIS — Auditoria operacional Nano + filtro OC1224 (16/11/2026)

**Controle:** pilotagem sem publicação, sem edição de estoque/NF/códigos no ERP. PR #399.

## 1. Inventário verificável no Conecta.IA
- 1.259 produtos, todos com `bling_id` preenchido, mas **180 sem SKU** no espelho.
- 984 sem nó de taxonomia; 915 sem marca.
- 17 aplicações em revisão, nenhuma com OEM registrado/aprovado; cinco sem ligação a `modelos`.
- Não existe duplicidade de SKU não nulo entre os produtos conferidos.
- Cinco registros `produto_enriquecimento` com status `aprovado` têm fonte com “aguarda aprovação” ou “decisão humana”. **Não foram alterados**; encaminhar para auditoria de aprovação.

## 2. Fila técnica determinística
Função `public.mobis_revisao_catalogo(p_loja uuid,p_limite int)` instalada no Supabase via migrations `20261116070000` e `20261116071000`.

Sinaliza:
- P0: identidade sem SKU/ID Bling; aplicação sem modelo/OEM/período/homologação; enriquecimento "aprovado" mas dependente de decisão humana.
- P1: falta de marca e nó técnico; códigos de cruzamento pendentes; NCM do Bling ainda não conferido na nota.

Segurança comprovada:
`has_function_privilege('anon',..., 'EXECUTE')=false`;
`authenticated=false`; `service_role=true`.
É função `SECURITY INVOKER`, somente leitura. Não autoriza publicação nem modifica o ERP. A consulta traz um recorte paginado/limitado de pendências; **os resultados limitados a 200 não representam a contagem total**.

## 3. Exemplo real: filtro OC1224
Produto no Bling **16275882008**:
- Nome `OC1224 FILTRO OLEO BLINDADO`, **campo codigo/SKU vazio**, marca vazia; GTIN `7894766669907` (dígito verificador válido).
- NCM informado no Bling `8421.23.00`; CEST e demais dados fiscais permanecem no ERP.
- Nenhuma imagem vinculada no produto do Bling consultado.
- Dimensões e pesos zerados no ERP; jamais preencher como medidas reais apenas com anúncio externo.
- O ID segue como identidade primária de origem: `produtos.bling_id='16275882008'`. Não converter `OC1224` automaticamente em SKU sem autorização.

### Pesquisa B2B — candidatos, não homologação
- Medauto Distribuidora: `https://medauto.com.br/produto/filtro-lubrificante-hr-25-tdi-06-oc1224%2B883`.
- Rovalepaes: `https://www.rovalepaes.com.br/motor/filtro-lubrificante-oc1224-filtro-lubrificante-hiunday-hr-2-5-w9020-psl332-ph5596-ofl0126b-a12h040-e`.

Esses sites associam `OC1224`, GTIN `7894766669907`, à marca MAHLE, e um informa dimensões **candidatas**: 119 mm de altura, 96,5 mm diâmetro, M26 x 1,5 de rosca. Não são prova para abrangência de motores/anos/OEM; conferir com fabricante e embalagem. Variação nos códigos de correspondência de marcas em anúncios reforça a necessidade de pesquisa e homologação.

### Ações realizadas
- 3 sugestões `produto_enriquecimento` criadas com status `a_confirmar`: `marca_peca`, `descricao_curta` e `descricao_longa`, cada uma com fonte e confiança estimada.
- NCM `84212300` espelhado em `produto_fiscal` com `origem_ncm='bling_erp'`, `status='a_confirmar'`, **sem afirmar verificação por XML**.
- Nenhuma edição no Bling; aplicações ainda não criadas nem homologadas; nenhum anúncio publicado.

## 4. Proposta de regra Nano v2 (inativa)
Inserido `agente_prompts.nome='nano_catalogo_mobis', versao=2, estado='proposto'`, mantendo v1 e acrescentando:
- A fila de revisão como fonte de alertas administrativos.
- ID do Bling não é substituto do SKU; não criar código por adivinhação.
- Detectar e escalar aprovações contraditórias.
- Tratar MAHLE OC1224 e sua procedência como sugestão em revisão.
- Exibir NCM público, mas proteger documento/fornecedor/custo.

**Aprovação do prompt ainda não concedida; Nano não foi reconfigurado automaticamente.**

## 5. Para avançar para cadastro comercial
1. Conferir etiqueta e embalagem do OC1224 no estoque; marca/código/GTIN, nota de entrada.
2. Confirmar com fabricante oficial dimensões, válvulas, rosca e aplicações por motor/ano/OEM.
3. Decidir se o campo `codigo` do Bling receberá `OC1224` ou código interno distinto, mantendo referência industrial separada.
4. Aprovar descrições; conferir imagens e direitos; medir embalagem; sincronizar e reler.
5. Só então criar páginas individuais por aplicação e publicação/Shopping após validação de disponibilidade, dados estruturados e SEO rastreável.

**Observação:** conteúdo editorial sobre marcas/veículos não é evidência de intercambialidade.
