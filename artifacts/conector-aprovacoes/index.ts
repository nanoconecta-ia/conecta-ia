// GERADO por scripts/gerar-autocontido.mjs. Não editar. Nenhuma publicação autorizada.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const __sdk = { createClient };

// ---------- supabase/functions/_shared/conector/registro.ts ----------
const __m3 = (() => {
const obj = (properties, required = [])=>({
        type: "object",
        properties,
        required,
        additionalProperties: false
    });
const txt = (descricao, maxLength = 200)=>({
        type: "string",
        maxLength,
        description: descricao
    });
const uuid = {
    type: "string",
    pattern: "^[0-9a-fA-F-]{36}$"
};
const sku = {
    type: "string",
    minLength: 1,
    maxLength: 80,
    description: "SKU/código do produto no Bling"
};
const livre = {
    type: "object"
};
const lista = (items, maxItems = 50)=>({
        type: "array",
        items,
        maxItems
    });
const fonte = obj({
    url: txt("endereço da fonte", 500),
    documento: txt("nome do documento", 200),
    versao: txt("versão da fonte", 60),
    consultado_em: txt("data (ISO)", 40)
});
const CAMPOS_BLING_PERMITIDOS = [
    "nome",
    "descricaoCurta",
    "descricaoComplementar",
    "marca",
    "gtin",
    "pesoLiquido",
    "pesoBruto",
    "dimensoes",
    "categoria"
];
const CAMPOS_BLING_PROIBIDOS = [
    "tributacao",
    "ncm",
    "cest",
    "fornecedor",
    "fornecedores",
    "precoCusto",
    "precoCompra",
    "preco",
    "estoque",
    "codigo",
    "situacao",
    "formato"
];
const def = (d)=>({
        exposicao: {
            chat: false,
            mcp: false
        },
        escreveExterno: false,
        simulacao: false,
        exigeAprovacao: false,
        idempotencia: "nao_se_aplica",
        estado: "planejada",
        ...d
    });
const leitura = (id, grupo, descricao, entrada, saida, verificacao, extra = {})=>def({
        id,
        grupo,
        descricao,
        entrada,
        saida,
        permissao: "leitura",
        risco: "LOW",
        verificacao,
        recuperacao: "Repetir a leitura; é segura.",
        exposicao: {
            chat: true,
            mcp: true
        },
        ...extra
    });
const proposta = (id, grupo, descricao, entrada, saida, risco, extra = {})=>def({
        id,
        grupo,
        descricao,
        entrada,
        saida,
        permissao: "propor",
        risco,
        verificacao: "A proposta nasce em rascunho e só vale depois do envio e da aprovação humana da versão exata.",
        recuperacao: "Descartar o rascunho ou criar nova versão; nada externo foi alterado.",
        idempotencia: "chave",
        exposicao: {
            chat: true,
            mcp: true
        },
        ...extra
    });
const interna = (id, descricao, entrada, risco, verificacao, recuperacao)=>def({
        id,
        grupo: "conecta",
        descricao,
        entrada,
        saida: livre,
        permissao: "executar",
        risco,
        simulacao: true,
        exigeAprovacao: true,
        idempotencia: "chave",
        verificacao,
        recuperacao,
        estado: "ativa",
        escreveExterno: false
    });
const execucao = (id, descricao, entrada, risco, verificacao, recuperacao)=>def({
        id,
        grupo: "bling",
        descricao,
        entrada,
        saida: livre,
        permissao: "executar",
        risco,
        simulacao: true,
        exigeAprovacao: true,
        idempotencia: "chave",
        verificacao,
        recuperacao,
        estado: "desligada",
        escreveExterno: true
    });
const PRODUTO_ALVO = obj({
    sku,
    produto_id: uuid
});
const itemProposta = obj({
    produto_id: uuid,
    sku,
    operacao: txt("id da ferramenta que será executada após aprovação", 80),
    alvo: txt("identificador no ERP/site", 100),
    campos: lista(txt(undefined, 60), 30),
    antes: livre,
    depois: livre,
    fontes: {
        ...lista(fonte, 10),
        minItems: 1
    },
    validacoes: lista(txt(undefined, 200), 20),
    risco: {
        type: "string",
        enum: [
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL"
        ]
    }
}, [
    "operacao",
    "depois",
    "fontes"
]);
const FERRAMENTAS_CONECTOR = [
    leitura("conecta.catalogo.resumo", "conecta", "Totais da loja: produtos espelhados, publicados e itens aguardando aprovação.", obj({}), obj({
        produtos: {
            type: "integer"
        },
        publicados: {
            type: "integer"
        },
        aguardando_aprovacao: {
            type: "integer"
        }
    }), "Contagem direta no espelho.", {
        estado: "ativa"
    }),
    leitura("conecta.catalogo.listar", "conecta", "Lista produtos da loja (nome, SKU, preço, estoque, publicado).", obj({
        apenas_nao_publicados: {
            type: "boolean"
        },
        busca: txt("trecho do nome ou SKU", 80),
        limite: {
            type: "integer",
            minimum: 1,
            maximum: 20
        }
    }), lista(livre, 20), "Leitura do espelho.", {
        estado: "ativa"
    }),
    leitura("conecta.catalogo.ver", "conecta", "Detalhes de um produto pelo SKU e o que falta para publicar.", obj({
        sku
    }, [
        "sku"
    ]), livre, "Leitura do espelho.", {
        estado: "ativa"
    }),
    leitura("engenharia.oem.buscar", "engenharia", "Busca direta por código OEM: DNA da peça (classe, fabricante, fonte), aplicações por VERSÃO do veículo, modelo do motor, referências cruzadas diretas e SKUs da loja. Só dado aprovado, salvo pedido.", obj({
        codigo: txt("código OEM como aparece (hífen, espaço e caixa são ignorados)", 40),
        incluir_a_confirmar: {
            type: "boolean"
        }
    }, [
        "codigo"
    ]), livre, "Leitura do catálogo técnico global; nada é deduzido quando não há registro.", {
        estado: "ativa"
    }),
    leitura("conecta.enriquecimento.pendentes", "conecta", "Itens de enriquecimento aguardando aprovação.", obj({
        limite: {
            type: "integer",
            minimum: 1,
            maximum: 20
        }
    }), lista(livre, 20), "Leitura da fila.", {
        estado: "ativa"
    }),
    leitura("conecta.travas.consultar", "conecta", "Estado operacional (trava) de produtos: bloqueado, liberado, pendente, em execução, sincronizado, divergente.", obj({
        produto_id: uuid,
        sku
    }), livre, "Leitura de produto_travas.", {
        estado: "ativa"
    }),
    leitura("conecta.proposta.estado", "conecta", "Estado de uma proposta (versão, hash, aprovação, itens, operações).", obj({
        proposta_id: uuid
    }, [
        "proposta_id"
    ]), livre, "Leitura de agente_propostas.", {
        estado: "ativa"
    }),
    leitura("conecta.publicacao.preparar", "conecta", "Verifica se um produto está pronto para a página pública e lista o que falta (sem publicar).", PRODUTO_ALVO, obj({
        pronto: {
            type: "boolean"
        },
        faltando: lista(txt(), 30)
    }), "Cálculo sobre dados aprovados do espelho.", {
        estado: "ativa"
    }),
    proposta("conecta.proposta.criar", "conecta", "Cria uma PROPOSTA versionada (antes/depois, fontes, validações) para o lojista aprovar. Não altera nada: só a aprovação humana libera execução.", obj({
        titulo: txt("título curto", 160),
        resumo: txt(undefined, 1000),
        lote: {
            type: "boolean"
        },
        itens: {
            ...lista(itemProposta, 200),
            minItems: 1
        }
    }, [
        "titulo",
        "itens"
    ]), obj({
        proposta_id: uuid,
        versao: {
            type: "integer"
        },
        hash: txt(),
        risco: txt()
    }), "MEDIUM", {
        estado: "ativa",
        simulacao: true
    }),
    proposta("conecta.enriquecimento.propor", "conecta", "Propõe um valor de enriquecimento para um campo do produto (entra como a_confirmar, com fonte).", obj({
        sku,
        campo: txt(undefined, 40),
        valor: txt(undefined, 4000),
        fonte: txt("URL ou documento", 500),
        confianca: {
            type: "number",
            minimum: 0,
            maximum: 1
        }
    }, [
        "sku",
        "campo",
        "valor",
        "fonte"
    ]), livre, "LOW", {
        estado: "ativa"
    }),
    proposta("conecta.codigo.propor", "engenharia", "Propõe um código de referência (OEM/fabricante/cruzado) com fonte.", obj({
        sku,
        tipo: txt(undefined, 30),
        valor: txt(undefined, 80),
        fonte: txt(undefined, 500),
        confianca: {
            type: "number",
            minimum: 0,
            maximum: 1
        }
    }, [
        "sku",
        "tipo",
        "valor",
        "fonte"
    ]), livre, "LOW", {
        estado: "ativa"
    }),
    proposta("conecta.aplicacao.propor", "engenharia", "Propõe aplicação veicular (modelo, motor, anos) com fonte.", obj({
        sku,
        modelo: txt(),
        motorizacao: txt(),
        ano_inicial: {
            type: "integer"
        },
        ano_final: {
            type: "integer"
        },
        fonte: txt(undefined, 500),
        confianca: {
            type: "number",
            minimum: 0,
            maximum: 1
        }
    }, [
        "sku",
        "modelo",
        "fonte"
    ]), livre, "LOW", {
        estado: "ativa"
    }),
    proposta("conecta.imagem.propor", "conecta", "Propõe uma imagem candidata para o produto (pendente de aprovação; direitos ainda não confirmados).", obj({
        sku,
        url: txt(undefined, 1000),
        origem: txt(),
        pagina: txt(undefined, 1000)
    }, [
        "sku",
        "url"
    ]), livre, "LOW", {
        estado: "ativa"
    }),
    leitura("conecta.imagem.buscar_web", "conecta", "Busca imagens candidatas na web (não salva nada).", obj({
        consulta: txt(undefined, 200)
    }, [
        "consulta"
    ]), livre, "Resultado é dado a conferir.", {
        estado: "ativa",
        exposicao: {
            chat: true,
            mcp: false
        }
    }),
    leitura("conecta.plugins.listar", "conecta", "Plugins ativos da loja e suas capacidades.", obj({}), lista(livre, 50), "Leitura.", {
        estado: "ativa",
        exposicao: {
            chat: true,
            mcp: false
        }
    }),
    def({
        id: "conecta.plugins.chamar",
        grupo: "conecta",
        descricao: "Chama um plugin ativo da loja (risco LOW, capacidade declarada). O retorno é dado a conferir.",
        entrada: obj({
            plugin: txt(),
            capacidade: txt(),
            entrada: livre
        }, [
            "plugin",
            "capacidade"
        ]),
        saida: livre,
        permissao: "leitura",
        risco: "LOW",
        verificacao: "Retorno tratado como dado não confirmado.",
        recuperacao: "Repetir é seguro (só leitura).",
        estado: "ativa",
        exposicao: {
            chat: true,
            mcp: false
        }
    }),
    leitura("conhecimento.buscar", "conecta", "Recupera conhecimento técnico com fonte e versão (documentação, validado ou hipótese), sem misturar os tipos.", obj({
        texto: txt(undefined, 200),
        tipo: {
            type: "string",
            enum: [
                "documentacao",
                "validado",
                "hipotese"
            ]
        },
        limite: {
            type: "integer",
            minimum: 1,
            maximum: 10
        }
    }, [
        "texto"
    ]), lista(livre, 10), "Cada item traz tipo, fonte, versão e status.", {
        estado: "ativa"
    }),
    def({
        id: "conecta.banners.gerenciar",
        grupo: "conecta",
        descricao: "Prepara banner promocional ou de fabricante (prévia). Geração de imagem é capacidade independente e ainda não configurada.",
        entrada: obj({
            tipo: {
                type: "string",
                enum: [
                    "fabricante",
                    "promocional"
                ]
            },
            produto_id: uuid
        }, [
            "tipo"
        ]),
        saida: livre,
        permissao: "propor",
        risco: "LOW",
        verificacao: "Prévia revisada pelo lojista.",
        recuperacao: "Descartar a prévia.",
        idempotencia: "chave",
        exposicao: {
            chat: true,
            mcp: true
        }
    }),
    def({
        id: "conecta.fabricante.pagina_preparar",
        grupo: "conecta",
        descricao: "Prepara a página de um fabricante com dados aprovados.",
        entrada: obj({
            fabricante: txt()
        }, [
            "fabricante"
        ]),
        saida: livre,
        permissao: "propor",
        risco: "LOW",
        verificacao: "Prévia revisada.",
        recuperacao: "Descartar.",
        idempotencia: "chave",
        exposicao: {
            chat: true,
            mcp: true
        }
    }),
    def({
        id: "conecta.seo.verificar",
        grupo: "conecta",
        descricao: "Executa verificações de SEO da página de um produto (título, descrição, dados estruturados, imagem).",
        entrada: PRODUTO_ALVO,
        saida: livre,
        permissao: "leitura",
        risco: "LOW",
        verificacao: "Regras mensuráveis; o resto marcado verificação manual.",
        recuperacao: "Repetir.",
        exposicao: {
            chat: true,
            mcp: true
        }
    }),
    leitura("bling.status.consultar", "bling", "Situação da conexão com o Bling e da última sincronização.", obj({}), livre, "Leitura de bling_conexoes.", {
        estado: "ativa"
    }),
    leitura("bling.produtos.consultar", "bling", "Consulta um produto no Bling pelo SKU (leitura em tempo real, sem custo nem fornecedor).", obj({
        sku
    }, [
        "sku"
    ]), livre, "Resposta do Bling filtrada por lista de campos permitidos.", {
        estado: "ativa"
    }),
    leitura("bling.categorias.consultar", "bling", "Lista as categorias de produto do Bling.", obj({
        busca: txt(undefined, 80)
    }), lista(livre, 100), "Resposta do Bling.", {
        estado: "ativa"
    }),
    leitura("bling.estoque.consultar", "bling", "Saldo de estoque de um produto no Bling.", obj({
        sku
    }, [
        "sku"
    ]), livre, "Resposta do Bling.", {
        estado: "planejada"
    }),
    leitura("bling.precos.consultar", "bling", "Preço atual de um produto no Bling (sem preço de compra/custo).", obj({
        sku
    }, [
        "sku"
    ]), livre, "Resposta do Bling.", {
        estado: "planejada"
    }),
    proposta("bling.produtos.preparar_cadastro", "bling", "Prepara (sem gravar) o cadastro de um produto novo no Bling: confere duplicidade por SKU/GTIN e monta a proposta.", obj({
        rascunho: livre,
        fontes: {
            ...lista(fonte, 10),
            minItems: 1
        }
    }, [
        "rascunho",
        "fontes"
    ]), livre, "MEDIUM", {
        estado: "planejada",
        simulacao: true
    }),
    proposta("bling.produtos.preparar_atualizacao", "bling", "Prepara (sem gravar) a alteração de campos permitidos de um produto: lê o Bling agora, monta antes/depois e cria a proposta.", obj({
        sku,
        campos: livre,
        fontes: {
            ...lista(fonte, 10),
            minItems: 1
        }
    }, [
        "sku",
        "campos",
        "fontes"
    ]), livre, "MEDIUM", {
        estado: "ativa",
        simulacao: true
    }),
    proposta("bling.categorias.preparar_alteracao_lote", "bling", "Prepara (sem gravar) a troca da categoria de produtos no Bling a partir das sugestões de categoria JÁ APROVADAS pelo lojista: lê a categoria atual no Bling agora, monta antes/depois e cria a proposta. Só a categoria; só os SKUs informados.", obj({
        skus: {
            ...lista(sku, 50),
            minItems: 1
        },
        escolhas: {
            type: "object",
            description: "SKU -> id da categoria do Bling, para os casos em que o nó tem mais de uma categoria"
        }
    }, [
        "skus"
    ]), livre, "MEDIUM", {
        estado: "ativa",
        simulacao: true,
        exposicao: {
            chat: true,
            mcp: false
        }
    }),
    proposta("bling.categorias.preparar_criacao", "bling", "Prepara (sem gravar) a criação de categoria no Bling, só se o mapeamento da taxonomia a suportar.", obj({
        nome: txt(undefined, 120),
        pai_id: txt(undefined, 30),
        fontes: {
            ...lista(fonte, 10),
            minItems: 1
        }
    }, [
        "nome",
        "fontes"
    ]), livre, "MEDIUM", {
        estado: "planejada",
        simulacao: true
    }),
    execucao("bling.produtos.criar", "Cria produto no Bling (POST /produtos).", obj({
        corpo: livre
    }, [
        "corpo"
    ]), "MEDIUM", "Ler o produto no Bling e comparar com o enviado.", "Timeout => desconhecido; reconciliar por SKU/GTIN antes de repetir."),
    execucao("bling.produtos.alterar", "Altera campos permitidos de um produto no Bling (PATCH /produtos/{id}).", obj({
        id: txt(undefined, 30),
        corpo: livre
    }, [
        "id",
        "corpo"
    ]), "MEDIUM", "Ler o produto e comparar campo a campo.", "Timeout => desconhecido; ler o produto e comparar antes de repetir."),
    execucao("bling.categorias.criar", "Cria categoria de produto no Bling (POST /categorias/produtos).", obj({
        corpo: livre
    }, [
        "corpo"
    ]), "MEDIUM", "Listar categorias e localizar a criada.", "Timeout => desconhecido; listar e procurar pelo nome/pai antes de repetir."),
    execucao("bling.produtos.confirmar", "Leitura de confirmação após gravação (parte do executor).", obj({
        id: txt(undefined, 30)
    }, [
        "id"
    ]), "LOW", "Compara com o esperado.", "Repetir a leitura."),
    interna("conecta.enriquecimento.definir", "Aplica no Conecta.IA o enriquecimento aprovado (camada separada do Bling). Confere conflito com o valor anterior aprovado.", obj({
        sku,
        campos: livre
    }, [
        "sku",
        "campos"
    ]), "MEDIUM", "Lê de volta os campos gravados em produto_enriquecimento.", "Conflito => falha registrada sem sobrescrever; refazer a proposta."),
    interna("conecta.publicacao.publicar", "Publica o produto no site se estiver completo (descrição, preço, SKU, imagem principal aprovada).", obj({
        sku
    }, [
        "sku"
    ]), "HIGH", "Lê o produto e confere publicado=true.", "Despublicar (publicado=false) é reversão operacional; produto incompleto nunca publica."),
    leitura("engenharia.taxonomia.buscar", "engenharia", "Busca nós da taxonomia de autopeças por texto.", obj({
        texto: txt(undefined, 80)
    }, [
        "texto"
    ]), lista(livre, 15), "Leitura de taxonomia_nos.", {
        estado: "ativa"
    }),
    leitura("engenharia.duplicidade.detectar", "engenharia", "Detecta CANDIDATOS a duplicidade por SKU, GTIN ou nome (sem acento e sem pontuação) no espelho. Sem filtro, varre a loja. Não mescla nada.", obj({
        sku,
        gtin: txt(undefined, 20),
        nome: txt(undefined, 200)
    }), livre, "Comparação no espelho; variações do mesmo pai não contam.", {
        estado: "ativa"
    }),
    leitura("engenharia.compartilhamento.sugerir", "engenharia", "A partir de um código OEM já aprovado, sugere OUTROS veículos que usam o mesmo motor (ex.: montadoras parceiras). Resultado é HIPÓTESE: compartilhar motor não prova que a peça serve; nunca vira anúncio sem prova para a versão.", obj({
        codigo: txt(undefined, 60),
        incluir_a_confirmar: {
            type: "boolean"
        }
    }, [
        "codigo"
    ]), livre, "Só aplicações aprovadas como ponto de partida; cada candidata exige prova.", {
        estado: "ativa"
    }),
    leitura("engenharia.loja.pecas_do_veiculo", "engenharia", "Peças da loja (publicadas, com estoque) com aplicação aprovada para uma versão de veículo, opcionalmente num ano.", obj({
        versao_id: uuid,
        ano: {
            type: "integer",
            minimum: 1950,
            maximum: 2100
        }
    }, [
        "versao_id"
    ]), livre, "Cruza grafo do veículo com produto_pecas_ref aprovado.", {
        estado: "ativa"
    }),
    leitura("engenharia.intercambio.listar", "engenharia", "Lista a MESMA peça fabricada por outras marcas (relação direta, sem transitividade), com fabricante, papel (sistemista, fabricante de motor...), tipo de relação e evidência. Referência cruzada não prova equivalência.", obj({
        codigo: txt(undefined, 60),
        incluir_a_confirmar: {
            type: "boolean"
        }
    }, [
        "codigo"
    ]), livre, "ref_cruzada com fonte; só aprovado por padrão.", {
        estado: "ativa"
    }),
    leitura("engenharia.bula.verificar", "engenharia", "Bula técnica do SKU: medidas exigidas para a família (mm, espessura, altura...) que estão aprovadas ou faltando, e contraindicações de montagem aprovadas. Sem a bula completa a peça não é 'pronta'; medida nunca é inventada.", obj({
        sku
    }, [
        "sku"
    ]), livre, "Medida aprovada exige fonte e valor.", {
        estado: "ativa"
    }),
    leitura("engenharia.loja.filtros", "engenharia", "Filtros da vitrine calculados do dado aprovado: categorias com ícone, montadoras e fabricantes dos produtos publicados com estoque.", obj({}), livre, "Só publicado, com estoque e ligação aprovada.", {
        estado: "ativa"
    }),
    leitura("engenharia.consulta.interpretar", "engenharia", "Interpreta uma pergunta de cliente em linguagem natural (ex.: 'qual é o motor para o HR 2011?'): reconhece veículo, ano e peça SÓ pelo cadastro, e devolve o que falta perguntar. Não inventa modelo nem peça; ambiguidade vira pergunta.", obj({
        texto: txt(undefined, 300)
    }, [
        "texto"
    ]), livre, "Vocabulário vem do banco; termos desconhecidos ficam em nao_reconhecido.", {
        estado: "ativa"
    }),
    leitura("engenharia.loja.condicoes", "engenharia", "Condições comerciais APROVADAS da loja (formas de pagamento e regra de entrega por CEP). Sem cadastro devolve lacunas e pede o CEP; nunca promete prazo, frete ou pagamento que a loja não cadastrou.", obj({
        cep: txt(undefined, 9)
    }), livre, "Só o que o lojista cadastrou e aprovou.", {
        estado: "ativa"
    }),
    leitura("engenharia.oem.pesquisar", "engenharia", "Pesquisa código OEM em fontes autorizadas.", obj({
        sku,
        texto: txt()
    }), lista(livre, 20), "Cada resultado traz fonte e data.", {
        estado: "planejada"
    }),
    leitura("engenharia.cruzados.verificar", "engenharia", "Lista os códigos cruzados DIRETOS das peças ligadas ao SKU, com status e evidência. Sem transitividade; ausência de relação = não confirmado.", obj({
        sku
    }, [
        "sku"
    ]), livre, "Relação técnica com fonte.", {
        estado: "ativa"
    }),
    leitura("engenharia.fabricantes.identificar", "engenharia", "Identifica e classifica o fabricante da peça.", obj({
        sku
    }, [
        "sku"
    ]), livre, "Fonte registrada.", {
        estado: "planejada"
    }),
    leitura("engenharia.aplicacoes.validar", "engenharia", "Valida aplicações do SKU por VERSÃO do veículo no mercado BR, opcionalmente para um ano. Devolve confirmada ou nao_confirmada, nunca incompatível.", obj({
        sku,
        ano: {
            type: "integer",
            minimum: 1950,
            maximum: 2100
        }
    }, [
        "sku"
    ]), livre, "Fonte e verificação registradas.", {
        estado: "ativa"
    }),
    proposta("engenharia.genealogia.organizar", "engenharia", "Propõe relações da genealogia automotiva (montadora → … → componente) com procedência.", obj({
        sku,
        relacoes: lista(livre, 100)
    }, [
        "sku",
        "relacoes"
    ]), livre, "MEDIUM", {
        estado: "planejada"
    }),
    proposta("engenharia.taxonomia.construir", "engenharia", "Propõe novos nós/relacionamentos da taxonomia, sempre com fonte.", obj({
        nos: lista(livre, 200)
    }, [
        "nos"
    ]), livre, "MEDIUM", {
        estado: "planejada"
    }),
    proposta("engenharia.classificacao.propor", "engenharia", "Propõe a classificação de um produto na taxonomia.", obj({
        sku,
        no_id: uuid,
        fonte: txt(undefined, 500)
    }, [
        "sku",
        "fonte"
    ]), livre, "LOW", {
        estado: "planejada"
    }),
    def({
        id: "dev.docs.consultar",
        grupo: "desenvolvimento",
        descricao: "Consulta a documentação técnica versionada do projeto.",
        entrada: obj({
            texto: txt()
        }, [
            "texto"
        ]),
        saida: livre,
        permissao: "leitura",
        risco: "LOW",
        verificacao: "Fonte e versão.",
        recuperacao: "Repetir."
    }),
    def({
        id: "dev.github.consultar",
        grupo: "desenvolvimento",
        descricao: "Consulta o GitHub com escopo limitado (somente leitura).",
        entrada: obj({
            caminho: txt()
        }, [
            "caminho"
        ]),
        saida: livre,
        permissao: "leitura",
        risco: "LOW",
        verificacao: "Commit/versão.",
        recuperacao: "Repetir."
    }),
    def({
        id: "dev.codigo.preparar",
        grupo: "desenvolvimento",
        descricao: "Prepara alteração de código como proposta (não aplica).",
        entrada: obj({
            descricao: txt(undefined, 2000)
        }, [
            "descricao"
        ]),
        saida: livre,
        permissao: "propor",
        risco: "HIGH",
        exigeAprovacao: true,
        verificacao: "Revisão humana do diff.",
        recuperacao: "Descartar a proposta.",
        idempotencia: "chave"
    }),
    def({
        id: "dev.pr.propor",
        grupo: "desenvolvimento",
        descricao: "Propõe um pull request de desenvolvimento (rascunho).",
        entrada: obj({
            titulo: txt()
        }, [
            "titulo"
        ]),
        saida: livre,
        permissao: "propor",
        risco: "HIGH",
        exigeAprovacao: true,
        verificacao: "Revisão humana.",
        recuperacao: "Fechar o PR.",
        idempotencia: "chave"
    }),
    def({
        id: "dev.testes.executar",
        grupo: "desenvolvimento",
        descricao: "Executa testes em ambiente isolado. Nunca em produção.",
        entrada: obj({
            suite: txt()
        }, [
            "suite"
        ]),
        saida: livre,
        permissao: "simular",
        risco: "MEDIUM",
        exigeAprovacao: true,
        verificacao: "Relatório do teste.",
        recuperacao: "Repetir no ambiente isolado."
    })
];
const POR_ID = new Map(FERRAMENTAS_CONECTOR.map((f)=>[
        f.id,
        f
    ]));
const buscarDefinicao = (id)=>POR_ID.get(id);
function ferramentasVisiveis(origem, escopos = []) {
    return FERRAMENTAS_CONECTOR.filter((f)=>f.estado === "ativa" && f.permissao !== "executar" && (origem === "chat" ? f.exposicao.chat : f.exposicao.mcp && escopos.includes(f.permissao)));
}
const nomeParaLlm = (id)=>id.replaceAll(".", "__");
const idDoNomeLlm = (nome)=>nome.replaceAll("__", ".");

return { CAMPOS_BLING_PERMITIDOS: CAMPOS_BLING_PERMITIDOS, CAMPOS_BLING_PROIBIDOS: CAMPOS_BLING_PROIBIDOS, FERRAMENTAS_CONECTOR: FERRAMENTAS_CONECTOR, buscarDefinicao: buscarDefinicao, ferramentasVisiveis: ferramentasVisiveis, nomeParaLlm: nomeParaLlm, idDoNomeLlm: idDoNomeLlm };
})();

// ---------- supabase/functions/_shared/conector/tipos.ts ----------
const __m5 = (() => {
const ORDEM_RISCO = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3
};
const maiorRisco = (a, b)=>ORDEM_RISCO[a] >= ORDEM_RISCO[b] ? a : b;

return { ORDEM_RISCO: ORDEM_RISCO, maiorRisco: maiorRisco };
})();

// ---------- supabase/functions/_shared/conector/policy.ts ----------
const __m4 = (() => {
const { ORDEM_RISCO: ORDEM_RISCO } = __m5;
const nega = (motivo)=>({
        decisao: "negada",
        motivo
    });
function decidir(def, c) {
    if (!def) return nega("ferramenta_desconhecida");
    if (def.permissao === "executar") {
        if (c.origem !== "executor") return nega("somente_executor: LLM e clientes externos não executam escrita");
        if (c.produtoTravado) return nega("produto_travado: só sugestão");
        if (!c.aprovacaoValida) return {
            decisao: "requer_aprovacao",
            motivo: "sem aprovação humana válida para esta versão"
        };
        if (c.simulado) return def.simulacao ? {
            decisao: "simulada",
            motivo: "execução simulada (mock)"
        } : nega("sem_modo_simulado");
        if (def.estado !== "ativa") return nega(`ferramenta_${def.estado}: escrita real desligada`);
        if (def.escreveExterno && !c.escritaRealLiberada) return nega("escrita_real_nao_liberada: falta liberação explícita da loja para esta ferramenta");
        return {
            decisao: "permitida",
            motivo: "aprovada e liberada"
        };
    }
    if (def.estado !== "ativa") return nega(`ferramenta_${def.estado}`);
    if (c.origem === "executor") return nega("executor_so_executa_aprovado");
    if (c.origem === "chat" && !def.exposicao.chat) return nega("nao_exposta_ao_chat");
    if (c.origem === "gateway_mcp") {
        if (!def.exposicao.mcp) return nega("nao_exposta_ao_mcp");
        if (!c.escopos?.includes(def.permissao)) return nega(`escopo_insuficiente: precisa de '${def.permissao}'`);
    }
    if (def.exigeAprovacao && !c.aprovacaoValida) return {
        decisao: "requer_aprovacao",
        motivo: "exige aprovação humana"
    };
    if (def.escreveExterno) return nega("escrita_externa_so_pelo_executor");
    if (ORDEM_RISCO[def.risco] >= ORDEM_RISCO.HIGH && def.permissao !== "leitura" && !c.aprovacaoValida) {
        return {
            decisao: "requer_aprovacao",
            motivo: `risco ${def.risco}`
        };
    }
    return {
        decisao: "permitida",
        motivo: def.permissao === "leitura" ? "leitura" : "gera apenas proposta (aprovação humana depois)"
    };
}

return { decidir: decidir };
})();

// ---------- supabase/functions/_shared/conector/bling_campos.ts ----------
const __m6 = (() => {
const { CAMPOS_BLING_PROIBIDOS: CAMPOS_BLING_PROIBIDOS } = __m3;
const MAPA_CAMPOS = [
    {
        conecta: "nome",
        caminho: [
            "nome"
        ],
        tipo: "texto",
        conferido: false
    },
    {
        conecta: "marca",
        caminho: [
            "marca"
        ],
        tipo: "texto",
        conferido: false
    },
    {
        conecta: "gtin",
        caminho: [
            "gtin"
        ],
        tipo: "gtin",
        conferido: false,
        observacao: "8, 12, 13 ou 14 dígitos"
    },
    {
        conecta: "descricao_curta",
        caminho: [
            "descricaoCurta"
        ],
        tipo: "texto",
        conferido: false
    },
    {
        conecta: "descricao_complementar",
        caminho: [
            "descricaoComplementar"
        ],
        tipo: "texto",
        conferido: false
    },
    {
        conecta: "peso_kg",
        caminho: [
            "pesoBruto"
        ],
        tipo: "numero_positivo",
        conferido: false,
        observacao: "o espelho lê pesoBruto antes de pesoLiquido; confirmar com o lojista qual gravar"
    },
    {
        conecta: "largura_cm",
        caminho: [
            "dimensoes",
            "largura"
        ],
        tipo: "numero_positivo",
        conferido: false
    },
    {
        conecta: "altura_cm",
        caminho: [
            "dimensoes",
            "altura"
        ],
        tipo: "numero_positivo",
        conferido: false
    },
    {
        conecta: "profundidade_cm",
        caminho: [
            "dimensoes",
            "profundidade"
        ],
        tipo: "numero_positivo",
        conferido: false
    },
    {
        conecta: "categoria_bling_id",
        caminho: [
            "categoria",
            "id"
        ],
        tipo: "id_numerico",
        conferido: false,
        observacao: "categoria precisa existir no Bling (bling_categorias)"
    }
];
const CAMPOS_ESCRITA_LIBERADOS = {
    "bling.produtos.alterar": [
        "categoria_bling_id"
    ]
};
function camposNaoLiberados(operacao, depois, campos = [], liberados = CAMPOS_ESCRITA_LIBERADOS) {
    const ok = new Set(liberados[operacao] ?? []);
    const pedidos = new Set([
        ...Object.keys(depois ?? {}),
        ...campos
    ]);
    return [
        ...pedidos
    ].filter((c)=>!ok.has(c)).sort();
}
const POR_CONECTA = new Map(MAPA_CAMPOS.map((m)=>[
        m.conecta,
        m
    ]));
const PROIBIDOS = new Set(CAMPOS_BLING_PROIBIDOS);
function chaveProibida(o, caminho = "") {
    if (!o || typeof o !== "object") return null;
    for (const [k, v] of Object.entries(o)){
        if (PROIBIDOS.has(k)) return caminho + k;
        const r = chaveProibida(v, `${caminho}${k}.`);
        if (r) return r;
    }
    return null;
}
function valida(m, v) {
    switch(m.tipo){
        case "texto":
            return typeof v === "string" && v.trim() !== "" ? null : "texto vazio ou inválido";
        case "numero_positivo":
            return typeof v === "number" && Number.isFinite(v) && v > 0 ? null : "número deve ser maior que zero";
        case "gtin":
            return typeof v === "string" && /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(v) ? null : "GTIN deve ter 8, 12, 13 ou 14 dígitos";
        case "id_numerico":
            return typeof v === "string" && /^\d{1,20}$/.test(v) ? null : "id de categoria deve ser numérico";
    }
}
function montarCorpoProduto(depois) {
    const corpo = {};
    const erros = [];
    for (const [k, v] of Object.entries(depois)){
        if (PROIBIDOS.has(k)) {
            erros.push(`${k}: campo proibido (fiscal, preço, custo, fornecedor, estoque ou SKU nunca são alterados)`);
            continue;
        }
        const m = POR_CONECTA.get(k);
        if (!m) {
            erros.push(`${k}: sem campo equivalente no Bling; permanece só no Conecta.IA`);
            continue;
        }
        const e = valida(m, v);
        if (e) {
            erros.push(`${k}: ${e}`);
            continue;
        }
        let alvo = corpo;
        m.caminho.slice(0, -1).forEach((p)=>{
            alvo = alvo[p] ??= {};
        });
        alvo[m.caminho[m.caminho.length - 1]] = m.tipo === "id_numerico" ? Number(v) : v;
    }
    if (Object.keys(corpo).length === 0 && erros.length === 0) erros.push("nada para enviar");
    const proibida = chaveProibida(corpo);
    if (proibida) erros.push(`${proibida}: campo proibido no corpo`);
    return {
        corpo,
        erros
    };
}
const folhas = (o, caminho = [])=>o && typeof o === "object" && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v])=>folhas(v, [
            ...caminho,
            k
        ])) : [
        {
            caminho,
            valor: o
        }
    ];
const norm = (v)=>typeof v === "string" ? v.trim() : typeof v === "number" ? v : v;
function divergencias(enviado, lido) {
    const out = [];
    for (const f of folhas(enviado)){
        let atual = lido;
        for (const p of f.caminho)atual = atual && typeof atual === "object" ? atual[p] : undefined;
        if (String(norm(atual)) !== String(norm(f.valor))) out.push(`${f.caminho.join(".")}: enviado ${JSON.stringify(f.valor)}, Bling devolveu ${JSON.stringify(atual ?? null)}`);
    }
    return out;
}
const vazio = (v)=>v === null || v === undefined || v === "" || v === 0;
function antesIntacto(antes, lidoNoBling) {
    const chaves = Object.keys(antes ?? {});
    if (chaves.length === 0) return false;
    return chaves.every((k)=>{
        const m = POR_CONECTA.get(k);
        if (!m) return false;
        const atual = m.caminho.reduce((a, p)=>a && typeof a === "object" ? a[p] : undefined, lidoNoBling);
        const esperado = antes[k];
        return vazio(atual) && vazio(esperado) ? true : String(norm(atual)) === String(norm(esperado));
    });
}

return { MAPA_CAMPOS: MAPA_CAMPOS, CAMPOS_ESCRITA_LIBERADOS: CAMPOS_ESCRITA_LIBERADOS, camposNaoLiberados: camposNaoLiberados, chaveProibida: chaveProibida, montarCorpoProduto: montarCorpoProduto, divergencias: divergencias, antesIntacto: antesIntacto };
})();

// ---------- supabase/functions/_shared/estado.ts ----------
const __m11 = (() => {
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64u(b) {
    let s = "";
    for (const x of b)s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
    const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
    return Uint8Array.from(atob(p), (c)=>c.charCodeAt(0));
}
const chaveHmac = (segredo)=>crypto.subtle.importKey("raw", enc.encode(segredo), {
        name: "HMAC",
        hash: "SHA-256"
    }, false, [
        "sign",
        "verify"
    ]);
async function assinarEstado(est, segredo) {
    const corpo = b64u(enc.encode(JSON.stringify(est)));
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(segredo), enc.encode(corpo)));
    return `${corpo}.${b64u(sig)}`;
}
async function verificarEstado(token, segredo, agora = Date.now()) {
    const [corpo, sig, resto] = token.split(".");
    if (!corpo || !sig || resto !== undefined) return null;
    try {
        const ok = await crypto.subtle.verify("HMAC", await chaveHmac(segredo), unb64u(sig), enc.encode(corpo));
        if (!ok) return null;
        const est = JSON.parse(dec.decode(unb64u(corpo)));
        if (typeof est.l !== "string" || typeof est.u !== "string" || typeof est.e !== "number" || est.e < agora) return null;
        return est;
    } catch  {
        return null;
    }
}

return { b64u: b64u, unb64u: unb64u, assinarEstado: assinarEstado, verificarEstado: verificarEstado };
})();

// ---------- supabase/functions/_shared/cripto.ts ----------
const __m10 = (() => {
const { b64u: b64u, unb64u: unb64u } = __m11;
const enc = new TextEncoder();
const dec = new TextDecoder();
function anel(c) {
    if (!c) throw new Error("chave de cifra não configurada");
    return typeof c === "string" ? {
        atual: "k1",
        chaves: {
            k1: c
        }
    } : c;
}
function chaveiroDoAmbiente(get) {
    const json = get("CREDENCIAIS_CHAVES");
    if (json) {
        try {
            const chaves = JSON.parse(json);
            const atual = get("CREDENCIAIS_CHAVE_ATUAL") ?? Object.keys(chaves).sort().at(-1);
            if (chaves[atual]) return {
                atual,
                chaves
            };
        } catch  {}
    }
    return get("CREDENCIAIS_CHAVE_CIFRA");
}
async function importar(b64) {
    const raw = Uint8Array.from(atob(b64), (c)=>c.charCodeAt(0));
    if (raw.length !== 32) throw new Error("a chave de cifra deve ter 32 bytes (base64)");
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
        "encrypt",
        "decrypt"
    ]);
}
async function cifrar(texto, chaveiro) {
    const a = anel(chaveiro);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const tudo = new Uint8Array(await crypto.subtle.encrypt({
        name: "AES-GCM",
        iv
    }, await importar(a.chaves[a.atual]), enc.encode(texto)));
    const tag = tudo.slice(tudo.length - 16);
    const corpo = tudo.slice(0, tudo.length - 16);
    return `v2.${a.atual}.${b64u(iv)}.${b64u(tag)}.${b64u(corpo)}`;
}
async function abrir(chaveB64, iv, tag, ct) {
    const corpo = unb64u(ct), t = unb64u(tag);
    const junto = new Uint8Array(corpo.length + t.length);
    junto.set(corpo);
    junto.set(t, corpo.length);
    return dec.decode(await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: unb64u(iv)
    }, await importar(chaveB64), junto));
}
async function decifrar(valor, chaveiro) {
    const a = anel(chaveiro);
    const p = valor.split(".");
    if (p[0] === "v2" && p.length === 5) {
        const chave = a.chaves[p[1]];
        if (!chave) throw new Error("chave de cifra desconhecida (kid)");
        return abrir(chave, p[2], p[3], p[4]);
    }
    if (p[0] === "v1" && p.length === 4) {
        for (const k of [
            a.atual,
            ...Object.keys(a.chaves).filter((x)=>x !== a.atual)
        ]){
            try {
                return await abrir(a.chaves[k], p[1], p[2], p[3]);
            } catch  {}
        }
        throw new Error("não foi possível decifrar (formato v1)");
    }
    throw new Error("Formato de segredo cifrado inválido");
}
async function recifrar(valor, chaveiro) {
    const a = anel(chaveiro);
    if (valor.startsWith(`v2.${a.atual}.`)) return valor;
    return cifrar(await decifrar(valor, chaveiro), chaveiro);
}

return { chaveiroDoAmbiente: chaveiroDoAmbiente, cifrar: cifrar, decifrar: decifrar, recifrar: recifrar };
})();

// ---------- supabase/functions/_shared/bling_token.ts ----------
const __m9 = (() => {
const { decifrar: decifrar, cifrar: cifrar } = __m10;
const ANTECEDENCIA_MS = 30 * 60_000;
const RESERVA_S = 60;
const TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";
async function renovarLoja(arm, lojaId, cfg, forcar = false) {
    const agora = cfg.agora ?? Date.now;
    const f = cfg.fetch ?? fetch;
    const espera = cfg.espera ?? ((ms)=>new Promise((r)=>setTimeout(r, ms)));
    const por = cfg.id ?? crypto.randomUUID();
    const antes = await arm.ler(lojaId);
    if (!antes) return "sem_conexao";
    if (!forcar && Date.parse(antes.expira_em) - agora() > ANTECEDENCIA_MS) return "ja_valida";
    if (!await arm.reservar(lojaId, por, RESERVA_S)) {
        for(let i = 0; i < 5; i++){
            await espera(1000);
            const dep = await arm.ler(lojaId);
            if (dep && dep.refresh_token_cifrado !== antes.refresh_token_cifrado) return "outra_renovacao";
        }
        return "falha_temporaria";
    }
    try {
        const atual = await arm.ler(lojaId) ?? antes;
        if (!forcar && atual.refresh_token_cifrado !== antes.refresh_token_cifrado) {
            await arm.liberar(lojaId, por);
            return "outra_renovacao";
        }
        const app = await arm.lerApp(lojaId);
        if (!app) {
            await arm.marcar(lojaId, "erro", "App do Bling não cadastrado. Informe o Client ID e o Client Secret no painel.");
            await arm.liberar(lojaId, por);
            return "reconectar";
        }
        const clientSecret = await decifrar(app.client_secret_cifrado, cfg.chaveCifra);
        const refresh = await decifrar(atual.refresh_token_cifrado, cfg.chaveCifra);
        let r;
        try {
            r = await f(TOKEN_URL, {
                method: "POST",
                redirect: "manual",
                headers: {
                    Authorization: "Basic " + btoa(`${app.client_id}:${clientSecret}`),
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "1.0",
                    "enable-jwt": "1"
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refresh
                }).toString(),
                signal: AbortSignal.timeout(15_000)
            });
        } catch  {
            await arm.liberar(lojaId, por);
            return "falha_temporaria";
        }
        if (r.status === 400 || r.status === 401) {
            await arm.marcar(lojaId, "expirada", "Acesso ao Bling expirou. Reconecte no painel.");
            await arm.liberar(lojaId, por);
            return "reconectar";
        }
        if (!r.ok) {
            await arm.liberar(lojaId, por);
            return "falha_temporaria";
        }
        const t = await r.json().catch(()=>null);
        if (!t?.access_token || !t.refresh_token || !t.expires_in) {
            await arm.liberar(lojaId, por);
            return "falha_temporaria";
        }
        await arm.salvar(lojaId, await cifrar(t.access_token, cfg.chaveCifra), await cifrar(t.refresh_token, cfg.chaveCifra), new Date(agora() + t.expires_in * 1000).toISOString());
        return "renovada";
    } catch  {
        await arm.liberar(lojaId, por).catch(()=>{});
        return "falha_temporaria";
    }
}
async function obterAccessToken(arm, lojaId, cfg) {
    let c = await arm.ler(lojaId);
    if (!c) return null;
    if (Date.parse(c.expira_em) - (cfg.agora ?? Date.now)() <= ANTECEDENCIA_MS) {
        const r = await renovarLoja(arm, lojaId, cfg);
        if (r === "reconectar" || r === "sem_conexao") return null;
        c = await arm.ler(lojaId);
        if (!c) return null;
    }
    return decifrar(c.access_token_cifrado, cfg.chaveCifra);
}

return { ANTECEDENCIA_MS: ANTECEDENCIA_MS, RESERVA_S: RESERVA_S, renovarLoja: renovarLoja, obterAccessToken: obterAccessToken };
})();

// ---------- supabase/functions/_shared/bling_api.ts ----------
const __m8 = (() => {
const { obterAccessToken: obterAccessToken, renovarLoja: renovarLoja } = __m9;
const BASE = "https://api.bling.com.br/Api/v3";
const RECUOS_MS = [
    1000,
    3000,
    8000
];
class BlingErro extends Error {
    status;
    constructor(status, msg){
        super(msg);
        this.status = status;
    }
}
async function blingFetch(arm, lojaId, caminho, cfg, op = {}) {
    if (!/^\/[a-z0-9/_-]*(\?[A-Za-z0-9%=&_.,\[\]-]*)?$/i.test(caminho)) throw new BlingErro(400, "Caminho inválido para a API do Bling.");
    const f = cfg.fetch ?? fetch;
    const espera = cfg.espera ?? ((ms)=>new Promise((r)=>setTimeout(r, ms)));
    const recuos = op.recuos ?? RECUOS_MS;
    const metodo = op.metodo ?? "GET";
    let token = await obterAccessToken(arm, lojaId, cfg);
    if (!token) throw new BlingErro(401, "Bling não conectado. Reconecte no painel.");
    let renovou = false;
    for(let tentativa = 0;; tentativa++){
        const r = await f(BASE + caminho, {
            method: metodo,
            redirect: "manual",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "enable-jwt": "1",
                ...op.corpo !== undefined ? {
                    "Content-Type": "application/json"
                } : {}
            },
            body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
            signal: AbortSignal.timeout(op.timeoutMs ?? 20_000)
        });
        if (r.status === 401 && !renovou) {
            renovou = true;
            const res = await renovarLoja(arm, lojaId, cfg, true);
            if (res === "reconectar") throw new BlingErro(401, "Acesso ao Bling expirou. Reconecte no painel.");
            token = await obterAccessToken(arm, lojaId, cfg);
            if (!token) throw new BlingErro(401, "Bling não conectado. Reconecte no painel.");
            continue;
        }
        const repetivel = metodo === "GET" && (r.status === 429 || r.status >= 500);
        if (repetivel && tentativa < recuos.length) {
            await espera(recuos[tentativa]);
            continue;
        }
        return r;
    }
}

return { RECUOS_MS: RECUOS_MS, BlingErro: BlingErro, blingFetch: blingFetch };
})();

// ---------- supabase/functions/_shared/conector/porta_bling.ts ----------
const __m7 = (() => {
const { blingFetch: blingFetch } = __m8;
class TimeoutBling extends Error {
    constructor(m = "timeout"){
        super(m);
    }
}
class BlingLeituraReal {
    simulado = false;
    arm;
    lojaId;
    cfg;
    constructor(arm, lojaId, cfg){
        this.arm = arm;
        this.lojaId = lojaId;
        this.cfg = cfg;
    }
    chamar() {
        throw new Error("escrita_real_desligada: esta porta só lê");
    }
    async ler(ferramenta, args) {
        let caminho;
        if (ferramenta === "bling.produtos.confirmar" && args.id && /^\d+$/.test(args.id)) caminho = `/produtos/${args.id}`;
        else if (ferramenta === "bling.produtos.consultar" && args.sku) caminho = `/produtos?codigos[]=${encodeURIComponent(args.sku)}`;
        else if (ferramenta === "bling.categorias.consultar") caminho = `/categorias/produtos?pagina=1&limite=100`;
        else throw new Error("leitura_nao_suportada");
        const r = await blingFetch(this.arm, this.lojaId, caminho, this.cfg);
        return {
            status: r.status,
            corpo: await r.json().catch(()=>null)
        };
    }
}

return { TimeoutBling: TimeoutBling, BlingLeituraReal: BlingLeituraReal };
})();

// ---------- supabase/functions/_shared/conector/executor.ts ----------
const __m2 = (() => {
const { buscarDefinicao: buscarDefinicao } = __m3;
const { decidir: decidir } = __m4;
const { antesIntacto: antesIntacto, CAMPOS_ESCRITA_LIBERADOS: CAMPOS_ESCRITA_LIBERADOS, camposNaoLiberados: camposNaoLiberados, divergencias: divergencias, montarCorpoProduto: montarCorpoProduto } = __m6;
const { TimeoutBling: TimeoutBling } = __m7;
const chamar = async (rpc, fn, args)=>{
    const { data, error } = await rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
};
async function escreverEConfirmarNoBling(bling, op, item, aoEnviar, liberados = CAMPOS_ESCRITA_LIBERADOS) {
    const alterar = op === "bling.produtos.alterar", criarProduto = op === "bling.produtos.criar", criarCategoria = op === "bling.categorias.criar";
    if (!alterar && !criarProduto && !criarCategoria) return {
        estado: "falhou",
        motivo: `operacao_nao_suportada: ${op}`
    };
    let corpo;
    if (criarCategoria) {
        const d = item.depois ?? {};
        if (typeof d.descricao !== "string" || !d.descricao.trim()) return {
            estado: "falhou",
            motivo: "categoria sem descrição"
        };
        corpo = {
            descricao: d.descricao.trim(),
            ...d.categoria_pai_id ? {
                categoriaPai: {
                    id: Number(d.categoria_pai_id)
                }
            } : {}
        };
    } else {
        const fora = camposNaoLiberados(op, item.depois, item.campos, liberados);
        if (fora.length) return {
            estado: "falhou",
            motivo: `campo_nao_liberado: ${fora.join(", ")} (liberado para ${op}: ${(liberados[op] ?? []).join(", ") || "nenhum"})`
        };
        const m = montarCorpoProduto(item.depois ?? {});
        if (m.erros.length) return {
            estado: "falhou",
            motivo: `corpo_invalido: ${m.erros.join("; ")}`
        };
        corpo = m.corpo;
    }
    if (alterar && !(item.alvo && /^\d+$/.test(item.alvo))) return {
        estado: "falhou",
        motivo: "alvo (id do produto no Bling) ausente ou inválido"
    };
    await aoEnviar?.();
    let r;
    try {
        r = await bling.chamar(op, {
            id: item.alvo ?? undefined,
            corpo
        }, item.idempotency_key);
    } catch (e) {
        return {
            estado: "desconhecida",
            motivo: e instanceof TimeoutBling ? "timeout na escrita" : "falha de rede na escrita"
        };
    }
    if (r.status === 429) return {
        estado: "falhou",
        motivo: "limite de requisições do Bling (não processado); tentar mais tarde"
    };
    if (r.status === 401) return {
        estado: "falhou",
        motivo: "acesso ao Bling expirou; reconectar"
    };
    if (r.status >= 500) return {
        estado: "desconhecida",
        motivo: `Bling respondeu ${r.status}; pode ter gravado`
    };
    if (r.status < 200 || r.status >= 300) return {
        estado: "falhou",
        motivo: `Bling recusou (${r.status})`,
        resposta: {
            status: r.status
        }
    };
    try {
        if (criarCategoria) {
            const l = await bling.ler("bling.categorias.consultar", {});
            const achou = (l.corpo?.data ?? []).find((c)=>c.descricao === corpo.descricao);
            return achou ? {
                estado: "confirmada",
                evidencia: {
                    leitura: achou
                },
                resposta: {
                    status: r.status
                }
            } : {
                estado: "desconhecida",
                motivo: "gravou segundo o Bling, mas a categoria não apareceu na leitura"
            };
        }
        let id = item.alvo ?? "";
        if (criarProduto) {
            id = String(r.corpo?.data?.id ?? "");
            if (!id) return {
                estado: "desconhecida",
                motivo: "Bling não devolveu o id do produto criado"
            };
        }
        const l = await bling.ler("bling.produtos.confirmar", {
            id
        });
        if (l.status !== 200) return {
            estado: "desconhecida",
            motivo: `leitura de confirmação falhou (${l.status})`
        };
        const dados = l.corpo?.data ?? {};
        const dif = divergencias(corpo, dados);
        return dif.length === 0 ? {
            estado: "confirmada",
            evidencia: {
                leitura: dados,
                comparados: Object.keys(corpo)
            },
            resposta: {
                status: r.status,
                id
            }
        } : {
            estado: "falhou",
            motivo: `divergência após gravar: ${dif.join("; ")}`,
            evidencia: {
                leitura: dados,
                divergencias: dif
            },
            resposta: {
                status: r.status,
                id
            }
        };
    } catch  {
        return {
            estado: "desconhecida",
            motivo: "gravou, mas a leitura de confirmação não respondeu"
        };
    }
}
async function executarProposta(o) {
    const rel = {
        proposta_id: o.propostaId,
        itens: []
    };
    let itens;
    try {
        itens = await chamar(o.rpc, "agente_proposta_iniciar_execucao", {
            p_loja: o.lojaId,
            p_proposta: o.propostaId
        });
    } catch (e) {
        rel.erro = e.message;
        return rel;
    }
    const achar = o.definicao ?? buscarDefinicao;
    for (const item of itens){
        const def = achar(item.operacao);
        let opId = null;
        try {
            opId = await chamar(o.rpc, "agente_operacao_abrir", {
                p_loja: o.lojaId,
                p_item: item.item_id,
                p_ferramenta: item.operacao,
                p_requisicao: {
                    alvo: item.alvo,
                    campos: item.campos
                }
            });
            const fechar = (v)=>chamar(o.rpc, "agente_operacao_fechar", {
                    p_loja: o.lojaId,
                    p_operacao: opId,
                    p_estado: v.estado,
                    p_resposta: v.resposta ?? null,
                    p_evidencia: v.evidencia ?? null,
                    p_erro: v.motivo ?? null
                }).then(()=>{
                    rel.itens.push({
                        item_id: item.item_id,
                        operacao: item.operacao,
                        estado: v.estado,
                        motivo: v.motivo,
                        evidencia: v.evidencia
                    });
                });
            if (o.parar?.()) {
                await fechar({
                    estado: "falhou",
                    motivo: "parada_de_emergencia: item não executado"
                });
                continue;
            }
            const p = decidir(def, {
                origem: "executor",
                aprovacaoValida: true,
                simulado: false,
                escritaRealLiberada: true,
                produtoTravado: false
            });
            if (p.decisao !== "permitida") {
                await fechar({
                    estado: "falhou",
                    motivo: `policy: ${p.decisao}: ${p.motivo}`
                });
                continue;
            }
            const enviada = ()=>chamar(o.rpc, "agente_operacao_marcar_enviada", {
                    p_loja: o.lojaId,
                    p_operacao: opId
                });
            let v;
            if (item.operacao === "conecta.enriquecimento.definir" || item.operacao === "conecta.publicacao.publicar") {
                await enviada();
                const rpc = item.operacao === "conecta.enriquecimento.definir" ? "agente_aplicar_enriquecimento" : "agente_aplicar_publicacao";
                try {
                    const lido = await chamar(o.rpc, rpc, {
                        p_loja: o.lojaId,
                        p_item: item.item_id
                    });
                    const esperado = item.operacao === "conecta.publicacao.publicar" ? {
                        publicado: true
                    } : item.depois;
                    const dif = Object.entries(esperado ?? {}).filter(([k, val])=>JSON.stringify(lido?.[k]) !== JSON.stringify(val));
                    v = dif.length === 0 ? {
                        estado: "confirmada",
                        evidencia: {
                            leitura: lido
                        }
                    } : {
                        estado: "falhou",
                        motivo: `divergência na leitura: ${dif.map(([k])=>k).join(", ")}`,
                        evidencia: {
                            leitura: lido
                        }
                    };
                } catch (e) {
                    v = {
                        estado: "falhou",
                        motivo: e.message.slice(0, 300)
                    };
                }
            } else {
                v = await escreverEConfirmarNoBling(o.bling, item.operacao, item, enviada, o.camposLiberados);
            }
            await fechar(v);
        } catch (e) {
            rel.itens.push({
                item_id: item.item_id,
                operacao: item.operacao,
                estado: "desconhecida",
                motivo: `erro de controle: ${e.message.slice(0, 200)}`
            });
        }
    }
    try {
        rel.estado_final = await chamar(o.rpc, "agente_proposta_finalizar", {
            p_loja: o.lojaId,
            p_proposta: o.propostaId
        });
    } catch (e) {
        rel.erro = e.message;
    }
    return rel;
}
async function reconciliar(o) {
    const { item, bling } = o;
    let resultado = "indeterminado";
    let evidencia = {};
    if (item.operacao === "bling.produtos.alterar" && item.alvo) {
        const { corpo } = montarCorpoProduto(item.depois ?? {});
        const l = await bling.ler("bling.produtos.confirmar", {
            id: item.alvo
        });
        const dados = l.corpo?.data;
        if (l.status === 200 && dados) {
            if (divergencias(corpo, dados).length === 0) {
                resultado = "gravado";
                evidencia = {
                    leitura: dados,
                    regra: "o produto já contém todos os valores propostos"
                };
            } else if (antesIntacto(item.antes ?? {}, dados)) {
                resultado = "nao_gravado";
                evidencia = {
                    leitura: dados,
                    regra: "o produto ainda contém exatamente os valores anteriores"
                };
            }
        }
    } else if (item.operacao === "bling.produtos.criar") {
        const sku = (item.depois ?? {}).sku ?? (item.depois ?? {}).codigo;
        if (typeof sku === "string") {
            const l = await bling.ler("bling.produtos.consultar", {
                sku
            });
            const achados = l.corpo?.data ?? [];
            if (l.status === 200) {
                resultado = achados.length ? "gravado" : "nao_gravado";
                evidencia = {
                    consulta_por_sku: sku,
                    encontrados: achados.length
                };
            }
        }
    } else if (item.operacao === "bling.categorias.criar") {
        const l = await bling.ler("bling.categorias.consultar", {});
        if (l.status === 200) {
            const achou = (l.corpo?.data ?? []).some((c)=>c.descricao === (item.depois ?? {}).descricao);
            resultado = achou ? "gravado" : "nao_gravado";
            evidencia = {
                listagem_de_categorias: true,
                encontrou: achou
            };
        }
    }
    if (resultado !== "indeterminado") await chamar(o.rpc, "agente_operacao_reconciliar", {
        p_loja: o.lojaId,
        p_operacao: o.operacaoId,
        p_resultado: resultado,
        p_evidencia: evidencia,
        p_user: o.userId
    });
    return resultado;
}
async function simularProposta(o) {
    if (!o.bling.simulado) throw new Error("ensaio exige porta simulada (mock)");
    const itens = await chamar(o.rpc, "agente_proposta_validar", {
        p_loja: o.lojaId,
        p_proposta: o.propostaId
    });
    const achar = o.definicao ?? buscarDefinicao;
    const rel = {
        proposta_id: o.propostaId,
        simulado: true,
        itens: []
    };
    for (const item of itens){
        const def = achar(item.operacao);
        const p = decidir(def, {
            origem: "executor",
            aprovacaoValida: true,
            simulado: true,
            produtoTravado: false
        });
        if (p.decisao !== "simulada" && p.decisao !== "permitida") {
            rel.itens.push({
                item_id: item.item_id,
                operacao: item.operacao,
                ok: false,
                motivo: `policy: ${p.motivo}`
            });
            continue;
        }
        if (item.operacao.startsWith("bling.")) {
            const v = await escreverEConfirmarNoBling(o.bling, item.operacao, item, undefined, o.camposLiberados);
            rel.itens.push({
                item_id: item.item_id,
                operacao: item.operacao,
                ok: v.estado === "confirmada",
                motivo: v.motivo,
                previsto: v.resposta,
                confirmacao_simulada: v.evidencia
            });
        } else {
            rel.itens.push({
                item_id: item.item_id,
                operacao: item.operacao,
                ok: true,
                previsto: item.depois,
                motivo: "interna: nada é gravado no ensaio"
            });
        }
    }
    rel.simulacao_id = await chamar(o.rpc, "agente_simulacao_registrar", {
        p_loja: o.lojaId,
        p_proposta: o.propostaId,
        p_user: o.userId,
        p_resultado: rel
    });
    return rel;
}

return { escreverEConfirmarNoBling: escreverEConfirmarNoBling, executarProposta: executarProposta, reconciliar: reconciliar, simularProposta: simularProposta };
})();

// ---------- supabase/functions/_shared/conector/bling_mock.ts ----------
const __m12 = (() => {
const { chaveProibida: chaveProibida } = __m6;
const { TimeoutBling: TimeoutBling } = __m7;
class BlingMock {
    simulado = true;
    produtos = new Map();
    categorias = [];
    recebidos = [];
    rejeitados = [];
    leituras = 0;
    falhas = [];
    proximoId = 9000;
    semear(id, produto) {
        this.produtos.set(id, structuredClone(produto));
        return this;
    }
    async chamar(ferramenta, args, idem) {
        const proibida = chaveProibida(args.corpo);
        if (proibida || typeof args.corpo !== "object" || args.corpo === null) {
            this.rejeitados.push({
                ferramenta,
                motivo: proibida ? `campo proibido: ${proibida}` : "corpo inválido"
            });
            return {
                status: 422,
                corpo: {
                    erro: "campo não permitido"
                }
            };
        }
        this.recebidos.push({
            ferramenta,
            id: args.id,
            corpo: args.corpo,
            idem
        });
        const falha = this.falhas[0]?.startsWith("leitura") ? undefined : this.falhas.shift();
        if (falha === "http_422") return {
            status: 422,
            corpo: {
                erro: "validação"
            }
        };
        if (falha === "http_429") return {
            status: 429
        };
        if (falha === "http_401") return {
            status: 401
        };
        if (falha === "timeout_nao_gravou") throw new TimeoutBling();
        const r = this.aplicar(ferramenta, args);
        if (falha === "timeout_gravou") throw new TimeoutBling();
        if (falha === "http_500_gravou") return {
            status: 500
        };
        return r;
    }
    aplicar(ferramenta, args) {
        const corpo = args.corpo;
        if (ferramenta === "bling.produtos.alterar") {
            const atual = this.produtos.get(args.id ?? "");
            if (!atual) return {
                status: 404
            };
            for (const [k, v] of Object.entries(corpo))atual[k] = v && typeof v === "object" ? {
                ...atual[k] ?? {},
                ...v
            } : v;
            return {
                status: 200,
                corpo: {
                    data: {
                        id: args.id
                    }
                }
            };
        }
        if (ferramenta === "bling.produtos.criar") {
            const id = String(this.proximoId++);
            this.produtos.set(id, structuredClone(corpo));
            return {
                status: 201,
                corpo: {
                    data: {
                        id: Number(id)
                    }
                }
            };
        }
        if (ferramenta === "bling.categorias.criar") {
            const id = this.proximoId++;
            this.categorias.push({
                id,
                descricao: String(corpo.descricao),
                idCategoriaPai: corpo.categoriaPai?.id
            });
            return {
                status: 201,
                corpo: {
                    data: {
                        id
                    }
                }
            };
        }
        return {
            status: 400
        };
    }
    async ler(ferramenta, args) {
        this.leituras++;
        const falha = this.falhas[0];
        if (falha === "leitura_timeout") {
            this.falhas.shift();
            throw new TimeoutBling();
        }
        if (ferramenta === "bling.categorias.consultar") return {
            status: 200,
            corpo: {
                data: this.categorias.map((c)=>({
                        id: c.id,
                        descricao: c.descricao,
                        categoriaPai: {
                            id: c.idCategoriaPai ?? 0
                        }
                    }))
            }
        };
        if (ferramenta === "bling.produtos.consultar") {
            const achados = [
                ...this.produtos.entries()
            ].filter(([, p])=>p.codigo === args.sku).map(([id, p])=>({
                    id: Number(id),
                    ...p
                }));
            return {
                status: 200,
                corpo: {
                    data: achados
                }
            };
        }
        const p = this.produtos.get(args.id ?? "");
        if (!p) return {
            status: 404
        };
        if (falha === "leitura_diverge") {
            this.falhas.shift();
            return {
                status: 200,
                corpo: {
                    data: {
                        id: Number(args.id),
                        ...structuredClone(p),
                        marca: "OUTRA"
                    }
                }
            };
        }
        return {
            status: 200,
            corpo: {
                data: {
                    id: Number(args.id),
                    ...structuredClone(p)
                }
            }
        };
    }
}

return { BlingMock: BlingMock };
})();

// ---------- supabase/functions/_shared/conector/cripto.ts ----------
const __m13 = (() => {
const enc = new TextEncoder();
const hex = (b)=>[
        ...new Uint8Array(b)
    ].map((x)=>x.toString(16).padStart(2, "0")).join("");
async function sha256Hex(texto) {
    return hex(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
}
const PREFIXO_TOKEN = "cia_mcp_";
function gerarToken() {
    const b = crypto.getRandomValues(new Uint8Array(32));
    const corpo = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = PREFIXO_TOKEN + corpo;
    return {
        token,
        prefixo: token.slice(0, PREFIXO_TOKEN.length + 6)
    };
}
const pareceTokenMcp = (t)=>/^cia_mcp_[A-Za-z0-9_-]{43}$/.test(t);
function igualConstante(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for(let i = 0; i < a.length; i++)d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

return { sha256Hex: sha256Hex, PREFIXO_TOKEN: PREFIXO_TOKEN, gerarToken: gerarToken, pareceTokenMcp: pareceTokenMcp, igualConstante: igualConstante };
})();

// ---------- supabase/functions/_shared/conector/acoes.ts ----------
const __m1 = (() => {
const { reconciliar: reconciliar, simularProposta: simularProposta, executarProposta: executarProposta } = __m2;
const { BlingMock: BlingMock } = __m12;
const { gerarToken: gerarToken, sha256Hex: sha256Hex } = __m13;
const { montarCorpoProduto: montarCorpoProduto } = __m6;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const erro = (status, mensagem, codigo)=>({
        status,
        corpo: {
            erro: mensagem,
            ...codigo ? {
                codigo
            } : {}
        }
    });
const ok = (corpo = {})=>({
        status: 200,
        corpo: {
            ok: true,
            ...corpo
        }
    });
const TRADUCOES = [
    [
        /versao_ou_hash_divergente/,
        409,
        "A proposta mudou desde que você a abriu. Abra a versão atual e aprove de novo."
    ],
    [
        /proposta_nao_pendente/,
        409,
        "Esta proposta já foi decidida, expirou ou foi substituída."
    ],
    [
        /proposta_expirada/,
        409,
        "A proposta expirou. Peça uma nova ao Nano.ia."
    ],
    [
        /sem_permissao/,
        403,
        "Você não tem permissão para esta ação nesta loja."
    ],
    [
        /confirmacao_explicita_obrigatoria/,
        422,
        "Risco alto: confirme explicitamente para aprovar."
    ],
    [
        /nada_aprovavel/,
        422,
        "Nenhum item pode ser aprovado: produtos travados ou fora do escopo."
    ],
    [
        /proposta_nao_encontrada|conversa_nao_encontrada|item_nao_encontrado/,
        404,
        "Não encontrado nesta loja."
    ],
    [
        /escrita_real_nao_liberada/,
        403,
        "A escrita no Bling está desligada para esta loja. Nada foi enviado."
    ],
    [
        /reconciliar_antes/,
        409,
        "Há uma operação com resultado desconhecido. Reconcilie antes de repetir."
    ],
    [
        /aprovacao_invalida|aprovacao_expirada|sem_aprovacao/,
        409,
        "A aprovação não vale mais para esta proposta."
    ],
    [
        /produto_travado|produto_em_execucao/,
        409,
        "Produto travado ou em execução."
    ],
    [
        /caminho_invalido/,
        422,
        "Caminho de anexo inválido."
    ],
    [
        /limite_de_chaves_ativas/,
        422,
        "Limite de chaves ativas atingido. Revogue uma chave antes de criar outra."
    ],
    [
        /expiracao_invalida/,
        422,
        "Informe uma expiração entre 1 minuto e 365 dias."
    ]
];
const traduz = (msg)=>{
    for (const [re, st, texto] of TRADUCOES)if (re.test(msg)) return erro(st, texto, (msg.match(re) ?? [])[0]);
    return erro(500, "Não foi possível concluir a ação.");
};
async function rpcOu(d, fn, args) {
    const { data, error } = await d.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
}
const uuid = (v)=>typeof v === "string" && UUID.test(v);
const uuids = (v)=>Array.isArray(v) && v.length > 0 && v.length <= 500 && v.every(uuid);
async function itemDaOperacao(d, lojaId, operacaoId) {
    const op = (await d.dados.from("agente_operacoes").select("item_id, estado").eq("loja_id", lojaId).eq("id", operacaoId).maybeSingle()).data;
    if (!op) return null;
    const it = (await d.dados.from("agente_proposta_itens").select("id, produto_id, operacao, alvo, campos, antes, depois, idempotency_key").eq("loja_id", lojaId).eq("id", op.item_id).maybeSingle()).data;
    if (!it) return null;
    return {
        item: {
            item_id: it.id,
            produto_id: it.produto_id,
            operacao: it.operacao,
            alvo: it.alvo,
            campos: it.campos,
            antes: it.antes,
            depois: it.depois,
            idempotency_key: it.idempotency_key
        },
        operacao: op.estado
    };
}
async function acaoAprovacoes(c, h, d) {
    try {
        switch(c.acao){
            case "decidir":
                {
                    if (!uuid(c.proposta_id) || !Number.isInteger(c.versao) || !/^[0-9a-f]{64}$/.test(String(c.hash)) || ![
                        "aprovada",
                        "rejeitada"
                    ].includes(c.decisao)) return erro(400, "Informe proposta_id, versao, hash e decisao (aprovada ou rejeitada).");
                    if (c.itens !== undefined && !uuids(c.itens)) return erro(400, "itens deve ser uma lista de ids.");
                    const r = await rpcOu(d, "agente_proposta_decidir", {
                        p_loja: h.lojaId,
                        p_proposta: c.proposta_id,
                        p_versao: c.versao,
                        p_hash: c.hash,
                        p_user: h.userId,
                        p_decisao: c.decisao,
                        p_itens: c.itens ?? null,
                        p_confirmacao_explicita: c.confirmacao_explicita === true
                    });
                    return r?.ok === false ? erro(409, "A proposta expirou. Peça uma nova ao Nano.ia.", "proposta_expirada") : ok(r ?? {});
                }
            case "revisar":
                {
                    if (!uuid(c.proposta_id)) return erro(400, "Informe proposta_id.");
                    return ok({
                        proposta_id: await rpcOu(d, "agente_proposta_revisar", {
                            p_loja: h.lojaId,
                            p_proposta: c.proposta_id,
                            p_user: h.userId
                        })
                    });
                }
            case "travar":
            case "destravar":
                {
                    if (!uuids(c.produtos)) return erro(400, "Informe a lista de produtos (até 500).");
                    const n = await rpcOu(d, c.acao === "travar" ? "produto_travar" : "produto_destravar", {
                        p_loja: h.lojaId,
                        p_produtos: c.produtos,
                        p_user: h.userId,
                        p_motivo: String(c.motivo ?? "").slice(0, 200)
                    });
                    return ok({
                        produtos_afetados: n
                    });
                }
            case "executar_simulado":
                {
                    if (!uuid(c.proposta_id)) return erro(400, "Informe proposta_id.");
                    const mock = new BlingMock();
                    const itens = await rpcOu(d, "agente_proposta_validar", {
                        p_loja: h.lojaId,
                        p_proposta: c.proposta_id
                    });
                    const semeadoDe = [];
                    for (const it of itens)if (it.operacao === "bling.produtos.alterar" && it.alvo) {
                        const lido = d.blingLeitura ? await d.blingLeitura.ler("bling.produtos.confirmar", {
                            id: it.alvo
                        }).catch(()=>null) : null;
                        const base = lido?.status === 200 ? lido.corpo?.data : null;
                        if (base) {
                            mock.semear(it.alvo, base);
                            semeadoDe.push(`${it.alvo}: leitura real do Bling`);
                        } else {
                            mock.semear(it.alvo, montarCorpoProduto(it.antes ?? {}).corpo);
                            semeadoDe.push(`${it.alvo}: valores 'antes' da proposta (leitura real indisponível)`);
                        }
                    }
                    const rel = await simularProposta({
                        rpc: d.rpc,
                        bling: mock,
                        lojaId: h.lojaId,
                        propostaId: c.proposta_id,
                        userId: h.userId
                    });
                    return ok({
                        relatorio: rel,
                        semeado_de: semeadoDe,
                        aviso: "Ensaio: nada foi enviado ao Bling e nenhum estado mudou."
                    });
                }
            case "executar":
                {
                    if (!uuid(c.proposta_id)) return erro(400, "Informe proposta_id.");
                    if (!d.blingLeitura) return erro(503, "Leitura do Bling indisponível para confirmar a execução.");
                    const rel = await executarProposta({
                        rpc: d.rpc,
                        bling: d.blingLeitura,
                        lojaId: h.lojaId,
                        propostaId: c.proposta_id
                    });
                    if (rel.erro) return traduz(rel.erro);
                    return ok({
                        relatorio: rel
                    });
                }
            case "reconciliar":
                {
                    if (!uuid(c.operacao_id)) return erro(400, "Informe operacao_id.");
                    if (!d.blingLeitura) return erro(503, "Leitura do Bling indisponível para reconciliar.");
                    const alvo = await itemDaOperacao(d, h.lojaId, c.operacao_id);
                    if (!alvo) return erro(404, "Operação não encontrada nesta loja.");
                    const r = await reconciliar({
                        rpc: d.rpc,
                        bling: d.blingLeitura,
                        lojaId: h.lojaId,
                        operacaoId: c.operacao_id,
                        userId: h.userId,
                        item: alvo.item
                    });
                    return ok({
                        resultado: r,
                        aviso: r === "indeterminado" ? "O Bling não deu prova de que gravou nem de que não gravou. Confira no Bling e reconcilie manualmente." : undefined
                    });
                }
            default:
                return erro(400, "Ação desconhecida.");
        }
    } catch (e) {
        return traduz(e.message);
    }
}
async function acaoChaves(c, h, d) {
    try {
        if (c.acao === "criar") {
            const nome = String(c.nome ?? "").trim();
            if (nome.length < 2 || nome.length > 80) return erro(400, "Dê um nome à chave (2 a 80 caracteres).");
            const escopos = Array.isArray(c.escopos) ? c.escopos : [];
            if (escopos.length === 0 || !escopos.every((x)=>x === "leitura" || x === "propor" || x === "simular")) return erro(400, "Escopos válidos: leitura, propor e simular. Aprovar e executar não existem para clientes externos.");
            const exp = new Date(String(c.expira_em));
            if (Number.isNaN(exp.getTime())) return erro(400, "Informe a expiração (data ISO).");
            const { token, prefixo } = gerarToken();
            const id = await rpcOu(d, "mcp_chave_criar", {
                p_loja: h.lojaId,
                p_user: h.userId,
                p_nome: nome,
                p_cliente: String(c.cliente ?? "").slice(0, 60) || null,
                p_hash: await sha256Hex(token),
                p_prefixo: prefixo,
                p_escopos: escopos,
                p_expira_em: exp.toISOString()
            });
            return ok({
                id,
                token,
                prefixo,
                aviso: "Copie o token agora: ele não será mostrado de novo."
            });
        }
        if (c.acao === "revogar") {
            if (!uuid(c.id)) return erro(400, "Informe o id da chave.");
            const r = await rpcOu(d, "mcp_chave_revogar", {
                p_loja: h.lojaId,
                p_chave: c.id,
                p_user: h.userId
            });
            return r ? ok() : erro(404, "Chave não encontrada ou já revogada.");
        }
        return erro(400, "Ação desconhecida.");
    } catch (e) {
        return traduz(e.message);
    }
}
const MIMES_ANEXO = {
    "image/png": "imagem",
    "image/jpeg": "imagem",
    "image/webp": "imagem",
    "application/pdf": "documento",
    "text/plain": "documento",
    "text/csv": "documento"
};
const MAX_ANEXO = 20 * 1024 * 1024;
const nomeSeguro = (n)=>n.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/\.{2,}/g, ".").replace(/^[._]+|[._]+$/g, "").slice(-100) || "arquivo";
async function acaoConversas(c, h, d) {
    try {
        switch(c.acao){
            case "criar":
                {
                    const id = await rpcOu(d, "agente_conversa_criar", {
                        p_loja: h.lojaId,
                        p_user: h.userId,
                        p_titulo: String(c.titulo ?? "Nova conversa"),
                        p_provedor: null,
                        p_modelo: null
                    });
                    return ok({
                        id
                    });
                }
            case "excluir":
                {
                    if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
                    return await rpcOu(d, "agente_conversa_excluir", {
                        p_loja: h.lojaId,
                        p_conversa: c.conversa_id,
                        p_user: h.userId
                    }) ? ok() : erro(404, "Conversa não encontrada.");
                }
            case "renomear":
                {
                    if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
                    return await rpcOu(d, "agente_conversa_renomear", {
                        p_loja: h.lojaId,
                        p_conversa: c.conversa_id,
                        p_user: h.userId,
                        p_titulo: c.titulo ?? null,
                        p_projeto: c.projeto ?? null
                    }) ? ok() : erro(404, "Conversa não encontrada.");
                }
            case "preparar_anexo":
                {
                    if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
                    const tipo = MIMES_ANEXO[String(c.mime)];
                    if (!tipo) return erro(422, "Tipo de arquivo não permitido (imagens PNG/JPEG/WebP, PDF, TXT ou CSV).");
                    if (!Number.isInteger(c.bytes) || c.bytes <= 0 || c.bytes > MAX_ANEXO) return erro(422, "Arquivo vazio ou maior que 20 MB.");
                    const dono = (await d.dados.from("agente_conversas").select("id").eq("id", c.conversa_id).eq("loja_id", h.lojaId).eq("user_id", h.userId).maybeSingle()).data;
                    if (!dono) return erro(404, "Conversa não encontrada.");
                    const path = `${h.lojaId}/${h.userId}/${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(String(c.nome ?? "arquivo"))}`;
                    const up = await d.assinarUpload?.(path);
                    return up ? ok({
                        ...up,
                        tipo
                    }) : erro(503, "Armazenamento de anexos indisponível.");
                }
            case "registrar_anexo":
                {
                    if (!uuid(c.conversa_id)) return erro(400, "Informe conversa_id.");
                    const tipo = MIMES_ANEXO[String(c.mime)];
                    if (!tipo || !/^[0-9a-f]{64}$/.test(String(c.sha256)) || !Number.isInteger(c.bytes) || c.bytes <= 0 || c.bytes > MAX_ANEXO) return erro(422, "Anexo inválido.");
                    const id = await rpcOu(d, "agente_anexo_registrar", {
                        p_loja: h.lojaId,
                        p_conversa: c.conversa_id,
                        p_user: h.userId,
                        p_tipo: tipo,
                        p_nome: String(c.nome ?? "arquivo").slice(0, 200),
                        p_mime: c.mime,
                        p_bytes: c.bytes,
                        p_sha256: c.sha256,
                        p_path: String(c.path ?? "")
                    });
                    return ok({
                        id
                    });
                }
            case "baixar_anexo":
                {
                    if (!uuid(c.anexo_id)) return erro(400, "Informe anexo_id.");
                    const a = (await d.dados.from("agente_anexos").select("storage_path, conversa_id").eq("loja_id", h.lojaId).eq("id", c.anexo_id).maybeSingle()).data;
                    const dono = a && (await d.dados.from("agente_conversas").select("id").eq("id", a.conversa_id).eq("loja_id", h.lojaId).eq("user_id", h.userId).maybeSingle()).data;
                    if (!a || !dono) return erro(404, "Anexo não encontrado.");
                    const url = await d.assinarDownload?.(a.storage_path, 300);
                    return url ? ok({
                        url,
                        expira_em_segundos: 300
                    }) : erro(503, "Armazenamento de anexos indisponível.");
                }
            default:
                return erro(400, "Ação desconhecida.");
        }
    } catch (e) {
        return traduz(e.message);
    }
}

return { acaoAprovacoes: acaoAprovacoes, acaoChaves: acaoChaves, MIMES_ANEXO: MIMES_ANEXO, MAX_ANEXO: MAX_ANEXO, nomeSeguro: nomeSeguro, acaoConversas: acaoConversas };
})();

// ---------- supabase/functions/_shared/plataforma.ts ----------
const __m15 = (() => {
const { chaveiroDoAmbiente: chaveiroDoAmbiente } = __m10;
async function doVault(admin, nome) {
    const { data } = await admin.rpc("plataforma_segredo", {
        p_nome: nome
    });
    return typeof data === "string" && data ? data : undefined;
}
async function segredoEstado(admin, get) {
    return get("ESTADO_SEGREDO") || await doVault(admin, "plataforma_estado_segredo");
}
async function chaveiroPlataforma(admin, get) {
    return chaveiroDoAmbiente(get) ?? await doVault(admin, "plataforma_chave_cifra_k1");
}

return { segredoEstado: segredoEstado, chaveiroPlataforma: chaveiroPlataforma };
})();

// ---------- supabase/functions/_shared/bling_armazem.ts ----------
const __m16 = (() => {
function armazemSupabase(admin) {
    return {
        async ler (lojaId) {
            const { data, error } = await admin.rpc("bling_ler_credenciais", {
                p_loja_id: lojaId
            });
            if (error) throw new Error("falha ao ler credenciais");
            return (data ?? [])[0] ?? null;
        },
        async reservar (lojaId, por, ttlS) {
            const { data, error } = await admin.rpc("bling_reservar_renovacao", {
                p_loja_id: lojaId,
                p_por: por,
                p_ttl_s: ttlS
            });
            if (error) throw new Error("falha ao reservar renovação");
            return data === true;
        },
        async liberar (lojaId, por) {
            await admin.rpc("bling_liberar_renovacao", {
                p_loja_id: lojaId,
                p_por: por
            });
        },
        async salvar (lojaId, access, refresh, expiraEm) {
            const { error } = await admin.rpc("bling_salvar_credenciais", {
                p_loja_id: lojaId,
                p_access: access,
                p_refresh: refresh,
                p_expira_em: expiraEm
            });
            if (error) throw new Error("falha ao salvar credenciais");
        },
        async lerApp (lojaId) {
            const { data, error } = await admin.rpc("bling_ler_app", {
                p_loja_id: lojaId
            });
            if (error) throw new Error("falha ao ler o app do Bling");
            return (data ?? [])[0] ?? null;
        },
        async marcar (lojaId, status, erro) {
            await admin.rpc("bling_marcar_status", {
                p_loja_id: lojaId,
                p_status: status,
                p_erro: erro
            });
        }
    };
}

return { armazemSupabase: armazemSupabase };
})();

// ---------- supabase/functions/_shared/conector/edge.ts ----------
const __m14 = (() => {
const { createClient: createClient } = __sdk;
const { decifrar: decifrar } = __m10;
const { chaveiroPlataforma: chaveiroPlataforma } = __m15;
const { armazemSupabase: armazemSupabase } = __m16;
const { BlingLeituraReal: BlingLeituraReal } = __m7;
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (o, status = 200)=>new Response(JSON.stringify(o), {
        status,
        headers: {
            ...CORS,
            "Content-Type": "application/json"
        }
    });
async function autenticar(req, lojaId) {
    if (req.method === "OPTIONS") return new Response("ok", {
        headers: CORS
    });
    if (req.method !== "POST") return json({
        erro: "Método não permitido."
    }, 405);
    const url = Deno.env.get("SUPABASE_URL");
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY"), {
        global: {
            headers: {
                Authorization: req.headers.get("Authorization") ?? ""
            }
        },
        auth: {
            persistSession: false
        }
    });
    const { data: u } = await usuario.auth.getUser();
    if (!u.user) return json({
        erro: "Não autenticado."
    }, 401);
    if (typeof lojaId !== "string" || !/^[0-9a-f-]{36}$/i.test(lojaId)) return json({
        erro: "Informe loja_id."
    }, 400);
    const { data: m } = await usuario.from("usuarios_loja").select("papel").eq("loja_id", lojaId).eq("user_id", u.user.id).maybeSingle();
    if (!m) return json({
        erro: "Você não tem acesso a esta loja."
    }, 403);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: {
            persistSession: false
        }
    });
    const { data: loja } = await admin.from("lojas").select("nome, ativa").eq("id", lojaId).maybeSingle();
    if (!loja || loja.ativa === false) return json({
        erro: "Loja não encontrada."
    }, 404);
    return {
        url,
        admin,
        userId: u.user.id,
        lojaId,
        papel: m.papel,
        nomeLoja: loja.nome
    };
}
async function blingLeitura(s) {
    const chaveCifra = await chaveiroPlataforma(s.admin, (n)=>Deno.env.get(n));
    return chaveCifra ? new BlingLeituraReal(armazemSupabase(s.admin), s.lojaId, {
        chaveCifra
    }) : undefined;
}
const decifrarComChaveiro = async (s)=>{
    const chaveiro = await chaveiroPlataforma(s.admin, (n)=>Deno.env.get(n));
    if (!chaveiro) throw new Error("Chave de cifra da plataforma não configurada.");
    return (cifrada)=>decifrar(cifrada, chaveiro);
};

return { CORS: CORS, json: json, autenticar: autenticar, blingLeitura: blingLeitura, decifrarComChaveiro: decifrarComChaveiro };
})();

// ---------- supabase/functions/conector-aprovacoes/index.ts ----------
const __m0 = (() => {
const { acaoAprovacoes: acaoAprovacoes } = __m1;
const { autenticar: autenticar, blingLeitura: blingLeitura, json: json } = __m14;
Deno.serve(async (req)=>{
    const c = await req.clone().json().catch(()=>({}));
    const s = await autenticar(req, c?.loja_id);
    if (s instanceof Response) return s;
    const r = await acaoAprovacoes(c, {
        userId: s.userId,
        lojaId: s.lojaId
    }, {
        rpc: (fn, args)=>s.admin.rpc(fn, args),
        dados: s.admin,
        blingLeitura: await blingLeitura(s)
    });
    return json(r.corpo, r.status);
});

return {  };
})();
