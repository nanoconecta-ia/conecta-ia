# Conecta Pair — pareamento e autorização remota

**Estado em 18/10/2026: estúdio, Pair e OAuth publicados; migrações aplicadas.** A conexão do cliente e o consentimento do proprietário continuam pendentes, assim como o teste completo com dados reais do Bling. Os testes de CI usam identidades e produtos sintéticos. [Publicação e evidências](PUBLICACAO-20261018.md).

Contratos de API: [API.md](API.md). Migração: `supabase/migrations/20261018230657_conecta_pair.sql` (com bloco ROLLBACK).

## 1. O que é

Deixa o lojista conectar computador, celular, sessão de navegador ou **agente externo de IA** (via MCP/API) à sua loja, lendo um QR Code, **sem conceder privilégio administrativo**. O agente consulta e **propõe**; quem aprova e executa é o lojista, na Central de Aprovações, sobre a **versão exata** da proposta.

```
 Dispositivo solicitante (sem login)                     Lojista (celular, logado)                 Servidor
 ───────────────────────────────────                     ──────────────────────────                ─────────────────────────
 gera TOKEN localmente (256 bits)
 POST pair/iniciar {nome,tipo,escopos,token_hash} ───────────────────────────────────────────────▶ cria desafio (2 min, uso único)
 ◀── {codigo, url, verificacao, segredo}                                                           guarda só HASHES
 mostra QR(url) + código de 6 dígitos
                                      lê o QR ──▶ #/parear?c=<codigo> (login normal)
                                      pair_detalhe: vê nome, tipo, escopos, duração, suas lojas
                                      escolhe loja/escopos/duração (só pode REDUZIR),
                                      digita o código da TELA do dispositivo ──────────────────▶ pair_aprovar (FOR UPDATE; 1 vencedor)
 POST pair/consultar {codigo,segredo} (polling) ─────────────────────────────────────────────────▶ aprovado → resgata UMA vez:
 ◀── {estado:"resgatado", loja, escopos, limite_ate}                                               cria dispositivo + sessão (hashes das 2 metades do token)
 usa o TOKEN (que nunca saiu do dispositivo) ──▶ conecta-gateway (JSON-RPC) ────────────────────▶ pair_validar a CADA chamada (revogação imediata)
```

Propriedades-chave:

| Pedido da ordem | Como é garantido | Onde |
|---|---|---|
| Desafio aleatório de uso único, expira em 2 min | 256 bits (`crypto.getRandomValues`); só o hash vai ao banco; TTL ≤ 120 s forçado no banco | `cripto.ts`, `pair_iniciar` |
| QR sem senha/credencial/token | O QR é só `https://…/#/parear?c=<código>`; teste decodifica o QR renderizado e confere | `montarUrlPareamento`, teste de UI |
| Aprovador autenticado, vê dispositivo/loja/permissões/duração, confirma | RPCs rodam com o JWT do lojista (`auth.uid()`); tela mostra tudo; exige digitar o código da tela do dispositivo | `pair_detalhe`, `pair_aprovar`, `Parear.tsx` |
| Consumo atômico, sem reuso | `FOR UPDATE` + `UPDATE … WHERE estado=…`; 8–12 conexões simultâneas: 1 vencedor | SQL + `conecta_pair_concorrencia.sh` |
| Vínculo sessão ↔ usuário ↔ loja ↔ dispositivo | `pair_sessoes`/`pair_dispositivos`; a loja vem **da sessão**, nunca de argumento | gateway |
| Revogação e encerramento remoto | `pair_revogar_*` (lojista/dono) e `pair_encerrar` (o próprio dispositivo); valem na **próxima** chamada porque o banco confere a cada uso. **Revogar também cancela as propostas pendentes e aprovadas-não-executadas** daquela sessão | SQL |
| Token curto, escopo mínimo | Acesso 15 min com rotação (ou, opcionalmente, token fixo até o fim da duração aprovada); escopos de leitura/proposta e `bling:consultar`, sem execução de escrita. **Token em duas metades** `<token>.<sal>`: o dispositivo gera a 1ª, o **servidor gera o sal de 256 bits**; as duas precisam bater, então um token fraco escolhido pelo cliente não autentica sozinho | migração, `separarToken` |
| Proteção contra replay | Token anterior tolerado 60 s (resposta perdida); depois disso **revoga a sessão inteira** | `pair_validar` |
| Nova confirmação para operação sensível | Aprovar risco HIGH/CRITICAL e parear agente desktop exigem autenticação recente (≤ 5 min, claim `amr`) | `autenticacao_recente` |
| Auditoria com usuário, loja, dispositivo e operação | `auditoria` imutável; toda chamada do gateway (ok/negada/inválida/erro) e todo evento de pareamento/aprovação | `pair_auditar` |
| Aprovação ligada à versão exata | Hash SHA-256 calculado **no banco**; conteúdo imutável por trigger; decidir exige o hash que o aprovador viu; nova versão substitui as anteriores | `aprovacoes` |

## 2. Central de Aprovações

Tipos: atualização de produto, criação de categoria, publicação de banner, alteração de página, publicação de catálogo, operação em lote, alteração de campanha, alteração de orçamento. Cada pedido mostra: **quem** (agente + dispositivo), **qual ferramenta**, **registros afetados**, **antes/proposto**, **prazo**, **riscos**, Aprovar/Recusar e a versão exata (`hash`).

- **Risco mínimo por tipo, imposto no banco**: o agente não consegue rebaixar o risco (banner/página/produto/categoria ≥ MEDIUM; catálogo/lote/campanha/orçamento ≥ HIGH).
- **Estados**: `pendente → aprovada → executando → executada | falhou`; desvios `recusada`, `expirada`, `substituida`, `cancelada`. Transições inválidas são barradas por trigger.
- **Teto de pendentes**: no máximo **20 por sessão** e **200 por loja** (pedido novo; duplicata idempotente e nova versão não contam; vencidas não contam). Acima disso o banco responde `54000` e o agente recebe a mensagem "há propostas pendentes demais".
- **Duplicadas**: `idempotency_key` única por loja. Mesma chave + mesmo conteúdo devolve o pedido existente; mesma chave + conteúdo diferente é recusada (`23505`).
- **Alterar depois = aprovar de novo**: `aprovacao_propor(p_grupo=…)` cria a versão N+1 e marca as anteriores como `substituida` (inclusive as já aprovadas e não executadas). Versões simultâneas entram em fila (advisory lock).
- **Notificação**: cada proposta cria uma linha em `notificacoes` (tipo `aprovacao`) e aparece na Central (atualiza a cada 15 s e ao focar a aba). *Push/e-mail não foram implementados.*
- **Execução separada**: `aprovacao_consumir` reivindica a aprovação **uma vez**, conferindo versão e prazo; `executarAprovada` roda o executor registrado e grava `executada`/`falhou`. **O registro de executores vem vazio**: aprovar não faz nada acontecer até um executor ser escrito, testado e autorizado. Falha **não repete sozinha**.

## 3. Gateway MCP/API para agentes externos

`POST /functions/v1/conecta-gateway`, JSON-RPC 2.0, `Authorization: Bearer <token>.<sal>` (token completo da sessão). Respostas conferidas contra os schemas oficiais do SDK `@modelcontextprotocol/sdk` 1.32 (versão de protocolo mais recente suportada: `2025-11-25`; aceita também `2025-06-18`, `2025-03-26`, `2024-11-05`, `2024-10-07`).

Ferramentas originais: `conecta.list_products`, `conecta.get_product`, `conecta.propose_enrichment`, `conecta.propose_banner`, `conecta.get_pending_approvals`, `conecta.get_task_status`. Além delas, `conecta.bling_consultar_produto` consulta o Bling somente com `bling:consultar`. Nenhuma aprova, executa escrita, publica ou altera preço/estoque. `tools/list` só mostra o que o escopo da sessão permite. Detalhes em [API.md](API.md).

O modelo **nunca** recebe credencial do Supabase ou do Bling: o gateway usa `service_role` só no servidor, com colunas em lista fechada; erros internos viram mensagem genérica.

## 4. Bling

Inalterado: OAuth oficial por loja (`bling-conectar`/`bling-callback`), escopos do app do Bling, tokens cifrados no servidor. O QR **não** substitui o OAuth nem concede escopo: um QR de "abrir o Bling no computador" seria apenas um link de navegação (`#/bling`) para o lojista fazer o login e a autorização normais. O Pair não entrega credencial de ERP ao agente. A consulta autorizada reutiliza o registry e cliente do servidor; ferramentas de escrita no Bling seguem `ativa:false`. [Operação e limites](OPERACAO-AGENTE.md).

## 5. Agente desktop (opcional) — contrato, **não implementado**

Não existe controle irrestrito de desktop. Para operar aplicativos locais haverá um **agente desktop opcional**, instalado com consentimento, que:
1. Pareia como `tipo = 'agente_desktop'` (mesmo QR; o aprovador vê um aviso destacado e precisa de **login recente**).
2. Declara uma **lista de capacidades** (`capacidades`, ex. `janela.listar`); o lojista aprova um subconjunto; nasce **sem nenhuma** por padrão. O servidor guarda e devolve a lista aprovada (`pair_validar`); **quem aplica a lista é o agente no computador** (o servidor não consegue impedir uma ação local) — por isso o agente é software auditável e instalado de forma consentida.
3. Mostra **indicador de sessão ativa** (o painel já mostra "Sessão ativa até hh:mm" em Dispositivos) e **botão de interrupção** local (`pair_encerrar`) e remoto (Desconectar / Interromper todos).
4. Faz *heartbeat* chamando `ping` no gateway (sugerido a cada 15 s): sessão revogada responde 401 e o agente **deve parar na hora**.

## 6. Matriz de testes pedidos

| Teste pedido | Evidência | Resultado |
|---|---|---|
| QR expirado | SQL: desafio vencido não aparece, não aprova, solicitante vê `expirado`; aprovado e não resgatado a tempo expira e **não cria sessão** | ✔ |
| QR reutilizado | SQL: 2ª aprovação → `desafio_ja_usado`; reresgate devolve o mesmo dispositivo, 1 sessão; 5 códigos errados bloqueiam o desafio; concorrência: 1 vencedor em 8–12 | ✔ |
| Usuário não autorizado | SQL: editor, lojista de outra loja, anônimo e sem login recusados (`42501`/`28000`); desafio não muda; gateway sem/ com token inválido → 401 + limite de falhas por IP | ✔ |
| Acesso entre lojas | SQL: lojista B não pareia/decide/lê aprovações da loja A (resposta idêntica à de "não existe"); produto da loja B como alvo → `42501`; RLS; TS: argumento `loja_id` recusado, toda consulta filtra a loja da sessão | ✔ |
| Sessão revogada | SQL: revogar dispositivo/sessão/tudo; `pair_validar` → nulo na próxima chamada; renovar recusado; só dono/lojista revogam; TS: revalida a cada chamada | ✔ |
| Aprovação adulterada | SQL: `UPDATE` de conteúdo/hash/risco/estado barrado por trigger; hash errado → `proposta_alterada` (auditado); nova versão invalida a anterior; executor com hash antigo recusado | ✔ |
| Solicitação duplicada | SQL e concorrência: mesma chave/conteúdo → 1 linha, 1 notificação; conteúdo diferente → erro; TS: chave automática estável por sessão | ✔ |
| Perda de conexão | SQL/TS: reresgate idempotente (token nunca trafega); token anterior vale 60 s após rotação; replay depois disso revoga a sessão (e só quem tem as **duas** metades dispara isso); `pair_encerrar` | ✔ |
| Concorrência entre dispositivos | `conecta_pair_concorrencia.sh`: 8 e 12 conexões reais simultâneas para aprovar, resgatar, propor, decidir (aprovar×recusar), executar e versionar | ✔ (4 execuções) |
| Operação recusada | SQL: recusada não executa (`estado_recusada`); TS executor: nada roda sem reivindicação | ✔ |

Registro histórico dos testes da implementação original do Pair (não representa teste real no Bling nem o total atual de CI): **176** verificações SQL do Pair e **17 de 17** suítes SQL do repositório passando no CI (antes só 1 rodava), **18** asserções de concorrência real (8–12 conexões, 30 no teto), **124** testes Node nas funções (44 do Pair, 11 dos contratos, 69 pré-existentes), **9** testes do painel, `tsc --noEmit` e `vite build` (com e sem a flag) limpos. **E2E local com HTTP real** (Postgres + PostgREST + as Edge Functions originais em Deno): **84/84**; esse E2E e a conferência MCP/UI ficam fora do repositório (dependem de binários baixados) — ver "Limitações". Teste de mutação: remover cada uma das 4 proteções novas (sal, cancelamento, teto, revoke de `private`) faz a suíte falhar.

## 7. Limitações e riscos reais (leia antes de aprovar)

1. **Aceite real pendente.** Migrações e funções foram implantadas com autorização, e discovery/DCR/negativa anônima foram verificados na nuvem. O CI usa identidades e produtos sintéticos. Falta o cliente real autorizar e consultar o SKU80692 no Bling; não equivale a teste completo do agente.
2. **`amr` (autenticação recente):** a reconfirmação depende do claim `amr` com `timestamp` do Supabase Auth. Não pude verificar o formato real aqui; a tela reconfirma por **senha** — usuários que entram só com Google não conseguem reconfirmar (precisam de fluxo de reautenticação OAuth, não feito). **Pendente de teste na branch do Supabase.**
3. **`verify_jwt=false` com Bearer opaco:** a plataforma está configurada para autenticação própria do Pair. Discovery e acesso anônimo já foram verificados; a chamada positiva com sessão aprovada pelo proprietário ainda depende do cliente real. Não retirar autenticação ou fabricar sessão para esse teste.
4. **Janela de 60 s:** o token anterior segue válido por 60 s após a rotação (para sobreviver a respostas perdidas). Um token completo roubado nesse intervalo funciona; depois, o uso do token antigo (com as duas metades) revoga a sessão e cancela as propostas dela (falha segura).
5. **Token estático (modo não renovável):** quem o copia (as duas metades) age como o dispositivo até o prazo. Mitigação: duração curta escolhida pelo lojista, escopos mínimos, revogação imediata, cancelamento das propostas ao revogar.
6. **Engenharia social / QR-jacking:** o lojista só autoriza digitando o código da **tela do dispositivo**; o nome do dispositivo é informado pelo próprio dispositivo (a tela avisa). Não há como o servidor provar que o aparelho é "o notebook da loja".
7. **Gateway de leitura de produtos** devolve preço e estoque ao agente pareado; custo, fornecedor, `bling_id` e campos internos não estão na lista de colunas. O lojista decide os escopos.
8. **Imagem do banner** é URL externa (https, sem IP/localhost/credenciais); o servidor **não a busca** nem verifica direitos de uso — o risco aparece na aprovação (e a Central ainda não mostra prévia da imagem).
9. **Limite de taxa** usa a tabela `limite_chamadas` (escreve no banco a cada chamada); suficiente para o piloto, não para tráfego alto. Falha na auditoria de chamadas de ferramentas bloqueia a entrega do resultado; propostas e decisões também têm auditoria transacional.
10. **Funções SQL expostas no PostgREST:** as 7 RPCs do lado do lojista são `SECURITY DEFINER` executáveis por `authenticated` (cada uma confere `auth.uid()` e o papel). As duas RPCs de consentimento OAuth também são expostas intencionalmente com verificações internas. Os avisos reais do advisor estão registrados na entrega e nos testes. As funções auxiliares em `private` **não** são mais executáveis por `authenticated`.
11. **Tetos** (20 por sessão, 200 por loja) são constantes na função SQL; ainda não configuráveis por plano.
12. **Não implementado:** push/e-mail de aprovação, executores reais (banner, página, catálogo, campanha…), agente desktop, painel de custos do Pair, expiração automática de linhas (só limpeza oportunista de desafios), reautenticação OAuth.
13. **Permissões da Fila e M6:** editor consulta e conversa, mas as decisões de enriquecimento e imagem devem exigir administração da loja no backend (`pode_administrar_loja`, lojista ou super admin com MFA). O [PR #24](https://github.com/nanoconecta-ia/conecta-ia/pull/24), integrado e publicado no artefato `assistente` v6, implementa o 403 para editor e a falha fechada na verificação. A interface desabilitada é conveniência; não substitui o gate do servidor. O artefato autocontido passou nas regressões M6. O comportamento permissivo da fonte anterior ao #24 não deve ser tomado como regra de autorização.
14. **Recursos escondidos por padrão:** no painel, Aprovações, Dispositivos e `#/parear` só aparecem em builds com `VITE_PAIR_ATIVO=1`. O build publicado em 18/10/2026 usa a flag ligada, após implantação autorizada de migrações e funções. A flag não concede sessão por si só.

## 8. Publicação e próximo aceite

Estúdio, consentimento, Pair e gateway OAuth publicados com autorização expressa. [Versões, migrações, CI e reversão](PUBLICACAO-20261018.md). Falta instalar o cliente MCP, obter consentimento nativo para Mobis e validar a leitura real do SKU80692 com auditoria e revogação. Navegador remoto depende de dispositivo conectado e sessão autenticada; a implementação do agente desktop próprio continua pendente. Executores de escrita exigem desenho, testes e autorização específicos.
