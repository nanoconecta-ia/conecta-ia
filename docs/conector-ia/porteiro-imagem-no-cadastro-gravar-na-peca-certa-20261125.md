# Porteiro — imagem no cadastro: gravar na peça certa (todo SKU sai com imagem)

**Estado:** norma do porteiro. Data: 2026-11-25. Aplica a qualquer agente (Nano, GPT, Claude, MCP) e a qualquer SKU.
Governança documental: o agente lê e obedece. A trava "de verdade" (servidor recusar gravar imagem num `produto_id` que não corresponde ao SKU) é validação de **código no gateway**, ainda **não implementada** — está descrita aqui como requisito, não como fato.

## Por que esta norma existe
Os docs de imagem já mandavam **buscar** e **propor** foto, mas não travavam a **gravação**. Resultado real (25/11/2026): a foto do jogo de parafusos **CI001549** foi gravada na junta **CI001041** (produto_id de outra peça, reaproveitado de uma consulta anterior) e ainda duplicada em 2 linhas. Esta norma fecha esse buraco: toda entrega de cadastro já sai com imagem **na peça certa**, ou com pendência honesta.

## Checklist obrigatório de imagem (6 itens)

1. **Imagem é etapa obrigatória de todo cadastro.** A foto em si é **opcional** — pode ficar `foto_pendente=true` com placeholder neutro —, mas **resolver a imagem não se pula**. Falta de foto nunca bloqueia o resto do cadastro nem o lote (exceção de foto opcional é só da loja MOBIS).

2. **Ordem de fonte, por direito de uso:**
   1. Foto própria do lojista ou foto do produto no **Bling** (melhor direito).
   2. Foto do **fornecedor/fabricante** (catálogo Trim-Go/Quatro no Drive autorizado).
   3. Imagem da **web como ILUSTRATIVA** — somente se for **o produto real, sem marca d'água, fundo branco e dentro do padrão de visualização**; via `conecta.imagem.buscar_web` quando exposto (hoje não exposto ao MCP externo: registrar `buscador_nao_exposto_ao_mcp`, não simular).
   4. Nada seguro → `foto_pendente=true` + placeholder. **Nunca inventar, forjar, ou usar foto de item similar/de outro SKU.**

3. **Gravar SEMPRE amarrado ao SKU certo.** Antes de inserir em `produto_imagens`:
   - resolver o `produto_id` **a partir do SKU** (`select id from produtos where loja_id=? and sku=?`);
   - **conferir que o SKU bate** com o id;
   - **nunca** reaproveitar um `produto_id` vindo de outra consulta/outro SKU.

4. **Gravação correta.** Uma **única** imagem `principal` por produto. Campos obrigatórios: `loja_id, produto_id, url, tipo, principal, aprovada, origem, licenca_tipo`.
   - `tipo = real` só se for **foto real do produto**; senão `ilustrativa` (a UI exibe "Imagem ilustrativa").
   - `aprovada = true` só com **direito de uso resolvido**; sem direito, fica candidata pendente, não exibida publicamente.

5. **Conferência pós-gravação (o passo que teria pego o erro).** Depois de gravar, **ler de volta**:
   `select p.sku, count(i.id), sum((i.principal)::int) from produtos p left join produto_imagens i on i.produto_id=p.id where p.sku=? group by p.sku;`
   Confirmar **exatamente 1 principal no produto certo** e **0 imagem órfã** em peça que não é dela. Só então declarar `imagem_gravada`.

6. **Travas de sempre.** Imagem **não libera publicação** sozinha; `produto_automacao.pausado=true` impede gravação automática pelo agente; direito de imagem pendente mantém a página **noindex**. Compatibilidade incerta nunca é anunciada junto da foto.

## Estados reportados ao lojista (fato, não intenção)
- `imagem_proposta` — candidata encontrada/sugerida, ainda não gravada.
- `imagem_gravada` — gravada e **lida de volta** no banco, no SKU certo (vale também `foto_pendente` quando não há foto segura).
- `imagem_publicada_verificada` — vista na **URL pública** da página.

## Requisito para o gateway (código, a implementar)
O servidor que grava `produto_imagens` deve **recusar** um `produto_id` cujo SKU não corresponda ao SKU do cadastro em andamento, e impedir mais de uma `principal` por produto. Enquanto não implementado, a conferência do item 5 é obrigatória para o agente.
