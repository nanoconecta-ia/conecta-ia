# Motor de indexação — relatório de riscos e ações que exigem autorização (2026-10-19)

## 1. Riscos
| # | Risco | Gravidade | Situação / mitigação |
|---|---|---|---|
| R1 | **Ano-modelo errado** (cadastro 2013, catálogo 2014; ano de outro mercado; ano de lançamento mundial) leva a peça errada | Alta | Início de período divergente vira **conflito** travado até o lojista decidir; sem evento de importação/comercialização no Brasil **com fonte**, o ano fica "a confirmar". **Falta dado:** não há fonte do período do HR/K2500 no Brasil (ver `periodo-brasil-hr-k2500.md`). |
| R2 | Mesmo motor tratado como compatibilidade (D4CB em veículos diferentes) | Alta | Aplicação sempre por **versão + mercado**; a extração separa o que o cadastro **exclui** do que **aplica**; texto com mais de um veículo ou motor **não gera aplicação** (um anúncio por versão). |
| R3 | **Defeito encontrado e corrigido** nesta branch: a ferramenta de extração contava como aplicação os motores, emissões e anos citados dentro do "NÃO SE APLICA" | Média (corrigido) | Corrigido em Python e TypeScript, com casos de referência compartilhados. Quem usou a saída antiga do `catalogo_ia` deve regerar. |
| R4 | Instrução maliciosa em página pesquisada | Alta | Conteúdo externo é dado: marcação oculta removida, linhas de comando retiradas e sinalizadas, fonte marcada **não confiável**; cadastro nunca copia a linha. Teste ponta a ponta. **Limite:** detecção por padrões; ataque novo pode escapar, por isso nada executa sem aprovação humana. |
| R5 | Agente aprovar ou publicar sozinho | Alta | Aprovar/rejeitar/resolver só pelo **lojista** (imposto no banco); agente e editor recusados; sincronizar exige proposta e leitura de confirmação. |
| R6 | Conflito de arquitetura com o outro agente (`aprovacoes`, `conversas`, `conecta-gateway` já em produção × tabelas `agente_*` desta branch) | Alta | Reconciliar **antes** de aplicar qualquer migração (ver `riscos-e-dependencias.md`). O pipeline foi feito **sem FK** para as tabelas de proposta justamente para não amarrar essa decisão. |
| R7 | Defeito em `public.chat_iniciar` (produção): reenvio de pergunta antiga vencida diz `em_execucao` por causa do turno mais novo | Baixa | Correção de 1 linha proposta em `motor-fase0-auditoria.md`; é núcleo do chat do outro agente, pede PR próprio. |
| R8 | Dados fiscais | Alta | Fora de escopo por desenho: nenhum campo fiscal, custo ou fornecedor é lido, copiado ou escrito; margem de +20% **não** é somada ao cadastro. Regra fiscal única para todos os produtos é proibida (validação do contador). |
| R9 | Campos do Bling não conferidos na documentação oficial | Média | O site oficial é bloqueado no ambiente de desenvolvimento; todos os campos de escrita seguem `conferido:false` e a escrita permanece desligada. |
| R10 | Sem IA ativa (0 chaves) e sem fontes reais | Média | O pipeline roda sem IA e devolve "a confirmar". A etapa de IA (opcional) não foi exercitada com provedor real. |
| R11 | Conectores reais ausentes (catálogos de fabricantes, B2B, GTIN) | Média | Interface pronta (autorização, tempo limite, sem navegação sem permissão). Cada conector real precisa de contrato/licença da fonte. Dados de catálogo (EPC) são de terceiros e licenciados. |
| R12 | Banco de teste local sobe/desce no ambiente | Baixa | `rodar_tudo.sh` recria o banco; se o Postgres local estiver parado, os testes de banco falham em massa (não é regressão). |

## 2. Ações que exigem sua autorização (nada foi feito)
| # | Ação | Por quê precisa de autorização |
|---|---|---|
| A1 | **Aplicar migrações em produção** (`…0001` a `…0009`) | Esquema de produção. Antes: reconciliar com `aprovacoes`/`conversas` (R6). Você já autorizou, condicionado à validação do mapeamento, apenas `sistemas_mecanicos`, `documentos_tecnicos` e `identificadores_oficiais`; as demais (OEM, verificação, pipeline) pedem confirmação específica. |
| A2 | **Publicar Edge Functions** (`conector-*`, `loja-seo`) | Deploy. |
| A3 | **Qualquer escrita no Bling** (categorias de 3 níveis, trocar a categoria órfã 1072643 dos 4 produtos, descrição enriquecida) | Escrita no ERP. Cada ferramenta de escrita está desligada e passa por proposta, aprovação, idempotência e leitura de confirmação. |
| A4 | **Ativar uma chave de IA** (e escolher o provedor) | Custo e dados enviados ao provedor. |
| A5 | **Conectores reais** de pesquisa (catálogo de fabricante, B2B, GTIN) | Licença e termos de cada fonte; navegação automatizada só onde permitida. |
| A6 | **Mesclar** os PRs #39 e #40 | Merge. |
| A7 | **Cadastrar o período do HR/K2500 no Brasil** em `eventos_veiculo` | Dado de produção; precisa de documento de fonte (importador, homologação, catálogo da montadora). |
| A8 | **Busca por placa** (serviço de terceiros pago) | Contratação e LGPD. |

## 3. Próximos passos sugeridos (sem tocar em produção)
1. Você decidir R6 (qual modelo de aprovação/conversa prevalece) para destravar A1.
2. Fornecer a fonte do período do HR e do K2500 (A7).
3. Escolher o primeiro conector real e a licença (A5).
