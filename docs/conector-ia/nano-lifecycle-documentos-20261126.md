# Registro documental privado — minuta de homologação

Fonte cadastrada por autoridade administrativa, desabilitada por padrão. Documento textual versionado com SHA-256 calculado pelo banco e referência de origem, sem alteração ou exclusão por DML ordinário. A leitura retorna o contrato FonteAutorizada/Documento do gate existente e só permite sessões de auditor habilitadas para a loja. Revogar fonte ou acesso impede novas leituras, e documento com data futura é retido. Fixture inteiramente sintética. Não cria credenciais reais, não importa catálogo externo e não certifica autenticidade do emissor, licença ou compatibilidade. Ainda faltam política de licenciamento/retenção, ingestão real autorizada, atestação independente por fato e adaptador de transporte. A imutabilidade exige política administrativa de correção e retenção antes de qualquer produção. Nenhuma migração hospedada, ERP, custo, preço ou publicação.

## Correção de homologação

O job banco 140159342711 (run 45892806650) rejeitou a coluna gerada porque convert_to não é IMMUTABLE. Substituída por cálculo obrigatório em trigger BEFORE INSERT e CHECK do hash sobre conteúdo UTF-8. Hash divergente fornecido é recusado; imutabilidade posterior permanece. Acrescentados testes de acento, barra, quebra de linha e hash falso. Nova revisão depende de CI; não enfraquecer o gate nem remover testes. Nenhum deploy.

A revisão aeab7b9 falhou por duplicação textual introduzida na edição (run 45892996903, job 140159977985). Arquivo reconstruído a partir de f208ebf com substituição literal, uma única transação e definição de tabela, preservando o trigger e o CHECK. Verificação estrutural realizada; homologação SQL ainda depende de CI.
