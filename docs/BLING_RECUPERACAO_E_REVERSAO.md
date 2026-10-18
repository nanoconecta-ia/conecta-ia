# Bling por loja — chaves, recuperação e reversão

## Segredos e quem os guarda
- **Plataforma (desenvolvedor, uma vez):** `ESTADO_SEGREDO` (assina o `state`), chaveiro de cifra (`CREDENCIAIS_CHAVE_CIFRA` simples, ou `CREDENCIAIS_CHAVES` JSON `{kid: base64(32 bytes)}` + `CREDENCIAIS_CHAVE_ATUAL`), `APP_URL`. Ficam em Edge Functions → Secrets e **numa cópia de recuperação fora do Supabase**.
- **Por loja (lojista, no painel):** Client ID, Client Secret e CNPJ. O secret é cifrado no servidor e nunca volta ao navegador.
- **Tokens do Bling:** access e refresh cifrados com a mesma chave; renovação automática por cron.

## Backup e recuperação da chave de cifra (procedimento)
1. Gerar com `openssl rand -base64 32` em máquina do desenvolvedor, nunca em chat.
2. Guardar em **dois** cofres independentes (gerenciador de senhas da empresa + cópia impressa lacrada), com duas pessoas autorizadas. A perda da chave torna tokens e secrets ilegíveis (a recuperação é pedir ao lojista que cole o secret e reconecte; nada se perde no Bling).
3. Teste de restauração a cada trimestre: decifrar um valor de teste com a cópia guardada.

## Rotação
1. Gerar `k2`; configurar `CREDENCIAIS_CHAVES={"k1":"…","k2":"…"}` e `CREDENCIAIS_CHAVE_ATUAL=k2` (as duas ativas).
2. Recifrar todos os valores (função `recifrar`, idempotente) para `v2.k2.…`.
3. Conferir que nenhum valor restante começa com `v1.` ou `v2.k1.`; só então retirar `k1`.
4. Rotação de emergência (suspeita de vazamento): igual, mais pedir reautorização às lojas.

## Reversão da migração 21 e das funções
- A migração só cria objetos novos; **antes da primeira conexão não há dados** nas tabelas. O bloco `ROLLBACK` no fim do arquivo SQL remove funções e tabelas.
- Funções: republicar as versões anteriores (`bling-conectar`/`bling-callback` v2, `bling-renovar` v1) e restaurar `BLING_CLIENT_ID/SECRET` globais, se ainda forem usados.
- Com dados já gravados: exportar `private.bling_apps` cifrado antes de remover; nunca em texto claro.

## Compatibilidade
Hoje `bling_conexoes` e `bling_credenciais` estão vazias; não há conexão existente para migrar. Valores no formato antigo `v1.` continuam legíveis (o chaveiro tenta as chaves) e são migrados para `v2.<kid>.` por `recifrar`.
