# Prompt para o agente de navegador (colar no Claude no Chrome / navegador)

Objetivo: publicar o app de teste e cadastrar o aplicativo privado no Bling, **sem nunca mostrar segredos no chat**.

```
Você vai me ajudar, passo a passo, no navegador, a colocar o Conecta.IA no ar para TESTE e a conectá-lo ao meu Bling.
Regras: (1) NUNCA escreva no chat, em resumo ou em captura de tela nenhuma chave, senha, token, Client Secret ou service role;
digite esses valores só nos campos do site onde eles pertencem. (2) PARE e me pergunte antes de qualquer pagamento,
mudança de plano, domínio, DNS ou qualquer alteração no meu site atual (www.mobisautoparts.com.br não pode ser tocado).
(3) Confirme comigo cada etapa antes de clicar em salvar/criar. (4) Se algo não bater com este roteiro, pare e me explique.

PARTE A — Hospedagem (Render, onde já tenho conta; se preferir outra, me avise)
1. Render > New > Web Service > conectar o GitHub e escolher o repositório nanoconecta-ia/conecta-ia
   (se não aparecer, me peça para instalar o app do Render nesse repositório).
2. Branch: feat/bling-conexao. Root Directory: web. Build Command: npm install && npm run build. Start Command: npm run start.
3. Variáveis de ambiente (crie os nomes, e me peça cada valor ou busque no painel indicado, sem exibir):
   NODE_VERSION=22; SUPABASE_URL e SUPABASE_ANON_KEY (Supabase > projeto conecta-ia > Project Settings > API);
   SUPABASE_SERVICE_ROLE_KEY (mesma tela; é SEGREDO: só colar no campo do Render);
   CREDENCIAIS_CHAVE_CIFRA (32 bytes aleatórios em base64: gere e me peça para guardar num gerenciador de senhas; se
   perder, os tokens do Bling não podem ser lidos); INGEST_KEY_PEPPER (texto aleatório longo); FRESCOR_MAX_MINUTOS=15.
4. Criar o serviço. Anote o endereço público (https://NOME.onrender.com). Depois defina APP_URL com esse endereço e faça novo deploy.
5. Supabase > Authentication > URL Configuration: Site URL = APP_URL; Redirect URLs = APP_URL/auth/callback e APP_URL/redefinir-senha.

PARTE B — Aplicativo privado no Bling
1. Bling > Central de Extensões > Área do Integrador > Cadastro de aplicativos > Novo > tipo API > uso PRIVADO.
2. Nome: Conecta.IA Mobis. URL de callback/redirecionamento: APP_URL/api/bling/callback.
3. Escopos: somente LEITURA de Produtos, Estoques e Categorias de produtos. Nenhum escopo de escrita.
4. Salvar. Copie o Client ID e o Client Secret DIRETO para as variáveis BLING_CLIENT_ID e BLING_CLIENT_SECRET do Render
   (sem colar no chat) e faça novo deploy.

PARTE C — Conferir
1. Abrir APP_URL/entrar e ver a tela de login.
2. Supabase > Authentication > Users > Add user: criar meu usuário (e-mail e senha só na tela do Supabase).
3. Me devolva, em texto, SOMENTE: o APP_URL, o e-mail do usuário criado e "Parte B concluída: escopos X". Nada de segredos.
```

Depois, no Claude Code: informar o APP_URL e o e-mail; o assistente vincula a loja `mobis` ao login e você clica em
"Conectar ao Bling" em `APP_URL/painel/bling`.
