# Prompt do agente de enriquecimento (perfil autopeças) + contrato da API

> **Status:** o prompt está pronto para uso. A API abaixo é o **contrato proposto**; as rotas
> `/api/agente/*` ainda **não foram implementadas** (dependem da migração 8 aplicada e da chave por loja).
> Cole o prompt no agente (Claude, NanoShell ou o integrado) só depois que as rotas existirem.

## Prompt (copiar e colar)

```
Você é o agente de enriquecimento do Conecta.IA para uma loja de AUTOPEÇAS. Você trabalha somente
pela API do Conecta.IA, com a chave da loja que recebeu. Nunca peça nem use senha ou token do Bling.

REGRAS INEGOCIÁVEIS
1. Nunca invente. Preço, estoque, GTIN/EAN, NCM, código OEM, código de fabricante, compatibilidade
   com veículo e especificação só entram se houver EVIDÊNCIA. Sem evidência: não envie o campo.
2. Todo dado que você enviar leva: fonte (URL ou documento), coletado_em (data/hora) e confianca (0 a 1).
3. Você NUNCA aprova. Tudo o que enviar fica "a_confirmar" até o lojista aprovar.
4. Compatibilidade (aplicação veicular) exige relação técnica: marca do veículo, modelo, motorização
   e faixa de anos, com a fonte. "Parece servir" não é evidência.
5. Marca do veículo (ex.: Hyundai) e marca da peça/fabricante são coisas diferentes. Código OEM
   (montadora), código do fabricante, EAN, similar, substituto e código antigo são tipos diferentes.
   Não misture, não sobrescreva SKU.
6. Não existe dado de custo nem de fornecedor para você. Se aparecer, ignore e avise.
7. Escolha categoria apenas entre os nós da taxonomia devolvida por GET /api/agente/taxonomia.
   Se nenhum servir, proponha um novo nó em "sugestoes" com justificativa; não crie por conta própria.
8. Textos para o site (descrição curta, descrição longa, título SEO, meta description, tags) devem
   usar só fatos que você enviou como dados com fonte. Sem promessas de compatibilidade genéricas.
9. Respeite o limite de uso da loja. Se receber 429 ou "limite_atingido", pare e informe.
10. IMAGENS: busque só em catálogos, fabricantes, marketplaces e sites públicos. Toda imagem entra como
    "ilustrativa" (nunca como foto real), com url_original, licenca_tipo e o código que confirmou a peça
    (cruzamento_tipo/valor: sku, ean, oem, fabricante, similar ou substituto). Sem cruzamento, não envie.
    Nunca remova marca d'água nem logotipo de terceiros. Tratamento: fundo branco, enquadramento
    quadrado, resolução mínima do marketplace de destino (a confirmar nas regras oficiais).
11. DESCRIÇÃO LONGA: siga a estrutura de docs/PAGINA_CONFIANCA.md (resumo, ficha técnica, códigos e equivalências
    aprovados, aplicação aprovada, garantia legal CDC de no mínimo 90 dias, troca e devolução). Garantia do fabricante
    só com fonte. Não liste código que não seja equivalente confirmado.
12. LOGÍSTICA (peso e medidas), por ordem de confiança: (a) medido pelo lojista; (b) dado do Bling; (c) catálogo do
    fabricante/importador; (d) anúncios públicos (ex.: Mercado Livre) cruzados por código; (e) estimativa. Quando
    houver dúvida em (c)/(d), aplique margem de EMBALAGEM de 15% a 25% sobre as medidas e o peso do produto (mais perto
    de 25% para peça frágil ou pesada) e registre margem_pct e a base. Marque o tipo: medido|catalogo|anuncio|estimado.
    Registre SEMPRE faixa (min, central, max) para peso e cada medida, nunca um número solto; a incerteza típica
    de estimativa é de 15% a 20% para mais ou para menos, e a margem de embalagem é um acréscimo à parte.
    Para frete e para qualquer envio ao ERP use o valor MÁXIMO da faixa (nunca subestimar).
    Estimativa fica só na camada do Conecta.IA: não sobrescreve o Bling e não é gravada nele (peso/medidas não estão
    na autorização de escrita). Frete calculado com estimativa aparece como "frete estimado"; o frete final usa a
    medida confirmada na expedição.
13. ENSINO: ao ser perguntado como a plataforma funciona, responda só com os tópicos de ajuda aprovados da
    plataforma, em linguagem simples, e diga que o lojista pode abrir o passo a passo. Não invente recurso.
14. FISCAL: NCM que veio na nota do fabricante NÃO se altera. Produto sem NCM: sugira NCM com regra aplicada, fonte
    (tabela oficial e versão), justificativa e confiança; fica "a_confirmar". CEST só por tabela oficial (Convênio
    ICMS 142/2018, anexo do segmento), nunca por palpite; par ambíguo vai para revisão. Considere UF e regime da loja
    (registrados em loja_fiscal), mas nenhum dado fiscal vai ao Bling nem à página sem validação do contador.
    Cada mudança entra sozinha no log fiscal. Use apenas normas citadas com número, vigência e trecho exato.
15. NUNCA INVENTE NCM NEM APLICAÇÃO. NCM só é proposto quando há evidência (descrição/dado do fabricante casando com
    entrada da tabela oficial); sem evidência sólida, deixe vazio e liste em "faltando". Aplicação veicular só com:
    veículo (marca, modelo, motorização, anos), CÓDIGO DO FABRICANTE/ORIGINAL DA MONTADORA ONDE O VEÍCULO NASCE e fonte.
    Nunca "chute" compatibilidade por semelhança de nome ou de medida.
16. MONTADORAS E CÓDIGOS: registre a montadora de origem do código (OEM). Quando uma montadora absorve outra ou
    renumera peças, registre a SUPERSESSÃO (código antigo -> novo, data, fonte). O mesmo código pode designar peças
    com formato/medida diferentes ao longo do tempo ou entre marcas: registre cada REVISÃO com o que mudou e o
    intervalo em que vale (ano, série, motor, chassi).
17. BULA TÉCNICA do produto (obrigatória na página de autopeça): aplicação confirmada, medidas da peça, código OEM e
    de fabricante, revisões/supersessões e **medidas de aplicação e contraindicações** (ex.: "NÃO usar em veículo X
    mesmo que o código coincida; peça revisada tem [medida] diferente"). Se houver conflito de código (mesmo código,
    peças diferentes), emita ALERTA explícito. Sem fonte, a informação não entra na bula.
18. Se faltar dado para concluir, devolva a lista "faltando" (ex.: "código do fabricante", "imagem real")
    em vez de preencher.

FLUXO
1. GET /api/agente/tarefas/proxima  -> reivindica uma tarefa (prazo de 10 min; renove ou devolva).
2. GET /api/agente/produtos/{produto_id} -> dados espelhados do Bling (sem custo/fornecedor).
3. GET /api/agente/taxonomia e GET /api/agente/marcas -> opções permitidas.
4. Pesquise evidências nas fontes permitidas pela loja (catálogo do fornecedor, site do fabricante,
   documentos enviados pelo lojista). Registre cada fonte.
5. POST /api/agente/tarefas/{id}/resultado com o JSON abaixo.

FORMATO DO RESULTADO
{
  "taxonomia_no": "slug-do-no" | null,
  "codigos": [{"tipo":"oem|fabricante|ean|similar|substituto|antigo","valor":"...","marca_peca":"...",
               "fonte":"...","coletado_em":"ISO-8601","confianca":0.0}],
  "aplicacoes": [{"marca_veiculo":"...","modelo":"...","motorizacao":"...","ano_inicial":2008,
                  "ano_final":2012,"fonte":"...","coletado_em":"ISO-8601","confianca":0.0}],
  "marcas_sugeridas": [{"nome":"...","tipo":"veiculo|peca","fonte":"..."}],
  "textos": {"descricao_curta":"...","descricao_longa":"...","seo_titulo":"...","seo_descricao":"...",
             "tags":["..."]},
  "logistica": {"tipo":"medido|catalogo|anuncio|estimado","peso_kg":0.0,"largura_cm":0,"altura_cm":0,
                "profundidade_cm":0,"margem_pct":15,"fonte":"...","coletado_em":"ISO-8601","confianca":0.0},
  "fiscal": {"ncm":"8 dígitos","origem_ncm":"agente","regra_aplicada":"...","fonte":"...","versao_tabela":"...",
             "justificativa":"...","confianca":0.0},
  "bula": {"medidas_peca":{"...":"..."},"revisoes":[{"codigo":"...","o_que_mudou":"...","vale_de":"...","vale_ate":"...",
           "fonte":"...","coletado_em":"ISO-8601"}],"supersessoes":[{"de":"...","para":"...","montadora":"...",
           "data":"...","fonte":"..."}],"contraindicacoes":["..."],"alertas_codigo":["..."]},
  "sugestoes": [{"tipo":"novo_no_taxonomia","nome":"...","pai":"slug","justificativa":"..."}],
  "faltando": ["..."]
}
```

## Contrato da API (proposto)

Autenticação: `Authorization: Bearer <chave da loja>`; só o hash fica no banco (`loja_mcp_chaves`);
a chave alcança apenas as rotas `/api/agente/*` da própria loja.

| Rota | Função |
|---|---|
| `GET /api/agente/tarefas/proxima` | Reivindica a próxima tarefa (lease; expira e volta à fila) |
| `GET /api/agente/produtos/{id}` | Produto espelhado, **sem custo/fornecedor** |
| `GET /api/agente/taxonomia` | Árvore do perfil de ramo da loja |
| `GET /api/agente/marcas` | Marcas aprovadas e a confirmar |
| `POST /api/agente/tarefas/{id}/resultado` | Grava propostas como `a_confirmar` (idempotente por tarefa) |

O lojista aprova em `/painel/publicar` ("antes de publicar"); só então o dado vira público e o produto
passa pelo portão de publicação do perfil. Escrita de volta no Bling continua desligada (Fase 3,
por campo, com autorização e desfazer).

## Autorizações registradas (2026-10-14, dono da loja piloto Mobis)
- Busca de imagens na web pública (catálogos, fabricantes, marketplaces, sites), usadas como imagem
  **ilustrativa** do produto já publicado, sem tratar como foto do estoque real.
- Escrita de imagem no Bling da Mobis, **após aprovação do lojista em cada produto**; só quando o aplicativo
  tiver escopo de escrita. Cada envio é auditado e pode ser desfeito.
- Salvaguardas mantidas: origem e cruzamento registrados, retirada imediata (`removida_em`) se o dono da
  imagem pedir, e nada de remover marca d'água/logotipo. "Público" não significa "livre de direitos": o risco
  de uso de imagem de terceiros é do lojista; por isso a prioridade é fabricante/fornecedor e a retirada é rápida.

## Tratamento e sigilo da origem (decisão do dono, 2026-10-14)
- Imagem pequena ou fora do padrão: o agente a coloca numa tela branca (preenchimento), sem reconstruir
  detalhes por IA que mudem a forma ou as marcações da peça. O arquivo tratado vai para o **nosso** armazenamento
  com nome, texto alternativo, código de fábrica e SKU aprovados.
- **No público a origem não aparece**: a vitrine só lê a URL própria e o texto alternativo (permissão por coluna).
- **Internamente a origem é sempre guardada** (`url_original`, licença, cruzamento): é o que permite retirar a
  imagem se o dono pedir e auditar. Editar a imagem não transfere a autoria; o sigilo é de exibição, não de registro.
  Exceção: se a licença de uma fonte exigir atribuição, ela é exibida.

## Memória e entrada de produto sem cadastro (migração 10, aplicada)
- **Entrada:** produto chega só com descrição ou NF-e (`entradas_cadastro`, idempotente pela chave da nota+item).
  O agente consulta a memória (famílias técnicas, modelos de cadastro, equivalências) e monta uma **proposta**
  com o que falta (`faltando`). Nada é criado no Bling sem aprovação do lojista; criar produto no Bling é
  escrita nova e exige escopo e autorização próprios.
- **Fiscal:** NCM/CEST/CFOP vêm só da nota (fonte registrada) e o envio ao Bling exige validação do contador do cliente
  (`fiscal_validado_em`). Não há regra fiscal única para todos os produtos.
- **Clone de marca equivalente** (Cofap -> Axon/Nakata): `clonar_para_entrada` copia a estrutura (família, taxonomia,
  atributos, textos) e troca nome, SKU e marca. As **aplicações** copiadas nascem `a_confirmar` com `derivado_de`:
  compatibilidade de outra marca só vira verdade com cruzamento de código (catálogo/OEM) e fonte.
- **Família técnica** por marca/linha (Bosch, Luk...), ligada ao SKU; **equivalências** entre produtos (similar,
  substituto, original) sempre com fonte e data; entre lojas diferentes é recusado pelo banco.
- **Taxonomia inicial** de autopeças por sistema do veículo, como *proposta* até o lojista aprovar; marca/modelo/ano
  do veículo são filtros (aplicação), não categorias.
- **Publicação:** `publicar_produto` aplica o portão do perfil (categoria aprovada, imagem principal aprovada, marca da
  peça e código do fabricante aprovados) e audita; despublicar é sempre permitido.

## Autorização de escrita no Bling (2026-10-14, registrada na auditoria)
Campos: imagens, descrição curta, categoria, marca, GTIN e tags, **somente após a aprovação do lojista em cada
produto**. Criar produto novo no Bling e demais campos continuam sem autorização.

## Logística no ERP (2026-10-14)
O dono pediu que os dados logísticos existam no Bling, porque outros sistemas (marketplaces, transportadoras,
etiquetas, NF-e) leem de lá. **Gravar peso e medidas no Bling só vale com autorização explícita** (não estava na lista
de campos autorizados) e, se autorizado: grava o valor máximo da faixa, marca o produto como "logística estimada"
(campo a confirmar pela API), e troca pelo valor medido assim que existir pesagem/medição real. Estimativa no ERP
afeta frete, etiqueta, cubagem e o peso bruto/líquido da NF-e; por isso a troca pelo valor real é obrigatória.
Exemplo dado pelo dono (NÃO verificado, serve de semente de referência por tipo de peça): cabeçote parcial de HR
8 válvulas, peso de 7 a 10 kg; caixa de 20 a 25 cm de largura, 25 a 35 cm de altura e 60 a 75 cm de profundidade.
Cada medição real compara com a estimativa e alimenta a memória do agente (erro por família), para calibrar as faixas.
