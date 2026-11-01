# Nano.IA — busca real de imagens via SearXNG: PR A (código, SEM deploy)

## Constatações antes da alteração (01/11/2026)
- O Supabase de destino é **conecta-ia** `dsfzhsrudriqkumtlqwj`, distinto de NanoShell IA.
- A Edge Function `assistente` está publicada, mas usa busca Google legada; `loja_busca_imagem` tem **0 registros**. O agente não tinha provedor configurado.
- `buscar_imagem_web` e `buscar_dados_tecnicos_web` já estavam presentes em `ia/ferramentas.ts` e no motor `conector/handlers.ts`, com contrato `ProvedorBusca`.
- **Gargalo adicional**: o chat persistente (`_shared/assistente/chat.ts`) expunha ao modelo apenas consulta ao Bling + ferramentas de proposta. Não expunha `buscar_imagem_web`, mesmo que um provedor estivesse disponível.
- PR #196 documenta o SearXNG, mas não o implementa. PR #206 altera frontend do chat; esta PR não toca no frontend nem no logo.

## Implementado nesta branch
1. `_shared/ia/searxng.ts`: `ProvedorBusca` para imagens e pesquisa técnica. API oficial `POST /search`, `format=json`, `categories=images|general`. Normalização `img_src` (foto), `thumbnail_src` (miniatura) e `url` (página de origem). Sem resultados = lista vazia; URL HTTP/interna ou sem origem é descartada; URLs repetidas são removidas; no máximo 6 imagens por chamada (configurável até 10). Nenhuma foto é baixada, salva ou publicada.
2. Configuração **somente servidor**, condicionada à allowlist `SEARXNG_LOJAS_PERMITIDAS`; URL HTTPS pública e token privado obrigatórios. Falha fechada; nenhuma configuração no browser ou no modelo.
3. `_shared/ia/provedor_busca.ts`: seleciona SearXNG autorizado, senão Google legado somente se já configurado, senão estado explícito `sem_provedor`. Mantém o mesmo contrato e nomes de ferramentas existentes; não cria segundo mecanismo de chat.
4. `_shared/ia/ferramentas.ts` e `_shared/conector/handlers.ts`: utilizam o seletor; ferramenta nunca recebe token no prompt.
5. `_shared/assistente/chat.ts`: habilita as duas ferramentas de pesquisa no chat persistente **quando o recurso de ferramentas do chat está ativo** (`chat_consulta_bling`), sem alterar permissões de escrita. Reaproveita `limite_chamada` existente por loja/usuário; consulta credenciais do Google apenas quando efetivamente necessário. Conserva a mesma auditoria geral.
6. `supabase/functions/assistente/index.ts`: rota legada também recebe configuração SearXNG pelo servidor. O chatbot continua utilizando o mesmo `assistente`.
7. `searxng.test.ts`: testes de isolamento por loja, HTTPS, POST JSON, limite, 401/403/429/502, timeout, HTML, JSON inválido, rejeição de URLs internas, dados privados e fallback Google.

## Configuração futura (exemplo sem segredos)
Somente **depois** de revisão e homologação, definir no ambiente **servidor**:
- `SEARXNG_BASE_URL=https://busca.sua-infra-exemplo.com` (origem HTTPS, sem caminhos)
- `SEARXNG_BEARER_TOKEN=<token PRIVADO do proxy autenticado>`
- `SEARXNG_LOJAS_PERMITIDAS=<UUID da loja autorizada>`

**Não colar credenciais no GitHub, chat ou frontend.** A instância SearXNG precisa existir e permitir `search.formats: [html, json]` em `settings.yml`. O proxy na frente deve validar o token Bearer. Sem proxy, sem allowlist ou sem instância, a busca continua indisponível. Configuração no Supabase não foi criada.

## Gatilhos de liberação obrigatórios
- Serviço SearXNG próprio, com HTTPS, autenticação, egress/DNS controlado, cota por loja e rate limit no proxy; não usar instância pública aberta para acesso com dados de cliente.
- Conferir obrigações de licença AGPL e custos de hospedagem. Gratuito em licença **não equivale** a infraestrutura sem custo.
- Confirmar exportação JSON, POST autorizado, portas, timeout, sem redirects, e revisão de DNS/rebinding pela infraestrutura.
- `node --experimental-strip-types --test supabase/functions/_shared/ia/searxng.test.ts` e regressão dos testes existentes de `busca.ts`.
- Testar UI no chat existente: buscar 4 imagens reais para SKU homologado; exibir URLs e páginas de origem sem afirmar foto correta, OEM ou licença. Antes de proposta/publicação, verificar imagem versus SKU e direito de uso.
- Nenhuma edição no Bling, migração de banco, implantação, merge ou publicação autorizada por esta PR.

## Compatibilidade e pendências
- `artifacts/assistente/index.ts` é o bundle gerado que deve ser **regenerado pelo pipeline de release** antes de implantar; não copiar fonte manualmente sobre ele.
- O retorno das ferramentas continua no texto da IA; **cartões gráficos de candidatas e fichas de aprovação** são uma etapa de frontend separada, sem substituir `Assistente.tsx`.
- Esta branch não prova chamada HTTP real, pois nenhuma instância SearXNG autorizada foi fornecida ou implantada.
- No chat persistente as ferramentas de pesquisa usam o gate existente `chat_consulta_bling`, para evitar ampliá-las a usuários sem permissão; se for necessário liberar pesquisa sem Bling, criar flag de permissão separada e auditar.
- A busca por palavras não garante correspondência de peça nem licença de imagem: revisão humana é obrigatória.
