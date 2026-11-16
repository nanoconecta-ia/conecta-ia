# Piloto MOBIS — Espelhamento Bling → Conecta.IA → aplicação → vitrine

Status: **rascunho de aprovação**. Produto piloto `CI002916`. Não publicar ou anunciar aplicações ainda não homologadas.

## Fonte de verdade verificada no ERP
- Bling: produto `16733945604`, SKU `CI002916`, marca registrada **Trim Go**, simples (`formato=S`).
- Produto físico no Conecta.IA: `13904336-e754-43df-a9b9-2957770c2634`, `bling_id=16733945604`.
- Preço-base no Bling e Conecta.IA na auditoria: R$ 13.500,00; saldo virtual: 0. **Nenhuma alteração de preço ou estoque realizada neste piloto.**
- Código `CI003695` é código **do fornecedor** no Bling; não foi comprovado como intercambiável ao SKU do produto. O fornecedor comercial é Quatro Distribuidora. Não inferir fabricante/importador legal a partir desses campos.
- Fotos da peça: apenas `imagens_publicaveis` e arquivos efetivamente licenciados, nunca motor gerado por IA.
- Tributação continua exclusivamente no ERP e respectiva NF. Não alterar NCM/CEST/origem.

## Nó do produto físico — caminho auditado
`Motor (motor)` → `Blocos e motores completos (blocos-motores)` → `Motor parcial (tec-blocos-motores-motor-parcial)`.

O nó técnico do **produto** não deve ser confundido com a hierarquia **montadora → modelo → geração → motorização**. A aplicação é vínculo N:1 ao produto físico, não cópia de produtos do Bling.

## Cinco vínculos já existentes (pendentes de homologação)
| Página | Modelo | Motor pesquisado | Período informado | Estado |
|---|---|---|---|---|
| `hyundai-hr-ci002916` | Hyundai HR | 2.5 8V D4BH | 2005–2012 | `a_confirmar` |
| `kia-bongo-k2500-ci002916` | Kia Bongo K2500 | 2.5 8V D4BH | 2005–2012 | `a_confirmar` |
| `mitsubishi-l200-gl-gls-ci002916` | Mitsubishi L200 GL/GLS | 2.5 8V 4D56 | não definido | `a_confirmar` |
| `mitsubishi-l200-sport-ci002916` | Mitsubishi L200 Sport | 2.5 8V 4D56 | início 2003; fim indefinido | `a_confirmar` |
| `mitsubishi-pajero-sport-ci002916` | Mitsubishi Pajero Sport | 2.5 8V 4D56 | início 2006; fim indefinido | `a_confirmar` |

- Nenhuma das cinco aplicações tem `codigo_oem` homologado.
- As páginas permanecem `pagina_indexavel=false`; o produto `publicado=false` e `exibicao_teste=true`.
- Quatro aplicações já referenciam o `modelo_id` da tabela `modelos`; Pajero Sport permanece sem `modelo_id` porque não foi encontrado um modelo Pajero correspondente na consulta auditada.
- Atenção à modelagem legada: `produto_aplicacoes.marca_veiculo_id` e `montadora_origem_id` apontam por FK à tabela **marcas**, enquanto `modelos.montadora_id` aponta para **montadoras**. Não gravar UUID de `montadoras` nos campos que apontam para `marcas`. Uma tentativa de correção foi rejeitada pelo FK e **não produziu alteração**.

## Contrato de espelhamento a preservar
1. `produtos.id + bling_id + sku`: identidade única, preço e saldo provenientes da fonte ERP.
2. `taxonomia_no_id`: sistema → subsistema → categoria da peça.
3. `produto_aplicacoes`: montadora/modelo/geração/motor/anos + OEM da aplicação, sempre com prova e revisão.
4. `produto_codigos`: códigos do fornecedor, fabricante, OEM e intercâmbio com fontes e status independentes.
5. Uma vitrine por aplicação aprovável, com imagem real da peça e identidade contextual de veículo/montadora, sem multiplicar SKU/estoque.
6. Preço único por produto mestre no piloto; regras futuras de preço por canal/aplicação exigem modelo explícito e aprovação.
7. Dados fiscais/GTIN de origem nunca inferidos de catálogo externo; informações fiscais completas permanecem vinculadas à NF no ERP.
8. Sem OEM comprovado e sem aprovação, manter rascunho e `noindex`, sem Google Ads/Merchant Center.

## Checklist antes de liberar os demais produtos
- [x] Identidade Bling ↔ Supabase conferida, sem clones físicos.
- [x] Caminho de taxonomia do motor parcial conferido.
- [x] Cinco vínculos para páginas por veículo já registrados em modo de revisão.
- [x] Modelo de ficha individual implementado **na branch** `feature/mobis-ficha-real-aplicacao`; não implantado.
- [ ] Resolver separação/relacionamento **marcas x montadoras** sem afetar cadastro fiscal.
- [ ] Cadastrar/validar modelo Pajero Sport e, quando necessário, geração/versão.
- [ ] Homologar OEM e compatibilidade (incluindo chassi, anos, componentes) separadamente por aplicação.
- [ ] Confirmar autorização de fotografias reais do produto e do veículo, logotipos da montadora e identidade MOBIS.
- [ ] Compilar, testar Edge Function, responsividade, proteção de publicação e links no ambiente de homologação.
- [ ] Aprovação humana explícita antes de merge/deploy e anúncios.

**Nenhuma ficha em revisão é anúncio de peça comprovadamente compatível.**
