# Atividade do agente externo no chat do Nano — desenho para aprovação

> Status: **somente desenho**. Nenhuma tabela, migração, função ou ferramenta foi criada. O SQL abaixo é rascunho e só vai para `supabase/migrations/` depois da aprovação do dono (regra do CLAUDE.md). Escrita no Bling continua desligada.

## 1. Objetivo
Quando um agente externo (GPT, Claude, outro) conectado por MCP trabalha no catálogo, o lojista vê no **chat do Nano**: o que ele consultou, o que propôs, e a decisão (aprovar/rejeitar), com rastreio. O agente livre nunca escreve no Bling nem aprova nada: propõe; o Nano aplica as regras; o lojista decide.

## 2. O que já existe (verificado no código)
- Gateway `conector-mcp`: chamadas passam pelo despachante com `origem: "gateway_mcp"`, escopos da chave e `mcpChaveId`; leitura e propor apenas.
- Propostas versionadas em `agente_propostas` (origem `chat | gateway_mcp | executor`) e item a item; aprovação humana na Central/Aprovações.
- Conversas do chat: `agente_conversas` / `agente_mensagens` (isoladas por loja e usuário, blocos canônicos).
- Imagens: `produto_imagens` + regras de galeria (até 8, marca d'água inutiliza, licença desconhecida não publica, tratamento não destrutivo com SHA).
- Ícones de taxonomia: `painel/src/lib/icones.ts` + `assets/sprite-icones.svg` (slug de taxonomia → ícone da peça).

## 3. O que falta (e o que NÃO é possível)
1. **A conversa privada do usuário com o GPT/Claude não chega ao Conecta.** O MCP só transporta chamadas de ferramenta. O que dá para rastrear é a *atividade* (chamadas e propostas) e um **resumo** que o agente registra por uma ferramenta própria. Nada de copiar a conversa.
2. **Sentido inverso** (o lojista fala no Nano e o agente externo vê): só por ferramenta de leitura de "mensagens do lojista para o agente" — opcional, fase posterior, sempre sob escopo `leitura`.
3. **Busca de imagem pelo agente externo.** O agente pode usar a busca/navegação *do próprio cliente* (se o plano dele tiver), o que evita contratar um provedor de busca **para ele**. Mas: (a) não é garantido (depende do cliente e do plano; não verificado); (b) o resultado chega ao Conecta como **URL não confiável**; (c) o Nano nativo, quando roda sozinho, continua precisando do seu próprio provedor de busca. Logo, o provedor de busca nativo segue pendente para o modo autônomo.

## 4. Desenho

### 4.1 Registro de atividade (nova tabela — rascunho)
```sql
-- RASCUNHO, NÃO APLICADO
create table public.agente_atividades (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  mcp_chave_id uuid,                       -- qual chave (nunca o token)
  origem text not null check (origem in ('gateway_mcp')),
  tipo text not null check (tipo in ('consulta','proposta','resumo','recusa')),
  ferramenta text,                         -- nome do catálogo
  produto_id uuid,                         -- opcional
  proposta_id uuid,                        -- liga à agente_propostas
  resumo text check (char_length(resumo) <= 600),  -- texto do agente, tratado como NÃO CONFIÁVEL
  criado_em timestamptz not null default now()
);
-- RLS: só quem vê a loja lê; escrita só pelo servidor (service role no gateway). Sem update/delete (imutável).
```
- Imutável, sem custo/fornecedor/fiscal/dado pessoal (mesmo filtro de `ficha.ts`).
- Retenção definida pelo lojista (padrão sugerido: 90 dias) — **decisão do dono**.

### 4.2 Ferramentas MCP novas (escopo `propor`, sem escrita externa)
| Ferramenta | O que faz | Travas |
|---|---|---|
| `nano.atividade.registrar` | agente registra um resumo ("verifiquei o CI000016, faltam GTIN e imagem") | ≤600 caracteres, texto escapado, sem HTML/links executáveis, rate limit |
| `conecta.imagem.propor_url` | agente propõe uma URL de imagem **original** para um produto | ver 4.3 |
O resto do catálogo existente (consultar ficha, taxonomia, preparar_atualizacao/cadastro) permanece como está.

### 4.3 Imagem proposta pelo agente (original, sem edição)
1. O Conecta **não confia** na URL: só https, bloqueio de IP privado/localhost/metadata (SSRF), tamanho e tipo (`image/jpeg|png|webp`), tempo-limite.
2. Baixa no servidor, calcula **SHA-256**, largura/altura; guarda a **referência original** (URL de origem + data + hash). A imagem **nunca é editada**; marca d'água ⇒ inutilizável (e nunca removida); licença desconhecida ⇒ não publicável.
3. Entra em `produto_imagens` como `aprovada = false`, `origem = 'agente_externo'`, dentro do limite de 8. O lojista aprova na galeria existente.
4. Domínio de origem segue a política de domínios (público só se fabricante verificado; concorrente nunca mostrado ao público).

### 4.4 Chat do Nano (interface)
- Cartão "Atividade do agente externo" (nome da chave, ferramenta, resumo, hora) reaproveitando `PainelContexto`/`CartaoProposta`.
- Proposta de melhoria com **ícone do slug de taxonomia** (via `icones.ts`) e a imagem **original** ao lado (sem filtro, sem corte), com origem/data/hash visíveis.
- Atualização ao vivo por Supabase Realtime na tabela (RLS), com fallback de recarga manual (offline-first: mostra o último estado e a hora).
- Selo claro "veio do agente externo" — nunca se passa por resposta do Nano. Sem nomes de provedor de IA na tela do lojista.

### 4.5 Desempenho ("modo pesado")
- Limites existentes: 120 chamadas/min por chave, corpo ≤100 KB. Acrescentar: orçamento diário por chave, paginação obrigatória em listagens, `idempotency_key` em toda proposta, compressão de resultados grandes.
- Medir latência e contagem por ferramenta no registro de atividade (sem custo de IA inventado).
- Teste de carga sintético (sem Bling real) antes de qualquer homologação.

## 5. Matriz de permissões
| Ação | Agente externo | Nano | Lojista |
|---|---|---|---|
| Ler catálogo/taxonomia | sim (leitura) | sim | sim |
| Criar proposta | sim (propor) | sim | sim |
| Registrar resumo | sim (propor) | — | lê |
| Propor URL de imagem | sim (propor) | sim | aprova |
| Aprovar/rejeitar | **não** | **não** | **sim** |
| Escrever no Bling | **não** | só após aprovação, Policy Engine, idempotência, auditoria (desligado hoje) | autoriza |
| Ver custo/fornecedor/fiscal | **não** | interno | sim |

## 6. Riscos
- R1 Injeção por texto do agente (resumo/URL): tratar tudo como não confiável; escapar na UI; nunca executar.
- R2 SSRF na busca da URL: allowlist de esquema, bloqueio de redes internas, limite de tamanho/tempo.
- R3 Direitos de imagem: sem licença conhecida não publica; origem sempre registrada.
- R4 Falsa sensação de espelhamento: a tela deve dizer "atividade e resumo", não "conversa completa".
- R5 Dependência do cliente externo (busca de imagem no plano dele): **não verificado**.

## 7. Fases
1. Aprovação deste desenho e das decisões abaixo.
2. Migração + RLS + testes SQL (local, sem produção).
3. Ferramentas MCP + testes (SSRF, tamanho, injeção, escopo, rate limit).
4. Interface do chat (cartão, ícone de taxonomia, imagem original) + capturas desktop/390 px.
5. Homologação com CI000016 (leitura/proposta, sem Bling). Deploy/publicação só com ordem específica.

## 8. Decisões que dependem do dono
1. Aprovar a tabela `agente_atividades` e a retenção (padrão 90 dias).
2. Aprovar as 2 ferramentas novas e que o resumo do agente é só texto curto.
3. Confirmar que o sentido inverso (lojista → agente externo) fica para depois.
4. Confirmar que o provedor de busca do Nano autônomo continua pendente (não depende do agente externo).
