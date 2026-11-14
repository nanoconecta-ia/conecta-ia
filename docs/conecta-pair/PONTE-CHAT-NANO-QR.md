# Ponte: chat do Nano respondido pelo agente conectado pelo QR

Estado: **desenho para aprovação** (14/11/2026). Nada implementado, nenhuma migração criada.

## Objetivo

No seletor de modelo do Estúdio do Nano, a opção **"Agente conectado pelo QR"** faz o chat do Nano ser respondido pelo agente externo pareado, em vez do modelo interno. O lojista continua usando a mesma tela.

## Fluxo

1. O lojista escolhe "Agente conectado pelo QR". A opção só fica habilitada com sessão Pair viva que tenha o escopo `chat:responder`.
2. Cada mensagem do lojista entra em `chat_fila` (loja, conversa, mensagem, prazo).
3. O agente chama `conecta.chat_next` pelo gateway e recebe a próxima mensagem **da loja da sessão**.
4. O agente trabalha com as ferramentas que a sessão permite e devolve o texto por `conecta.chat_reply`.
5. A resposta entra na conversa marcada como `origem = agente_qr`, com o nome do dispositivo.
6. **Prazo:** sem resposta em 90 s, o Nano responde com o modelo interno e marca `fallback`. A resposta atrasada do agente é recusada.

## Banco (migração a aprovar)

- `pair_escopos_validos` recebe `chat:responder`, com o rótulo no QR: "Ler e responder as mensagens do chat do Nano desta loja".
- A tabela `chat_fila` guarda:
  - **identificação:** `id`, `loja_id`, `conversa_id`, `mensagem_id`;
  - **estado:** `estado` (`pendente`, `entregue`, `respondida`, `expirada`, `fallback`);
  - **sessão e prazo:** `sessao_id` de quem pegou, `prazo_em`, `criado_em`, `respondida_em`.
- Regras da `chat_fila`:
  - RLS por loja.
  - Escrita só pelo servidor.
  - Uma entrega por vez: a mensagem é reivindicada com `FOR UPDATE SKIP LOCKED`.
- Uma auditoria `gateway.chat` por mensagem entregue e por resposta. O registro guarda só os ids, sem o texto.

## Gateway

| Ferramenta | Escopo | Efeito |
|---|---|---|
| `conecta.chat_next` | `chat:responder` | Reivindica a próxima mensagem pendente da loja, com o texto e as últimas 10 mensagens da conversa. |
| `conecta.chat_reply` | `chat:responder` | Grava a resposta. Recusa se o prazo passou, se a sessão não for a que reivindicou ou se o texto tiver mais de 8.000 caracteres. |

## O que o agente consegue fazer pelo chat

| Pedido do lojista | Situação |
|---|---|
| Consultar produto, preço, estoque e situação no Bling | **Já existe** (`bling_consultar_produto`, `get_product`, `get_part_by_code`) |
| Diagnosticar sincronização e imagens | **Já existe** (`get_sync_status`, `get_product_images`) |
| Enriquecer: marca, descrições, peso, códigos OEM, aplicações, bula | **Já existe como proposta** (`propose_*`). Exige fonte e vai para a Fila. |
| Buscar imagem na web quando não houver | O agente pesquisa com as ferramentas próprias e propõe com `propose_image`. O lojista confirma os direitos. |
| Usar as fotos do Google Drive da loja | **Falta.** Precisa de uma ferramenta de leitura da pasta autorizada do Drive, com escopo próprio. |
| Usar fotos e dados do Bling | Já entram pela sincronização como candidatas pendentes. A releitura por agente ainda é só proposta (`espelho:atualizar`). |
| Aprovar, confirmar direitos e publicar na loja | **Fica com o lojista**, por regra do projeto. O agente só prepara. |
| Gravar no Bling | **Desligado**, por regra do projeto. Exige autorização por campo, Policy Engine e auditoria. |

## Limites honestos

- **Agente sempre ligado.** O agente precisa ficar rodando para atender. Uma sessão de conversa, como o Claude neste chat, só age quando é chamada e não serve como atendente permanente.
- **Texto para fora.** O texto das conversas vai para o provedor do agente externo. Por isso há um escopo próprio, e o rótulo no QR deixa isso explícito.
- **Custo.** O custo do agente externo é cobrado na conta de quem o opera, não no Conecta.

## Ordem de entrega (cada passo com aprovação)

1. Migração do escopo e da `chat_fila`, testada em Postgres local.
2. As duas ferramentas no gateway, com testes.
3. A opção no seletor do Nano, o rótulo nas respostas e o fallback.
4. A ferramenta de leitura do Drive (separada).
