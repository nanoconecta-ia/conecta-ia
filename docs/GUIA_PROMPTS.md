# Guia de prompts do projeto (organização das 10 dicas)

Como cada dica vira prática no Conecta.IA, com exemplos prontos para colar. Regra geral deste projeto: **resposta curta, sem
repetir pergunta já respondida, e prompts entregues em um único bloco para copiar.**

| # | Dica | Como usamos aqui |
|---|---|---|
| 01 | Gráficos e diagramas | Central de ajuda e explicações do agente trazem diagrama simples do fluxo ERP -> Conecta.IA -> site (ex.: Bling -> espelho -> agente propõe -> lojista aprova -> publica). |
| 02 | Estilos para mudar o tom | Três tons: **lojista** (simples, sem jargão), **contador** (técnico, cita norma) e **cliente final** (curto, confiável). Cada texto gerado declara o tom. |
| 03 | Adaptar ao público | O agente que ensina o lojista usa analogias do dia a dia da loja (balcão, estoque, nota) e evita termos de TI. |
| 04 | Vibe coding | Peça de código sempre com revisão: gargalos, segurança e boas práticas atuais; testes antes de aplicar no banco. |
| 05 | Artefatos editáveis | Prompts e documentos para colar saem **em um único bloco**; documentos longos ficam em `docs/` do repositório. |
| 06 | Mostrar exemplos | Para tom da loja, o lojista cola 2 ou 3 descrições que ele aprova; o agente replica o estilo (sem inventar dado técnico). |
| 07 | Pensamento estendido | Tarefas complexas (regra fiscal, DIFAL, equivalência de códigos): o agente analisa por etapas, cruza fontes, lista prós e contras e **só então** conclui, deixando o raciocínio na justificativa registrada. |
| 08 | Atribuir uma habilidade | Especialistas fixos: **Fiscal sênior** (contabilidade), **Catálogo de autopeças** (OEM, aplicação), **Logística**. Cada um com regras próprias e memória. |
| 09 | Restrições | Restrições do projeto valem em todo prompt: não inventar NCM nem aplicação, citar fonte, não gravar no Bling sem autorização, não expor custo/segredos. |
| 10 | Ajustes em vez de recomeçar | O fluxo de aprovação aceita "ajustar" a proposta (encurtar, mudar o tom, corrigir um campo) mantendo a ideia central e o histórico. |

## Modelos prontos

**Ensinar o lojista (dicas 03 e 01)**
```
Explique [recurso do Conecta.IA] para o dono de uma loja de autopeças que não é de tecnologia. Sem jargão; use uma analogia
do balcão ou do estoque; no máximo 5 linhas; se ajudar, um diagrama simples em setas. Use apenas os tópicos de ajuda aprovados.
```

**Especialista fiscal sênior (dicas 07, 08 e 09)**
```
Atue como contador sênior em tributação de autopeças (ICMS, ST, DIFAL, CEST, NCM) para uma loja em Goiás, regime [regime
declarado]. Pense por etapas: (1) identifique o produto e a evidência; (2) cruze com as tabelas oficiais carregadas; (3) liste prós
e contras de cada enquadramento; (4) só então proponha. Restrições: nunca invente NCM nem regra; cite norma, vigência e trecho
exato; se faltar fonte, diga o que falta; nada vai ao ERP nem ao site sem validação do contador.
```

**Texto no tom da loja (dica 06)**
```
Aqui estão 3 descrições que eu aprovo como modelo de tom: [colar]. Escreva a descrição curta de [produto] no mesmo tom, usando
somente os dados aprovados abaixo: [dados]. Não acrescente compatibilidade nem especificação que não esteja nos dados.
```

**Ajustar a proposta (dica 10)**
```
Mantenha a ideia central da proposta anterior, mas [reduza para 2 linhas / mude o tom para mais formal / corrija o campo X].
Não altere os dados com fonte; mostre o que mudou.
```
