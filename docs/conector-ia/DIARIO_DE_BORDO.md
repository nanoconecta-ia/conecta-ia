# Diário de bordo do projeto

## 2026-11-03 — Peça única vendida em vários canais

**Raciocínio do dono (registrado):**
- A mesma peça aparece em vários lugares ao mesmo tempo: o site da Mobis no Conecta.IA, marketplaces e outros canais ligados ao Bling.
- Onde for comprada primeiro, o estoque dá baixa e a peça sai de todos os canais, para não vender duas vezes.
- Se o lojista decidir deixar o item livre para todas as plataformas, tudo bem. Se não, uma unidade vendida significa produto zerado em todos os lugares.

**Como isso se traduz no sistema (proposta, nada implementado):**
1. **Fonte única do estoque é o Bling.** O Conecta.IA espelha; não é dono do saldo.
2. **Bling → Conecta (webhook de estoque e produto):** qualquer baixa, inclusive a do balcão, chega ao espelho em segundos. Núcleo pronto e testado no PR #277.
3. **Política por produto (decisão do lojista):**
   - `exclusivo` (padrão): unidade única; ao zerar, sai de todos os canais.
   - `livre`: o lojista aceita vender em mais de um canal.
4. **Conecta → Bling (venda no site):** a venda precisa ser registrada no Bling para que o saldo caia e os outros canais enxerguem. Isso é **escrita no Bling** e exige autorização específica do dono, passar pelo Policy Engine e auditoria. A decisão de 17/10 não liberou pedido de venda nem estoque.
5. **Quem compra primeiro:** antes de cobrar, o site reconsulta o saldo no Bling na hora (já previsto no CLAUDE.md). Se zerou, avisa o cliente e leva ao WhatsApp.

**Ainda não verificado (ler a documentação do Bling antes de afirmar):**
- Como o Bling reserva ou baixa o estoque ao criar um pedido de venda, e em qual situação do pedido.
- Se existe janela entre o pedido e a baixa em que dois canais possam vender a mesma unidade.
- Como cada marketplace ligado ao Bling reage ao saldo zerado.

**Decisões pendentes do dono:**
- Autorizar o estudo e o desenho da criação de pedido de venda no Bling.
- A venda direta no site (checkout) entra no próximo marco, ou a Mobis segue em modo WhatsApp por enquanto?

## 2026-11-03 — Documentação do Bling lida: reserva de estoque, balcão e JWT

Fontes: ajuda.bling.com.br (artigo "Como dar baixa no estoque no momento que o pedido for feito — Reserva de estoque"), developer.bling.com.br/aplicativos e /webhooks.

**O que o Bling garante (documentado):**
- **Reserva de estoque** é uma configuração da conta (Todas as configurações > Suprimentos > Estoque): "Considerar situações de vendas para obter o saldo atual". O saldo atual passa a ser **saldo real menos o reservado** pelas vendas nas situações escolhidas. Uma venda "Em aberto" pode reservar a unidade antes de qualquer lançamento de estoque.
- Quando o estoque da venda é lançado, a unidade sai da reserva e vira saída. Se o estoque for lançado pela nota fiscal e o pedido continuar numa situação que reserva, **o saldo continua reservado** (contagem dupla): é preciso mudar a situação do pedido.
- **Balcão (PDV):** o webhook de estoque do Bling dispara em lançamentos físicos: vendas, NF-e e tela de estoque. Então a baixa do balcão chega ao espelho pelo webhook de `stock`, desde que o lançamento automático de estoque esteja ligado na conta da Mobis (a conferir no Bling; não consigo ver a configuração).
- **JWT:** a autenticação com token opaco foi descontinuada; o Bling exige JWT. É o formato que o Conecta.IA já usa (`enable-jwt: 1`). Era disso que tratava a dúvida sobre "WJP".
- **Aplicativo público** precisa de homologação; enquanto não for homologado, só 10 usuários podem autorizá-lo. Relevante só quando virar serviço para outros clientes.

**Consequências para o desenho (proposta, nada implementado):**
1. Para a venda do site "segurar" a peça em todos os canais, o pedido precisa existir no Bling numa situação que reserve estoque. Isso depende de **a reserva estar ligada na conta da Mobis** (configuração sua no Bling).
2. **O Bling não oferece reserva atômica** (verificar e reservar numa operação só). Fica uma janela curta entre conferir o saldo e criar o pedido, e outra até cada marketplace receber o saldo novo (como o Bling avisa os marketplaces, não li).
3. Mitigação: conferir o saldo no Bling imediatamente antes; criar o pedido "Em aberto"; reler o saldo depois. Se ficou negativo, sinalizar o pedido, avisar o cliente e levar ao WhatsApp. Honestamente: reduz muito a chance de venda dupla, mas não a elimina.
4. O aplicativo da Mobis precisa do escopo de pedidos de venda, e a escrita precisa de autorização específica, Policy Engine e auditoria.

**Para conferir na conta da Mobis (dono):** reserva de estoque ligada? Lançamento automático de estoque ligado? Quais situações de pedido reservam? O PDV da Mobis lança estoque na venda?
