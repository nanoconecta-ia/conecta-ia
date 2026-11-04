# Continuidade do chat com OpenRouter prioritário

## Problema e comportamento

A conta piloto esgotou a franquia diária de `openrouter/free`. O código descartava o motivo detalhado do 429. A recuperação sem IA já mantinha a ficha de SKU exato, mas não havia reserva independente quando o OpenRouter era o principal.

Agora o adaptador identifica somente os códigos conhecidos de limite diário/minuto do OpenRouter, tanto no HTTP como dentro de SSE. Não devolve corpo bruto nem mensagem arbitrária do provedor. A resposta guarda `motivo_ia`, `tentar_novamente_em`, `renovacao_estimada` e `provedor_bloqueado` nos metadados existentes. Quando o provedor não informa reset válido, a próxima virada UTC é uma estimativa identificada na UI.

Um bloqueio diário registrado hoje, ainda válido, é reutilizado no servidor por loja. Isso evita nova inferência ao OpenRouter até a renovação, inclusive em outra conversa. Falha na leitura do registro não inventa bloqueio: o provedor é consultado normalmente. Não há cache de respostas de catálogo, preço ou estoque.

## Reserva independente

A primeira versão usa Groq no provedor já existente `compativel_openai`. Endereço exato: `https://api.groq.com/openai/v1`, com barra final opcional. Endereços OpenRouter, OpenAI, HTTP, aliases e query strings não são aceitos para troca automática. Outros endereços continuam disponíveis para escolha manual pelo fluxo existente.

A reserva exige chave ativa, modelo configurado e autorização separada no chat, desmarcada inicialmente e reiniciada na troca de provedor/loja. O servidor revalida o endereço da credencial na execução; não confia só no estado anunciado pelo painel.

- OpenRouter é tentado primeiro, salvo bloqueio diário já conhecido.
- Uma única tentativa de reserva após 429, 502 ou 504, sem anexo, texto já transmitido, ferramenta já tentada ou proposta já criada.
- Só a pergunta atual é reenviada; o histórico anterior é descartado para a reserva.
- A reserva recebe apenas as mesmas ferramentas de leitura do modo gratuito. Pesquisa externa e criação de propostas são bloqueadas pelo servidor.
- O provedor/modelo efetivo, a latência e a troca são registrados e exibidos; chave configurada não é apresentada como disponibilidade comprovada.
- Gemini não participa dessa reserva. Sua configuração permanece desativada.
- Sem chave/autorização ou com ambas as IAs indisponíveis, continuam `/ficha SKU`, `/revisar SKU`, contexto vivo e recursos locais existentes. Nenhum novo executor de escrita foi criado.

## Ativação

Em Integrações de IA, cadastrar a chave Groq no provedor compatível com OpenAI, informar modelo com suporte a ferramentas e a URL acima. Testar a chave. Manter OpenRouter como principal. Reabrir o chat e autorizar a reserva na aba Modelo e privacidade.

A loja piloto possui somente a chave OpenRouter ativa neste momento; a reserva não está operacional sem uma credencial Groq válida. Não existe compra de créditos nem cadastro de conta automático. Não cole chaves no chat ou no GitHub.

## Validação

Testes com provedor/ERP sintéticos verificam: cota diária → reserva autorizada; ausência de consentimento/chave; endpoint incorreto; falha dos dois com ficha sem IA disponível; bloqueio diário sem nova chamada; ausência de histórico no novo provedor; ferramentas de proposta inventadas bloqueadas; Gemini nunca consultado.

Há testes puros para a política de troca e o parser de cota; o teste de navegador com streaming cobre 390/1280 px, checkbox inicialmente desmarcado, envio do consentimento e identificação do modelo Groq. Não substituem homologação com credencial real.

Sem migração de banco nem alteração de credenciais existentes. Publicação necessária: assistente e painel. As APIs gratuitas continuam sujeitas a limites e indisponibilidade; não há promessa de serviço ilimitado.
