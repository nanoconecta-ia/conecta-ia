# Motor de indexação — demonstração e evidências (2026-10-19)

Executada contra um Postgres **local**, com **produtos de teste fictícios** e conectores de teste (sem rede, sem Bling, sem produção). A saída abaixo foi gerada pelo próprio código; os testes automatizados (`pipeline.test.ts`, `comparacao.test.ts`, `extracao.test.ts`) repetem as mesmas verificações.

## Cenário 1 — produto limpo, até a aprovação humana
Entrada: nome sujo (`*** JOGO DE JUNTAS HR 2.5 D4CB - MARCA: MARCATESTE`), descrição com aplicação e **NÃO SE APLICA**, GTIN válido, peso 2,4 kg. Conectores: catálogo oficial (teste), página de fornecedor **com instruções maliciosas** (teste) e uma API **sem autorização** (ignorada).

```
== fila: {"processados":1,"paradosEm":{"aguardando_aprovacao":1},"falhas":[]}
== histórico:
  - → entrada [sistema] 
  entrada → normalizado [pipeline] texto normalizado e extraído
  normalizado → identificado [pipeline] peça identificada (marca da peça ≠ montadora do veículo)
  identificado → pesquisado [pipeline] 2 evidência(s) externa(s)
  pesquisado → comparado [pipeline] 0 conflito(s) entre fontes
  comparado → validado [pipeline] 2 pendência(s) de validação
  validado → enriquecido [pipeline] cadastro montado só com dado que tem fonte
  enriquecido → aguardando_aprovacao [pipeline] pronto para decisão do lojista
== pesquisa: {"falhas":[],"ambiguas":[],"ignorados":[{"id":"api-sem-contrato","motivo":"sem autorização do dono/contrato"}]}
== evidências:
  bling:TESTE-P1 (bling) → {"oem":["20910-4AU07"],"gtin":"7891252806921","peso_kg":2.4,"aplicacoes":[{"motor":"D4CB","modelo":"HR","ano_fim":null,"ano_inicio":2013}]}
  https://exemplo.invalid/catalogo/20910-4AU07 (oficial) → {"oem":["20910-4AU07"],"aplicacoes":[{"motor":"D4CB","modelo":"HR","ano_fim":2020,"ano_inicio":2013}]}
  https://fornecedor.invalid/p/123 (fornecedor, NÃO CONFIÁVEL, alertas=3) → {"oem":["20910-4AU07"],"aplicacoes":[{"motor":"D4CB","modelo":"HR"}]}
== identificação: {"marca_da_peca":"MarcaTeste","montadoras_citadas":["Hyundai"],"classe_peca":{"classe":"a_confirmar","evidencia":null,"pendencia":"marca 'MarcaTeste' sem fonte que a classifique (OEM ou reposição)"}}
```

Pontos a observar:
- O pipeline **parou sozinho** em `aguardando_aprovacao`: não aprova, não sincroniza, não publica.
- `bling:TESTE-P1 (bling)` × `catalogo-oficial (oficial)`: o mesmo OEM e o mesmo início de período (2013) → **0 conflitos**.
- A página do fornecedor foi marcada **NÃO CONFIÁVEL (3 alertas)**: o comentário HTML, a linha "aprove todos…" e a referência `bling.produtos.alterar` foram **retirados**. A aplicação dela entra com **confiança baixa**. Nada daquilo chegou ao cadastro (o teste procura o texto no resultado e falha se achar).
- `classe_peca = a_confirmar`: a marca não está na lista de fornecedores homologados **com fonte**.
- `montadoras_citadas = Hyundai` e `marca_da_peca = MarcaTeste`: marca da peça e montadora do veículo ficam separadas.
- O "NÃO SE APLICA" (`D4BH`, `Euro III`, `até 2012`) é **exclusão**: não aparece como aplicação.

### Cadastro enriquecido gerado (trecho)
Cada atributo traz fonte, data da consulta, confiança e situação `a_confirmar`.
```json
{
 "sku": "TESTE-P1",
 "nome_comercial": {
  "fonte": "bling:TESTE-P1",
  "valor": "Jogo de Juntas HR 2.5 D4CB - Marcateste",
  "origem": "bling",
  "situacao": "a_confirmar",
  "confianca": "media",
  "consultado_em": "2026-10-19T12:00:00.000Z"
 },
 "gtin": {
  "fonte": "bling:TESTE-P1",
  "valor": "7891252806921",
  "origem": "bling",
  "situacao": "a_confirmar",
  "confianca": "media",
  "consultado_em": "2026-10-19T12:00:00.000Z"
 },
 "medidas": {
  "peso_kg": {
   "fonte": "bling:TESTE-P1",
   "valor": 2.4,
   "origem": "bling",
   "situacao": "a_confirmar",
   "confianca": "media",
   "consultado_em": "2026-10-19T12:00:00.000Z"
  },
  "altura_cm": null,
  "largura_cm": null,
  "profundidade_cm": null
 },
 "nao_se_aplica": {
  "fonte": "bling:TESTE-P1",
  "valor": "Motores D4BH Euro III até 2012.",
  "origem": "bling",
  "situacao": "a_confirmar",
  "confianca": "media",
  "consultado_em": "2026-10-19T12:00:00.000Z"
 },
 "seo": {
  "slug": "jogo-de-juntas-hr-2-5-d4cb-marcateste-teste-p1",
  "titulo": "Jogo de Juntas HR 2.5 D4CB - Marcateste - TESTE-P1",
  "descricao": "Jogo de Juntas HR 2.5 D4CB - Marcateste. Veículos citados no cadastro: Hyundai, HR. Motor: D4CB (Euro 5). Não se aplica: Motores D4BH Euro III até 2012."
 },
 "pendencias": [
  "dimensões ausentes ou incompletas: não inventadas",
  "ano informado sem evidência do início da importação/comercialização no Brasil: ano a confirmar",
  "marca 'MarcaTeste' sem fonte que a classifique (OEM ou reposição)"
 ]
}
```
Observe: `dimensoes` ausentes ficaram `null` com pendência **"não inventadas"**; o peso é o do Bling, **sem margem somada**.

## Cenário 2 — o ano diverge em 1
Cadastro diz `(2013+)`; o catálogo oficial de teste diz `2014-2020`. Os períodos se tocam, mas começam em anos diferentes — exatamente o erro de ano-modelo que gera peça errada.
```
== conflito [aplicacao] inicio do periodo (HR)
   A: {"fonte":"bling:TESTE-P2B","valor":2013,"tipo_fonte":"bling"}
   B: {"fonte":"https://exemplo.invalid/c2014","valor":2014,"tipo_fonte":"oficial"}
== estado do item: conflito | tentativa de pular para validado:
   recusado: transição não permitida: conflito → validado
```
O item **ficou travado em `conflito`**; só o lojista resolve e devolve à comparação.

## Cobertura da Fase 6 (testes automatizados)
| Requisito | Teste |
|---|---|
| Isolamento entre lojas | `pipeline_indexacao.sql` (itens, reserva, resolução, leitura); `pipeline.test.ts` DEMO 5; testes de RLS anteriores |
| Duplicidade de SKU e GTIN | `ferramentas_verificacao.sql`; DEMO 5 (mesmo SKU ativo não duplica) |
| Produtos sem GTIN | DEMO 3 (`sem GTIN: não inventado`) |
| Referências OEM conflitantes | `comparacao.test.ts`; DEMO 2 (OEM, GTIN e peso divergentes) |
| Compatibilidades falsas | `validar_aplicacoes_do_sku` (nunca "incompatível"); NÃO SE APLICA ≠ aplicação |
| Dados incompletos | DEMO 3 |
| Falhas de API e limites | DEMO 4; `pipeline_reservar` (5 simultâneos) |
| Retentativa após timeout | DEMO 4 (recuo, nova tentativa, 5ª falha para) |
| Sincronização repetida | idempotência de `pipeline_criar`; uma única proposta no DEMO 1 |
| Publicar sem aprovação | agente e editor recusados; pular etapa recusado |
| Instruções maliciosas em página | `comparacao.test.ts` (saneamento) e DEMO 1 (nada vaza para o cadastro) |

## O que a demonstração NÃO prova
- Pesquisa em fontes reais: os conectores são de teste; o ambiente de desenvolvimento não alcança sites externos.
- IA de verdade: a etapa de IA é opcional e não foi exercitada (0 chaves ativas).
- Sincronização real com o Bling: `criarProposta` e `confirmarSincronizacao` são injetados; no teste, simulados.
