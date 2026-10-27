# Barreira de dados no payload enviado à IA

**Estado:** código e testes no repositório. **Não implantada** — a função `assistente` em produção só muda com deploy autorizado.

## O que faz
Todo corpo enviado a provedor de IA (Claude, Gemini, OpenAI-compatível; com e sem streaming) e a plugin de terceiros passa por `protegerCorpo()` (`supabase/functions/_shared/ia/guarda_payload.ts`) **depois de montado e antes do `fetch`**. Não depende do prompt.

| Ação | Quando |
|---|---|
| **Remove a chave** (e o valor) | custo, margem, fornecedor, dados fiscais (NCM, CEST, CST, CFOP, ICMS, IPI, PIS, COFINS, tributação), CPF/CNPJ, senha, token, segredo — em mensagens, entradas e resultados de ferramenta, inclusive JSON dentro de texto |
| **Troca por `[segredo removido]`** | JWT, `sk-…`, `AIza…`, `cia_mcp_…`, `sb_secret_…`, `Bearer …` em qualquer texto |
| **Bloqueia (422) sem chamar a rede** | anexo de texto (CSV etc.) com coluna de custo, fornecedor ou dado fiscal no cabeçalho |
| **Não mexe** | `tools`, `system` e demais partes de contrato; binários (base64); referência técnica `fornecedores_oem` |

O relatório (`aoFiltrar`) traz **só nomes de chave e contagens**, nunca valores. No chat do `assistente` ele vai para `meta.payload_filtrado` da mensagem.

## Limites honestos
- Texto livre digitado pelo lojista não é filtrável de forma confiável: segue coberto pelo aviso de consentimento.
- A lista de chaves é por nome. Dado sensível com nome inesperado não é detectado; por isso a lista permitida de cada ferramenta (ex.: `filtrarProdutoBling`) continua sendo a primeira camada.
- Falso positivo possível: chave legítima com nome igual a um termo proibido (ex.: `cnpj` da própria loja) é removida. Ajustar a lista em `CHAVE_PROIBIDA` com teste.
- Ainda não ligado ao relatório do `conector-chat` (não implantado).

## Como verificar
`node --experimental-strip-types --test supabase/functions/_shared/ia/guarda_payload.test.ts` (22 testes). Com a barreira desligada, 19 deles falham (verificado por mutação).
