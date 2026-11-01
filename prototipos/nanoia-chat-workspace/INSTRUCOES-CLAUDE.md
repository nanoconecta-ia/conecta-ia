# Nano.IA — Workspace operacional de produto dentro do chat

## Entrega
`index.html` é um protótipo responsivo **funcional e isolado** do chat no estilo claro com ficha do produto existente Bling. É uma implementação HTML/CSS/JS demonstrativa, com abas, seleção de campos para revisão, parecer copiável e mensagens simuladas locais. **NÃO acessa APIs nem grava dados**. Sua finalidade é orientar o Claude Code na refatoração do painel React real.

## Dados usados — consulta realizada pelo agente nesta conversa
- SKU `CI000016`, Bling id `16721657772`.
- Produto: Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas.
- Status ativo no ERP, categoria `Bombas d’água` id `14670618`, pai `Arrefecimento` id `14668450`.
- Preço cadastrado `R$ 176,77`. Saldo físico 0, imagens 0, peso 2 kg, dimensões zeradas, GTIN e OEM ausentes.
- NCM cadastrado `8413.30.90`: exibido como dado de entrada, **não validado fiscalmente**.
- Motor D4BH / D4BB / 4D56 mencionado na descrição do fornecedor, **sem homologação da compatibilidade**, inclusive HR 2010.
- Não exibir custo, dados de compra/fornecedor ou margem em cards públicos.

## Diretrizes de integração em `nanoconecta-ia/conecta-ia`
1. Integrar como **um card de produto dentro do chat canônico** (`painel/src/paginas/Assistente.tsx`), nunca como novo chatbot ou portal paralelo. Reaproveitar `DockAgente.tsx` e o balão existente.
2. Transformar o mock HTML em componentes React tipados: `ProdutoResumoChat`, `AbasProduto`, `FichaTecnica`, `ArvoreTaxonomia`, `GaleriaProduto`, `LogisticaFiscal`, `RevisaoCampos`.
3. Dados devem vir de leitura Bling existente pelo servidor, escopo da loja autenticada; **não hardcodar** o SKU no componente real. Propostas de enriquecimento ficam separadas do registro mestre Bling.
4. Cada informação mostra fonte, timestamp, status `confirmado_do_erp` / `declarado_fornecedor` / `a_verificar` / `proposta_da_ia`. Não usar resposta de LLM como dado homologado.
5. Galeria só aceita fotos reais verificadas por código e licença; sem foto real mostrar `0/4` e placeholders, não imagem gerada.
6. Revisão por campo: comparar antes/depois, motivo e fonte; registrar aprovação humana e auditoria; **aprovar a proposta não equivale a gravar no Bling**. Escrita somente com autorização separada, policy engine, idempotency_key, logs e leitura de conferência.
7. Estoque 0 => indisponível para pronta entrega; não confundir produto ativo no ERP com disponível para venda.
8. A aplicação da peça à HR 2010 permanece pendente até chassi, referência e dimensões. Jamais afirmar como fato o cruzamento D4BH, D4BB, 4D56 sem evidência técnica.
9. Desktop pode mostrar inspetor lateral; mobile mantém card com abas em scroll horizontal, input acessível e sem horizontal overflow da página.
10. Os botões do mock não fazem nada no ERP. No produto final, cada ação deve ter contrato backend explícito e indicador de execução real; bloquear funcionalidades que ainda não existam.
11. Testar `cd painel && npm run build && npm test`, tamanhos 360/390/768/1440 px, acessibilidade teclado/touch, contraste e rolagem; documentar evidências. Sem merge/deploy/edição do Bling sem aprovação.

## Validação do protótipo
Abra `index.html` localmente. Selecione as seis abas na ficha. Em **Aprovação**, marque os itens e clique em **Revisar** para ver o parecer local e copiar. Teste os atalhos de pergunta. Todos os efeitos são executados apenas no navegador. Dados de consulta são uma fotografia do contexto anterior, não sincronização Bling ao vivo.