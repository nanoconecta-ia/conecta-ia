# Mobis — resiliência do catálogo e inspeção da prévia no Nano (20/11/2026)

Autorização do proprietário nesta conversa: investigar a mensagem intermitente "Não foi possível carregar o catálogo", aproveitar o visualizador Web já presente no Nano e melhorar a integração sem TinyFish ou Desktop Commander.

## Evidência observada
- A vitrine publicada respondeu com estado carregando e, em algumas capturas, erro do catálogo.
- Logs da Edge Function `loja-publica` mostraram 108 POST HTTP 200 na janela inspecionada, sem 5xx/429 nessa amostra. Algumas respostas demoraram mais de 5 s. Não foi comprovada causa única da falha intermitente.
- Mobis permanece em ambiente teste; nenhum item comercialmente publicado, e apenas 1 SKU em prévia informativa. Nada autoriza remover bloqueios.

## Implementação
- Tratamento resiliente na vitrine: timeout de 18 s por tentativa; no máximo uma repetição para erros transitórios de rede ou HTTP 5xx. Sem repetição automática para 404, 413, 429. Não reutiliza conteúdo de outro lojista e não remove travas.
- Aba Web do Estúdio Nano: botão explícito `Conferir catálogo público` com chamada à mesma API pública/mesma chave publicável da vitrine; mostra retorno real (quantidade e ambiente), sem simular sucesso nem enviar credenciais; controle de recarga da prévia iframe.
- Interface de status responsiva no Android e desktop; nenhuma conexão de navegador remoto é alegada.
- Testes sintéticos: recuperação após 503 no catálogo, inspeção e recarga da prévia Nano; autenticação do Conecta.IA permanece isolada.

## Limites
Nenhuma migração no Supabase, nenhuma alteração de Edge Function, Bling, estoque, custo, preço, NF, fotos, aplicações, banners, produtos publicados, modo `teste`, sessão ou políticas de segurança. Se a API pública continuar falhando, diagnóstico complementar deverá inspecionar erros do cliente e traces específicos.
