# Piloto Bling → Catálogo → Imagens → Site → MCP — diagnóstico e desenho para aprovação

> Data: 2026-11-02. **Fase 1 de 2.** Este documento é o diagnóstico (só leitura) e o desenho. **Nenhuma migração, bucket, função ou arquivo foi criado/aplicado.** O `CLAUDE.md` exige aprovar o desenho antes de criar tabelas/migrações. Nada foi escrito no Bling.

## 1. Estado reconsultado (leitura, hoje)
| Item | Valor |
|---|---|
| Produtos no espelho / publicados / lojas | 42 / **0** / 1 (loja `cd9d7570…`) |
| `produto_imagens` | **0** linhas |
| `storage.objects` | **0** arquivos; buckets: `lojas-marca` (público, 512 KB) e `agente-anexos` (privado, 20 MB, anexos do chat) |
| Funções | `bling-sync` v7, `loja-publica` v4, `conector-mcp` v3 (todas ativas) |

### Os dois produtos do piloto (confirmados no banco e no Bling, por igualdade exata)
| | OC1224 | 80692 |
|---|---|---|
| Linha no espelho | 1 (sem duplicidade de SKU) | 1 (sem duplicidade de SKU) |
| Bling ID | `16622651283` = ordem ✔ | `16719464748` = ordem ✔ |
| Categoria Bling (espelho = Bling) | `14676579` ✔ | `14676551` ✔ |
| Taxonomia | Filtros de óleo — **proposto** | Juntas e retentores — **proposto** |
| Marca / situação / publicado | MAHLE / METAL LEVE / A / não | SABó / A / não |
| Imagem no Bling | **1 interna** (arquivo hospedado pelo Bling) | **1 externa** (link do CDN de um anúncio do Mercado Livre) |
Nem custo, nem fornecedor, nem dado fiscal foram copiados para este documento (a resposta do Bling os contém; não são usados).

## 2. Achados que mudam ou condicionam a ordem
1. **As duas fotos são de naturezas diferentes.** OC1224: arquivo do próprio Bling. 80692: foto de **anúncio de terceiro** em marketplace → direitos de uso **desconhecidos** e identidade **não provada** (o nome do arquivo não traz o SKU; a observação do Bling já diz "imagens externas não verificadas para publicação"). Para o piloto ela entra **só na galeria administrativa**, como pendente, **sem direitos**, nunca pública.
2. **URL assinada do Bling é credencial.** O link da imagem interna carrega `AWSAccessKeyId` e `Signature` (e vence: o principal em 09/11, a miniatura hoje). **Nunca persistir a URL com query**; guardar só o caminho-base sem assinatura como proveniência e baixar o arquivo no backend na hora da leitura.
3. **`produto_imagens` não tem onde guardar o arquivo**: faltam caminho no storage, hash, bytes, tipo (mime), versão tratada e evidências. `url` é `NOT NULL`. Há `url_original`/`url_tratada`, `confianca` (0–1), `direitos_*`, `licenca_tipo`, `cruzamento_*`, `fundo_branco`, `alt_texto`.
4. **Sem bucket adequado.** `lojas-marca` é público e de 512 KB (marca); `agente-anexos` é de anexos de chat (ciclo de vida diferente). Proposta: bucket novo e **privado**.
5. **Não existe processador de imagem real**: `imagens/variantes.ts` só tem um mock (`ProcessadorMock`). A "versão com fundo branco" exige decodificar pixels (biblioteca WASM no Deno) → dependência nova a avaliar.
6. **`bling-sync` não importa imagens** e a leitura de produto do Bling no `conector-mcp` filtra campos. Falta um leitor mínimo e dedicado de mídia (lê só os links de imagem).
7. **O banco já bloqueia imagem não aprovada no público**: política `imagens_publicas` (anon) exige `aprovada` + `direitos_confirmados_em` + não removida; o `anon` só tem `SELECT` em colunas seguras (sem `url_original`, direitos, evidência); `loja-publica` lê a view `imagens_publicaveis`. Os testes de aceite 7 e 9 partem disso; ainda faltam provas automatizadas e uma prova em ambiente real.
8. **Não existe método de pontuação de confiança.** Os cortes 80%/95% mapeiam para `confianca` 0,80/0,95, mas nenhum código calcula a nota. Sem método, "não atribuir confiança fictícia" implica `confianca = NULL` ("não avaliada") + revisão humana + evidências registradas.
9. **O ambiente de desenvolvimento não alcança o Bling S3 nem o CDN do Mercado Livre** (proxy devolve 403) e não contornei. Logo, **o piloto real só pode ser executado dentro do backend** (função) ou num job com rede. Isso conflita com "sem publicação em produção" — ver decisão D5.
10. **Documentação interna desatualizada** (item 9 da ordem): o cabeçalho de `conector-mcp/index.ts` ainda diz "NÃO IMPLANTADA nesta fase" e a função está ativa (v3, idêntica à `main`, 49/49 arquivos). Corrigir na entrega.
11. O texto de 80692 no Bling já tem revisão de 02/11 feita por agente externo antes deste piloto; este piloto **não escreve** no Bling.

## 3. Reaproveitamento (nada paralelo)
| Necessidade | Já existe (reutilizar) | Novo (mínimo) |
|---|---|---|
| Validar URL/arquivo, SSRF, tipo real, dimensões, SHA-256 | `busca_segura/imagem_original.ts` (#255) | aceitar bytes já baixados (função irmã) |
| Regras de aprovação, direitos, cruzamento, variantes | `imagens/regras.ts`, `busca_segura/galeria.ts`, `imagens/variantes.ts` (chave de storage determinística) | — |
| Registro e fila de aprovação | `produto_imagens`, RPC `imagem_propor`, `imagem_decidir`, Fila/Galeria do painel | colunas novas (seção 4) |
| Leitura do Bling com token da loja | `porta_bling.ts` / `bling_armazem` | leitor mínimo de mídia |
| Entrega pública | view `imagens_publicaveis` + `loja-publica` | — (fase posterior: cópia para bucket público) |
| MCP | `conector-mcp` + registro de ferramentas | 1–2 ferramentas de leitura da galeria |
| Painel | `GaleriaProduto.tsx` no Catálogo | mostrar original × tratada, evidências, confiança |

## 4. Migração proposta (RASCUNHO — não aplicada; aguarda aprovação)
Aditiva, sem `DROP`, sem alterar o que existe:
```sql
alter table public.produto_imagens
  add column importada_de text check (importada_de in ('bling_interna', 'bling_externa')),
  add column arquivo_original_path text,
  add column arquivo_original_sha256 text check (arquivo_original_sha256 ~ '^[0-9a-f]{64}$'),
  add column arquivo_original_bytes integer check (arquivo_original_bytes > 0),
  add column arquivo_original_mime text check (arquivo_original_mime in ('image/jpeg', 'image/png', 'image/webp')),
  add column arquivo_tratado_path text,
  add column arquivo_tratado_sha256 text check (arquivo_tratado_sha256 ~ '^[0-9a-f]{64}$'),
  add column evidencias jsonb not null default '[]' check (jsonb_typeof(evidencias) = 'array');
-- isolamento por loja e por produto no próprio caminho do arquivo
alter table public.produto_imagens add constraint produto_imagens_caminho_da_loja check (
  (arquivo_original_path is null or arquivo_original_path like 'lojas/' || loja_id::text || '/produtos/' || produto_id::text || '/%')
  and (arquivo_tratado_path is null or arquivo_tratado_path like 'lojas/' || loja_id::text || '/produtos/' || produto_id::text || '/%'));
-- duplicidade por conteúdo no mesmo produto
create unique index produto_imagens_sha_unico on public.produto_imagens (produto_id, arquivo_original_sha256)
  where arquivo_original_sha256 is not null and removida_em is null;
-- bucket PRIVADO, só service_role escreve/lê (sem política em storage.objects); 8 MB; jpeg/png/webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produto-imagens', 'produto-imagens', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']);
```
Garantias a testar no banco local antes de pedir aplicação: `anon` **não** recebe as colunas novas (grants por coluna); a view `imagens_publicaveis` continua igual; caminho de outra loja é recusado; hash repetido no mesmo produto é recusado; conteúdo de `evidencias` nunca é lido pelo público.
Rollback: `drop index`, `drop constraint`, `drop column` das 8 colunas e `delete from storage.buckets where id='produto-imagens'` (somente se vazio). Não afeta dados existentes (tabela com 0 linhas).

## 5. Pipeline proposto (por produto, idempotente)
1. **Ler a mídia no Bling** (leitor mínimo, GET apenas): devolve só `{tipo: interna|externa, link}`; nada mais do produto entra no fluxo.
2. **Conferir identidade**: SKU e `bling_id` do espelho = os do Bling; senão, interrompe.
3. **Baixar no backend** (reuso do guarda de #255: https, sem rede interna, tempo e tamanho limitados, tipo real pelos bytes, dimensões, SHA-256). Link interno: usado uma vez, **não persistido** (só o caminho-base).
4. **Persistir o original** no bucket privado: `lojas/{loja}/produtos/{produto}/{imagem}/original.{ext}` (chave de `variantes.ts`, só UUIDs).
5. **Registrar** em `produto_imagens` com `aprovada=false`, `tipo` honesto (foto vinda do cadastro do próprio produto = `real` só se o lojista confirmar; senão `ilustrativa`), `origem='bling_interna|bling_externa'`, hashes, bytes, mime, dimensões, `evidencias`.
6. **Duplicidade**: índice único por produto + hash; mesma imagem importada de novo = no-op (idempotência por `bling-img:{loja}:{produto}:{sha256}`).
7. **Original intocado**; "tratada" (fundo branco) só se necessário e só depois de decisão D4.
8. **Direitos**: `licenca_tipo` e `direitos_confirmados_*` vazios por padrão; a foto interna do Bling pode ser marcada como `propria` **pelo lojista** com referência (a constraint exige referência ≥ 10 caracteres e o usuário); a externa fica sem direitos.
9. **Confiança**: `NULL` (não avaliada) + evidências objetivas listadas (ex.: "veio do cadastro do próprio produto no Bling, ID X, lida em AAAA-MM-DD", "hash novo", "sem código visível verificado"). Regra futura: <0,80 rejeitar como identificada; 0,80–0,94 revisão humana; ≥0,95 candidata forte, **sempre** com aprovação e direitos. A regra só vale depois que um método de pontuação for aprovado (D3).
10. **Galeria** mostra tudo para homologação; aprovar é do lojista, por imagem.

## 6. Site público e MCP
- `loja-publica`: já projeta campos explícitos e só produto publicado; manter e **acrescentar teste** de que a resposta nunca contém custo, fornecedor, `url_original`, evidências nem imagem não aprovada/sem direitos.
- **Entrega do arquivo ao público** (decisão D2): recomendado **copiar para um bucket público só no momento da publicação** (aprovada + direitos), com `url` estável; o bucket privado nunca é exposto. Fora do escopo do piloto.
- MCP (mesmo `conector-mcp`, sem novo gateway): ferramenta de leitura `conecta.galeria.ver` (por SKU): devolve metadados (estado, origem, confiança, evidências resumidas, dimensões, hash) e **URL assinada de 10 min somente para imagem aprovada com direitos**; imagem pendente volta **sem URL**. Isolamento por `loja_id` da chave/sessão. Nenhum agente público recebe imagem não aprovada.

## 7. Testes de aceite × como serão provados
| # | Aceite | Prova planejada |
|---|---|---|
| 1–2 | OC1224 e 80692 com arquivo persistente | **execução real no backend** (D5): objeto no bucket + linha em `produto_imagens` + hash |
| 3 | Associação correta a produto e loja | SQL (FK composta/constraint do caminho) + leitura real |
| 4 | Galeria administrativa exibindo as fotos | captura da galeria publicada ou em homologação (D5) |
| 5 | Taxonomia preservada | consulta antes/depois: `taxonomia_no_id` e status `proposto` iguais |
| 6 | Originais preservados | hash do arquivo guardado = hash baixado; sem sobrescrita (teste) |
| 7 | Não aprovadas bloqueadas na vitrine | SQL como `anon` + chamada pública de `loja-publica` |
| 8 | MCP autenticado consulta imagens autorizadas | unidade + SDK MCP em loopback; depois chamada real com chave |
| 9 | API pública sem custo/fornecedor | teste automatizado do contrato de saída + chamada real |
| 10 | Sem escrita no Bling e sem duplicidade de SKU | testes: porta do Bling só com GET; `count(*)` de SKU antes/depois; auditoria sem PATCH |
Automatizado (CI) cobre 3, 6, 7, 9, 10 e parte de 8. **1, 2, 4 e a parte real do 8 dependem de executar no backend.**

## 8. Decisões que preciso de você
- **D1 — Migração da seção 4** (colunas, restrições, índice, bucket privado): aprova, ajusta ou recusa?
- **D2 — Como o site entrega a foto aprovada**: (A, recomendado) copiar para bucket público na publicação; (B) URL assinada por requisição. Pode ficar para depois do piloto.
- **D3 — Confiança**: manter `NULL` + revisão humana no piloto (recomendado) **ou** aprovar uma régua objetiva de pontuação (precisa ser definida e aprovada por você antes de gravar qualquer número).
- **D4 — "Versão tratada" (fundo branco)**: no piloto, só medir e registrar (`fundo_branco`) sem tratar (recomendado) **ou** adotar biblioteca WASM de imagem e tratar sem alterar a peça.
- **D5 — Como executar o piloto real** sem "publicação em produção": o código precisa rodar com rede e acesso ao Storage. Opções: (a) autorizar **um** deploy pontual da função no projeto (produção, com revisão e reversão); (b) job pontual no GitHub Actions com segredo do banco (exige criar esse segredo — não recomendo); (c) só entregar código + testes e **adiar** a prova real. Sem uma delas, o critério de conclusão ("duas imagens reais na galeria") **não pode ser cumprido** e eu não vou declarar concluído.
- **D6 — Foto interna do OC1224**: você confirma que é foto própria da Mobis? (define `licenca_tipo='propria'` com referência; sem isso fica sem direitos). A do 80692 fica **sem direitos**.

## 9. Riscos
R1 URL assinada do Bling vazar em log/DB (mitigado: não persistir, só caminho-base). R2 foto de terceiro (80692) publicada sem direito (mitigado: bloqueio no banco e nos testes). R3 identidade errada por aparência semelhante (mitigado: confiança nula + revisão humana). R4 dependência nova de processamento de imagem (D4). R5 deploy necessário para a prova real (D5). R6 colunas novas expostas ao `anon` (mitigado: grants por coluna + teste). R7 migração com confirmação interativa no `apply_migration` (aditiva, sem `DROP`).

## 10. Próximo passo após o seu aval
PR 1 (banco): migração + testes SQL locais + reversão. PR 2 (código): leitor de mídia do Bling (somente GET), importador, ferramenta/ação, galeria com original × tratada e evidências, `conecta.galeria.ver`, testes de contrato público, correção da documentação do `conector-mcp`. Depois, a execução real conforme D5, com evidências.
