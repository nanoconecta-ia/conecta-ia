# Roteiro oficial de aprovação — do estado atual até o sistema Conecta.IA 100% real

**Data:** 2026-11-28 · **Status:** roteiro de governança (checklist de portões) · **Escopo:** Conecta.IA / Mobis
**Natureza:** organiza o caminho até produção. **NÃO autoriza** por si só nenhuma gravação, migração, publicação ou escrita no Bling — cada portão exige autorização explícita registrada abaixo. Documentação não implica implantação.

> Cada autorização é **separada** (propor ≠ aprovar conteúdo ≠ gravar no Bling ≠ publicar ≠ implantar). Uma não implica a outra.

---

## Decisão registrada (2026-11-28)
**Imagens reais dos produtos (camada 3) entram SÓ DEPOIS do sistema Conecta.IA pronto.** Até lá: `foto_pendente` + placeholder/ilustrativo. A existência de produto no Bling não autoriza foto nem publicação.

As **3 camadas de imagem** permanecem: (1) ícone 3D genérico; (2) figura EPC por montadora (PartSouq, referencial); (3) foto real do SKU (só do lojista, após sistema pronto). Ver `fonte-canonica-partsouq-epc-camada2-20261128.md`.

---

## Fases e portões

| Fase | O que entra | Pré-requisito técnico | AUTORIZAÇÃO necessária | Aprovado por / data | Estado |
|---|---|---|---|---|---|
| **0. Atual** | Painel V3, Nano Lifecycle (código), docs, 17 ícones candidatos | — | — | — | ✅ na `main` |
| **1. Leitura real (Marco 1)** | Espelho **somente leitura** de 20–50 produtos reais do Bling; catálogo **informativo sem preço**; atendimento WhatsApp | Credencial Bling cifrada no servidor; função de sync leitura | **Conectar Bling (leitura)** | ______ / __/__ | 🔴 pendente |
| **2. Homologação de conteúdo** | Aprovar aplicações/OEM **por SKU, com evidência** (PartSouq + VIN) | Fluxo Nano + fila de revisão | **Aprovar cada aplicação/OEM** (lojista) | ______ / __/__ | 🔴 pendente |
| **3. Visual ligado** | Resolvedor de ícone (3D físico / vetor abstrato) nas telas; delta `f557d8ca` (kits, EPC navegável) | Delta no repo + resolvedor | **Homologar ícones** + aprovar migração de UI | ______ / __/__ | 🟡 parte candidata |
| **4. Imagens reais (APÓS sistema pronto)** | Foto real do SKU, fundo `#FFFFFF`, `tipo=real, aprovada` | Bucket de fotos; gravar na peça certa pelo SKU | **Aprovar cada foto** (lojista) | ______ / __/__ | ⏸️ adiado por decisão |
| **5. Preço / venda (opcional)** | Ligar `offers`/preço; modo checkout ou WhatsApp; regras por UF | Flags preparadas e desligadas; super admin MFA | **Liberar preço** + **regras de venda** | ______ / __/__ | 🔴 decisão em aberto |
| **6. Migrações no banco** | Aplicar minutas SQL no Supabase `dsfzhsrudriqkumtlqwj` | Minutas testadas em CI | **Autorizar migração** | ______ / __/__ | 🔴 pendente |
| **7. Publicação** | Deploy no `mobisautopecas.com.br` | DNS + SSL verificados; arquivo de release datado | **Assinar release de publicação** | ______ / __/__ | 🔴 pendente |

---

## Pré-requisitos de segurança (transversais, antes de qualquer "real")
- Segredos/tokens **só no servidor**, nunca no front nem no repositório.
- Credencial Bling por loja **cifrada**; JWT não truncado; header `enable-jwt: 1`.
- Isolamento por loja (RLS quando suportado).
- `produto_automacao.pausado` permanece ligado até autorização de escrita.

## Terceiros
- **Contador** valida regras fiscais (NCM/CEST/CFOP) antes de produção.
- **Fotos reais** autorizadas pelo lojista (fase 4).

---

## Caminho mínimo recomendado
**Fase 1 (Marco 1)** primeiro: leitura real do Bling, catálogo informativo sem preço, WhatsApp — **zero escrita, zero fiscal, zero risco**. Depois: homologar alguns SKUs (fase 2) → ligar visual (fase 3) → decidir preço (fase 5) → publicar (fase 7). Imagens reais (fase 4) só após o sistema pronto, conforme decisão do dono.

## O que este roteiro NÃO faz
Não conecta Bling, não grava, não migra, não publica. Cada linha acima espera sua autorização registrada no campo "Aprovado por / data".
