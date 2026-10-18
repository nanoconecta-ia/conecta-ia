# 4. Matriz Bling ↔ Conecta.IA

Fonte executável: `supabase/functions/_shared/conector/matriz_bling.ts`. O teste `conector.test.ts` garante que (a) toda coluna gravada pelo espelho tem linha na matriz, (b) nenhuma linha implementada escreve no Bling, (c) custo/fornecedor não existem no espelho, (d) nenhuma linha afirma ter conferido a documentação oficial.

**Aviso de honestidade:** nenhum nome de campo/caminho da API v3 abaixo foi conferido em `developer.bling.com.br` (o domínio é bloqueado neste ambiente). Estão como o código atual os usa. `conferidoDoc` só vira `true` com evidência anexada.

## 4.1 Hoje: bling → Conecta.IA (espelho somente leitura, implementado)
Quem altera: só o `bling-sync` (service_role). O lojista não edita produto. Reversão: reexecutar a sincronização (o Bling prevalece).

| Campo | Caminho no Bling | Destino | Validação |
|---|---|---|---|
| id | `id` | `produtos.bling_id` | chave de idempotência `(loja_id, bling_id)` |
| sku / nome | `codigo` / `nome` | `sku` / `nome` | vazio ⇒ não publica |
| preço de venda | `preco` | `preco` | IA nunca sobrescreve |
| estoque | `estoque.saldoVirtualTotal` | `estoque` | IA nunca sobrescreve; frescor antes de cobrar |
| situação | `situacao` | `situacao` | ≠ 'A' ⇒ despublica; sumiu da lista ⇒ `ausente` |
| categoria | `categoria.id` | `categoria_bling_id` | ponte para taxonomia (`bling_categoria_taxonomia`) |
| marca, gtin, gtin tributário | `marca`, `gtin`, `gtinEmbalagem` | idem | GTIN nunca inventado |
| descrições | `descricaoCurta`, `descricaoComplementar` | idem | HTML reduzido a texto na vitrine |
| peso/dimensões/volumes | `pesoBruto\|pesoLiquido`, `dimensoes.*`, `volumes` | `peso_kg`, `*_cm`, `volumes` | `> 0`; zero = "não informado" |
| unidade, condição, formato, pai | `unidade`, `condicao`, `formato`, `idProdutoPai` | idem | variação por `pai_bling_id` |

## 4.2 Camada do Conecta.IA (nasce aqui; não volta ao Bling)
`taxonomia`, `aplicacao_veicular`, `codigos_oem_cruzados`, `imagens`, `descricao_enriquecida`: o agente **propõe** (`a_confirmar`, fonte e data obrigatórias), o lojista **aprova**; reversível. SEO: planejado (Fase 3).

## 4.3 Futuro: Conecta.IA → Bling (planejado, desligado)
| Campo | Condição para ligar |
|---|---|
| `descricao_enriquecida_no_bling` | lojista autoriza **o campo**; diff antes/depois; aprovação por escrita; `idempotency_key`; leitura de confirmação; ferramenta `bling.produtos.alterar` hoje `ativa:false`, `conferido:false`. |

## 4.4 Proibido (nunca, sem decisão explícita por escrito)
Custo, fornecedor e preço de compra (não copiados) · NCM/CEST/CST/CFOP no Bling (só após validação do contador e autorização específica) · preço e estoque alterados por IA.

## 4.5 Governança de sincronização (revisão pedida na seção 10 da ordem)
| Item | Estado | Lacuna |
|---|---|---|
| Escopos OAuth | por app da loja | **conferir** quais escopos o app precisa (leitura de produtos/estoque/empresa) — decisão do dono de 17/10: cadastro sim, NF só consulta |
| Renovação de token | ✅ cron 30 min, reserva (lock) no banco, 401 renova uma vez | — |
| Paginação / rate limit | ✅ 100/pág., ~3 req/s, recuo 1s/3s/8s só em GET | limites oficiais **não conferidos** |
| Sincronização incremental | 🟡 lista tudo a cada 15 min e busca detalhe só do que mudou/velho (24h) | custo cresce com o catálogo; webhook reduziria |
| Webhooks | 🔴 | ler "Webhooks" na doc; `sync_eventos` já existe para a fila |
| Duplicidade | ✅ `(loja_id,bling_id)`; SKU não é chave | — |
| Conflito | ✅ Bling prevalece; divergência registrada | tela de divergências no painel (Fase 2) |
| Retentativas / idempotência | ✅ leitura repete; escrita nunca; `idempotency_key` exigida no catálogo | — |
| Leitura após gravação | 📋 contrato definido; sem escrita ativa para exercitar | Fase 2 |
