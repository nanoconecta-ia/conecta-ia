# Backup / snapshot do Bling dentro do Conecta: desenho para aprovação

Estado (2026-10-19): **implementado no repositório (PR #53) e testado; NÃO aplicado em produção**. O dono aprovou o desenho. Aplicar a migração, publicar a função e ligar a tela exigem autorização específica, um passo por vez.
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

## O que foi implementado (PR #53)
- Migração `20261019000019_bling_snapshots.sql`: `bling_snapshots`, `bling_snapshot_produtos`, `bling_snapshot_categorias`, `bling_snapshot_contatos`; RLS só para o administrador da loja (o editor não lê, porque há custo e fornecedor); funções `bling_snapshot_iniciar/gravar/concluir/podar` só para service_role; a poda nunca apaga o último backup completo. Teste: `supabase/tests/bling_snapshots.sql` (19 verificações).
- `_shared/bling_snapshot.ts`: as 59 colunas do Bling, formatação no padrão do Bling (vírgula decimal, ponto de milhar), CSV, hash estável, comparação snapshot x Bling e a coleta (`executarBackup`) com portas só de leitura, orçamento de tempo e estados completo/parcial/falhou. 12 testes.
- Função `bling-backup`: cron diário, "executar" (administrador, 4 por hora) e "csv" (a partir do que já está guardado, funciona com o Bling fora do ar).
- Tela "Backup do Bling" (`/backup`), escondida por `VITE_BACKUP_ATIVO=1`: lista, "Fazer backup agora", "Baixar CSV". 4 testes.
- Prompt do agente (`PROMPT_PADRAO`, regras 8g e 8h): fatos confirmados do Bling, limites das ferramentas, como ler uma negativa e uso do backup.

## Para colocar em produção (cada passo com autorização específica)
1. Aplicar a migração 0019 (cria tabelas novas; não altera nada existente).
2. Gerar a versão autocontida de `bling-backup` (`node scripts/empacotar-funcao.mjs bling-backup`) e publicar com `verify_jwt = false`.
3. Agendar o cron diário (mesmo segredo `x-cron-segredo` da `bling-sync`).
4. Republicar o painel com `VITE_BACKUP_ATIVO=1`.
5. Primeiro backup manual e conferência do CSV.

## Limites conhecidos
- Os caminhos da API do Bling para vínculos de fornecedor (`/produtos/fornecedores`), contatos e categorias estão marcados "conferido: false": a documentação oficial não pôde ser aberta do ambiente de desenvolvimento. O primeiro backup real mostra se estão certos.
- O formato exato de **Categoria do produto** em subcategorias (nome só ou "Pai > Filho") e o de **Tags** no CSV ainda precisam de teste de importação com 1 produto. O CSV sai com o nome da categoria.
- Se o backup ficar parcial (muitos produtos, tempo esgotado), a próxima rodada faz um novo snapshot; a retomada incremental fica para uma etapa seguinte.
