# Desenho: envio de fotos por produto (PROPOSTA — nada foi criado, gravado ou publicado)

Data: 14/11/2026. Status: **para aprovação**. Regra do projeto: mostrar o desenho antes de criar tabelas, migrações ou buckets.

## Objetivo
O lojista (ou o Nano) anexa uma foto a um produto; o Conecta guarda, trata em versões leves, e a foto só vira publicável depois de **aprovação + direitos confirmados**. Nada é escrito no Bling.

## Peças que já existem (reaproveitar, não refazer)
| Peça | Onde | Estado |
|---|---|---|
| Tabela `produto_imagens` (origem, direitos, aprovada, principal, `url_tratada`, `removida_em`, limite de 8 por produto) | migrações | em produção |
| Regras de publicação e direitos | `_shared/imagens/regras.ts`, `imagem_confirmar_direitos`, `imagem_decidir`, `imagem_retirar` | em produção |
| Importação do cadastro do Bling como candidata pendente | `bling-sync` (#365) | publicada, ainda não exercitada com dados reais |
| Variantes (400/1200/800/og) e processador de pixels | `variantes.ts`, `pixels.ts` (#366) | mesclado, **não ligado** |
| Redução no navegador (≤1600 px, ≤2 MP) | `painel/src/lib/reduzirFoto.ts` (#367) | mesclado, **não ligado** |
| Bucket `produtos-imagens` (público, 5 MB, PNG/JPEG/WebP) | só no banco ao vivo | **não consta em nenhuma migração** (deriva) e está vazio |

## Fluxo proposto
1. **Navegador:** o lojista escolhe a foto → `prepararFotoParaEnvio` reduz se precisar.
2. **Envio:** o navegador chama uma função (`produto-foto-enviar`, nova) com login do lojista, `loja_id`, `produto_id` e o arquivo. Nunca grava direto no Storage.
3. **Servidor (a função):** confere que o usuário administra a loja e que o produto é da loja; confere assinatura do arquivo (JPEG/PNG/WebP), tamanho e limite de 8 imagens; calcula SHA-256 e **recusa duplicata** do mesmo produto.
4. **Armazenamento:** grava o **original recebido** em bucket **privado** (caminho só com UUIDs, via `chaveArmazenamento`), registra a linha em `produto_imagens` como **pendente**: `origem = 'Upload do lojista'`, `tipo = 'real'`, `aprovada = false`, `principal = false`, sem direitos confirmados.
5. **Fila (já existe):** o lojista aprova e confirma direitos (referência ≥ 10 caracteres). Só então vale `podePublicar`.
6. **Tratamento:** depois da aprovação, gera as variantes e grava em bucket **público** só o que for publicável; `url_tratada` aponta para elas. Antes da aprovação **nada fica público**.

## Decisões que preciso de você
1. **Onde roda o tratamento (passo 6):**
   - **A (recomendo):** na própria função, mas só para arquivos já reduzidos no navegador (≈2 MP, medido ~0,5 s e dentro de 256 MB). Foto que chegar maior é recusada com aviso.
   - B: tratar tudo no navegador e enviar as versões prontas. Mais leve no servidor, mas o servidor não controla o que recebe (menos confiável).
2. **Buckets:** criar migração para `produtos-originais` (privado) e formalizar `produtos-imagens` (público, só derivados), **ou** reaproveitar o que existe. Recomendo formalizar em migração e documentar a deriva atual.
3. **Original no Drive:** manter o original também no Google Drive (como fizemos com as 5 do CI002916) ou só no Storage? O plano gratuito do Supabase tem pouco espaço; o Drive é o arquivo de longo prazo.
4. **Quem pode enviar:** só o responsável da loja (como `bling-sync`) ou também o agente (com aprovação humana depois)?
5. **Limpeza:** o que fazer com foto rejeitada (apagar o arquivo do Storage na hora ou manter por 30 dias).

## Decisões adotadas (14/11/2026, resposta "Ok" do lojista às recomendações)
O lojista respondeu "Ok" à pergunta que listava as 5 decisões. Interpretei como aceite das **recomendações 1 e 2**. Para as 3 a 5 eu não havia dado recomendação explícita; adotei os padrões abaixo, **provisórios e revisáveis a qualquer momento**:
1. Tratamento na própria função, só para arquivo já reduzido no navegador (**opção A**).
2. Dois buckets formalizados em migração: `produtos-originais` (privado, 3 MB) e `produtos-imagens` (público, só derivados). → PR de migração separado, não aplicado.
3. Original **só no Storage por ora**; cópia no Drive fica para uma ferramenta própria (não gasta espaço do plano gratuito agora). *Padrão provisório.*
4. Só o **responsável da loja** envia. O agente continua propondo pelos caminhos que já existem (`imagem_propor`), com decisão humana. *Padrão provisório.*
5. Foto rejeitada ou retirada: **apagar o arquivo do Storage** (a linha já é removida por `imagem_decidir`). *Padrão provisório.*

## Riscos e limites
- **Plano gratuito:** 2 s de CPU e 256 MB por chamada; função de envio e tratamento devem ser separadas para não somar. WASM de ~1,4 MB; conferir limite de tamanho ao publicar.
- **Não validado:** nada disto rodou no Edge Function publicado; só Deno local e Chrome headless.
- **Direitos:** foto do lojista tem direito presumido, mas **não pula** a confirmação registrada; foto de fornecedor/web continua exigindo licença e referência.
- **Segurança:** bucket privado sem política para o navegador; URLs assinadas curtas só para a tela de aprovação; nenhum nome de arquivo do usuário entra no caminho.
- **Custo:** cada produto ≈ 1 original (~0,3–0,5 MB reduzido) + 4 derivados (~0,1 MB). Para 1.000 produtos × 5 fotos ≈ 2–3 GB: **excede o plano gratuito de Storage** (1 GB). Conferir cota atual antes de abrir envio em massa.

## Testes planejados
Função com portas simuladas (sem rede), RLS/permissões no SQL local, upload real de uma foto de teste em loja de teste, e conferência de que nada vira público antes de aprovar.

## Entrega proposta (PRs separados, cada um com seu "pode")
1. Migração dos buckets + política (apenas após sua aprovação do desenho).
2. Função `produto-foto-enviar` + testes.
3. Tela de envio no painel usando `reduzirFoto`.
4. Tratamento após aprovação (variantes) e `url_tratada`.
