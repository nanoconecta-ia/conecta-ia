# PartSouq — fonte canônica de referência EPC (camada 2): OEM, figura e aplicação por montadora

**Data:** 2026-11-28 · **Status:** norma canônica conceitual · **Escopo:** Conecta.IA / Mobis (Nano, taxonomia, catálogo)
**Natureza:** define **como** o Nano usa o PartSouq como referência. **NÃO autoriza** scraping em massa, gravação de OEM no cadastro, publicação, escrita no Bling nem migração. Uso **referencial**, com fonte e data. Documentação não implica implantação.

> Ler junto: `docs/conector-ia/principio-milho-sku-oem-20261128.md`, `docs/conector-ia/taxonomia-visual-mobis-hr-e-sistemas-20261128.md`, `docs/conector-ia/fontes-pesquisa-rapida-sku-ncm-gs1-20261119.md`, `docs/conector-ia/porteiro-imagem-no-cadastro-gravar-na-peca-certa-20261125.md`.

---

## 1. As 3 camadas de imagem (nunca misturar)

| Camada | O que é | Fonte | É foto do produto à venda? |
|---|---|---|---|
| **1. Ícone 3D** (biblioteca MA Display) | linguagem visual do **sistema/categoria** | gerado — **genérico, igual p/ toda montadora** | ❌ não (conceito) |
| **2. Figura / vista explodida EPC** | a **aplicação**: figura da peça no conjunto, posição, nº do item, **OEM** | **PartSouq** e EPC oficial por montadora | ❌ não (referência de encaixe) |
| **3. Foto real do SKU** | o item físico que a Mobis vende | **foto autorizada do lojista**, fundo `#FFFFFF` | ✅ **só esta** (`tipo=real, aprovada`) |

---

## 2. Papel do PartSouq (camada 2)

O PartSouq é a fonte de **referência** para:
- **Código OEM** da peça/aplicação, e suas **substituições** oficiais.
- **Vista explodida / figura EPC** (número do item, posição no conjunto).
- **Aplicação por VIN / montadora / modelo** (casa a peça ao veículo certo).
- **Símbolo da montadora** para uso **referencial** no cartão de aplicação.

O Nano **extrai e vincula** esses dados; **não** os publica nem grava sozinho.

---

## 3. Regras de uso (inegociáveis)

- **Uso referencial**: figura/OEM/símbolo como **referência de aplicação**, com **atribuição**, **sem marca d'água**, **sem sugerir endosso** oficial da montadora. Nunca rotular "original/genuíno".
- **OEM só com fonte** (URL + data). **Sem VIN/motorização → `a confirmar`**; não transferir OEM entre "primos".
- **Variantes = divergência**: quando o mesmo motor tem vários OEM (espessura/grade, Euro III/IV/V, carroceria), **listar como divergência** e exigir VIN/spec antes de escolher.
- **Camada 2 ≠ camada 3**: a figura EPC **nunca** vira a foto do produto à venda; essa é só a foto real do lojista.
- **A figura não prova compatibilidade sozinha**: precisa de evidência técnica (VIN, motor, ano, geração).

---

## 4. Fluxo do Nano (proposta, não implantação)

1. Buscar no PartSouq por **OEM**, **nome da peça** ou **VIN/veículo**.
2. Extrair: OEM primário, substituições, cross-ref, figura/posição, aplicação.
3. Classificar estado: `confirmado` (com fonte) / `divergente` (variantes) / `a confirmar` (sem VIN).
4. **Propor** como **referência candidata** (figura EPC = referência; ícone 3D = ilustrativo).
5. **Aprovação humana** (porteiro/lojista) antes de qualquer gravação ou exposição pública.
6. A **foto comercial** continua sendo **só a foto real aprovada** do lojista.

---

## 5. Exemplo real trabalhado (evidência 2026-11-28)

**Peça:** junta de cabeçote do motor **D4CB** (Hyundai HR / Kia Bongo 2.5 16V diesel).

- **OEM primário:** `22311-4A000` — "GASKET-CYLINDER HEAD", Hyundai/KIA. Fonte: PartSouq (`partsouq.com/shop/product/223114A000-...`).
- **Substituição oficial:** `22311-4A010`.
- **Cross-ref aftermarket:** Teikin `TG0139NK` (jogo).
- **Variantes observadas** (mesmo motor, aplicações distintas): `22311-4A020`, `-4A100`, `-4A110`, `-4A120`, `-4A700` — por sub-motorização (Euro III/IV/V), espessura/grade e carroceria (Grand Starex/H-1 ≠ HR/Bongo).

**Conclusão (governança):** sem **VIN/motorização** confirmados, o OEM correto permanece **`a confirmar`**; apresentar as variantes como **divergência**, não escolher um código por dedução. O PartSouq confirma **identidade e figura**; o **VIN** confirma a **aplicação**.

---

## 6. O que esta norma NÃO faz

- Não autoriza scraping em massa do PartSouq, nem armazenar imagens dele como foto de produto.
- Não grava OEM no cadastro, não publica, não escreve no Bling, não migra banco.
- Não homologa compatibilidade por figura; cada aplicação exige evidência própria e aprovação individual.
