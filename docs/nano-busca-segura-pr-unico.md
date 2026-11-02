# Nano IA — especificação unificada de busca e enriquecimento (para implementação Claude Code)

Status: **proposta de arquitetura, NÃO implementada**. PR documental; não alterar deploy, ERP ou credenciais.

## Objetivo
Enriquecer catálogo e atendimento automotivo usando IA como geradora de hipóteses e verificadores determinísticos para validar evidências. Aproveitar serviços, taxonomia, fila e UI existentes; evitar segundo assistente e duplicidade de endpoints.

## Pipeline obrigatório
1. Entrada: consulta em linguagem natural, código SKU/OEM/GTIN, imagem ou XML autorizado. Normalizar grafia, fabricante, modelo, motor, anos e dimensões sem apagar texto original.
2. Resolver entidades separadamente: montadora, veículo, geração, motorização, ano, fabricante da peça, importador, marca comercial, SKU Bling, OEM e GTIN.
3. IA sugere candidatos e sinônimos (4D56/D4BH/D4BB apenas como termos candidatos, jamais equivalências universais).
4. Buscar fontes com orçamento, timeout, cache, rate limit, rastreio e deduplicação. Prioridade: fabricante e catálogo técnico oficial > distribuidor B2B autorizado > documentação técnica > marketplaces (descoberta somente). Pesquisa via provedor intercambiável Google Programmable Search ou SearXNG; sem scraping que viole acesso, robots ou termos.
5. Evidência estruturada: URL, título, editor/fabricante, data de coleta, trecho verificável, código exato e contexto da aplicação, hash, licença/permissão de imagem e grau de confiança. Ausência de prova = campo pendente.
6. Validador de código verifica identidade, especificações e aplicação independentemente. OEM/GTIN iguais não bastam para equivalência mecânica; exige catálogo de aplicação e características técnicas compatíveis. Conflitos são exibidos, não resolvidos por palpite.
7. Produzir ficha com campos propostos, campos confirmados, divergências, fontes e pendências; nenhuma escrita automática no Bling, alteração fiscal, publicação ou envio externo.
8. Aprovação humana por versão/hash e auditoria; revalidar identidade do produto antes de qualquer escrita futura autorizada.

## Regras automotivas
- 'HR 2008' identifica ano/modelo candidato, nunca motor confirmado; perguntar 8V/16V, código do motor, chassi ou peça quando necessário. Não generalizar D4BH = 4D56 para todas as peças.
- '1 pique / 2 piques' são marcações físicas cuja função varia por fabricante e junta; espessura só com tabela técnica específica, nunca por inferência.
- Referências Jusa, Sabó, Ecoparts e concorrentes são cruzamentos candidatos até comprovação; registrar direção e tipo da relação (substitui, equivalente, semelhante, incompatível).
- Medidas, material (metal/fibra), tolerâncias, versões, anos e veículos só são preenchidos com evidência verificável. SKU interno não substitui código do fabricante.
- Não misturar fornecedor/importador, fabricante real e montadora; preservar procedência e vínculo com nota sem modificar NCM/CFOP.

## Imagens (galeria de até 8 candidatas)
- Mostrar até oito candidatas distintas com fonte, código visível, resolução, ângulo, licença, evidência e estado (aprovável/pendente/rejeitada).
- Somente mesmo produto e código confirmado; ângulo alternativo rotulado. Preferir fotos próprias ou autorizadas de fabricante/distribuidor, sem marca d'água. Não remover marcas de terceiros.
- Processamento não destrutivo: original preservado, fundo branco, enquadramento, expansão de canvas, correção conservadora de luz, sem alterar geometria, inscrições, furos, dentes ou códigos. Comparação original/tratada; sem inventar detalhes por super-resolução.
- Rejeitar imagens sem licença suficiente para publicação; marketplace pode fornecer pista textual, não direito de uso.
- Aprovação separada para cada imagem; nunca publicar automaticamente.

## Integração e UX
- Reusar Assistente, Catálogo, Taxonomia, Aprovações e Bling existentes; painel desktop e smartphone com ficha completa no chat e evidências clicáveis.
- Fallback sem Gemini mostra dados reais verificados; FreeLLM/API gratuita não recebe dados fiscais, custos, fornecedores privados, credenciais ou dados pessoais. Não permitir que fallback amplie permissões.
- Cache com validade por fonte; registrar indisponibilidade e taxa de erros; resultados offline marcados como possivelmente desatualizados.
- Preços e custos internos não devem aparecer em descrições públicas, prompts de provedores gratuitos nem visualizações de cliente.

## Testes de aceite a implementar
1. HR 2008 ambíguo -> pergunta, sem motor confirmado.
2. D4BH/4D56 códigos próximos -> não afirmar equivalência sem aplicação.
3. Código OEM coincide, dimensões divergem -> rejeitar intercâmbio.
4. Marca conflitante no Bling -> bloquear proposta e mostrar evidência.
5. Piques sem tabela -> espessura pendente.
6. Imagem de peça semelhante -> rejeitada; imagem com marca d'água -> não utilizável; licença desconhecida -> não publicável.
7. Oito candidatas -> galeria sem aprovações automáticas; original intocado.
8. Fonte indisponível, 429/5xx, HTML inesperado -> falha fechada, sem inventar informação.
9. Fallback sem IA -> ficha verificada sem expor custos ou dados sensíveis.
10. Reaprovação após edição -> hash muda e invalida aprovação anterior.
11. Testes de autorização: nenhum write no Bling, deploy, merge ou publicação sem aprovação específica.
12. Evidência rastreável com URL, código, data e licença; marketplace nunca prova compatibilidade isoladamente.

## Instruções para Claude Code
- Inspecionar contratos, testes e componentes existentes antes de implementar; apresentar mapa de reaproveitamento e gaps.
- Implementar em commits pequenos **neste PR**, com testes de unidade, integração e UI; preservar retrocompatibilidade.
- Não criar segundo chat, gateway paralelo ou tabelas redundantes.
- Não declarar testes reais sem logs verificáveis.
- Não fazer merge nem deploy até revisão humana, CI verde e homologação em ambiente isolado.
- PR de especificação não representa funcionalidades concluídas.

---

## Estado da implementação (Claude Code, 02/11/2026)

Status: **implementação PARCIAL, sem merge e sem deploy.** Migrações novas **não aplicadas**. Nada foi gravado no Bling, no fiscal ou em produção.

### Mapa de reaproveitamento (nada paralelo foi criado)
| Requisito | Já existia (reaproveitado) | Acrescentado neste PR |
|---|---|---|
| Interpretar consulta, vocabulário | `consulta/interpretar.ts`, `vocabulario_de_busca()`, tool `engenharia.consulta.interpretar` | `busca_segura/entidades.ts` (ano ≠ motor; códigos de motor são termos candidatos), `glossario_de_motores()` (só leitura, vem de `motores`/`versao_motor`) |
| Aplicação e intercâmbio | `aplicacoes/regras_aplicacao.ts` (`validarAplicacao`, `validarIntercambiabilidade`) | `busca_segura/intercambio.ts` (compara medidas/material; OEM igual não basta; relação com tipo e direção), `piques.ts` |
| Evidência e fontes | `ia/busca.ts`, `ia/provedor_busca.ts`, `ia/searxng.ts`, `painel/src/lib/evidencia.ts` | `busca_segura/evidencia.ts` (evidência estruturada, prioridade de fonte, falha fechada, cache) |
| Imagens | `imagens/regras.ts`, `imagens/variantes.ts`, `imagens/fidelidade_visual.ts`, `conecta.imagem.*`, `produto_imagens` | `busca_segura/galeria.ts` (≤ 8, estados, marca d'água, tratamento não destrutivo), gatilho de limite 8 no banco |
| Marca | `cadastro/regras_marca.ts`, `preparar_atualizacao` | `conflitoDeMarca` + bloqueio de troca com prova fraca |
| Fallback sem IA | `assistente/ficha_sem_llm.ts`, `recuperacaoSemIa` (#241) | `busca_segura/ficha.ts` (ficha verificada + saneamento de custo/fiscal/pessoal) |
| Aprovação humana e hash | `agente_propostas` (versão + hash), `conector-aprovacoes` | nada: coberto pelos testes SQL existentes |

### Matriz dos 12 testes de aceite
| # | Teste | Onde está |
|---|---|---|
| 1 | HR 2008 ambíguo → pergunta, sem motor confirmado | `busca_segura/entidades.test.ts` ("aceite 1"), `integracao.test.ts` |
| 2 | D4BH/4D56 só candidatos, sem equivalência | `entidades.test.ts` ("aceite 2") |
| 3 | OEM igual, dimensões divergem → rejeita | `intercambio.test.ts` ("aceite 3") |
| 4 | Marca conflitante no Bling → bloqueia e mostra evidência | `marca_conflito.test.ts`, `regras_marca.test.ts` |
| 5 | Piques sem tabela → espessura pendente | `intercambio.test.ts` ("aceite 5") |
| 6 | Peça semelhante / marca d'água / licença desconhecida | `galeria.test.ts` ("aceite 6") |
| 7 | Oito candidatas, sem aprovação automática, original preservado | `galeria.test.ts` ("aceite 7"), `supabase/tests/galeria_limite_oito.sql` |
| 8 | 429/5xx/HTML inesperado → falha fechada | `evidencia.test.ts` ("aceite 8"), `integracao.test.ts` |
| 9 | Fallback sem IA sem custos nem dados sensíveis | `ficha.test.ts` |
| 10 | Reaprovação após edição invalida a anterior | já coberto: `supabase/tests/conector_ia_estado.sql` (revisar invalida; hash/versão exatos) |
| 11 | Nenhuma escrita no Bling/deploy/merge/publicação sem aprovação | `autorizacao.test.ts` (estrutural: registro, política, módulos puros) |
| 12 | Evidência rastreável; marketplace nunca prova sozinho | `evidencia.test.ts` ("aceite 12") |

### Decisões de comportamento (para homologar)
- **Troca de marca pelo modelo:** só com URL externa (verificada); com prova fraca (marca apenas "declarada" no cadastro) o modelo é bloqueado e a evidência é mostrada. Uma pessoa (formulário) pode sempre; a troca fica registrada nas validações. (O PR pedia "bloquear"; a ordem do dono de 02/11 autorizou o agente a propor troca com origem. Esta é a conciliação.)
- **Galeria:** nenhuma candidata sai aprovada nem publicável. "Licença desconhecida" = aprovável como identidade, **não publicável** (duas decisões separadas, como já era em `imagens/regras.ts`).
- **Marketplace** e fonte não classificada = descoberta (pista), nunca prova nem direito de uso.

### Pendências (não implementado neste commit)
1. **Interface da galeria** no painel (Imagens/Catálogo/chat) com as oito candidatas, evidências clicáveis e aprovação **por imagem**. Hoje a galeria só existe na resposta da ferramenta `conecta.imagem.buscar_web` (com `sku`).
2. **Persistência** da evidência/estado da candidata em `produto_imagens` (a RPC `imagem_propor` continua gravando como "ilustrativa" com cruzamento `sku`). Requer desenho de migração a aprovar.
3. **Classe de fonte "fabricante oficial" e "distribuidor B2B"** depende de um cadastro de domínios confiáveis (dado) que **não existe**: hoje tudo que não é marketplace vira "outra" e nenhuma imagem sai "forte".
4. **Provedor de busca:** o Google Custom Search está fechado a novos clientes (`ia/busca.ts`); sem SearXNG (ou outro provedor) configurado, `buscar_web` responde "sem_provedor".
5. **Tratamento de imagem** (fundo branco, enquadramento, luz): só há as regras/validação; **não há serviço de processamento** ligado (a porta é um mock).
6. **`intercambio.ts`, `piques.ts` e `ficha.ts`** são módulos puros testados, mas **ainda não ligados a ferramentas do chat**. Faltam também os dados estruturados de medidas/material por produto e as tabelas técnicas de piques.
7. **Enriquecimento/taxonomia/tags/descrição** (prioridade 3): este commit **não** acrescenta geração de tags/descrição; segue valendo o que existe (`conecta.enriquecimento.propor`, `espec:*`, `regras_seo`, `regras_taxonomia`).
8. **Glossário de motores:** `glossario_de_motores()` lê `motores`/`versao_motor`; se essas tabelas estiverem vazias em produção, o resultado é "sem candidato" (falha fechada). Não verifiquei o conteúdo em produção.
9. **Documentos acrescentados pelo GPT no mesmo PR** (`docs/nano-busca-imagens-implementacao.md`, `docs/nano-voz-arquitetura.md`): a galeria implementada segue o contrato de imagens (≤ 8, estados, origem, evidência, licença). **Ainda não feito** do documento de imagens: adaptador SearXNG novo (já existe `ia/searxng.ts`; falta configurar a instância e validar `format=json`), Crawl4AI, deduplicação por **hash perceptual** (hoje deduplica por SHA-256/URL), e a UI com original/tratado lado a lado. A **voz** é só especificação: nada foi implementado.
10. **Migrações** `20261102000002_glossario_de_motores.sql` e `20261102000003_galeria_limite_oito.sql`: validadas só em banco descartável; **não aplicadas**.

### Riscos para homologação
- O deploy do `assistente` precisa ser refeito (artefato mudou); sem ele, nada disto vale em produção.
- Sem a migração do glossário, `engenharia.consulta.interpretar` cai em glossário vazio (seguro, com aviso).
- A comparação de códigos aceita grafias do mesmo código (hífen/espaço/sem separador); revisar se algum fabricante usa código com espaço significativo.
- A lista de domínios de marketplace é heurística embutida; precisa de revisão periódica.
- Homologar em ambiente isolado com CI001086 (troca de marca) e um SKU com imagem real, antes de qualquer publicação.
