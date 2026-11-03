# Homologação do Contexto Vivo (Conecta.IA → Nano)

Estado em 2026-11-03 (verificado em produção, somente leitura): `contexto_sessoes` e `contexto_registrar` **aplicadas**; OAuth e imagens **pendentes**; `#267` (ferramenta + painel) **não publicada**. O Contexto Vivo **não é operacional** até o passo 6 passar.

## Pré-requisitos, na ordem
1. Migração `oauth` aplicada (senão o deploy de `assistente`/`conector-mcp` desalinha a auditoria — risco R4).
2. Merge do #267 na `main` (CI já verde).
3. Deploy do `conector-mcp` e do `assistente` (workflows manuais, clique do dono) e do painel (`painel-pages.yml`).
4. Uma chave MCP de leitura criada no painel e guardada só no cliente do agente (nunca no chat).

## Teste real (leva ~5 minutos; nada é gravado no Bling)
5. No painel, em Catálogo, conferir que "Compartilhando a seleção com o Nano" está marcado (**nasce ligado** e lembra a sua escolha por loja) e selecionar **2 produtos** (ex.: OC1224 e 80692). Na extensão do Bling também nasce ligado e começa sozinho ao conectar à loja.
6. No chat do Nano (e depois no agente externo por MCP), perguntar: "quais produtos estão selecionados?" sem citar SKU.
   - **Passa** se responde os 2 SKUs corretos, com nome e marca, sem custo/fornecedor/fiscal.
7. Abrir 1 produto (selecionar só ele): perguntar "qual é o produto ativo?" → deve trocar para o único selecionado.
8. Desligar o compartilhamento (a escolha fica lembrada) ou esperar 30 min: perguntar de novo → deve responder **contexto indisponível**, sem inventar SKU.
9. Isolamento: com outro usuário (outra loja), repetir a pergunta → nunca enxerga a seleção da primeira loja.

## Já provado em teste automatizado (Postgres local com todas as migrações)
Seleção múltipla; produto ativo; troca de ficha na mesma sessão; evento duplicado ignorado; versão antiga vira conflito; produto de outra loja recusado; usuário sem vínculo recusado; sessão por usuário; expiração; navegador sem acesso direto à tabela; resposta sem custo/fornecedor.
Arquivos: `supabase/tests/contexto_sessoes.sql` (15 verificações) e `supabase/functions/_shared/conector/contexto_integracao.test.ts` (8 testes).

## Reversão
`CONTEXTO_REGISTRAR_REVERSAO.sql` (remove a função) e, se necessário, `DROP TABLE public.contexto_sessoes` (dado efêmero). Desligar o compartilhamento no painel já interrompe a gravação.
