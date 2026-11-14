# Desenho: painel do agente conectado (modelo, tempo, chamadas, consumo, alertas) — PROPOSTA

Status: proposta; nada aqui está implementado, migrado ou publicado (exceto o item 1, já no ar).
Regra de ouro (dono, 2026-11-14): **sempre modo real**. Cada número na tela diz de onde veio: **medido pelo Conecta.IA**, **informado pelo agente** ou **indisponível**. Nunca estimado nem simulado.

## 1. Já no ar
Temporizador em Dispositivos: tempo restante da janela (atualiza a cada 30 s) e teto total aprovado. (#348)

## 2. Modelo do agente conectado — "informado pelo agente"
- O servidor só conhece o `nome` dado no pareamento; não consegue provar qual modelo roda por trás (Claude, GPT, outro).
- Proposta: campo opcional `modelo_informado` (texto curto, sem marcação, ≤ 80) em `pair_desafios` e `pair_dispositivos`, enviado em `iniciar`.
- Tela: "Claude Sonnet 5.5 — **informado pelo agente**, não verificado". Sem o campo: "modelo não informado".
- Migração aditiva (2 colunas nuláveis + validação de tamanho/caracteres). Precisa de aprovação antes de aplicar.

## 3. Chamadas ao gateway — "medido"
- O gateway já audita toda chamada (ok, negada, inválida, erro) com sessão, dispositivo e ferramenta.
- Proposta: RPC de leitura (lojista/admin da loja) que agrega por dispositivo: chamadas nas últimas 24 h e no mês, por resultado; última ferramenta e hora. Sem expor argumentos.
- Sem nova tabela: lê `auditoria`. Índice por (loja, ação, data) se a medição mostrar lentidão.

## 4. Consumo de tokens
- **Nano integrado (medido):** `loja_chaves_ia.tokens_mes` e `limite_mensal_tokens` já existem. Mini painel: usado no mês, limite, % e provedor/modelo efetivo.
- **Agente externo (Claude/GPT pareado) — indisponível para o servidor:** os tokens são gastos no provedor do agente; o Conecta.IA não os vê. Opção futura: o agente **informar** o uso por chamada (`uso_informado`), exibido como "informado pelo agente". Até existir, a tela diz "consumo no seu provedor; não visível aqui".

## 5. Alertas (notificações)
- Sessão: aviso quando faltar < 1 h para o fim da janela, com botão "Reconfirmar +8 h" (já existe).
- Nano: aviso ao atingir 80% e 100% do limite mensal de tokens.
- Canal: banner no painel e, se o lojista ligar, e-mail. Push/WhatsApp ficam para depois (exigem integração e autorização própria).

## 6. Perfil no chat do Nano
- O chat já identifica o modelo efetivo (`identificarModeloEfetivo`). Proposta: rótulo padronizado "Nano · <modelo efetivo>" (ex.: "NanoClaude Sonnet 5.5"), com modelo de contingência marcado quando houver troca. Nome do perfil e lista de modelos a exibir: decisão do dono.

## 7. Ordem sugerida
(3) chamadas medidas → (4) mini painel do Nano → (5) alertas → (2) modelo informado (migração) → (6) rótulo no chat.

## 8. Decisões do dono
1. Aprova o campo `modelo_informado` (autodeclarado)?
2. Alertas só no painel, ou também por e-mail?
3. Nome oficial do perfil no chat ("NanoClaude"?) e se mostra também o provedor.
4. Aceita que o consumo do agente externo fique como "indisponível" até ele informar?

## 9. Fora de escopo
Merge, deploy, migração e qualquer escrita no Bling por este documento.
