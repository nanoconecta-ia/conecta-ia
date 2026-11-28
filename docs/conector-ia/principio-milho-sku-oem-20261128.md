# Princípio do Milho — multiplicação de conhecimento SKU × OEM × Aplicação (sem multiplicar estoque)

**Data:** 2026-11-28 · **Status:** norma canônica conceitual · **Escopo:** Conecta.IA / Mobis Autopeças (`painel/`)
**Natureza:** princípio reitor para humanos e agentes. **NÃO autoriza** implantação em produção, merge, escrita no ERP/Bling, migração no banco operacional (`dsfzhsrudriqkumtlqwj`) nem publicação. Documentação não implica implantação.
**Travas vigentes:** `produto_automacao.pausado` bloqueia gravações por agente; catálogo Mobis em modo informativo **sem preço e sem foto obrigatória**; `offers`/`price`/`InStock` e feed Google Merchant **preparados e DESLIGADOS** até liberação do dono.

> Leia junto: `CLAUDE.md` (regras mestras), `docs/conector-ia/porteiro-master-ofertas-por-aplicacao-oem-seo-bling-20261119.md`, `docs/conector-ia/regra-mestra-catalogo-enriquecido-sem-preco-sem-foto-20261119.md`, `docs/conector-ia/diretriz-indexacao-google-taxonomia-individualizada-20261125.md`.

---

## 1. O princípio, em uma frase

**Um grão gera muitos grãos — mas o estoque continua sendo um só.**
Um único **SKU mestre** (produto físico cadastrado no Bling) multiplica **conhecimento técnico e oportunidades comerciais** (OEMs, aplicações, páginas, SEO), **sem jamais multiplicar a quantidade física** nem duplicar o cadastro.

**Multiplicar conhecimento ≠ multiplicar estoque.** Toda aplicação converge para a mesma identidade patrimonial (`sku_pai`) e a mesma disponibilidade real (estoque único do Bling).

---

## 2. Correspondência milho → arquitetura (não criar sistema paralelo)

| Milho | Significado | Onde vive no código (existente ou pendente) |
|---|---|---|
| Grão | SKU mestre (produto físico) | `produtos` + espelho só-leitura do Bling |
| Solo | Infraestrutura de dados | Supabase `dsfzhsrudriqkumtlqwj` (somente este ref) |
| Raízes | OEM, documentação, fabricantes, fontes rastreáveis | `RelacaoTecnicaEvidencia` / engineering (SHA-256 por documento) |
| Tronco | Identidade patrimonial do produto | `sku_pai` (identidade preservada) |
| Crescimento | Engenharia de intercâmbio/cruzamento de códigos | `nano_lifecycle/engineering`, reconciliação veicular |
| Espigas | Famílias de aplicações veiculares homologadas | taxonomia por veículo (`taxonomia_nos`, grafo veicular) |
| Grãos da espiga | Aplicação individual (montadora×modelo×geração×ano×motor×mercado) | `produto_aplicacoes` / página `#/a/<slug>` |
| Colheita | Páginas, busca orgânica, oportunidades comerciais | `seo_evidencia`, `PaginaAplicacaoMobis`, vitrine pública |
| Novo plantio | Enriquecimento contínuo, auditável | ciclo Nano Lifecycle + Quality Gate |

**Regra:** usar a arquitetura existente. É **proibido** criar autoridade, tabela ou fluxo paralelo ao que já está descrito nas regras mestras.

---

## 3. Vocabulário controlado (para o agente não alucinar)

### 3.1 Estados de cada dado (obrigatório marcar)
- `confirmado` — tem fonte autorizada + data + evidência (hash do documento).
- `ausente` — não existe no cadastro; **não inventar**.
- `nao_consultado` — ainda não pesquisado; **não presumir**.
- `divergente` — fontes conflitam; **sinalizar**, não escolher sozinho.
- `aprovado` — validado por humano/auditor independente (libera publicação do canal).

### 3.2 Entidades
- **SKU mestre:** identidade comercial/patrimonial do produto físico. Um só por produto. Estoque único.
- **OEM:** referência técnica original da peça **ou** da aplicação. Um SKU pode ter **vários** OEMs comprovados sem perder identidade. **OEM de componente interno ≠ OEM do conjunto completo.** Código de junta/filtro **não** vira OEM de motor parcial.
- **Aplicação:** combinação exata Peça × Veículo × Motor × Período × Mercado(`BR`), com OEM e evidência próprios. É um **grão da espiga**, não um produto novo.
- **Página pública de aplicação:** registro individual (URL/título/slug/meta/JSON-LD próprios) ligado ao mesmo `sku_pai` e ao estoque único.

### 3.3 Proibições inegociáveis (anti-alucinação)
Nunca inventar nem presumir: **OEM, GTIN/EAN, ano, motorização, foto de outra peça/veículo, preço, estoque, NCM, compatibilidade, métrica**. Compatibilidade exige relação técnica + fonte + data. Semelhança de código ou de imagem **não** prova equivalência. Sem VIN/chassi comprovado: "a confirmar".

---

## 4. Regra do grão → múltiplas aplicações (como multiplicar sem duplicar)

1. **1 SKU físico = 1 cadastro = 1 estoque.** Sempre.
2. Cada **aplicação comprovada** gera **1 página filha** (`#/a/<slug>`), com conteúdo **único e verdadeiro** (veículo, motor, anos, OEM daquela aplicação, restrições, contraindicações).
3. Entrada com vários veículos → dividir em **N aplicações candidatas**, **sem clonar o produto físico**.
4. `oem_compartilhado` só quando **o mesmo conjunto OEM** for comprovado entre aplicações.
5. Sem OEM/ano/motor explícito → `PENDENTE_REVISAO_TECNICA`: **não publicar** a aplicação (fica privada/`noindex`).

---

## 5. Implantação (10 passos) — somente após habilitação autorizada

Quando um novo SKU ingressa no Bling, o **Nano Lifecycle** deverá — **apenas após habilitação explícita do fluxo** (hoje `produto_automacao.pausado` = bloqueado):

1. Identificar o produto físico (espelho Bling, só-leitura).
2. Preservar a identidade patrimonial (`sku_pai`).
3. Consultar referências técnicas **autorizadas**.
4. Identificar códigos OEM (com fonte).
5. Mapear intercâmbios **comprovados** (sem transitividade automática).
6. Individualizar as aplicações veiculares.
7. Vincular fontes e evidências (hash do documento).
8. Submeter **cada** aplicação ao **Quality Gate 1,00**.
9. Preparar as projeções para **Bling (prévia)**, **Conecta.IA** e **Site Público**.
10. Disponibilizar as aplicações **aprovadas** conforme a autorização **de cada canal**.

Cada passo produz proposta/recibo auditável; produtor ≠ parecerista ≠ auditor ≠ decisor humano (segregação de autoridade).

---

## 6. SEO — por que o Google NÃO vê duplicata (o ponto central)

Objetivo: cada aplicação é **uma página legítima e distinta**, para o Google indexar como **conteúdo único**, nunca como produto repetido.

### 6.1 Individualização obrigatória por página filha
Cada `#/a/<slug>` tem, próprios e diferentes entre si:
- **URL/slug** único (ex.: peça + modelo + motor + geração).
- **Título (`<title>`)** e **meta description** únicos.
- **H1 e corpo** descrevendo a aplicação específica (veículo, anos, motor, OEM daquela aplicação, restrições).
- **`canonical` apontando para a própria página filha** (ela é o conteúdo único) — **nunca** canonicalizar todas as filhas para o SKU pai (isso as colapsaria numa só).
- **JSON-LD `Product`** com o identificador do SKU e os dados técnicos da aplicação, **SEM `offers`/`price`/`availability`** por ora (preparado e **desligado**).
- Relação **pai↔filho explícita**: a ficha do SKU físico (`#/p/mobis/<SKU>`) lista todas as páginas de aplicação aprovadas; cada página filha linka de volta ao `#/p/mobis/<SKU_PAI>`. Relacionamento semântico, **não** canonical cruzado.

### 6.2 O que impede o Google de ler como duplicado
- **Conteúdo substancialmente diferente** por página (veículo/motor/OEM/anos distintos) — é o que caracteriza páginas únicas, não cópias.
- **Página sem prova vigente → `noindex` ou `404`** (reconciliação `seo_evidencia` / `reconciliarProvaSeo`). Nunca indexar aplicação presumida.
- **`sitemap.xml`** inclui **somente** páginas com prova técnica vigente e aprovada.
- **Mesmo `sku`/estoque** aparece no dado estruturado como **a mesma peça física** aplicada a veículos diferentes — não como N produtos. A multiplicação é de **páginas de aplicação**, não de SKUs.

### 6.3 Preço/comércio (estado atual)
`offers`, `price`, `InStock`, checkout e feed Google Merchant/Shopping ficam **preparados e DESLIGADOS**. Vitrine Mobis opera com `preco_publico = null`, `estoque_publico = null` e "Preço sob consulta" até o dono liberar. A individualização/SEO/NAP/anti-alucinação já valem **sem** preço.

---

## 7. Quality Gate 1,00 e segurança

- **Quality Gate 1,00** = comprovação dos requisitos obrigatórios + testes + auditoria independente antes de aprovar qualquer aplicação/canal.
- Cada aplicação: **evidência própria, aprovação individual, rastreabilidade e possibilidade de revogação**.
- **Proibido:** publicar aplicação presumida, duplicar cadastro, inventar OEM/GTIN, alterar preço, criar autoridade paralela, escrever no Bling (Mobis bloqueia `bling.*` de escrita), tocar o ref proibido `ptilvkzuhjnqnfydjcly` (NanoShell IA).
- Preservar este princípio nos **nove kits** da Matriz Mestra (`KITS_CANONICOS`, Kits 01–09), usando a arquitetura existente.

---

## 8. O que esta norma NÃO faz

- Não autoriza merge, deploy, publicação, escrita no Bling nem migração no banco operacional.
- Não liga preço, estoque público, carrinho ou feed comercial.
- Não homologa OEM/GTIN/aplicação automaticamente.

Qualquer passo de implantação exige autorização explícita do dono, por etapa, com desenho apresentado e aprovado (branch + Pull Request em rascunho).
