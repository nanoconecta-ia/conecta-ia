# O agente propõe dados e imagens (nunca aprova sozinho)

## O que mudou
Até aqui o agente só lia. Agora ele também **propõe**, com 5 ferramentas novas, todas gravando como `a_confirmar` e exigindo fonte:

| Ferramenta | Grava em | Campos aceitos |
|---|---|---|
| `propor_enriquecimento` | `produto_enriquecimento` | `marca_peca`, `descricao_curta`, `descricao_longa`, `peso_kg`, `dimensoes`, `categoria_sugerida`, `ncm_sugerido` (lista fechada, checada no banco) |
| `propor_codigo` | `produto_codigos` | `oem`, `fabricante`, `ean`, `similar`, `substituto`, `antigo` (nunca `sku`: esse é do Bling) |
| `propor_aplicacao` | `produto_aplicacoes` | modelo, motorização, ano inicial/final — alimenta direto a busca por veículo da loja |
| `buscar_imagem_web` | — (não grava) | devolve candidatas (Google Programmable Search, modo imagem) |
| `propor_imagem` | `produto_imagens` | URL https de uma candidata; nasce `aprovada = false` |

Toda proposta passa por uma RPC `*_propor` (só `service_role`) que confere, **no banco**, que o produto pertence à loja, além da checagem no servidor. Nenhuma função aprova: isso é sempre decisão do lojista na **Fila de aprovação**, que agora também lista imagens pendentes (cartão com miniatura, Aprovar/Rejeitar).

## Imagem: por que precisa de "cruzamento"
A tabela `produto_imagens` já tinha uma regra (migração 9): imagem que não é `real` só pode ser aprovada com um **cruzamento** registrado (o código que ligou a imagem a esta peça). `imagem_propor` usa o próprio SKU buscado como cruzamento (`cruzamento_tipo = 'sku'`); é o sinal disponível numa busca por texto — mais fraco que um cruzamento por OEM/EAN, por isso a tela avisa "direitos de uso ainda não confirmados" e pede conferência antes de aprovar.

## Busca de imagem (BYOK, por loja)
Cada loja cola a própria chave do **Google Programmable Search** (cse.google.com) em Integrações de IA — 100 buscas grátis por dia, depois pago. Guardada cifrada (`loja_busca_imagem`), nunca sai do servidor. Sem chave, `buscar_imagem_web` devolve um aviso e o agente segue sem imagem.

## Provedores de IA (GPT, Qwen, Kimi, DeepSeek)
Nenhum código novo: todos falam o protocolo da OpenAI e já passam pelo adaptador "compatível com OpenAI" (PR #18). O lojista só cola a chave e o endereço certo:

| Provedor | Endereço |
|---|---|
| OpenAI (GPT) | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| Qwen (Alibaba) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Kimi (Moonshot) | `https://api.moonshot.cn/v1` |

## Migração
`20261018000008_agente_propoe_e_imagens.sql`: check de campo em `produto_enriquecimento`; tabela `loja_busca_imagem`; RPCs `enriquecimento_propor`, `codigo_propor`, `aplicacao_propor`, `imagem_propor`, `imagem_decidir`, `busca_imagem_salvar/ler/desativar` (todas só `service_role`).

## Limitações
- **Nada aplicado nem publicado**: aguarda autorização.
- `ia-config` ganhou `salvar_busca_imagem`/`remover_busca_imagem`; `assistente` passa `admin` (service_role) e a credencial de busca ao executor de ferramentas — republicar as duas juntas.
- Testado só com fetch simulado (Google CSE real não foi chamado).
- O agente só busca imagem por texto; não confere se a foto bate de verdade com a peça — por isso a aprovação humana continua obrigatória.
- `propor_enriquecimento` nunca sobrescreve um campo já `aprovado` (o `on conflict` ignora nesse caso).
