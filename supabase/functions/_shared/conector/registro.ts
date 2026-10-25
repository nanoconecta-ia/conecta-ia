// Registro central de ferramentas do Conector IA (Tool Registry). O que não está aqui não existe.
// Chat, gateway MCP e executor consultam ESTE catálogo; o Policy Engine decide sobre ele (policy.ts).
// Regras: LLM nunca recebe o MCP do Bling cru; escrita externa só pelo executor, após aprovação humana;
// "ativa" significa handler implementado E testado — o resto é contrato (planejada) ou está travado (desligada).
import type { DefinicaoFerramenta, JsonSchema, Permissao, Risco } from "./tipos.ts";

const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });
const txt = (descricao?: string, maxLength = 200): JsonSchema => ({ type: "string", maxLength, description: descricao });
const uuid: JsonSchema = { type: "string", pattern: "^[0-9a-fA-F-]{36}$" };
const sku: JsonSchema = { type: "string", minLength: 1, maxLength: 80, description: "SKU/código do produto no Bling" };
const livre: JsonSchema = { type: "object" };
const lista = (items: JsonSchema, maxItems = 50): JsonSchema => ({ type: "array", items, maxItems });
const fonte = obj({ url: txt("endereço da fonte", 500), documento: txt("nome do documento", 200), versao: txt("versão da fonte", 60), consultado_em: txt("data (ISO)", 40) });

/** Campos do produto no Bling que o Conector IA PODE alterar (nunca fiscal, preço, custo, fornecedor, estoque, SKU). conferido:false até a conferência na documentação oficial. */
export const CAMPOS_BLING_PERMITIDOS = ["nome", "descricaoCurta", "descricaoComplementar", "marca", "gtin", "pesoLiquido", "pesoBruto", "dimensoes", "categoria"] as const;
export const CAMPOS_BLING_PROIBIDOS = ["tributacao", "ncm", "cest", "fornecedor", "fornecedores", "precoCusto", "precoCompra", "preco", "estoque", "codigo", "situacao", "formato"] as const;

const def = (d: Omit<DefinicaoFerramenta, "exposicao" | "escreveExterno" | "simulacao" | "exigeAprovacao" | "idempotencia" | "estado"> & Partial<DefinicaoFerramenta>): DefinicaoFerramenta => ({
  exposicao: { chat: false, mcp: false }, escreveExterno: false, simulacao: false, exigeAprovacao: false, idempotencia: "nao_se_aplica", estado: "planejada", ...d,
});
const leitura = (id: string, grupo: DefinicaoFerramenta["grupo"], descricao: string, entrada: JsonSchema, saida: JsonSchema, verificacao: string, extra: Partial<DefinicaoFerramenta> = {}) =>
  def({ id, grupo, descricao, entrada, saida, permissao: "leitura", risco: "LOW", verificacao, recuperacao: "Repetir a leitura; é segura.", exposicao: { chat: true, mcp: true }, ...extra });
const proposta = (id: string, grupo: DefinicaoFerramenta["grupo"], descricao: string, entrada: JsonSchema, saida: JsonSchema, risco: Risco, extra: Partial<DefinicaoFerramenta> = {}) =>
  def({ id, grupo, descricao, entrada, saida, permissao: "propor", risco, verificacao: "A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.",
    recuperacao: "Descartar o rascunho ou criar nova versão; nada externo foi alterado.", idempotencia: "chave", exposicao: { chat: true, mcp: true }, ...extra });
/** Execução na camada Conecta.IA (banco próprio): também só pelo executor e só com aprovação, mas não fala com sistema externo. */
const interna = (id: string, descricao: string, entrada: JsonSchema, risco: Risco, verificacao: string, recuperacao: string) =>
  def({ id, grupo: "conecta", descricao, entrada, saida: livre, permissao: "executar", risco, simulacao: true, exigeAprovacao: true, idempotencia: "chave",
    verificacao, recuperacao, estado: "ativa", escreveExterno: false });
const execucao = (id: string, descricao: string, entrada: JsonSchema, risco: Risco, verificacao: string, recuperacao: string) =>
  def({ id, grupo: "bling", descricao, entrada, saida: livre, permissao: "executar", risco, simulacao: true, exigeAprovacao: true, idempotencia: "chave",
    verificacao, recuperacao, estado: "desligada", escreveExterno: true });

const PRODUTO_ALVO = obj({ sku, produto_id: uuid });
const itemProposta = obj({
  produto_id: uuid, sku, operacao: txt("id da ferramenta que será executada após aprovação", 80), alvo: txt("identificador no ERP/site", 100),
  campos: lista(txt(undefined, 60), 30), antes: livre, depois: livre, fontes: { ...lista(fonte, 10), minItems: 1 }, validacoes: lista(txt(undefined, 200), 20), risco: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
}, ["operacao", "depois", "fontes"]);

export const FERRAMENTAS_CONECTOR: readonly DefinicaoFerramenta[] = [
  // ------------------------------------------------------------------ Conecta.IA (leitura e propostas)
  leitura("conecta.catalogo.resumo", "conecta", "Totais da loja: produtos espelhados, publicados e itens aguardando aprovação.", obj({}), obj({ produtos: { type: "integer" }, publicados: { type: "integer" }, aguardando_aprovacao: { type: "integer" } }),
    "Contagem direta no espelho.", { estado: "ativa" }),
  leitura("conecta.catalogo.listar", "conecta", "Lista produtos da loja (nome, SKU, preço, estoque, publicado).", obj({ apenas_nao_publicados: { type: "boolean" }, busca: txt("trecho do nome ou SKU", 80), limite: { type: "integer", minimum: 1, maximum: 20 } }), lista(livre, 20),
    "Leitura do espelho.", { estado: "ativa" }),
  leitura("conecta.catalogo.ver", "conecta", "Detalhes de um produto pelo SKU e o que falta para publicar.", obj({ sku }, ["sku"]), livre, "Leitura do espelho.", { estado: "ativa" }),
  leitura("engenharia.oem.buscar", "engenharia", "Busca direta por código OEM: DNA da peça (classe, fabricante, fonte), aplicações por VERSÃO do veículo, modelo do motor, referências cruzadas diretas e SKUs da loja. Só dado aprovado, salvo pedido.",
    obj({ codigo: txt("código OEM como aparece (hífen, espaço e caixa são ignorados)", 40), incluir_a_confirmar: { type: "boolean" } }, ["codigo"]), livre,
    "Leitura do catálogo técnico global; nada é deduzido quando não há registro.", { estado: "ativa" }),
  leitura("conecta.enriquecimento.pendentes", "conecta", "Itens de enriquecimento aguardando aprovação.", obj({ limite: { type: "integer", minimum: 1, maximum: 20 } }), lista(livre, 20), "Leitura da fila.", { estado: "ativa" }),
  leitura("conecta.travas.consultar", "conecta", "Estado operacional (trava) de produtos: bloqueado, liberado, pendente, em execução, sincronizado, divergente.", obj({ produto_id: uuid, sku }), livre,
    "Leitura de produto_travas.", { estado: "ativa" }),
  leitura("conecta.proposta.estado", "conecta", "Estado de uma proposta (versão, hash, aprovação, itens, operações).", obj({ proposta_id: uuid }, ["proposta_id"]), livre, "Leitura de agente_propostas.", { estado: "ativa" }),
  leitura("conecta.publicacao.preparar", "conecta", "Verifica se um produto está pronto para a página pública e lista o que falta (sem publicar).", PRODUTO_ALVO, obj({ pronto: { type: "boolean" }, faltando: lista(txt(), 30) }),
    "Cálculo sobre dados aprovados do espelho.", { estado: "ativa" }),
  proposta("conecta.proposta.criar", "conecta", "Cria uma PROPOSTA versionada (antes/depois, fontes, validações) para o lojista aprovar. Não altera nada: só a aprovação humana libera execução.",
    obj({ titulo: txt("título curto", 160), resumo: txt(undefined, 1000), lote: { type: "boolean" }, itens: { ...lista(itemProposta, 200), minItems: 1 } }, ["titulo", "itens"]),
    obj({ proposta_id: uuid, versao: { type: "integer" }, hash: txt(), risco: txt() }), "MEDIUM", { estado: "ativa", simulacao: true }),
  proposta("conecta.enriquecimento.propor", "conecta", "Propõe um valor de enriquecimento para um campo do produto (entra como a_confirmar, com fonte).",
    obj({ sku, campo: txt(undefined, 40), valor: txt(undefined, 4000), fonte: txt("URL ou documento", 500), confianca: { type: "number", minimum: 0, maximum: 1 } }, ["sku", "campo", "valor", "fonte"]), livre, "LOW", { estado: "ativa" }),
  proposta("conecta.codigo.propor", "engenharia", "Propõe um código de referência (OEM/fabricante/cruzado) com fonte.",
    obj({ sku, tipo: txt(undefined, 30), valor: txt(undefined, 80), fonte: txt(undefined, 500), confianca: { type: "number", minimum: 0, maximum: 1 } }, ["sku", "tipo", "valor", "fonte"]), livre, "LOW", { estado: "ativa" }),
  proposta("conecta.aplicacao.propor", "engenharia", "Propõe aplicação veicular (modelo, motor, anos) com fonte.",
    obj({ sku, modelo: txt(), motorizacao: txt(), ano_inicial: { type: "integer" }, ano_final: { type: "integer" }, fonte: txt(undefined, 500), confianca: { type: "number", minimum: 0, maximum: 1 } }, ["sku", "modelo", "fonte"]), livre, "LOW", { estado: "ativa" }),
  proposta("conecta.imagem.propor", "conecta", "Propõe uma imagem candidata para o produto (pendente de aprovação; direitos ainda não confirmados).",
    obj({ sku, url: txt(undefined, 1000), origem: txt(), pagina: txt(undefined, 1000) }, ["sku", "url"]), livre, "LOW", { estado: "ativa" }),
  leitura("conecta.imagem.buscar_web", "conecta", "Busca imagens candidatas na web (não salva nada).", obj({ consulta: txt(undefined, 200) }, ["consulta"]), livre, "Resultado é dado a conferir.", { estado: "ativa", exposicao: { chat: true, mcp: false } }),
  leitura("conecta.plugins.listar", "conecta", "Plugins ativos da loja e suas capacidades.", obj({}), lista(livre, 50), "Leitura.", { estado: "ativa", exposicao: { chat: true, mcp: false } }),
  def({ id: "conecta.plugins.chamar", grupo: "conecta", descricao: "Chama um plugin ativo da loja (risco LOW, capacidade declarada). O retorno é dado a conferir.", entrada: obj({ plugin: txt(), capacidade: txt(), entrada: livre }, ["plugin", "capacidade"]), saida: livre,
    permissao: "leitura", risco: "LOW", verificacao: "Retorno tratado como dado não confirmado.", recuperacao: "Repetir é seguro (só leitura).", estado: "ativa", exposicao: { chat: true, mcp: false } }),
  leitura("conhecimento.buscar", "conecta", "Recupera conhecimento técnico com fonte e versão (documentação, validado ou hipótese), sem misturar os tipos.", obj({ texto: txt(undefined, 200), tipo: { type: "string", enum: ["documentacao", "validado", "hipotese"] }, limite: { type: "integer", minimum: 1, maximum: 10 } }, ["texto"]),
    lista(livre, 10), "Cada item traz tipo, fonte, versão e status.", { estado: "ativa" }),
  def({ id: "conecta.fabricante.pagina_preparar", grupo: "conecta", descricao: "Prepara a página de um fabricante com dados aprovados.", entrada: obj({ fabricante: txt() }, ["fabricante"]), saida: livre,
    permissao: "propor", risco: "LOW", verificacao: "Prévia revisada.", recuperacao: "Descartar.", idempotencia: "chave", exposicao: { chat: true, mcp: true } }),
  def({ id: "conecta.seo.verificar", grupo: "conecta", descricao: "Executa verificações de SEO da página de um produto (título, descrição, dados estruturados, imagem).", entrada: PRODUTO_ALVO, saida: livre,
    permissao: "leitura", risco: "LOW", verificacao: "Regras mensuráveis; o resto marcado verificação manual.", recuperacao: "Repetir.", exposicao: { chat: true, mcp: true } }),

  // ------------------------------------------------------------------ Bling (leitura pelo backend com o token da loja; nunca o MCP cru)
  leitura("bling.status.consultar", "bling", "Situação da conexão com o Bling e da última sincronização.", obj({}), livre, "Leitura de bling_conexoes.", { estado: "ativa" }),
  leitura("bling.produtos.consultar", "bling", "Consulta um produto no Bling pelo SKU (leitura em tempo real, sem custo nem fornecedor).", obj({ sku }, ["sku"]), livre,
    "Resposta do Bling filtrada por lista de campos permitidos.", { estado: "ativa" }),
  leitura("bling.categorias.consultar", "bling", "Lista as categorias de produto do Bling.", obj({ busca: txt(undefined, 80) }), lista(livre, 100), "Resposta do Bling.", { estado: "ativa" }),
  leitura("bling.estoque.consultar", "bling", "Saldo de estoque de um produto no Bling.", obj({ sku }, ["sku"]), livre, "Resposta do Bling.", { estado: "planejada" }),
  leitura("bling.precos.consultar", "bling", "Preço atual de um produto no Bling (sem preço de compra/custo).", obj({ sku }, ["sku"]), livre, "Resposta do Bling.", { estado: "planejada" }),
  proposta("bling.produtos.preparar_cadastro", "bling", "Prepara (sem gravar) o cadastro de um produto novo no Bling: confere duplicidade por SKU/GTIN e monta a proposta.",
    obj({ rascunho: livre, fontes: { ...lista(fonte, 10), minItems: 1 } }, ["rascunho", "fontes"]), livre, "MEDIUM", { estado: "planejada", simulacao: true }),
  proposta("bling.produtos.preparar_atualizacao", "bling", "Prepara (sem gravar) a alteração de campos permitidos de um produto: lê o Bling agora, monta antes/depois e cria a proposta.",
    obj({ sku, campos: livre, fontes: { ...lista(fonte, 10), minItems: 1 } }, ["sku", "campos", "fontes"]), livre, "MEDIUM", { estado: "ativa", simulacao: true }),
  proposta("bling.categorias.preparar_criacao", "bling", "Prepara (sem gravar) a criação de categoria no Bling, só se o mapeamento da taxonomia a suportar.",
    obj({ nome: txt(undefined, 120), pai_id: txt(undefined, 30), fontes: { ...lista(fonte, 10), minItems: 1 } }, ["nome", "fontes"]), livre, "MEDIUM", { estado: "planejada", simulacao: true }),

  // ------------------------------------------------------------------ Execução (SÓ o executor; nunca exposto a LLM nem a cliente externo)
  execucao("bling.produtos.criar", "Cria produto no Bling (POST /produtos).", obj({ corpo: livre }, ["corpo"]), "MEDIUM", "Ler o produto no Bling e comparar com o enviado.", "Timeout => desconhecido; reconciliar por SKU/GTIN antes de repetir."),
  execucao("bling.produtos.alterar", "Altera campos permitidos de um produto no Bling (PATCH /produtos/{id}).", obj({ id: txt(undefined, 30), corpo: livre }, ["id", "corpo"]), "MEDIUM", "Ler o produto e comparar campo a campo.", "Timeout => desconhecido; ler o produto e comparar antes de repetir."),
  execucao("bling.categorias.criar", "Cria categoria de produto no Bling (POST /categorias/produtos).", obj({ corpo: livre }, ["corpo"]), "MEDIUM", "Listar categorias e localizar a criada.", "Timeout => desconhecido; listar e procurar pelo nome/pai antes de repetir."),
  execucao("bling.produtos.confirmar", "Leitura de confirmação após gravação (parte do executor).", obj({ id: txt(undefined, 30) }, ["id"]), "LOW", "Compara com o esperado.", "Repetir a leitura."),

  interna("conecta.enriquecimento.definir", "Aplica no Conecta.IA o enriquecimento aprovado (camada separada do Bling). Confere conflito com o valor anterior aprovado.",
    obj({ sku, campos: livre }, ["sku", "campos"]), "MEDIUM", "Lê de volta os campos gravados em produto_enriquecimento.", "Conflito => falha registrada sem sobrescrever; refazer a proposta."),
  interna("conecta.publicacao.publicar", "Publica o produto no site se estiver completo (descrição, preço, SKU, imagem principal aprovada).",
    obj({ sku }, ["sku"]), "HIGH", "Lê o produto e confere publicado=true.", "Despublicar (publicado=false) é reversão operacional; produto incompleto nunca publica."),

  // ------------------------------------------------------------------ Engenharia de produtos (contratos; dependem de fontes externas ainda não ligadas)
  leitura("engenharia.taxonomia.buscar", "engenharia", "Busca nós da taxonomia de autopeças por texto.", obj({ texto: txt(undefined, 80) }, ["texto"]), lista(livre, 15), "Leitura de taxonomia_nos.", { estado: "ativa" }),
  leitura("engenharia.duplicidade.detectar", "engenharia", "Detecta CANDIDATOS a duplicidade por SKU, GTIN ou nome (sem acento e sem pontuação) no espelho. Sem filtro, varre a loja. Não mescla nada.", obj({ sku, gtin: txt(undefined, 20), nome: txt(undefined, 200) }), livre, "Comparação no espelho; variações do mesmo pai não contam.", { estado: "ativa" }),
  leitura("engenharia.compartilhamento.sugerir", "engenharia", "A partir de um código OEM já aprovado, sugere OUTROS veículos que usam o mesmo motor (ex.: montadoras parceiras). Resultado é HIPÓTESE: compartilhar motor não prova que a peça serve; nunca vira anúncio sem prova para a versão.", obj({ codigo: txt(undefined, 60), incluir_a_confirmar: { type: "boolean" } }, ["codigo"]), livre, "Só aplicações aprovadas como ponto de partida; cada candidata exige prova.", { estado: "ativa" }),
  leitura("engenharia.loja.pecas_do_veiculo", "engenharia", "Peças da loja (publicadas, com estoque) com aplicação aprovada para uma versão de veículo, opcionalmente num ano.", obj({ versao_id: uuid, ano: { type: "integer", minimum: 1950, maximum: 2100 } }, ["versao_id"]), livre, "Cruza grafo do veículo com produto_pecas_ref aprovado.", { estado: "ativa" }),
  leitura("engenharia.intercambio.listar", "engenharia", "Lista a MESMA peça fabricada por outras marcas (relação direta, sem transitividade), com fabricante, papel (sistemista, fabricante de motor...), tipo de relação e evidência. Referência cruzada não prova equivalência.", obj({ codigo: txt(undefined, 60), incluir_a_confirmar: { type: "boolean" } }, ["codigo"]), livre, "ref_cruzada com fonte; só aprovado por padrão.", { estado: "ativa" }),
  leitura("engenharia.bula.verificar", "engenharia", "Bula técnica do SKU: medidas exigidas para a família (mm, espessura, altura...) que estão aprovadas ou faltando, e contraindicações de montagem aprovadas. Sem a bula completa a peça não é 'pronta'; medida nunca é inventada.", obj({ sku }, ["sku"]), livre, "Medida aprovada exige fonte e valor.", { estado: "ativa" }),
  leitura("engenharia.loja.filtros", "engenharia", "Filtros da vitrine calculados do dado aprovado: categorias com ícone, montadoras e fabricantes dos produtos publicados com estoque.", obj({}), livre, "Só publicado, com estoque e ligação aprovada.", { estado: "ativa" }),
  leitura("engenharia.consulta.interpretar", "engenharia", "Interpreta uma pergunta de cliente em linguagem natural (ex.: 'qual é o motor para o HR 2011?'): reconhece veículo, ano e peça SÓ pelo cadastro, e devolve o que falta perguntar. Não inventa modelo nem peça; ambiguidade vira pergunta.", obj({ texto: txt(undefined, 300) }, ["texto"]), livre, "Vocabulário vem do banco; termos desconhecidos ficam em nao_reconhecido.", { estado: "ativa" }),
  leitura("engenharia.loja.condicoes", "engenharia", "Condições comerciais APROVADAS da loja (formas de pagamento e regra de entrega por CEP). Sem cadastro devolve lacunas e pede o CEP; nunca promete prazo, frete ou pagamento que a loja não cadastrou.", obj({ cep: txt(undefined, 9) }), livre, "Só o que o lojista cadastrou e aprovou.", { estado: "ativa" }),
  leitura("engenharia.oem.pesquisar", "engenharia", "Pesquisa código OEM em fontes autorizadas.", obj({ sku, texto: txt() }), lista(livre, 20), "Cada resultado traz fonte e data.", { estado: "planejada" }),
  leitura("engenharia.cruzados.verificar", "engenharia", "Lista os códigos cruzados DIRETOS das peças ligadas ao SKU, com status e evidência. Sem transitividade; ausência de relação = não confirmado.", obj({ sku }, ["sku"]), livre, "Relação técnica com fonte.", { estado: "ativa" }),
  leitura("engenharia.fabricantes.identificar", "engenharia", "Identifica e classifica o fabricante da peça.", obj({ sku }, ["sku"]), livre, "Fonte registrada.", { estado: "planejada" }),
  leitura("engenharia.aplicacoes.validar", "engenharia", "Valida aplicações do SKU por VERSÃO do veículo no mercado BR, opcionalmente para um ano. Devolve confirmada ou nao_confirmada, nunca incompatível.", obj({ sku, ano: { type: "integer", minimum: 1950, maximum: 2100 } }, ["sku"]), livre, "Fonte e verificação registradas.", { estado: "ativa" }),
  proposta("engenharia.genealogia.organizar", "engenharia", "Propõe relações da genealogia automotiva (montadora → … → componente) com procedência.", obj({ sku, relacoes: lista(livre, 100) }, ["sku", "relacoes"]), livre, "MEDIUM", { estado: "planejada" }),
  proposta("engenharia.taxonomia.construir", "engenharia", "Propõe novos nós/relacionamentos da taxonomia, sempre com fonte.", obj({ nos: lista(livre, 200) }, ["nos"]), livre, "MEDIUM", { estado: "planejada" }),
  proposta("engenharia.classificacao.propor", "engenharia", "Propõe a classificação de um produto na taxonomia.", obj({ sku, no_id: uuid, fonte: txt(undefined, 500) }, ["sku", "fonte"]), livre, "LOW", { estado: "planejada" }),

  // ------------------------------------------------------------------ Desenvolvimento (só contrato; nada altera produção)
  def({ id: "dev.docs.consultar", grupo: "desenvolvimento", descricao: "Consulta a documentação técnica versionada do projeto.", entrada: obj({ texto: txt() }, ["texto"]), saida: livre, permissao: "leitura", risco: "LOW", verificacao: "Fonte e versão.", recuperacao: "Repetir." }),
  def({ id: "dev.github.consultar", grupo: "desenvolvimento", descricao: "Consulta o GitHub com escopo limitado (somente leitura).", entrada: obj({ caminho: txt() }, ["caminho"]), saida: livre, permissao: "leitura", risco: "LOW", verificacao: "Commit/versão.", recuperacao: "Repetir." }),
  def({ id: "dev.codigo.preparar", grupo: "desenvolvimento", descricao: "Prepara alteração de código como proposta (não aplica).", entrada: obj({ descricao: txt(undefined, 2000) }, ["descricao"]), saida: livre, permissao: "propor", risco: "HIGH", exigeAprovacao: true, verificacao: "Revisão humana do diff.", recuperacao: "Descartar a proposta.", idempotencia: "chave" }),
  def({ id: "dev.pr.propor", grupo: "desenvolvimento", descricao: "Propõe um pull request de desenvolvimento (rascunho).", entrada: obj({ titulo: txt() }, ["titulo"]), saida: livre, permissao: "propor", risco: "HIGH", exigeAprovacao: true, verificacao: "Revisão humana.", recuperacao: "Fechar o PR.", idempotencia: "chave" }),
  def({ id: "dev.testes.executar", grupo: "desenvolvimento", descricao: "Executa testes em ambiente isolado. Nunca em produção.", entrada: obj({ suite: txt() }, ["suite"]), saida: livre, permissao: "simular", risco: "MEDIUM", exigeAprovacao: true, verificacao: "Relatório do teste.", recuperacao: "Repetir no ambiente isolado." }),
];

const POR_ID = new Map(FERRAMENTAS_CONECTOR.map((f) => [f.id, f]));
export const buscarDefinicao = (id: string) => POR_ID.get(id);

/** O que cada origem pode ENXERGAR (o Policy Engine ainda decide a chamada). Planejadas aparecem só no catálogo, nunca na lista do LLM. */
export function ferramentasVisiveis(origem: "chat" | "gateway_mcp", escopos: readonly Permissao[] = []): DefinicaoFerramenta[] {
  return FERRAMENTAS_CONECTOR.filter((f) => f.estado === "ativa" && f.permissao !== "executar" &&
    (origem === "chat" ? f.exposicao.chat : f.exposicao.mcp && escopos.includes(f.permissao)));
}

// Nomes para LLM: Claude/OpenAI aceitam [A-Za-z0-9_-]; trocamos "." por "__" e voltamos na chamada.
export const nomeParaLlm = (id: string) => id.replaceAll(".", "__");
export const idDoNomeLlm = (nome: string) => nome.replaceAll("__", ".");
