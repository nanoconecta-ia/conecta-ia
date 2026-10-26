# Modelo de importação para enriquecimento (código da montadora como base)

Uma linha por **fato**, não por produto: o mesmo SKU pode ter várias linhas (uma por aplicação, por medida ou por equivalente).
**Nada é gravado direto:** tudo entra na Fila de aprovação como "a confirmar", com fonte e data.

| Coluna | O que vai | Obrigatória |
|---|---|---|
| `sku_loja` | SKU do produto no Bling da loja (para ligar ao cadastro) | sim |
| `codigo_montadora` | código original (OEM) da peça | sim |
| `montadora` | quem emite o código (ex.: Mitsubishi, Hyundai) | sim |
| `fabricante` / `codigo_fabricante` | quem fabrica a peça e o código dele (ex.: Mahle Metal Leve, LuK, Valeo, Sachs) | quando houver |
| `tipo_relacao` | `original`, `referencia_cruzada`, `equivalente_validado`, `substituicao_engenharia` ou `substituto_homologado` | sim |
| `codigo_novo_substituto` | no caso de peça melhorada ou atualizada: o código novo (o antigo fica na coluna `codigo_montadora`) | quando houver |
| `veiculo_marca`, `veiculo_modelo`, `motor`, `cilindrada`, `ano_inicial`, `ano_final` | aplicação | quando houver |
| `medida_nome`, `medida_valor`, `medida_unidade` | uma medida por linha (ex.: diâmetro, 91,1, mm) | quando houver |
| `contraindicacao` | texto curto: o que NÃO combina | quando houver |
| `fonte` | portal ou catálogo de onde veio (ex.: "portal B2B do fornecedor X") | **sim** |
| `data_consulta` | AAAA-MM-DD | **sim** |

Regras: não preencher o que a fonte não diz (deixe vazio); equivalente não é idêntico, então só marque `equivalente_validado` quando a fonte validar; sem `fonte` e `data_consulta` a linha é recusada.
