# M5 — workflow manual, stack local e dados sintéticos

Autorizado em 2026-10-18 somente para preparação e commit. Este workflow **não foi executado**
nesta sessão. Nenhum projeto Supabase remoto, credencial de produção ou recurso pago é utilizado.

## Custos e permissões

Repositório conferido via GitHub: `visibility=public`. Runner fixado em `ubuntu-24.04`, padrão
hospedado pelo GitHub, para o qual os minutos de Actions de repositórios públicos são gratuitos
([regra de cobrança](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
Não usa larger runners, ambientes pagos do Supabase ou branches do Supabase. A checagem inicial
aborta se o repositório ficar privado ou o runner não for `github-hosted`, Linux x64.

O token do workflow tem somente `contents: read`; checkout não persiste credenciais. Não referencia
`secrets.*`, ambientes de produção, OIDC ou tokens do Supabase remoto. Permissões administrativas
das políticas de Actions da organização não estão expostas pelo conector; o workflow não as altera.
Os dois jobs do workflow de preparação já executaram no runner padrão: a organização permitiu
checkout/setup-node/npm e execução desses jobs. O setup-cli/Docker do M5 só será confirmado na execução manual.
Timeout de 30 minutos e concorrência de uma execução limitam o uso do runner.

## Isolamento

`supabase init` cria `.m5-local`, um projeto novo e descartável. A preparação copia **apenas**
`private.autenticacao_recente` do commit fixo `65ac98c` do #23, cria uma RPC local de teste e duas funções
de eco. Copia também o artefato assistente para testar a rejeição do gateway local com `verify_jwt=true`.
TOTP é habilitado explicitamente só nesse TOML local.

**Não copiar as migrações inteiras do produto.** As migrações `bling_renovacao_automatica` e
`bling_sync_cron` contêm agendamentos com URLs de produção. O M5 não inclui cron, pg_net ou esses SQLs.
Isso também significa que o M5 não certifica o schema inteiro nem o fluxo Pair completo.

As únicas credenciais lidas são as geradas pelo `supabase status` local, em arquivo temporário com
permissão 0600. O cliente recusa qualquer `API_URL` diferente de `http://127.0.0.1:54321` e não segue
redirecionamentos. Identidades e senhas são sintéticas, criadas via GoTrue local e removidas ao final.
Nenhuma chamada de GPT ou Bling é feita. Tokens, QR codes e logs brutos não são publicados.

## Experimentos previstos

| Caso | Prova programada | Limite explícito |
|---|---|---|
| M5-1 | JWT GoTrue real, `amr` com timestamp inteiro e RPC original retorna true | Local |
| M5-2 | Espera real de 310 s, refresh não muda amr e RPC retorna false | Sem relógio falso |
| M5-3 | Enrollment/challenge/verify TOTP real, JWT aal2 | OAuth **não executado**, sem credenciais remotas |
| M5-4 | Bearer opaco preservado com verify_jwt=false | Hash/comprimento, sem token em log |
| M5-5 | Bearer inválido com exp vencido chega à função | JWT sintético não assinado; não é prova de token real expirado |
| M5-6 | Preflight e headers de 100/3000 caracteres | Gateway local |
| M5-7 | Sem JWT/opaco dão 401 no artefato assistente; controle aceita JWT real | Não valida gateway da nuvem |

O relatório sempre marca `m5_completo=false`, pois OAuth e gateway de nuvem continuam pendentes.
Uma falha de experimento encerra com código diferente de zero. As evidências sanitizadas vão ao resumo
da execução; não são enviados logs que possam conter as chaves locais.

## Verificações realizadas nesta sessão

- Três testes das guardas passaram: recusa de URL remota/porta errada, extração SQL sem cron,
  workflow manual/sem secrets/deploy/runner pago.
- Gerada uma fixture local a partir da função real do #23. TOML validado pelo parser `tomllib`:
  TOTP ativo, `assistente.verify_jwt=true`, `m5-eco.verify_jwt=false`; SQL gerado sem cron nem URLs.
- `node --check` passou nos scripts. YAML dos workflows validado com PyYAML.
- O Docker do ambiente não está acessível e a saída pela rede não funciona no executor.
  Não alegar execução de GoTrue/edge-runtime, nem sucesso dos sete experimentos nesta sessão.

O GitHub exige que o arquivo de um workflow `workflow_dispatch` exista na branch padrão para permitir
disparo manual. Enquanto este PR estiver isolado e a main não tiver esse arquivo, **o botão não estará
disponível**. Nenhum merge foi feito para habilitá-lo. Depois de uma decisão específica sobre integração,
a execução será manual na aba Actions; esta preparação não despacha o workflow.

## Evidência de CI da implementação de base

O commit `e39b99f24a8954f5737b478a8d3a9d63483f8a1e` do #26 passou no
[run 39155721460](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39155721460):
artefato/segurança e painel. O painel passou nos sete testes, TypeScript e build.
A demonstração local com três provedores/ferramenta usa mocks identificados como SIMULADOS.
Isso não prova o fluxo GPT real → Bling real → histórico persistente.
