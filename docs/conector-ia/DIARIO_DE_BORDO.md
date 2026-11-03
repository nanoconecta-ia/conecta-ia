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
