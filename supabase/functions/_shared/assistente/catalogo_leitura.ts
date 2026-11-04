// Leitura do CATÁLOGO ESPELHADO da loja (totais, lista, ficha), oferecida ao chat persistente, inclusive ao modelo GRATUITO.
// Só leitura do banco do Conecta.IA, com os dados já saneados: nenhuma devolve custo, preço de compra, fornecedor, dado fiscal nem credencial.
// O espelho NÃO é o total ao vivo do Bling: o Nano precisa dizer isso e a data da última sincronização.
export const FERRAMENTAS_CATALOGO = ["resumo_loja", "listar_produtos", "ver_produto", "diagnostico_ia"] as const;

export const REGRA_CATALOGO = "Para saber qual IA está respondendo, se houve limite, 429/502/timeout ou quanto demorou, use diagnostico_ia (devolve request_id por turno); cite o request_id ao reportar problema. "
  + "Para saber QUANTOS produtos a loja tem, use resumo_loja; para listar ou procurar por nome, listar_produtos; para a ficha de um SKU, ver_produto. "
  + "Essas ferramentas leem o ESPELHO do Bling no Conecta.IA, não o total ao vivo do Bling: diga isso, cite quantos estão ativos e a data de ultima_sincronizacao, e não diga que não consegue contar.";
