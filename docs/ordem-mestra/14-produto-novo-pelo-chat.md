# Produto novo montado no chat do Nano.IA — desenho para aprovação (sem código)

Pedido do dono (2026-11-01): descrever uma peça ("virabrequim aço forjado STD Kia Bongo K2500 8V", "motor HR 2012") ou anexar um catálogo, e o Nano.IA **montar o produto completo, com imagens**, para o dono mandar ao Bling, à análise ou ao site. Este documento não altera código nem dado. Depende das decisões da seção 6.

## 1. Análise
**Problema:** hoje o Nano.IA propõe campo por campo. Não monta uma ficha única, não mostra imagens no chat e não cria produto novo (a ferramenta de criar está desligada e o contrato de cadastro está só planejado).

**O que já existe e será reaproveitado (conferido no código):**
| Peça | Onde | Estado |
|---|---|---|
| Ler anexo PDF, imagem e CSV | chat do `assistente` (`+`) | funciona (PDF só em provedor que aceita, como o Gemini) |
| Propor marca, descrições, peso, medidas, categoria, códigos, aplicação e imagem, sempre com fonte | `propor_*` e `conecta.*.propor` | ativas, entram como "a confirmar" |
| Achar duplicidade, inclusive excluídos | `bling_consultar_produto`, `engenharia.duplicidade.detectar` | ativas |
| Proposta versionada com hash, aprovação humana, auditoria, leitura de confirmação | `conector/executor.ts` | ativas; testadas com Bling simulado |
| Contrato de cadastro de produto novo | `bling.produtos.preparar_cadastro` | **planejada** |
| Executor de criação | `bling.produtos.criar` | **desligada**; nenhum campo liberado |
| Portão de publicação (nome, SKU, preço, categoria, imagem, marca de peça, código do fabricante, bula) | `produto_pendencias` | ativo |

**Fatos do Bling (do esquema `createProduct`, não de memória):** só `nome`, `tipo`, `situacao` e `formato` são obrigatórios; `nome` até 120 caracteres; categoria vai por id; imagens por link (`midia.imagens.imagensURL`, só escrita); campos customizados por id; `situacao` aceita A ou I.

## 2. Arquitetura e fluxo
1. O dono descreve a peça ou anexa o catálogo.
2. O Nano.IA extrai campos **só do que o texto ou o catálogo diz**, cada campo com fonte (arquivo e página, ou texto do dono). O que não tem fonte fica "a confirmar".
3. Antes de montar, confere duplicidade no Bling (ativos, inativos e excluídos). Se existir, propõe reativar ou atualizar, **nunca criar de novo**.
4. Mostra **uma ficha única no chat** (reuso de `FichaProduto`) com os campos, as lacunas, a aplicação por veículo, motor e ano, e as imagens candidatas.
5. **Aprovação total antes do site (pedido do dono, 2026-11-01):** o produto novo só entra no site com **todas** as exigências do portão aprovadas na mesma tela. A ficha mostra a lista, com o status vindo do resultado real do portão (nunca aparência fixa):
   - nó da **taxonomia** aprovado;
   - **marca de peça** e **código do fabricante** aprovados;
   - **imagem principal** aprovada, com direitos de uso confirmados;
   - **bula técnica** (medidas) aprovada;
   - nome, descrição, categoria do Bling e, digitados por você, SKU e preço.
   Enquanto algum item estiver pendente, o botão **Cadastrar no site** fica desligado e mostra o que falta. Os outros dois botões continuam: **Criar no Bling** e **Enviar para análise** (itens "a confirmar" vão para a Fila).
6. Ordem de execução do lote aprovado: criar no Bling, esperar o espelho sincronizar, aplicar as aprovações da camada Conecta.IA e só então publicar no site. Cada etapa lê de volta e confirma; se uma falhar, as seguintes não rodam.
7. Depois de gravar, o executor lê o produto de volta e só então confirma (regra já existente).

## 3. Schema e estados
- **Fase 1 sem migração:** a ficha vive dentro da proposta (`antes: null`, `depois: ficha`, fontes por campo). Estados existentes: pendente, aprovada, executando, confirmada, falhou, desconhecida.
- Imagem aprovada e direitos confirmados continuam em `produto_imagens`; código e aplicação em `produto_codigos` e nas tabelas de aplicação, como hoje.
- Se a Fase 3 precisar de rascunho que sobreviva a dias (catálogo longo), isso é uma migração à parte, mostrada antes e aprovada (regra do CLAUDE.md).

## 4. Riscos e como tratar
| Risco | Tratamento |
|---|---|
| Inventar compatibilidade ou medida | só com fonte e data; sem prova fica "a confirmar"; teste automático cobre isso |
| Criar duplicata | busca obrigatória incluindo excluídos antes de qualquer proposta de criação |
| SKU, preço, NCM e estoque errados | **campos humanos**: a ficha os pede ao dono, a IA não os preenche (decisão D1) |
| Publicar com algo pendente | o portão é revalidado **no servidor** na hora de publicar; o botão desligado na tela não é a única proteção |
| Produto novo difícil de desfazer no Bling | criar **inativo** e ativar em segunda proposta (decisão D2); não existe ferramenta de excluir |
| Direitos de imagem | imagem entra "direitos não confirmados" e só vai ao Bling depois de aprovada |
| Custo de IA em catálogo grande | limite por loja já existe; processar por páginas e mostrar o consumo |
| Injeção por texto de catálogo | conteúdo de anexo é dado; o prompt já trata assim; a escrita exige aprovação humana |

## 5. Fases e testes
- **F1:** ficha no chat + `preparar_cadastro` com Bling simulado. Testes: sem fonte nada entra; duplicata bloqueia; campos humanos recusados se vierem da IA; nada é gravado.
- **F2:** ligar `criar` para **um** produto real, com aprovação, leitura de confirmação e desfazer documentado.
- **F3:** imagens no chat e envio ao Bling por link, com chave de busca do Google.
- **F4:** botão "Cadastrar no site" amarrado ao portão de publicação, ligado só com aprovação total (teste: com um item pendente o botão não liga e a publicação é recusada no servidor).

## 6. Decisões do dono
- **D1.** SKU, preço e NCM digitados por você na ficha (a IA nunca preenche)? Recomendado: sim.
- **D2.** Criar o produto inativo no Bling e ativar depois? Recomendado: sim.
- **D3.** Existe chave do Google para busca de imagens? Se não, a F3 espera.
- **D4.** Provedor de IA para catálogos: o Gemini atual aceita PDF; a cota gratuita limitou hoje.

Nada deste documento foi implementado, publicado ou gravado no Bling.
