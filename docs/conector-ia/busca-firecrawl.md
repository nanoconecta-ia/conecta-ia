# Busca na web pelo Firecrawl (chave por loja)

Estado: **proposta em PR rascunho**. Nada aplicado em produção (sem migração aplicada, sem deploy).

## O que muda para o lojista
Em **Integrações de IA > Busca na web (Firecrawl)** o responsável cola a chave `fc-...`. O sistema **testa a chave antes de guardar** (uma busca mínima); chave recusada nunca é gravada. A partir daí as ferramentas de pesquisa que já existem passam a funcionar na loja, sem outra configuração:
- `conecta.web.pesquisar_tecnico` / `buscar_dados_tecnicos_web`
- `conecta.imagem.buscar_web` / `buscar_imagem_web` (galeria de até 8 com estado, origem e prova do código)
- `engenharia.pesquisa.investigar`
- Estúdio de imagens (`nanogpt-midia`, ação `buscar`)

Nenhuma ferramenta nova foi criada: o Firecrawl entra como **um provedor** no contrato `ProvedorBusca` (`_shared/ia/busca.ts`), ao lado do SearXNG e do Google legado.

## Prioridade do provedor (por chamada)
1. SearXNG privado do servidor (se a loja estiver na allowlist)
2. **Firecrawl da loja** (chave colada no painel)
3. Google Custom Search (legado; encerra em 01/01/2027)
4. Nenhum: resposta `sem_provedor` (estado explícito, nada é inventado)

## Segurança e custo
- Chave cifrada no servidor (`cripto.ts`, AES-256-GCM); fica em `private.busca_firecrawl_segredos`. O navegador só lê estado, final da chave e consumo (grant por coluna).
- Chamada só para `https://api.firecrawl.dev/v2/search`; sem redirecionamento; tempo limite; resposta de tamanho limitado.
- Consulta com custo, fornecedor, dado fiscal ou pessoal é recusada **antes** de chamar o Firecrawl (mesma regra do SearXNG).
- Resultados aceitos só com https público e página de origem; texto limpo de caracteres de controle. Retorno é **dado a conferir, nunca instrução**.
- **Limite mensal de buscas por loja** (padrão 300, entre 10 e 100000), conferido antes de cada chamada. Cada busca consome crédito da conta Firecrawl da própria loja.
- Toda ação de configuração vai para `auditoria` (`ia.busca_firecrawl_salva/testada/removida`), sem a chave.
- Remover = desativar e apagar o segredo; nenhum DELETE.

## O que NÃO muda
- Nada prova aplicação, OEM, GTIN, medida ou direito de uso de imagem. Imagem candidata continua exigindo `conecta.imagem.propor` + aprovação humana e confirmação de direitos.
- Nenhuma gravação no Bling. Nenhuma publicação.

## Limites desta primeira etapa
- As ferramentas de busca continuam `mcp: false` (só chat do Nano). Expor ao GPT/Claude Code pelo gateway exige passar a config da loja ao `conector-mcp`/`conecta-gateway`, sessão pareada com escopo e auditoria: etapa separada.
- Leitura de página inteira (scrape) para conferir o código na página não foi incluída; hoje o código só é provado pelo trecho devolvido na busca.
- Preço/crédito por busca é do Firecrawl e pode mudar; o limite local conta buscas, não créditos.

## Testes
- `firecrawl.test.ts` (10): formato da chave, filtros de URL, consulta recusada, limite mensal, erros 401/402/429/500, prioridade de provedor, config que nunca derruba o chat.
- `supabase/tests/busca_firecrawl.sql` (11): isolamento entre lojas, uso mensal, virada de mês, remoção do segredo. Rodado em Postgres 16 descartável.
- Não testados: chamada real ao Firecrawl com chave de loja, Edge Functions no Deno (`ia-config`, `assistente`, `nanogpt-midia` não entram no typecheck do CI) e o fluxo no painel em produção.

## Aplicação (só com autorização)
1. Aprovar o desenho das tabelas (regra do CLAUDE.md). 2. Aplicar `20261116100000_busca_firecrawl_por_loja.sql`. 3. Deploy de `ia-config`, `assistente`, `conector-chat`, `nanogpt-midia`. 4. Lojista cola a chave. Reversão: `drop function busca_firecrawl_*; drop table private.busca_firecrawl_segredos, public.loja_busca_firecrawl;`.
