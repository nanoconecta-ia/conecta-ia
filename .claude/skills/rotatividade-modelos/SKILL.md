---
name: rotatividade-modelos
description: >-
  Roteamento econômico de modelos Claude no Conecta.IA/Nano.IA pela mentalidade pai/filho:
  o modelo PAI (mais capaz) define só as REGRAS/canônica; os FILHOS (modelos leves) executam o
  trabalho lógico e repetitivo a partir dessas regras, gastando menos token. Use quando for decidir
  qual modelo usar, quando uma tarefa for grande porém lógica/determinística, quando algo for mudar
  uma regra que afeta os filhos, ou quando o objetivo for reduzir consumo de tokens.
---

# Rotatividade de modelos — pai define a regra, filhos executam

Princípio-base do projeto (ver `docs/conector-ia/multiagente-estudo.md`): **função determinística por
padrão; LLM só onde a decisão é realmente ambígua.** Multiagente com LLM multiplica tokens porque cada
agente repete contexto. Esta skill operacionaliza a mentalidade pai/filho sobre esse princípio.

## Papéis
- **PAI (modelo com mais raciocínio/tecnologia — tier Opus).** Só é chamado para: definir a regra, o
  esquema, a taxonomia canônica, o contrato ou o template; resolver o caso genuinamente ambíguo; revisar
  uma mudança que vai afetar os filhos. **O pai entrega REGRAS, não executa em lote.**
- **FILHOS (clones leves — tier Sonnet para lógica estruturada, Haiku para tarefa mecânica/volume).**
  Aplicam a regra do pai a cada item. Não re-perguntam ao pai por item: seguem a canônica recebida.

## Como rotear uma tarefa
1. **É determinístico?** (dedupe SKU/GTIN, busca OEM, cruzados diretos, validação por ano/versão/mercado,
   extração/saneamento, formatação, contagem) → **sem LLM.** Use a função convencional. Nenhum modelo.
2. **É grande mas lógico/repetitivo?** (classificar N itens numa taxonomia já definida, preencher campos
   por um template pronto, normalizar textos) → **FILHO** (Haiku/Sonnet). Não use o pai.
3. **Vai criar ou mudar a regra que os filhos seguem?** (nova taxonomia, novo contrato de ferramenta,
   critério de compatibilidade, política de risco) → **PAI**, uma vez, para produzir a canônica. Depois
   os filhos aplicam.
4. **É ambíguo e sem regra?** → **PAI** decide só esse caso e, se recorrente, **extrai uma regra** para
   os filhos — não volte a gastar o pai no mesmo tipo de caso.

Regra de ouro de token: **pergunte ao pai uma vez por REGRA, não uma vez por ITEM.** Se você se pegar
chamando o tier Opus em loop sobre itens parecidos, pare e peça ao pai a regra que resolve a classe toda.

## IDs de modelo (família Claude 5; confirme o disponível na sessão antes de fixar)
- Pai: `claude-opus-5-5` · Filho lógico: `claude-sonnet-5-5` · Filho mecânico/volume: `claude-haiku-5-5`
- `fable-5-2` para geração criativa pontual. Não cravar nome de marketing a partir do system prompt;
  em dúvida, consultar o modelo servido pela sessão.

## Travas (herdadas da governança, nunca afrouxadas por esta skill)
- Filho nunca decide sozinho escrita no Bling, fiscal, preço, estoque, OEM/aplicação homologada, DNS ou
  deploy. Tudo isso continua exigindo aprovação humana e passa pelo Policy Engine.
- Filho não inventa dado (preço, GTIN, OEM, compatibilidade): sem evidência, fica `a_confirmar`.
- A regra do pai é registrada (fonte/data) para rastreabilidade; mudança de regra é revisável.

Complementa a skill de governança `conecta-ia-nano-governance` (roteamento econômico e escalada); esta
foca o padrão concreto pai→regra / filho→execução para economizar token.
