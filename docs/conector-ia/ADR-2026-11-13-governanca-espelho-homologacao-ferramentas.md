# ADR — Conecta.IA como plano de controle do ecossistema Bling e homologação obrigatória

**Data:** 13/11/2026  
**Status:** decisão arquitetural solicitada pelo proprietário, **proposta documentada para revisão técnica/merge**. Não comprova implementação, conexão ativa ou homologação efetiva.
**Escopo:** Mobis como piloto; aplicável a outras lojas por isolamento de tenant.  
**Destinatários:** Nano.IA, Claude Code, GPT e agentes administrativos, integradores de ERP, revisores e operadores autorizados.

## Decisão

O **ERP Bling é a fonte oficial** do cadastro físico/fiscal, identificadores nativos, estoque, pedidos e cadastro comercial do cliente. O **Conecta.IA é o espelho governado e plano de controle**, especializado em indexação, enriquecimento, taxonomia, aplicações técnicas, auditoria, fila de propostas e integração entre ferramentas. O **Nano.IA** coordena tarefas no catálogo de ferramentas autorizado; GPT, Claude Code e outros executores especializados podem atuar sob **o mesmo contrato, escopo, autenticação, orçamento e aprovação**, nunca com permissões herdadas do agente principal.

O Conecta.IA complementa o que o ERP não oferece ou não permite customizar. Campo técnico não gravável no Bling continua na **extensão Conecta.IA vinculada ao ID original** e é exibido de forma governada, **sem falsificar uma gravação no ERP**. Campos graváveis e expressamente aprovados podem retornar ao produto existente no Bling por ferramenta server-side; o sistema deve conferir o resultado com nova leitura. Dados do produto nativo e sua extensão devem manter genealogia, proveniência e versões distintas.

**Limite necessário:** não é possível declarar que todo aplicativo de terceiros conectado diretamente ao Bling seja tecnicamente controlado pelo Conecta.IA se o tráfego não passar por ele. Todo **aplicativo, agente e automação operado por meio do Conecta.IA** deve passar pelo Gateway, Policy Engine e auditoria. Integrações nativas externas, como Bling ↔ Mercado Livre, permanecem sob sua integração oficial; o Conecta.IA acompanha por leituras/eventos autorizados, correlaciona IDs e detecta divergências. Jamais construir uma segunda sincronização concorrente sem projeto e autorização específicos.

## Fluxo da função «Indexar e enriquecer»

1. **Conectar e conferir identidade:** OAuth/credenciais por loja, consentimento granular, CNPJ da conta Bling consistente com a loja; conferir capacidades reais da API, escopos e limites. Conexão não verificada deve aparecer como «não verificada», nunca «ativa».
2. **Ingerir sem escrever:** ler produto nativo por `loja_id + bling_id + SKU`, com paginação/cursor, versão, data, hash e fonte; distinguir dados importados do marketplace, fornecedor, NF e catálogo técnico. Preserve os originais como snapshot, sem modificar notas nem preço/estoque.
3. **Indexar e resolver identidade:** normalizar marca, SKU fabricante, GTIN com validação, OEM/OES com referência, família e aliases. Um produto físico/estoque por identidade real; registros duplicados vão à fila. OEM parecido não prova equivalência, e dois anúncios por veículo não viram novos produtos de estoque.
4. **Enriquecer em rascunho:** taxonomia (Sistema → Subsistema → Família → Peça), descrição curta/longa, referências cruzadas, imagens, medidas, aplicações por montadora/modelo/versão/motor/ano/tecnologia e contraindicações. Usar pesquisa web, catálogos e ferramentas autorizadas com identificação de fonte, data, direitos de imagem e grau de evidência. Marcar campos estimados, conflitantes ou sem fonte.
5. **Homologação técnica obrigatória:** validar individualmente a peça, sua classificação, fabricante/origem, vínculo OEM, aplicação **por versão de veículo**, motor, ano, tecnologia e restrições. Evidência de anúncio ou inferência do LLM é **candidata**, nunca homologação. Relação OEM não é transitiva. Exigir evidência direta por aplicação ou documentação técnica suficiente, data, revisor e ausência de conflitos abertos. Peça de segurança (freio, direção etc.) requer revisão reforçada.
6. **Diferença e aprovação:** mostrar `antes → proposto → evidências → impacto → campos aprovados`, com identidade e registro de decisão humana. O agente não pode aprovar proposta própria, nem se atribuir papel de aprovador via serviço, extensão, navegador ou Desktop Commander. Política fiscal e compatibilidade comercial seguem gates separados.
7. **Atualização controlada no ERP:** apenas campos expressamente suportados pela API e presentes na allowlist de escrita aprovada; `idempotency_key`, lock/versão, verificação de identificação do produto e reconsulta pós-PATCH. Nunca atualizar automaticamente NF, NCM/CEST/CFOP, GTIN, custo, fornecedor, estoque, fiscal, tributação, preço ou composições sem fluxo próprio e autorização específica. Falha/timeout de escrita = estado **desconhecido** e reconciliação, não repetição cega.
8. **Extensões e projeções:** campos técnicos que o Bling não aceita permanecem armazenados no Conecta.IA, ligados ao mesmo ID e versão. Loja e marketplaces recebem apenas dados aptos, homologados e aprovados por canal, incluindo imagens com licença e política comercial. Publicação não é efeito colateral da indexação.
9. **Acompanhamento contínuo:** conciliar estoque/status/ID, eventos repetidos, conflitos de versão, alterações externas do Bling, cadastros desatualizados e mudanças de catálogos. Gravar auditoria e expor alertas; nunca presumir que um snapshot antigo esteja sincronizado.

### Estados e barreiras

`importado → indexado → candidato → evidencia_coletada → homologacao_pendente → homologado → aprovacao_loja_pendente → aprovado_para_escrita → confirmado_no_bling → apto_para_canal`.

Estados de exceção: `conflito`, `sem_evidencia`, `bloqueado`, `escrita_estado_desconhecido`, `desatualizado`, `rejeitado`. O motor não pula estados. **Homologado** não é sinônimo de **publicado** nem de **fiscalmente autorizado**. A taxonomia pai/filho representa hierarquia técnica e muitas aplicações da mesma peça; não significa composições/variações nativas do Bling nem novo estoque.

## Gateway de ferramentas e agentes

O **Gateway Conecta.IA** mantém o catálogo fechado de ferramentas tipadas: Bling API, conector autorizado, MCP/Pair, agentes especializados, Desktop Commander remoto, navegador autorizado, busca técnica, OCR quando justificado, edição de imagens, extensões de torre/Nano e interfaces experimentais. **«OMCP», «WJP» e outras siglas ainda não especificadas não viram protocolos implementados só por serem citados**; exigem definição de contrato, versão, identidade, escopos e ensaio em homologação.

Fluxo: `usuario/loja → tarefa → Policy Engine → roteador por capacidade/custo → ferramenta isolada → evidência → verificador → proposta → aprovador humano → executor autorizado → leitura de confirmação → auditoria`.

- **Agentes:** Nano orquestra; GPT/Claude/terceiros recebem tarefas de menor privilégio com `tenant_id`, `task_id`, orçamento, timeout, capacidades e retorno estruturado. Podem escalar complexidade para modelo maior, sem herdar novos poderes de escrita. Subagentes não acessam segredos, dados de outra loja ou cópia integral desnecessária de clientes.
- **Desktop Commander:** é uma ferramenta remota controlada, não autorização para contornar gateway. Uso por sessão consentida, lista de ações, caminhos/host autorizados, captura de logs, operação reproduzível e aprovação humana antes de gravar no ERP. Cláudio, GPT e Nano não dividem uma sessão privilegiada invisível; quando dois agentes trabalham no mesmo SKU, travar ou reconciliar versão.
- **Torre/extensões e experimentos:** sandbox, chave e armazenamento separados, capability flag, execução somente teste por padrão, limites de CPU/rede/custo, verificação de origem e botão de desativar. «Instalado», «autorizado», «conectado» e «testado» são estados distintos comprovados por telemetria.
- **APIs/MCP:** tokens no servidor/cofre, OAuth da loja e expiração/revogação, permissões por ferramenta e papel, `loja_id` obrigatório e RLS; serviço com credencial não equivale a aprovação humana. Respostas externas são dados não confiáveis: sanitizar comandos, URLs, imagens e conteúdo de marketplace antes de apresentar aos modelos.
- **Escritas:** `read` e `propose` podem ser automatizados dentro dos escopos aprovados; `write`, `publish`, `delete`, `NF`, `stock`, `payment` têm executores e aprovações independentes. O agente não emite NF ou movimenta estoque no projeto piloto por padrão.

## Privacidade, vendas, bancos e responsabilidades

Cadastro completo de cliente, CPF/CNPJ, endereço, inscrição estadual, dados tributários e pedidos devem ser captados em canal autenticado e enviados **ao Bling por integração autorizada**, conforme necessidade operacional; Conecta.IA guarda no máximo ID de correlação opaco, situação de aprovação e rastreio minimizado. **Dados de cartão e credenciais bancárias não transitam nem ficam armazenados no Nano/Conecta**, cabendo ao prestador de pagamento autorizado tratar a transação. Os dados do Bling ficam restritos ao tenant; fotos e descrições públicas jamais incluem dados financeiros, custos, fornecedor ou identificadores internos.

A triagem de venda por UF, CPF/CNPJ como **categoria** (sem coletar número), contribuinte ICMS, finalidade (uso/consumo, revenda, imobilizado), produto, regime, vigência e validação do contador é **fail-closed**. Sem regra documentada e vigente = `analise_fiscal`, não «permitido». Essa triagem não emite nota, aceita pagamento nem determina impostos. O cliente recebe informação de privacidade e status antes do encaminhamento. Não transformar «empresa com CNPJ» automaticamente em «contribuinte do ICMS».

## Critérios verificáveis para homologar qualquer plugin/conector

| Critério | Evidência mínima |
| --- | --- |
| Identidade e isolamento | duas lojas com dados distintos; proibir consulta/escrita cruzada |
| Contrato e capacidades | manifesto versionado; parâmetros e campos permitidos; integração realmente disponível |
| Conteúdo técnico | fonte, data, especificação, versão do veículo, exclusões e rastreabilidade |
| Indexação e qualidade | importação idempotente; SKU único; duplicatas e conflitos revisáveis |
| Aprovação | agente não aprova; diff campo a campo; revisor real; registro e revogação |
| Escrita no Bling | modo de teste sem escrita, allowlist, idempotência, auditoria, confirmação pós-gravação |
| Controle de canais | marketplace nativo não duplicado; anúncios vinculados ao mesmo SKU |
| Segurança e LGPD | OAuth, cofre, RLS, logs sem PII, revisão de imagens e licenças |
| Resiliência | timeout, retry limitado, reconciliação, rollback e «estado desconhecido» |
| Operação | métricas, alertas, filas, versão, status real da conexão e custo por tarefa |

## Critérios de aceite do piloto Mobis

1. Ler 1 produto por ID/SKU do Bling sem gravar nada, auditando origem/API e exibindo dados e extensões separados.
2. Propor enriquecimento técnico com evidências e comparar antes/depois; caso contraditório fica bloqueado.
3. Testar aplicações de HR/Bongo com mudanças 8V/16V, Euro 3/5 e ano; motor em comum não basta.
4. Homologar uma aplicação por revisor humano distinto e aprovar **um** campo técnico permitido, com `idempotency_key`, em ambiente de homologação com rollback documentado.
5. Tentar ferramentas sem permissão, cross-tenant, prompt injection de página externa, pedido repetido e escrita fiscal: todas recusadas.
6. Checar fotos técnicas reais versus sintéticas, imagem com direitos e anúncio sem homologação: não publicar.
7. Consultar uma operação CPF/CNPJ e UF sem fornecer documentos; sem regra fiscal vigente, recusar autorização automática.
8. Desconectar o Bling e verificar «não verificado/desatualizado» em vez de «sincronizado».
9. Validar responsividade do painel Mobis e preservar o Olho E02, os hologramas e a divisão entre painel administrativo e loja.
10. Só liberar operações reais após aprovação explícita, testes de integração, revisão de segurança e autorização de negócio; neste registro, nada foi executado.

## Arquivos existentes relacionados e reconciliação

- [Agent Gateway e OAuth](../AGENT_GATEWAY.md): reutilizar orquestrador, Policy Engine, contratos e credenciais; não criar gateway paralelo.
- [Espelho técnico para o Bling](../ESPELHO_TAXONOMIA_BLING.md): respeitar allowlist por campo, revisão humana, idempotência e readback.
- [Arquitetura multiagente](multiagente-arquitetura.md): capacidades, genealogia automotiva, evidências e escopos.
- [Operação de agentes/Pair](../conecta-pair/OPERACAO-AGENTE.md): consentimento e sessão do agente não substituem credencial do usuário nem prova de conexão.
- [Catálogo aprovado Mobis](layout-canva-catalogo-aplicacao-aprovado.md): layout visual e segurança da área interna.
- Documento de sincronização Bling/marketplaces ainda **em branch de trabalho**, não integrado ao `main`: `docs/conector-ia/arquitetura-sincronizacao-bling-nano-marketplaces.md`. Ao revisar PRs futuros, conciliar seu texto com este ADR, evitando duas arquiteturas conflitantes.

**Não implementado por este ADR:** acesso a dados bancários, integração de clientes em produção, novas ferramentas remotas, bypass do Bling, alteração de cadastro, migração de banco, integração com marketplaces, merge ou deploy. Aprovação do texto é diferente de homologação funcional.
