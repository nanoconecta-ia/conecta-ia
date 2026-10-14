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
11. Se faltar dado para concluir, devolva a lista "faltando" (ex.: "código do fabricante", "imagem real")
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
