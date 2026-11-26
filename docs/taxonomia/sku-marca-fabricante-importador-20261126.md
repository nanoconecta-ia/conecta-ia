# Taxonomia multidimensional: SKU Bling, marca, fabricante e importador
Data: 2026-11-26. PROPOSTA para homologação, não é migração executada nem página publicada.

## Princípio
A identidade física é (loja_id, produto_id / bling_id), com SKU Bling como chave comercial de consulta. Não clonar produto, saldo, SKU ou nota fiscal ao criar aplicações, páginas de marca ou códigos cruzados. Código do fornecedor pode coincidir com SKU, mas é um identificador distinto até haver comprovação. O código OEM original não é necessariamente o código MPN da peça vendida.

## Modelo existente no repositório
- produtos.taxonomia_no_id → classificação de peça.
- marcas (tipo veiculo/peca), produto_codigos (sku, oem, fabricante, ean, similar, substituto, antigo), produto_aplicacoes.
- Registro inicial de fabricantes em busca_segura/fabricantes.ts é lista de pesquisa, não fornecedor homologado; categoria singular não limita portfólio real.
- Migração 20261014000002 estabelece segregação por loja, RLS e evidência para aprovação.
- A diretriz canônica de 25/11/2026 individualiza páginas por aplicação e mantém preço/estoque públicos desligados.
- Esta inspeção é do GitHub, não do schema implantado.

## Extensão proposta (reusar entidades existentes quando possível)
1. Manter marca comercial da peça separada da montadora. Associar organizações verificadas em papéis fabricante, importador, distribuidor e fornecedor fiscal, com vigência e fonte por produto. Uma organização pode exercer vários papéis. Não inferir fabricante/importador pelo emissor da NF ou pela marca.
2. Códigos: SKU Bling original; código do fornecedor (escopo fornecedor); MPN (escopo fabricante/marca); OEM (escopo montadora); GTIN validado; cruzado/substituto com relação direta, direção e evidência. Não propagar equivalência transitiva. Identidade do código inclui emissor; não fundir códigos iguais de marcas diferentes.
3. Evidências: origem (NF-e, catálogo oficial, EPC), referência, data, campo comprovado, status e responsável. A NF de entrada comprova identidade fiscal e origem comercial, não necessariamente aplicação ou equivalência. Dados fiscais completos, preço de custo, fornecedor comercial e identificadores internos privados não entram no payload público.
4. Uma organização/marca pode atender múltiplas categorias. Não criar uma cópia da árvore Motor para cada marca. Usar facetas e projeções de produtos com vínculos aprovados. Cadastro MAHLE/Metal Leve, MANN-FILTER, Wega (conferir grafia Vega na NF), Tecfil são exemplos de pesquisa, não homologação de vínculo.
5. Caminho exemplo de classificação funcional: Motor > Lubrificação > Filtro de óleo; Alimentação de combustível > Filtragem > Filtro de combustível; Admissão > Filtragem > Filtro de ar; Climatização > Filtragem > Filtro de cabine; demais filtros internos classificados pelo sistema e função efetivos. Faceta Filtragem reúne os tipos sem duplicar o nó funcional.
6. Página de marca proposta: /marcas/[slug], com identidade aprovada, categorias, produtos publicados da marca e filtros de aplicação homologada. /fabricantes/[slug] e /importadores/[slug] apenas se papel e divulgação autorizados; manter distinção de marca, entidade e fornecedor fiscal. Link para fichas e páginas individuais por aplicação existentes. Evitar páginas vazias ou duplicadas indexáveis. Slug estável; aliases verificados; sem alegação de representação oficial.
7. Banco de imagens: ícones de categoria, fotos do SKU real, referências OEM/EPC e logos separados. Reutilizar MA Vision para variantes autorizadas; a mesma referência técnica só pode servir a mais de um SKU com vínculo documentado.
8. Agente começa no SKU do Bling e resolve produto no tenant correto. Confere código do fornecedor/MPN na NF ou catálogo; registra evidência OEM e aplicação; propõe marca e papéis; classifica função; propõe imagem; revisa; gera projeção de página em rascunho. Ausência de evidência = pendente, não publica.

## Homologação
- Auditar schema e API pública reais antes de desenhar migração, evitar tabela/coluna duplicada e reforçar RLS/tenant.
- Primeiro SKU: filtro de óleo MAHLE Metal Leve existente no Bling. Identidade ainda não localizada; cruzamento específico não confirmado.
- Testes: mesmo SKU aparece na categoria, marca e aplicações sem duplicar estoque; dois fabricantes com mesmo código não são fundidos; importador não vira fabricante; equivalência sem fonte não publicada; nenhum custo, NF integral, fornecedor fiscal ou estoque/preço privado vaza.
- Nenhuma alteração de banco, ERP, estoque, publicação, DNS ou permissões neste documento. Implementação requer homologação e aprovação explícita.
