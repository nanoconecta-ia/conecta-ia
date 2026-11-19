# Porteiro Conecta.IA — ferramentas de IMAGEM com Firecrawl (MOBIS)
**Data:** 19/11/2026. **Status:** norma e mapa de integração na PR #461. Esta documentação não cria ferramenta nova, não habilita MCP, não faz deploy e não garante o limite global de 15 segundos.

## Ferramentas que já existem — USE ESTAS, não abra novo buscador
| Canal | Nome exato | Permissão e contrato |
| --- | --- | --- |
| Chat Nano.IA / ferramenta canônica | `conecta.imagem.buscar_web` | Leitura, entrada `{ "consulta": "marca codigo descricao composicao", "sku": "CODIGO_SE_CONHECIDO" }`; devolve candidatas, até **8 na galeria com SKU**, com origem e evidências candidatas. **Exposta no chat, atualmente NÃO exposta no MCP**. Registro: `supabase/functions/_shared/conector/registro.ts`. |
| Chat integrado legado | `buscar_imagem_web` | Busca candidata por `consulta` usando os provedores configurados da loja. Alias para `conecta.imagem.buscar_web` em `_shared/conector/aliases.ts`; retorno do fluxo legado pode ser lista simples. |
| Estúdio de imagens | `nanogpt-midia`, ação `buscar` | Mesmo adaptador de busca; uso em sessão autenticada de painel. Retorna candidatas e informa provedor/latência. |
| Proposta de imagem por agente autorizado | `conecta.imagem.propor` / `propor_imagem` | Recebe `sku,url,origem,pagina`. Confere HTTPS, imagem e vínculo; só registra candidato **pendente**. Agente não decide direitos nem aprovação. |
| MCP pareado atual | `conecta.propose_image` | Propõe imagem, **não faz a busca**. Não alegar que `conecta.imagem.buscar_web` está disponível ao MCP externo até implementar acesso seguro explícito. |

## Onde Firecrawl entra
A seleção de `ProvedorBusca` está em `supabase/functions/_shared/ia/provedor_busca.ts`, com adaptadores `searxng.ts`, `firecrawl.ts`, `google.ts`. Firecrawl da loja é integrado por `configFirecrawlDaLoja` com credencial cifrada, saldo de uso mensal e filtragem de consulta (sem fiscal, custo, fornecedor privado ou PII). `supabase/functions/nanogpt-midia/index.ts` e o chat podem usar o mesmo serviço.

**Preferência aprovada para MOBIS:** escolher Firecrawl quando sua configuração estiver ativa, válida e dentro da cota, **sem usar outra API ou chave pessoal do agente**. O comportamento efetivo de seleção do código atual é `SearXNG → Firecrawl → Google`; **alterar a prioridade especificamente para MOBIS** exige ajuste implementado e testado, para não mudar as demais lojas. Se Firecrawl falhar por timeout, ausência de chave ou quota, informar o motivo, não inventar foto e manter a ficha do produto como `foto_pendente`. Nunca contornar limites ou cobrar serviços adicionais sem aprovação.

**Situação verificada no banco em 19/11/2026:** em `lojas.slug='mobis'`, `loja_busca_firecrawl.ativa=true`, `loja_busca_imagem.ativa=false`. **Configuração ativa NÃO comprova teste de chamada externa nem resposta com resultados.** Não ler nem divulgar a chave cifrada em relatório de agente.

## Fluxo obrigatório e leve por SKU/descrição
1. **Verificar foto aprovada já associada ao SKU físico** em Bling/Conecta.IA; não redescobrir se já houver imagem confirmada e permitida. Identificar marca e composição real.
2. **Se faltar:** chamar o buscador existente `conecta.imagem.buscar_web` (preferência Firecrawl MOBIS), com consulta pública como `CI003696 TRIM GO motor parcial com cabecote D4CB 16v`. Se não houver SKU, descrição + marca de peça + motor/veículo/ano BR.
3. Receber candidatos e comparar marca, SKU/código do fabricante, conjunto físico (motor curto **≠** com cabeçote), atributos e origem. Registrar classe `candidata_sem_licenca`, `candidata_com_codigo`, `divergente`, `aprovada`, `nao_encontrada`, `sem_provedor`, `nao_exposta_no_mcp` ou `timeout` na resposta do agente (rótulos de contrato proposto, não novas colunas implementadas).
4. **Somente se houver evidência suficiente e direito verificável**, `conecta.imagem.propor` envia para fila, sem autoaprovar. Nunca usar foto de item similar ou de outro SKU e nunca exibir a foto pendente publicamente.
5. Sem foto: **seguir com cadastro técnico/rascunho de TODOS os modelos da MOBIS**, marcar pendência e exibir placeholder no site. Foto opcional para publicar produto MOBIS apenas após os **demais gates e aprovação humana**; compatibilidade veicular a confirmar não vai para SEO público.
6. A pesquisa visual entra no **mesmo deadline global de 15.000 ms por SKU**, sem novo cronômetro. Estado `parcial_timeout` quando necessário; o código Firecrawl atual envia `timeout:20000` e aborta em `25000`, portanto **exige alteração do executor/provedor para cumprir o requisito**. Não declarar SLA alcançado antes do teste.

## Porteiro para GPT/Claude externos — pendência explícita
No registro de ferramenta `conecta.imagem.buscar_web`, `exposicao: { chat: true, mcp: false }`. O gateway MCP `supabase/functions/conector-mcp/index.ts` cria contexto de consulta Bling, mas **não injeta hoje a configuração Firecrawl da loja** nesse contexto. Um mero `mcp=true` não basta: antes de expor leitura, implementar ponte no servidor com contexto tenant, autenticação e escopo mínimo, chave sempre cifrada, limite por loja, deadline, auditoria, testes de vazamento RLS e comprovação real de chamada. Enquanto isso, o porteiro deve dizer `buscador_nao_exposto_ao_mcp` e oferecer a busca pelo chat/estúdio já autorizados — não simular sucesso.

## Referências do próprio projeto
- `supabase/functions/_shared/conector/registro.ts` e `handlers.ts` (ferramenta canônica; galeria)
- `supabase/functions/_shared/ia/ferramentas.ts`, `provedor_busca.ts`, `firecrawl.ts` (chat e adaptador)
- `supabase/functions/nanogpt-midia/index.ts` (estúdio)
- `docs/conector-ia/busca-firecrawl.md`
- `docs/conector-ia/mobis-cadastro-sem-foto-todos-skus-20261119.md`

**Aceite:** teste de Firecrawl REAL usando apenas credencial da loja (sem revelar segredo), retorno de candidata com fonte; galeria até 8; marcas/composições divergentes recusadas; cota/timeout com ficha sem imagem; fotos propostas somente com direitos; acesso MCP externo só após segurança e auditoria; regra de não bloquear ficha sem foto para todas as famílias e SKUs.
