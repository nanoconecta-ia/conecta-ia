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

## 1b. Dois caminhos (esclarecimento do dono, 2026-11-01)
- **Caminho A, produto que já está no Bling** (os 42 do espelho, como o CI001086): o sistema vê o produto no Bling e o **leva para o site**. O Bling continua sendo a fonte; o Nano.IA só completa o que falta (taxonomia, imagens, marca de peça, código, bula) com fonte e aprovação. **Preço e custo são completados pelo lojista**, e a IA não os preenche. O **custo nunca vai ao site nem à tela do cliente**; só o preço de venda aprovado.
- **Caminho B, produto que ainda não existe no Bling:** a ficha do chat cria o cadastro no Bling (seções 2 a 5) e, com aprovação total, ele segue o caminho A. Aqui o lojista **digita SKU, preço e NCM na própria ficha**.
- No caminho A, o preço vem do Bling; se faltar ou parecer errado (por exemplo, o CI001086 tem 939,466667 com seis casas decimais), a ficha marca "o lojista confere no Bling". Alterar preço no Bling continua fora do alcance da IA.

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
| Preço ou custo errados por IA | só pedido explícito do lojista, proposta HIGH com antes e depois, nunca a partir de texto de terceiros (D5) |
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
- **D1.** SKU, preço e NCM completados por você, nunca pela IA (digitados na ficha, no caminho B; conferidos no Bling, no caminho A). Resposta do dono em 2026-11-01: o lojista completa custo e preço. A confirmar por ele só o texto acima.
- **D2.** Criar o produto inativo no Bling e ativar depois? Recomendado: sim.
- **D5 (novo, pedido do dono em 2026-11-01).** O lojista pode **pedir ao Nano.IA para ajustar preço de venda e preço de custo**. Hoje isso é proibido por decisão de 2026-10-29 (`CAMPOS_BLING_PROIBIDOS` e `CAMPOS_ESCRITA_LIBERADOS`; a IA nunca altera preço, custo, estoque, fornecedor, SKU nem fiscal). Mudar exige esta decisão por escrito, mudança da lista fechada com o teste que a trava, e as regras abaixo:
  - só a **pedido do lojista no chat**, nunca por iniciativa da IA, nem a partir de texto de catálogo ou de cliente;
  - sempre por **proposta com antes e depois, aprovação da versão exata, auditoria e leitura de confirmação**; risco **HIGH** para preço (aprovação reforçada);
  - **estoque, fornecedor e fiscal continuam proibidos**;
  - o **custo nunca vai ao site nem ao cliente**;
  - fato do Bling (esquema `patchProduct`): `preco` é gravável no PATCH do produto; o **custo não é**: `fornecedor.precoCusto` é somente leitura nesse PATCH, e o custo fica no vínculo produto-fornecedor, que tem endpoint próprio, ainda **não conferido** para alteração;
  - o custo passaria pelo provedor de IA (Gemini) quando aparecer no chat; hoje as ferramentas escondem custo e fornecedor. Isso precisa de aceite do dono.
- **D3.** Existe chave do Google para busca de imagens? Se não, a F3 espera.
- **D4.** Provedor de IA para catálogos: o Gemini atual aceita PDF; a cota gratuita limitou hoje.

Nada deste documento foi implementado, publicado ou gravado no Bling.

## 7. Visão do dono: Nano.IA como condutor de venda (2026-11-01) — fases propostas
Pedido: o Nano.IA ajudar o lojista a **não ter prejuízo**: ver custo e preço, custo-benefício, fiscal e logística, custo de compra, e **pesquisar no Google** se o produto está bem posicionado no preço. Regra de ouro: **analisar é leitura (risco baixo); mudar preço é proposta com aprovação (risco alto)**.
- **P1, análise de margem (só leitura, conta feita em código, não pela IA):** custo de compra e de custo, preço de venda, margem bruta, e o que falta para calcular frete e imposto (peso, medidas, NCM, CEST, origem). Regras fiscais **só como alerta**, validadas pelo contador do cliente (CLAUDE.md).
- **P2, mercado:** busca na web de preços e anúncios do mesmo código, **sempre com fonte e data**, tratada como pista e não como prova. Exige chave de busca (Google Programmable Search) e respeito aos termos dos marketplaces.
- **Teste real da P2 (2026-11-01, CI001086):** uma busca no TinyFish (custo zero) devolveu, com fonte, quatro preços de bomba de óleo HR/K2500 2.5 16V D4CB entre R$ 861,30 e R$ 1.322,05 (Caminhonete e Cia, Rhino Auto Parts, Mercado Livre e DOR Auto Imports), contra R$ 939,47 do Bling. Conclusão: a ferramenta alcança preço de mercado brasileiro, inclusive o Mercado Livre, sem chave do Google. **Limites:** só trechos da busca (páginas não abertas); marcas diferentes da TRIM GO; um anúncio com título misto (8v e 16v); referências de outras marcas (70871, AT8875) são **indício** e não código da peça. Regra mantida: resultado é pista com fonte e data, nunca prova, e nunca altera preço sozinho. Firecrawl não listou Mercado Livre no catálogo gratuito; serve para Amazon.com.br e Nuvemshop.
- **P3, histórico próprio:** vendas e giro lidos dos pedidos do Bling (leitura).
- **P4, sugestão de preço:** vira proposta HIGH com antes e depois (D5). Nunca grava sozinho.
- **Fora desta trilha:** venda direta ao cliente pelo WhatsApp (webhook Meta, fila) é outro projeto; entra depois do site publicar o primeiro produto.
- Custo e fornecedor passam a entrar no contexto do chat do lojista: exige aceite do dono (provedor de IA) e continua **fora do site e da tela do cliente**.

## 8. Visão do dono: Nano.IA comercial, com cliente, proposta e pedido (2026-11-01) — fases propostas
Pedido: o lojista escreve "faz uma proposta para a empresa tal, Hyundai HR 2012, pistão STD metal leve, biela, pagamento em 3x, entrega em 3 dias", e o Nano.IA cadastra o cliente, monta a proposta ou o pedido de venda e pede aprovação. Também atuar no B2B junto do lojista com a extensão (custo dos produtos e dados para cadastro e fiscal).

**O que existe (conferido nas ferramentas do Bling e no registro):** o Bling tem contatos, propostas comerciais e pedidos de venda (criar e listar). No registro do Conecta.IA, `bling.contatos.criar/alterar` e `bling.pedidos_venda.criar` estão **desligadas**; proposta comercial não existe como ferramenta. Nota fiscal é **só consulta** (decisão do dono de 2026-10-17: emitir e enviar são proibidos).

**Regras:**
- O Nano só cota **itens do catálogo com preço e estoque lidos do Bling na hora**; aplicação "HR 2012" só entra com fonte (aplicação aprovada). Peça pedida e não encontrada vira linha "não encontrada", nunca inventada.
- Pagamento (3x) e prazo (3 dias) são **termos ditos pelo lojista**, gravados como tal; o Nano não promete frete, prazo nem pagamento que o lojista não informou (já é regra de `engenharia.loja.condicoes`).
- Cliente é dado pessoal (CPF/CNPJ, telefone, e-mail): busca por duplicidade antes de cadastrar, máscara antes de ir ao provedor de IA, e sem consentimento nada sai da loja.
- Pedido de venda e cadastro de cliente são escrita externa de risco **MEDIUM/HIGH**: proposta com versão e hash, aprovação humana, `idempotency_key`, leitura de confirmação e auditoria. **Nunca emite nota fiscal.**

**Fases:**
- **C1, rascunho no chat (sem gravar nada):** o Nano acha o cliente (se já existe no Bling) e monta a proposta em texto, com itens, preços, termos e o que faltou. O lojista copia ou manda.
- **C2, cliente:** cadastrar contato novo no Bling, por proposta aprovada, depois de conferir duplicidade por CNPJ.
- **C3, proposta comercial e pedido de venda no Bling,** por proposta aprovada. Aprovação reforçada no pedido.
- **C4, B2B com a extensão:** a extensão captura custo, dados de cadastro e fiscal do portal do fornecedor e os envia como **propostas com fonte** para a Fila; nada é gravado nem preenchido sem o clique do lojista.
- Ordem geral: **primeiro o site publicar o primeiro produto (CI001086)**, depois P1 (margem), depois C1. O resto só com cada fase anterior provada.
