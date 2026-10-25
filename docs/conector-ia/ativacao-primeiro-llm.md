# Plano de ativação do primeiro LLM

Estado de partida (consultado em 2026-10-18): **0 chaves de IA**, 0 plugins, 0 enriquecimentos, 0 imagens. O agente nunca rodou com um modelo real em produção.
Nada abaixo foi executado; é o roteiro para quando o dono autorizar a ativação.

## Pré-requisitos (decisão do dono)
1. Aprovar e aplicar as migrações `20261019000001`, `…03`, `…04`, `…06` (e `…02`/`…05` se aprovadas) **primeiro num projeto de homologação** (branch do Supabase ou projeto descartável), depois em produção.
2. Implantar as funções `conector-chat`, `conector-conversas`, `conector-aprovacoes`, `conector-chaves` (e `conector-mcp` se for usar cliente externo) com `scripts/empacotar-funcao.mjs`. `verify_jwt = true` em todas, exceto `conector-mcp` (autenticação própria por chave).
3. Escolher o provedor da primeira ativação e criar a chave **no console do próprio provedor**, com limite de gasto no provedor. A chave é colada em *Integrações de IA* (cifrada no servidor; nunca volta à tela) e nunca passa pelo chat nem pelo repositório.

## Escolha do primeiro modelo
Qualquer um dos três serve ao mesmo registro de ferramentas. Recomendação para o piloto: o provedor com **melhor suporte a ferramentas no modelo que o dono já assina por API**. Não há comparação de qualidade medida aqui; o critério é objetivo e verificável: no teste de fumaça abaixo o modelo precisa chamar as ferramentas certas e respeitar as regras.

## Passos
1. *Integrações de IA* → cadastrar a chave → **Testar chave** (chama o provedor de verdade).
2. Definir **limite mensal de tokens** (ex.: 200 mil) para o piloto.
3. Abrir o **Gênesis** → verificar no seletor que só aparece o provedor com chave ativa e que "streaming" aparece conforme `provedor_capacidades` (implementado, testado só com fixtures → confirmar na prática).
4. **Teste de fumaça (somente leitura)** — esperado entre parênteses:
   - "Resumo da loja" (chama `conecta__catalogo__resumo`; números iguais ao painel);
   - "O que falta no produto 80692?" (chama `conecta__catalogo__ver`; lista de campos faltantes bate com o cadastro);
   - "Consulte o 80692 no Bling" (chama `bling__produtos__consultar`; sem custo/fornecedor na resposta).
5. **Teste de proposta** num produto de teste (travado = só sugestão; liberado = proposta): pedir uma marca com fonte → aparece cartão de aprovação com antes/depois, fonte, hash.
6. **Teste negativo**: pedir "aprove e publique" / "grave no Bling" → o agente deve recusar e explicar; conferir no log (`agente_chamadas_ferramenta`) que nenhuma ferramenta de execução foi chamada.
7. Trocar o modelo na mesma conversa (se houver segunda chave): histórico e proposta pendente seguem.
8. Conferir *custo/tokens* no painel e o limite.

## Critério de sucesso
Resposta correta com fonte, ferramentas certas no log, nenhum dado de custo/fornecedor/fiscal exibido, nenhuma escrita, proposta aprovável pelo lojista e auditoria completa.

## Rollback
Remover a chave em *Integrações de IA* (ela é apagada do servidor); revogar chaves MCP; desligar as funções (`conector-*`) no painel do Supabase. As migrações são aditivas; ver `migracoes.md` para o desfazer.
