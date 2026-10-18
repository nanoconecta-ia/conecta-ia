# Prompt para o agente de navegador — somente Supabase e Bling (sem Render, sem outra hospedagem)

As funções `bling-conectar` e `bling-callback` já estão publicadas no projeto Supabase `conecta-ia`
(ref `dsfzhsrudriqkumtlqwj`). Callback do Bling:
`https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/bling-callback`

```
Você vai me ajudar, no navegador, a cadastrar o aplicativo PRIVADO no meu Bling e a guardar as chaves no Supabase.
Regras: (1) NUNCA escreva no chat, em resumo ou em captura de tela nenhuma chave, senha, token ou Client Secret; digite
esses valores só nos campos onde eles pertencem. (2) NÃO use Render nem nenhuma outra hospedagem. (3) PARE e me pergunte antes
de qualquer pagamento, mudança de plano, domínio, DNS ou alteração no site atual www.mobisautoparts.com.br.
(4) Confirme cada etapa comigo antes de salvar. (5) Se algo não bater, pare e me explique.

PARTE 1 — Bling
1. Bling > Central de Extensões > Área do Integrador > Cadastro de aplicativos > Novo > tipo API > uso PRIVADO.
2. Nome: Conecta.IA Mobis. URL de callback/redirecionamento (exatamente):
   https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/bling-callback
3. Escopos: somente LEITURA de Produtos, Estoques e Categorias de produtos. Nenhum escopo de escrita.
4. Salvar e deixar a tela do Client ID/Client Secret aberta numa aba (sem copiar para o chat).

PARTE 2 — Supabase (projeto conecta-ia, ref dsfzhsrudriqkumtlqwj; confirme o nome/ref antes de qualquer alteração)
1. Edge Functions > Secrets (Manage secrets). Criar estes secrets:
   BLING_CLIENT_ID e BLING_CLIENT_SECRET (copiar da aba do Bling direto para os campos);
   ESTADO_SEGREDO (texto aleatório de pelo menos 40 caracteres);
   CREDENCIAIS_CHAVE_CIFRA (32 bytes aleatórios em base64; me peça para guardá-la num gerenciador de senhas: se for perdida,
   os tokens do Bling gravados não poderão ser lidos).
2. NÃO criar nem alterar tabelas, funções ou políticas. NÃO mexer no projeto NanoShell IA nem em outro projeto.

PARTE 3 — Conferir
Me devolva em texto SOMENTE: "Parte 1 concluída com escopos: [lista]" e "Parte 2 concluída: secrets criados: [nomes]". Nada de valores.
```

O botão "Conectar ao Bling" do painel chama `bling-conectar` (com o login do usuário) e abre a autorização no Bling.
O painel estático (GitHub Pages) é a próxima etapa; até lá a conexão pode ser testada com o usuário logado via chamada autenticada.
