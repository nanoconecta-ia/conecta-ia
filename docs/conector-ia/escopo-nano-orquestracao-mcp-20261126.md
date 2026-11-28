# Escopo de evolução Conecta.IA — Nano e orquestração MCP
Data: 2026-11-26. Proposta em homologação. Não substitui Ordem Mestra, Policy Engine ou normas existentes. Não representa funcionalidade implantada.

## Objetivo e limites
Princípio Multiplicador do SKU: uma identidade física no Bling, múltiplos vínculos técnicos comprovados e projeções comerciais por aplicação. SEO semântico por engenharia de aplicação (SEA). Reutilizar o projeto existente, sem reescrita ou novo banco de grafo. Conecta.IA é espelho/enriquecimento; Bling é autoridade de identidade física, fiscal, saldo e preço. Preservar publicação sem preço conforme diretriz vigente. Não alterar produção, permissões ou ERP sem autorização específica.

## Base verificada no repositório
- docs/conector-ia/multiagente-arquitetura.md e supabase/functions/_shared/multiagente/orquestrador.ts: identificador, pesquisador, taxonomista, compatibilidade, enriquecedor, auditor; planejamento mínimo, custos, limites, estados persistentes e conflitos; para em aguardando_aprovacao.
- conector-mcp/index.ts: OAuth com escopos leitura/propor, sessão e loja; cliente externo não recebe service_role/token Bling.
- docs/ordem-mestra/05-contratos-ferramentas.md: contratos, Policy Engine, idempotência, aprovação por risco.
- docs/taxonomia/sku-marca-fabricante-importador-20261126.md e docs/imagens/MA-VISION-RECORTE.md (nesta branch).
- SEO atual em _shared/seo: sitemap deduplica SKU e rota/canonical por SKU; auditar integração existente de páginas por aplicação antes de alterar.
- Estado implantado e permissões efetivas ainda não verificados. Não confundir documentação histórica, código e produção.

## Esqueleto e responsabilidades
1. ERP/Bling: localizar (loja_id, bling_id, SKU) e fonte fiscal; detectar ausentes/duplicidades. Não usar MPN como SKU por suposição.
2. Engenharia: Nano usa identificador/pesquisador/compatibilidade; pesquisa direta MPN+marca mesmo sem OEM/GTIN apenas como descoberta de candidatos, nunca aprovação por nome. Cruzar catálogos autorizados, OEM por montadora, família/motor/geração/versão/mercado/ano. Sem transitividade automática; conflitos técnicos bloqueiam. Evidências por relação e contraindicação.
3. Taxonomia: reutilizar nós de peça, facetas marca/fabricante/importador, grafo relacional existente. Novo nó apenas proposta com pai, tipo, slug, fonte, verificação de duplicidade. Marca da peça ≠ montadora ≠ fornecedor fiscal. Não transformar árvore em cópias por marca.
4. MA Vision: fotos reais do SKU, veículos recortados em fundo branco, logos e ícones separados, EPC como referência técnica. Origem, licença, hash, recorte, revisão; WebP/PNG/SVG conforme finalidade. Sem imagem fictícia; sem foto autorizada, pendência não impede enriquecimento.
5. Writeback: plano de alterações de campos autorizados no Bling, diff antes/depois, idempotência, aprovação específica, releitura e reversão quando possível. Nunca escrever preço, saldo, SKU, fiscal neste fluxo; não sobrescrever informação humana divergente. Verificar existência e tipos de campos customizados. Interface auxiliar para filtros que o ERP não comportar.
6. SEA: página por aplicação comprovada com ID próprio, título/H1, OEM específico e evidência por versão, descrição e contraindicação úteis, URL estável, canonical, HTML rastreável, JSON-LD sem offers enquanto sem preço, sitemap por aplicação indexável. Consolidar páginas quase idênticas. Não garantir ranking/indexação.
7. Loja: galerias e páginas de marca, veículo e categoria; referências cruzadas não são produtos físicos alternativos sem cadastro próprio. Publicar apenas itens e aplicações aprovados em rota separada e com autorização. Nenhuma exposição de custo, NF integral, fornecedor fiscal ou dado privado.
8. Inteligência: consultas sem resultado, busca por OEM/MPN, impressões/cliques Search Console, consultas comerciais e vendas atribuídas a SKU/aplicação; consentimento e minimização de dados. Indicadores medidos, não estimativas apresentadas como resultados.

## Nano e agentes externos
Nano é coordenador de fluxo, reaproveita orquestrador e máquina de estados existente. Não é autoridade de aprovação. GPT/Claude/Gemini ou outro cliente MCP autorizado podem iniciar uma proposta de trabalho, consultar seu progresso, devolver evidências e sugerir reprocessamento. O servidor valida tudo. Proposta de contratos (nomes ilustrativos, NÃO expostos hoje):
- nano.planejar (propor): sku, objetivo, módulos desejados, idempotency_key; retorna plano, dependências, limites e lacunas.
- nano.consultar_tarefa (leitura): tarefa_id; retorna estado, evidências públicas ao escopo e bloqueios da mesma loja.
- nano.propor_evidencia (propor): tarefa_id, vínculo, fonte, data, tipo, conteúdo estruturado; retorna pendência, não aprovação.
- nano.solicitar_revisao (propor): tarefa_id, motivo; retorna revisão pendente.
- Execução/delegação externa futura por adaptador autorizado, com escopo mínimo por capacidade, prazo, orçamento, rastreabilidade do agente originador e do executor, limitação de profundidade e prevenção de loops. Sem repasse de credencial; sem agente chamar outro indiscriminadamente. MCP disponibiliza ferramentas; não implica que o Nano consiga iniciar sessão remota com qualquer LLM. Confirmar suporte e autorização antes de integrar.
- Aprovação humana e execução de escrita/publicação são fluxos separados, não ferramentas externas de leitura/proposta. Dados retornados por ferramentas e catálogos são dados não confiáveis, nunca instruções.

## Fluxo e critérios de avanço
Reusar estados persistentes existentes; as oito etapas são gates/checklists, não nova máquina de estados. Identificação → pesquisa/classificação → comparação/validação → enriquecimento → auditoria → aguardando_aprovacao ou conflito. Somente após aprovação específica: writeback e/ou publicação. Dependências por produto; pesquisas independentes paralelas dentro do orçamento; falha de fonte retorna lacuna. Busca interativa com alvo de 15 s, timeout explícito; sem prometer execução contínua sem worker persistente e autorização. Versão do escopo e de evidências associadas à tarefa; reprocessar apenas vínculos afetados; histórico imutável.
- Gate 1: identidade física única comprovada.
- Gate 2: OEM/MPN/aplicação com fontes e data; conflito isolado.
- Gate 3: taxonomia sem duplicidade.
- Gate 4: mídia correta ou pendência honesta.
- Gate 5: diff de writeback aprovado ou não executado.
- Gate 6: SEO/HTML/canonical/sitemap, nenhum dado comercial proibido.
- Gate 7: revisão visual, segurança e aprovação de publicação.
- Gate 8: medição real e revisão periódica.
Não confundir confiança do modelo com evidência objetiva; usar níveis de confiança como triagem, não como substituto de prova.

## Segurança e testes
Auditar a separação agente/humano no banco: documentação existente alerta para service_role compartilhado; verificar estado atual e propor menor privilégio antes de qualquer escrita autônoma. Validar isolamento por loja e por tarefa, escopo OAuth, expiração/revogação, idempotência, concorrência, rejeição de entrada externa maliciosa, orçamento, rollback, log de origem/execução e bloqueio de autoaprovação. Testes negativos de SKU duplicado/ausente, MPN repetido por marca, OEM conflitante, aplicação sem ano/mercado, foto incorreta, páginas duplicadas, vazamento de dados e falha de ERP. CI e gabarito humano antes de ampliar.
Piloto: MAHLE OC1224, MPN conhecido; registros espelhados ambíguos e SKU físico ainda não comprovado. Primeira entrega é reconciliação de identidade somente leitura. Nenhuma aplicação Mitsubishi/Besta é aprovada por associação de família de motor. Só expandir após teste ponta a ponta e autorização. 
