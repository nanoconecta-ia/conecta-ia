# Conecta.IA — arquitetura (rascunho para validação)

Estado: **rascunho**. Stack, banco e hospedagem ainda **não definidos**: dependem de ler o site pronto neste repositório. Nada aqui foi implementado.

## 1. Visão

O lojista mantém o cadastro no ERP. O Conecta.IA publica no site sem recadastro. Cada cliente tem seu **indexador independente**, com agente próprio, e escolhe o modo de entrada. O NanoShell é uma opção, não uma dependência.

```
                    ┌─ Modo externo: Agente NanoShell ──(API de entrada, chave por loja)─┐
Bling (ERP) ────────┤                                                                     ├─▶ Conecta.IA ─▶ Site / checkout / WhatsApp
                    └─ Modo nativo: Indexador do Conecta.IA (credencial Bling do cliente) ┘
                                    └─ agente do cliente: imagens, cadastro, SEO

NanoShell fora do ar ⇒ o cliente muda para o modo nativo e continua operando.
```

O mesmo contrato de dados alimenta o site nos dois modos: o site não sabe de onde o dado veio, só a origem registrada.

## 2. API de entrada (modo externo; proposta, contrato a validar)

O agente externo chama o Conecta.IA. No modo nativo o próprio indexador produz os mesmos eventos e passa pelas mesmas validações.

- **Autenticação:** `Authorization: Bearer <chave da loja>`. Uma chave por loja, guardada só no servidor (armazenar apenas o hash), revogável e com data de último uso.
- **Idempotência:** cabeçalho `Idempotency-Key`. O mesmo envio repetido não duplica nem regrava.
- **Ordem:** cada envio leva `versao_origem` (data/hora de alteração no Bling, ou número crescente). O Conecta.IA **ignora** envio mais antigo que o já gravado.
- **Corpo (proposta):**
  - `erp`: `"bling"`
  - `erp_id`: ID do produto no ERP
  - `tipo`: `produto` | `preco` | `estoque` | `inativacao`
  - `versao_origem`
  - `dados`: campos do tipo (ausente = não informado; nunca preencher por padrão)
- **Respostas:** `200 aplicado`, `200 ignorado` (versão antiga ou repetido), `422` com a lista de campos obrigatórios que faltam, `401/403` credencial inválida ou loja errada, `429` limite.
- **Registro:** origem, data e versão de cada gravação. Falha de validação fica visível para o lojista e para o agente.

## 3. Publicação

- Produto só é publicado se tiver os campos obrigatórios (lista a definir com o lojista).
- Campo vazio fica vazio na página. Nada é inventado.
- Produto inativo ou removido no ERP é despublicado, não apagado.
- Último catálogo válido continua no ar se o agente ou o ERP ficarem fora do ar.

## 4. Controle de venda

Ordem de avaliação de uma compra, no servidor:
1. A loja está em modo que permite checkout? (`catalogo` bloqueia)
2. A UF do CEP de entrega é permitida pelo **super admin**?
3. A UF é permitida pelo **lojista**?
4. O tipo de comprador (PF/PJ, pelo CPF/CNPJ) é permitido pelo lojista?
5. Preço e estoque estão frescos e válidos?

Se qualquer passo falhar: a compra é recusada com motivo claro e o cliente é levado ao WhatsApp (exceto em loja só catálogo).

Papéis: `super_admin` (plataforma), `lojista` (por loja). Cada um com login próprio; super admin com verificação em duas etapas. Auditoria de toda mudança de regra.

## 5. Isolamento e segurança

- Toda tabela de dados da loja carrega o identificador da loja. Acesso filtrado no servidor **e** no banco (RLS no Postgres/Supabase).
- Chave por loja só atua na própria loja.
- Segredos fora do código e do navegador.
- Backups: plano gratuito do Supabase não tem backup diário. Exportação periódica do catálogo para outro lugar antes de abrir ao público.

## 6. Frescor de preço e estoque

- O agente envia a cada mudança. O Conecta.IA guarda `atualizado_em` e a `versao_origem`.
- Antes de cobrar: se o dado tem mais que a idade máxima (sugestão: 15 min), bloquear a compra e levar ao WhatsApp.
- Observação: se um item não muda há muito tempo, isso não é erro. A idade máxima precisa se referir à **saúde da conexão** (último envio ou sinal de vida do agente), não à última alteração do produto. Definir um sinal de vida do agente.

## 7. Indexador nativo e autenticação do Bling (JWT)

Fonte da nota: guia "Migração para autenticação JWT" da documentação do Bling.

- O Bling está descontinuando tokens opacos; a data do bloqueio está em definição.
- Header `enable-jwt: 1` na obtenção do token, na renovação e em todas as requisições. O JWT tem ~1.500 a ~3.000 caracteres: colunas e headers precisam comportar isso.
- **No modo nativo o Conecta.IA fala com o Bling**, então isso vale para ele: credenciais por cliente, cifradas, só no servidor, renovação automática, isolamento por loja.
- Respeitar os limites de requisições e avaliar webhooks do Bling (páginas "Limites" e "Webhooks" da documentação). Não presumir; ler antes de implementar.
- O indexador nativo reaproveita as regras de sincronização: idempotência, ordem por versão, backoff, último estado válido se o Bling cair.
- **Agente do cliente:** melhora imagens, cadastro e SEO. Dado enriquecido fica separado do original, com fonte, data e confiança. Escrita de volta no Bling só com autorização explícita por campo.

## 8. Decisões em aberto

1. Stack, banco e hospedagem do site pronto (ler o repositório).
2. Campos obrigatórios para publicar um produto.
3. Sinal de vida do agente e idade máxima aceita.
4. Quais UFs o super admin pode bloquear e como o lojista as vê.
5. Formas de pagamento do checkout (o piloto pode começar só em modo WhatsApp).
6. Plano do Supabase para produção (o gratuito pausa por inatividade e não tem backup diário).
7. Nome das organizações: a do Supabase e a do GitHub serão renomeadas para NanoConecta.ai. Não fixar nomes de organização no código.
8. Escrita de volta no Bling: nunca, ou só com autorização por campo? (recomendado: só na camada do Conecta.IA; escrita opcional e explícita)
9. Qual agente/modelo de IA o indexador nativo usa e quem paga o custo por cliente (limite de uso por loja).
10. Critério de troca para o modo nativo quando o NanoShell falhar (sinal de vida do agente) e se a troca é automática ou manual.
11. "Recursos mais modernos": lista concreta a definir com o cliente (SEO local, dados estruturados, otimização de imagem, PWA...). Sem prometer resultado de ranking.
