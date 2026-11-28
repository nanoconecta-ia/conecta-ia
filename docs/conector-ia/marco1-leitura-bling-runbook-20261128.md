# Marco 1 — leitura real do Bling (runbook de ativação)

**Data:** 2026-11-28 · **Status:** runbook de governança · **Escopo:** Conecta.IA / Mobis
**Natureza:** descreve **como ligar** a leitura real do Bling reusando a infra existente. **Somente leitura.** Não autoriza escrita no Bling, movimentação de estoque, emissão fiscal, publicação nem migração destrutiva. Documentação não implica implantação.

---

## 1. A infra de leitura JÁ EXISTE (não reconstruir)

Verificado em 2026-11-28: **58/58 testes passam** nos módulos de leitura.

| Componente | Papel |
|---|---|
| `supabase/functions/bling-conectar` + `bling-callback` | OAuth: obtém e guarda a credencial da loja (cifrada) |
| `supabase/functions/_shared/bling_token.ts` | renovação de token; header `enable-jwt: 1`, JWT não truncado |
| `supabase/functions/_shared/bling_api.ts` | chamadas à API Bling v3 |
| `supabase/functions/_shared/bling_sync.ts` | sincroniza o **espelho somente leitura** do catálogo |
| `supabase/functions/_shared/bling_snapshot.ts` | snapshot do cadastro |
| `supabase/functions/loja-publica` | lê o espelho (chave anônima, RLS) para a vitrine |

**Reuso:** ligar o Marco 1 é **configurar credencial + rodar o sync de leitura**, não escrever código novo de sync.

---

## 2. Passos para ativar (cada um exige autorização registrada)

1. **Registrar o app OAuth do Bling** para o Conecta.IA (escopos de **leitura** de produtos; sem escrita).
2. **Secrets no servidor** (nunca no front/repo): `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `CREDENCIAIS_CHAVE_CIFRA` (cifra a credencial da loja).
3. **Conectar a loja Mobis**: fluxo `bling-conectar` → `bling-callback` grava a credencial **cifrada** por loja.
4. **Rodar `bling-sync`** em modo leitura: espelha 20–50 produtos reais.
5. **Conferir** no catálogo **informativo** (sem preço): `preco_publico=null`, `estoque_publico=null`, 0 itens publicados até homologação.
6. (Opcional) **Webhook** do Bling para espelho quase em tempo real + varredura periódica de segurança.

---

## 3. Travas (modo seguro)

- **Zero escrita**: `produto_automacao.pausado` permanece ligado; nenhuma ferramenta `bling.*` de escrita é acionada (bloqueada por `conector/mobis_politica.ts`).
- **Sem fiscal**: nota fiscal só consulta; nunca emitir/movimentar estoque.
- **Sem preço público** nesta fase (catálogo informativo).
- **Imagens reais só depois** do sistema pronto (decisão do dono 28/11); até lá `foto_pendente` + placeholder.
- Credencial **cifrada**, só no servidor; nunca em log nem no navegador.

---

## 4. Estado atual e o que falta

- ✅ Código de leitura: presente e verde (58/58).
- 🔴 **Falta (sua autorização):** registrar o app OAuth e **fornecer/gerar a credencial** do Bling da Mobis; autorizar rodar o `bling-sync` de leitura.

Enquanto a credencial não é fornecida, o Marco 1 fica **pronto tecnicamente, desligado operacionalmente**.
