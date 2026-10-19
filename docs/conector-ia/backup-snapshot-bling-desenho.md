# Backup / snapshot do Bling dentro do Conecta: desenho para aprovação

Estado: **proposta, nada criado**. Pela regra do projeto, tabelas e migrações só depois de aprovação.
Fonte do formato: planilha de exportação de produtos do próprio Bling (59 colunas, `produtos_2026-10-19-19-25-35.csv`).

## Objetivo
1. Guardar no Conecta uma cópia completa e versionada do cadastro do Bling (todas as "gavetas"), para o agente consultar sem depender da API lenta.
2. Gerar CSV no **mesmo formato do Bling**, para download/upload.
3. Servir de base para o chat nativo e para os agentes por QR.
Regra mantida: o Conecta **não grava no Bling sozinho**. Alteração = proposta, aprovação da versão exata, idempotência, leitura de confirmação, auditoria. Duas rotas de gravação: API (ferramenta liberada + escopo do app) ou CSV importado pelo lojista.

## Mapa das 59 colunas da planilha do Bling para a API v3
(Campo da API como visto em `GET /produtos/{id}`. "?" = sem equivalente confirmado.)

| Coluna do Bling | Campo da API |
|---|---|
| ID | id |
| Código | codigo |
| Descrição | nome |
| Unidade | unidade |
| NCM | tributacao.ncm |
| Origem | tributacao.origem |
| Preço | preco |
| Valor IPI fixo | tributacao.valorIpiFixo |
| Observações | observacoes |
| Situação | situacao |
| Estoque | estoque.saldoVirtualTotal |
| Preço de custo | vínculo de fornecedor: precoCusto |
| Cód. no fornecedor | vínculo: codigo |
| Fornecedor | vínculo: fornecedor (contato) |
| Localização | estoque.localizacao |
| Estoque máximo / mínimo | estoque.maximo / minimo |
| Peso líquido / bruto (Kg) | pesoLiquido / pesoBruto |
| GTIN/EAN; GTIN/EAN da Embalagem | gtin; gtinEmbalagem |
| Largura / Altura / Profundidade | dimensoes.largura / altura / profundidade |
| Data Validade | dataValidade |
| Descrição do Produto no Fornecedor | vínculo: descricao |
| Descrição Complementar | descricaoComplementar |
| Itens p/ caixa | itensPorCaixa |
| Produto Variação; Código Pai; Clonar dados do pai | variacao / (importação) |
| Tipo Produção | tipoProducao |
| Classe de enquadramento do IPI | tributacao.classeEnquadramentoIpi |
| Código na Lista de Serviços | tributacao.codigoListaServicos |
| Tipo do item | tributacao.spedTipoItem |
| **Grupo de Tags/Tags** | **? (sem campo na API v3 conhecida; existe na planilha)** |
| Tributos | tributacao.percentualTributos |
| Código Integração | ? |
| Grupo de produtos | tributacao.grupoProduto.id |
| Marca | marca |
| CEST | tributacao.cest |
| Volumes | volumes |
| Descrição Curta | descricaoCurta |
| Cross-Docking | estoque.crossdocking |
| URL Imagens Externas | midia.imagens.externas |
| Link Externo | linkExterno |
| Meses Garantia no Fornecedor | vínculo: garantia |
| Condição do Produto | condicao |
| Frete Grátis | freteGratis |
| Número FCI | tributacao.nFCI |
| Vídeo | midia.video.url |
| Departamento | ? |
| Unidade de Medida | dimensoes.unidadeMedida |
| Preço de Compra | vínculo: precoCompra |
| Valor base ICMS ST para retenção; Valor ICMS ST para retenção; Valor ICMS próprio do substituto | tributacao.valorBaseStRetencao; valorStRetencao; valorICMSSubstituto |
| **Categoria do produto** | categoria.id |
| Informações Adicionais | tributacao.dadosAdicionais |

## Proposta de tabelas (rascunho, sem migração)
- `bling_snapshots (id, loja_id, criado_em, origem, versao, contagens jsonb)`: uma linha por coleta.
- `bling_snapshot_produtos (snapshot_id, bling_id, codigo, json_api jsonb, json_vinculos jsonb, hash)`: o JSON completo de cada produto, mais os vínculos de fornecedor. Imutável.
- `bling_snapshot_categorias`, `bling_snapshot_contatos`: mesma ideia, para categorias e fornecedores.
- Exportação CSV: função que lê um snapshot e monta as 59 colunas na ordem do Bling (números com vírgula, aspas, codificação UTF-8). RLS por loja; só service_role escreve.
- Coleta: sob demanda ("Sincronizar agora") e diária. Leitura do Bling apenas.

## Pontos a conferir antes de implementar
- Formato exato aceito na importação para **Grupo de Tags/Tags** e **Categoria do produto** (caminho "Pai > Filho"? separador?). Testar com 1 produto.
- Se o Bling importa pelo **ID** (a planilha traz ID) para atualizar produto existente.
- Contatos e categorias: pedir as planilhas modelo correspondentes.
