# Porteiro — expansão de aplicações por nomenclatura de motor (1 SKU → N aplicações cross-marca)

**Estado:** norma do porteiro. Data: 2026-11-25. Aplica a qualquer agente (Nano, GPT, Claude, MCP) e a qualquer SKU.

## Princípio
Um **mesmo motor** recebe **nomenclaturas diferentes por montadora**. A peça física é uma só (1 SKU no Bling, 1 estoque, 1 NF), mas **se desdobra em várias aplicações** — e cada aplicação é uma **página independente** (título, SEO e OEM próprios), ligada ao mesmo SKU.

Exemplo-base (motor 2.5 8V):
- **Hyundai D4BH** ≡ **Mitsubishi 4D56**, família **D4BA / D4BB / D4BF / D4BH**.
- Aplicações documentadas desse motor: **Hyundai** (HR, Galloper, H1/Starex, H100/Porter, Terracan), **Kia** (Bongo K2500/K2700), **Mitsubishi** (L200, Pajero/Pajero Sport).

O motor 16V (D4CB Euro V) segue a mesma lógica com a própria lista de aplicações.

## O que o porteiro EXIGE do agente ao cadastrar
1. **Identificar o motor e TODAS as suas nomenclaturas** (ex.: D4BH = 4D56 = família D4Bx) antes de montar aplicações.
2. **Enumerar todas as aplicações documentadas** cross-marca — não parar em HR/Bongo. Fonte das aplicações, em ordem:
   - catálogo do fornecedor/fabricante (Trim-Go/Quatro no Drive autorizado) e índice interno;
   - genealogia veicular (`roteiro-descricao-genealogia-veicular-br`);
   - EPC/montadora por VIN (prova máxima).
3. **Uma página por aplicação** (montadora × modelo), com slug, título e SEO próprios, todas vinculadas ao mesmo SKU/estoque. Criar a **montadora** que faltar (Hyundai, Kia, Mitsubishi, Ford, Iveco, Fiat/Peugeot/Citroën, VW…).
4. **Nunca deduzir só pelo nome**: cada aplicação carrega `fonte`, `data` e `status`. O OEM por componente também (não inventar; conferir — ver a correção do D4BH, onde o GPT havia "arredondado" tudo para `-42000`).

## Status e liberação (trava de publicação)
Cada aplicação tem um estado explícito:
- **`referencia_fornecedor` (a homologar)** — veio do catálogo do fornecedor, ainda **não homologada**. Página fica **privada/noindex** (acessível por link/WhatsApp como "sob consulta"), **não** entra no Google.
- **`homologada`** — comprovada (EPC/montadora ou decisão do responsável) **e** com `liberado_publicacao = true` **e** direitos de imagem resolvidos. Só então a página fica **pública e indexável**.

Regra dura: enquanto o índice/registro do produto marcar `liberado_publicacao: false`, `aplicacoes_status: REFERENCIA_DO_FORNECEDOR_NAO_HOMOLOGADA` ou `direitos_imagem: PENDENTE`, a página **não é indexável** e o texto diz **"aplicação de referência (a homologar)"**, nunca "homologada".

## Travas que continuam valendo
- Preço: **consultar antes de divulgar**; catálogo informativo sem preço.
- Estoque: não afirmar saldo/pronta-entrega sem confirmação.
- Bling é a fonte: não duplicar SKU, não publicar produto excluído sem decisão registrada, não mesclar SKUs distintos (ex.: `CI003000` ≠ `CI003696`).
- OEM: não inventar, não atribuir sem fonte.
