# Publicar a vitrine num host gerenciado (plano grátis)

Guia prático para colocar o site (`web/`, Next.js) num host gerenciado, começando **de graça**.
Nada aqui publica sozinho nem gera cobrança: é um roteiro. O lojista cria a conta e aprova cada passo.
O domínio `www.mobisautopecas.com.br` e o site atual **não são tocados** até a etapa 5, e só com autorização.

> Estado em 2026-11-24: o app `web/` **builda isolado** (sem depender de arquivos fora da pasta) e já foi
> validado rodando contra o banco real. Um site de teste temporário foi publicado para conferência visual.

## 1. Escolher o host (grátis para começar)
Qualquer host gerenciado de Next.js serve. Os comuns:
- **Vercel** — mais simples para Next (plano Hobby grátis para validação; loja comercial de verdade pede o plano Pro, ~US$20/mês).
- **Cloudflare Pages** — plano grátis generoso; exige o adaptador `@cloudflare/next-on-pages` para rodar SSR (um passo técnico a mais).
- **Netlify** — grátis com limites.
> _Render está descartado por decisão do projeto._

Recomendação: começar na **Vercel** para validar; migrar para Cloudflare/servidor próprio quando houver muitos lojistas ou tráfego alto.

## 2. Conectar o repositório
- Criar conta no host e conectar o GitHub `nanoconecta-ia/conecta-ia`.
- **Diretório raiz do projeto: `web`** (o app fica nessa subpasta — este é o ajuste mais importante).
- Detecção automática: framework **Next.js**.
  - Install: `npm ci` · Build: `npm run build` · Start: `npm start` (o host costuma preencher sozinho).
- Branch de produção: **`main`** (deploy automático a cada merge).

## 3. Variáveis de ambiente (no painel do host, nunca no código)
| Nome | Valor | Observação |
|---|---|---|
| `SUPABASE_URL` | `https://dsfzhsrudriqkumtlqwj.supabase.co` | público |
| `SUPABASE_ANON_KEY` | chave **publicável** do Supabase | pública (pode aparecer no navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** do Supabase | **SEGREDO** — só no painel do host, nunca no repositório, log ou navegador |
| `APP_URL` | o endereço do site (depois, o domínio real) | usado em links/canonical |

- As chaves estão em: Supabase → projeto `conecta-ia` → Settings → API.
- A vitrine pública (loja/produto/aplicação) já lê por RLS com a **chave pública**; o painel/admin e as rotas internas precisam da **service_role**. Por isso as duas variáveis.
- **Nunca** colar a `service_role` no chat, no código ou em arquivo versionado.

## 4. Validar no endereço do host
- Abrir `…/loja/mobis/produto/<id>` e `…/loja/mobis/aplicacao/<slug>` e conferir: páginas abrem, sem preço, OEM e aplicações aprovadas aparecem.
- Páginas de produto em modo teste (`exibicao_teste=true`) ou aplicações não aprovadas ficam ocultas de propósito.

## 5. Domínio próprio (etapa separada, só com autorização explícita)
1. No host, adicionar `www.mobisautopecas.com.br` → o host mostra os registros DNS a criar.
2. Na **Locaweb** (onde o domínio está hoje), **reduzir o TTL** antes e criar os registros indicados.
3. O host emite e renova o **SSL** automaticamente.
4. Verificar DNS + SSL. **O site atual continua no ar** até o novo ser validado.
5. O corte é um passo à parte, com plano de volta (manter o apontamento antigo pronto para reverter).

## Custo (resumo)
- Começar: **R$ 0** (host grátis + Supabase grátis que já roda).
- Produção robusta (quando o movimento justificar): host ~R$ 0–110/mês + **Supabase Pro** ~R$ 140/mês (backup diário, sem pausa). Domínio já é pago na Locaweb.
- Nenhuma mudança de plano/DNS acontece sem o "pode" do lojista, por etapa.

## Pendências de qualidade antes de divulgar no Google
- Elevar a fonte dos códigos OEM de "ficha do lojista" para **EPC oficial da montadora** (hoje marcados "a validar").
