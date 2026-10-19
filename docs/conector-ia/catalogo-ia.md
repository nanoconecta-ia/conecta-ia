# Catálogo IA — extração, validação e classificação de cadastro de autopeças

Ferramenta em `scripts/catalogo_ia/`. Lê um CSV (`sku,nome,descricao,marca,gtin`) e gera **propostas** em JSONL com status `a_confirmar`. Não grava no Bling.

```
python3 -m scripts.catalogo_ia.cli entrada.csv saida.jsonl
python3 -m unittest scripts.catalogo_ia.tests.test_catalogo
```

## O que é determinístico (código, não IA)
- Código OEM no formato `XXXXX-XXXXX`: limpa espaço, ponto, barra e caixa. A **confiança nunca é alta**: sem separador nem rótulo ("OEM", "original", "Hyundai"…) fica `baixa`, porque `15105605RS` (Sabó) tem a mesma forma de um código da montadora.
- GTIN: confere o dígito verificador.
- Anos: só os que o texto escreve (`2013+` = início 2013, em aberto). Nunca expande.
- Motor, emissão, veículos citados e bloco `NÃO SE APLICA`: sempre trechos do texto.
- Classe da peça: `genuina` só com marca da montadora e declaração; `oem` só se a marca estiver em `dados/fornecedores_homologados.csv` **com fonte** (arquivo vazio por padrão); senão `a_confirmar`.
- Referência cruzada: vazia. Só entra de tabela com fonte, nunca da memória do modelo.

## IA (opcional)
`llm.py` recebe uma função `enviar(sistema, usuario) -> texto`. A resposta passa por `validar_saida_llm`: código, ano, motor e `NÃO SE APLICA` que não estejam no texto de origem são descartados, e a taxonomia fora da lista fechada (`dados/taxonomia.json`, espelho da semente da migração) também. O envio real a um provedor não foi testado nesta entrega (sem chave e sem rede nos testes).

## Limites conhecidos
- A taxonomia ainda é **proposta** até o lojista aprovar; a extração não atribui categoria sozinha.
- A lista de motores (`dados/motores.json`) só tem códigos citados no cadastro do piloto e na genealogia; ampliar exige fonte.
