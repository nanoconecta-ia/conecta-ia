# Resultado técnico Nano Engineering — minuta de homologação

A função registra uma extração candidata determinística produzida pelo extrator existente. O banco revalida a entrada integral contra o snapshot atual e o lease ativo (loja, tarefa, execução, geração e versão); grava recibos SHA-256 e mantém a evidência em tabela privada, sem UPDATE/DELETE para o consumidor ou serviço. Uma evidência por geração da tarefa, retry idêntico idempotente enquanto o lease for válido. Nova geração pode registrar nova evidência, sem sobrescrever a anterior.

A validação SQL do envelope não demonstra a correção semântica de cada candidato: um chamador privilegiado poderia enviar conteúdo candidato falso. Não consumir essa tabela como aplicação homologada, nem liberar transições com base em seus hashes. A criação de tarefas, o histórico da fila, validação semântica independente e testes de concorrência específicos da persistência continuam pendentes. A função não foi ligada ao worker e não autoriza custo, publicação, compra, ERP ou deploy.

Somente CI descartável; não aplicar em produção.
