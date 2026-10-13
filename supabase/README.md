# Banco (Supabase `conecta-ia`)

Migrações da Fase 1 em `migrations/`. **Não estão aplicadas** no projeto: só são aplicadas após aprovação explícita, conferindo antes que o ref é `dsfzhsrudriqkumtlqwj` (nunca o do NanoShell IA).

## Teste local (Postgres 16, sem tocar no Supabase)
```
createdb t
psql -v ON_ERROR_STOP=1 -d t -f tests/stub_supabase.sql   # imita roles e auth.* do Supabase (só teste)
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d t -f $f; done
psql -v ON_ERROR_STOP=1 -d t -f tests/rls_isolamento.sql   # duas lojas fictícias; desfaz tudo no fim
```

## Regras que o esquema impõe
- Toda tabela de loja tem `loja_id` e RLS; lojista só vê a própria loja.
- Espelho do Bling e filas: escrita só pelo servidor (`service_role`); lojista não edita produto.
- Segredos (tokens do Bling, chaves de IA) em `private.*`, cifrados, sem acesso do navegador; chaves MCP só como hash.
- Super admin = `app_metadata.papel = 'super_admin'` **e** sessão MFA (`aal2`).
- Permissão de venda = bloqueio do super admin ∩ escolha do lojista (`motivo_bloqueio_venda`).
- Auditoria só de inserção.

## Pendente
Pedidos/checkout, banners/páginas, categorias/fabricantes, aplicação veicular. A cifragem dos segredos é feita no servidor (`CREDENCIAIS_CHAVE_CIFRA`); o banco só guarda o texto cifrado.
