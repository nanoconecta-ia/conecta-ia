# Plano de publicação controlada — frontend (painel) e Gateway MCP
**Estado em 28/10/2026: NADA FOI PUBLICADO por este plano.** Merge no GitHub **não é** deploy. Cada etapa abaixo precisa de autorização específica do proprietário na sessão.

## 1. O que está realmente no ar (verificado) e o que não deu para verificar
| Peça | Verificado | Fonte | Limite |
|---|---|---|---|
| **Painel (GitHub Pages)** | último deploy = run #26 de "Painel (GitHub Pages)", `workflow_dispatch`, **27/10 14:51 UTC, `main@eca8e21`**, sucesso | histórico do GitHub Actions (`painel-pages.yml` só roda manualmente; `publicar-design-20261024.yml` está travado a um commit antigo e não dispara com merges) | **não consegui abrir o site** (o domínio `nanoconecta-ia.github.io` não está liberado na rede desta sessão): é o último deploy *registrado*, não uma leitura do site |
| `main` hoje | `d19848c` | git | — |
| **Delta do painel entre `eca8e21` e `main`** | **9 arquivos**: #113 (correções mobile do painel lateral) e #114 (contraste AA, tema Alto contraste, token `--borda-forte`, seletor de aparência) | `git diff --stat eca8e21..main -- painel` | só CSS/tema/seletor e testes; nenhuma mudança de backend |
| **`conecta-gateway` (Edge Function)** | v4 no ar (`ezbr_sha256 5332a9a7…`, arquivo `e4765f13…`, 2 412 linhas) | `get_edge_function` (somente leitura); cópia em `docs/exec-local/rollback/` | **≠ `main`**: artefato da `main` antes do #124 tinha 2 800 linhas (`6bcef275…`); depois do #124, `33847cd4…` |
| Edge Functions não implantadas | `conector-mcp`, `conector-chat` | `list_edge_functions` | — |
| **Banco** | migração `exec_local_fila` aplicada (versão `20261028065432`), fila vazia | consulta de leitura | — |
| **Fase A (PowerShell real no PC Mobis)** | relatada: 10/10 | proprietário | ver §6 |

### Como o proprietário confirma em 1 minuto o que o site serve
Abra o painel → `F12` → aba **Rede** → recarregue (`Ctrl+F5`) → veja o nome do arquivo `index-….js`. Nomes esperados (build local com as flags de produção `VITE_PAIR_ATIVO=1`, `VITE_BACKUP_ATIVO=1`):
| Versão | JS | CSS |
|---|---|---|
| **antiga** (`eca8e21`, último deploy) | `index-B-Ep9bwf.js` | `index-FBo6PzJO.css` |
| **nova** (`main` `d19848c`) | `index-W02r3ip2.js` | `index-DyKHkJ6Z.css` |
(Hashes de conteúdo gerados aqui; o CI pode divergir se as dependências instaladas diferirem — se o nome não for nenhum dos dois, me diga qual aparece.)

## 2. Ajuste de expectativa — o que muda no visual ao publicar
Publicar o `main` troca **só** o que está nos 9 arquivos: correções do painel no celular, contraste AA, tema **Alto contraste** e o novo seletor de aparência (que agora aparece no celular). **A interface "nova" mais ampla NÃO está implementada**: os PRs 2 a 6 da proposta de design (navegação, casca do chat, cartões, site, extensão) ainda não foram feitos, e o cartão de resultado do executor local (`apresentacao_chat.ts`) **não está ligado à tela do chat**. Depois do deploy, a interface continuará parecendo, em grande parte, a atual.

## 3. Plano do frontend (controlado)
0. *(recomendado, PR pequeno)* **Carimbo de versão**: `VITE_BUILD_SHA` e data injetados pelo workflow e mostrados na tela Design/Sobre e em `versao.json`; acaba a dúvida "o que está no ar?".
1. **Portões**: CI verde no `main`; `npm test` e `npm run build` (flags de produção) já passam em `d19848c`; scripts visuais (temas, painel lateral 390×844 e 844×390) passaram no #114.
2. **Publicar** *(autorização)*: disparar manualmente "Painel (GitHub Pages)" na `main` (build com `npm ci`, `npm test`, `npm run build` e flags de produção).
3. **Verificar**: nome dos arquivos (§1) + roteiro: celular 390 px e PC → seletor de aparência (5 modos), Alto contraste, painel lateral do Nano.ia, telas Parear/Dispositivos.
4. **Rollback (minutos)**: *Re-run all jobs* do run #26 (`40525183390`) — refaz o deploy exato de `eca8e21`; alternativa: criar a tag `painel-eca8e21` e disparar o workflow nela *(a tag exige autorização)*.
Risco: baixo (sem mudança de backend; só CSS/tema/seletor).

## 4. Plano do Gateway (diff e rollback; detalhes em `gateway-diff-checklist.md`)
**Decisões antes de publicar**
1. Aceitar levar junto ~390 linhas que já estão na `main` mas nunca foram publicadas (ex.: `ia/reducao.ts`, `reduzirJson`) **ou** reconstruir sobre o v4. Para ver tudo: `git diff` entre `docs/exec-local/rollback/conecta-gateway.v4.prod.index.ts` e `artifacts/conecta-gateway/index.ts`.
2. **Entrada do LLM**. Recomendação: **implantar `conector-mcp`** — não exige migração, as chaves por loja já existem (`loja_mcp_chaves`, função `conector-chaves` no ar, RPC `mcp_chave_validar`), e é uma função nova (não altera nenhum cliente atual). Alternativa: criar escopo no Pair (exige migração de `pair_escopos_validos()`).
**Passos** *(cada um com autorização)*: (a) publicar `conecta-gateway` com o artefato `33847cd4…` e `verify_jwt=false` (como hoje) — as rotas `/dispositivo/*` ficam inertes sem agente pareado; (b) conferir o hash do que ficou no ar; smoke: sem token → 401, token inválido → 401, JSON-RPC atual inalterado; (c) publicar `conector-mcp` (se a decisão 2 for essa); (d) parear o PC Mobis; (e) prova real.
**Rollback**: republicar `docs/exec-local/rollback/conecta-gateway.v4.prod.index.ts` (`e4765f13…`) com `verify_jwt=false` (cria uma nova versão com o conteúdo antigo). `conector-mcp`: despublicar/neutralizar a função (sem dado a desfazer). Banco: rollback no fim da migração (fila vazia).

## 5. Ordem recomendada
Gateway → `conector-mcp` → frontend → pareamento no painel (já existe tela de aprovação de `agente_desktop` com capacidades) → prova real com **um inventário de leitura**, com evidência (origem, horário, hash, auditoria). O frontend pode ir antes ou depois: não depende do backend.

## 6. Fase A — fonte primária × cópia
- **Fonte primária:** `C:\Users\mobis\AppData\Local\Temp\nano-fase-a-20261028\scripts\exec-local\agente\evidencias\homologacao-powershell_real-2026-10-28T06-18-44-450Z.json`, no PC Mobis. **Esta sessão não a leu.**
- **Cópia resumida** (`NanoIA-Fase-A-Evidencia-2026-10-28.json`, gerada no ChatGPT): **não é o original e não tem o mesmo hash**; **esta sessão não tem acesso a ela** e não deve ser citada como evidência primária.
- Para registrar de forma verificável sem enviar o arquivo: no PC, `Get-FileHash <caminho> -Algorithm SHA256` e `(Get-Item <caminho>).Length`; cole aqui o hash e o tamanho. Eu registro como "informado pelo proprietário".
