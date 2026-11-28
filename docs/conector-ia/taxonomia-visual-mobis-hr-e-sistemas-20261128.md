# Taxonomia visual MOBIS — família Hyundai HR, categorias universais e sistemas (ícones)

**Data:** 2026-11-28 · **Status:** norma canônica conceitual (referência de taxonomia) · **Escopo:** Conecta.IA / Mobis Autopeças (`painel/`)
**Natureza:** especificação da **estrutura** de taxonomia e do **inventário de ícones por categoria**. **NÃO autoriza** merge para publicação, deploy, escrita no Bling nem migração no banco operacional. Documentação não implica implantação.
**Fonte:** referência visual enviada pelo dono em 2026-11-28 (reconhecimento de cliente + organização do catálogo).

> Ler junto: `docs/conector-ia/principio-milho-sku-oem-20261128.md`, `docs/conector-ia/roteiro-descricao-genealogia-veicular-br-20261119.md`, e a regra mestra de taxonomia individualizada por aplicação.

---

## 1. Categoria especial: Hyundai HR (família distinta de utilitários)

A **Hyundai HR** é tratada como uma **família própria de veículos utilitários** na taxonomia — **não** deve ser confundida com categorias genéricas como picape, van, furgão, caminhão, SUV ou passeio.

**Caminho taxonômico:** `Montadora → Hyundai → Família HR → Configuração`

**Configurações da família HR (nó "Configuração"):**
- `HR Chassi simples` (chassi)
- `HR Baú`
- `HR Plataforma / Grade baixa`

**Uso:** padrão para **reconhecimento visual do cliente** e **organização do catálogo**. Não altera a identidade física do SKU (um SKU físico, N aplicações — ver princípio do Milho). A configuração é atributo de **aplicação**, não cria produto físico novo.

---

## 2. Categorias universais de veículo

Categorias de reconhecimento visual, paralelas à família HR:

| Categoria | Observação |
|---|---|
| Picape | — |
| Van | — |
| Furgão | — |
| Caminhão (leve / pesado) | distinguir leve de pesado quando houver evidência |
| SUV | — |
| Passeio (veículo de passeio) | — |
| Moto (motocicleta) | — |
| Utilitários diesel | agrupador por motorização/uso, com evidência |

> Categoria de veículo é **classificação visual/organizacional**. A compatibilidade real de uma peça continua exigindo evidência técnica (aplicação × veículo × motor × ano × OEM), nunca deduzida pela categoria.

---

## 3. Sistemas (conjuntos de peças) — inventário de ícones

Sistemas que compõem o catálogo (cada um com seu glifo na biblioteca `IconeMA`):

- Motor
- Arrefecimento
- Freios
- Suspensão
- Elétrica
- Transmissão
- Cabeçote
- Injeção
- Filtragem
- Lubrificação

Cada sistema liga-se à taxonomia (`Sistema → Subconjunto → Componente`) e, quando houver, à **vista explodida EPC** correspondente.

---

## 4. Governança da taxonomia (regras do dono)

- **Catálogo de peças sobressalentes** (reposição/aftermarket).
- **"Não fabricamos peças"** — a Mobis comercializa reposição; não é fabricante.
- **Mapeamento visual + taxonomia correta** — organização por reconhecimento, sem afirmar compatibilidade sem prova.
- **Referências de catálogos de fabricantes / EPC** — OEM e aplicações ancorados em fonte (EPC/fabricante), por montadora; sem inventar código.
- Coerente com a regra de originalidade/OEM: destacar o **CÓDIGO OEM** como referência, **sem** rotular a peça como "original/genuína/não-original".

---

## 5. Ícones: origem e limite (anti-fabricação)

- Os **glifos visuais** destas categorias e sistemas vêm da **biblioteca aprovada `IconeMA` / `maIcones.ts`** (69 ativos 3D metálicos), parte do delta de integração do MA Display (branch `antigravity/ma-display-integracao-20261127`, commit `f557d8ca`), **ainda não incorporado** à `main`.
- As imagens de referência enviadas pelo dono são **referência de desenho** (raster), **não** os ativos finais. **Não** recriar/forjar a identidade aprovada a partir delas — os vetores oficiais entram do bundle/push do Antigravity, e são usados de forma **referencial**.
- Símbolo de montadora: uso referencial autorizado, obtido do provedor OEM/EPC ou arquivo oficial, sem sugerir endosso oficial; **proibido** holograma/selo de autenticidade de peça genuína em item aftermarket.

---

## 6. O que esta norma NÃO faz

- Não cria produto físico novo nem multiplica estoque (um SKU → N aplicações).
- Não autoriza publicação, deploy, escrita no Bling nem migração no banco.
- Não homologa compatibilidade por categoria; cada aplicação exige evidência própria e aprovação individual.

Qualquer passo de implantação (criar os nós no banco, ligar ícones às telas) é **migração/integração** — mostrar desenho e esperar aprovação, em branch + Pull Request em rascunho.
