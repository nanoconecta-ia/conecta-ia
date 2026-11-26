# Piloto técnico Nano Engineering — somente CI descartável

Gate anterior: b53c525, workflow 45882304502, jobs funcoes e banco concluídos com sucesso. Este avanço bloqueia conflitos Nano produzidos por RPCs legadas e DML, preservando conflito legado. Integra a função TypeScript de persistência à fixture PostgreSQL de um SKU sintético existente: duas conexões/execuções disputam o mesmo lease, esperam uma gravação e um retry idempotente; readback verifica hashes, fila/histórico imutados e zero custos. Não inicia consumidor em produção.

Limites: hash é integridade, não autenticidade semântica; o SKU de teste não comprova aplicações/OEM reais. Ainda é necessário validar fontes autorizadas por fato e escopo, identidade independente do auditor, autorizações específicas de serviço, recuperação após perda de resposta e aprovação administrativa. Nenhum deploy ou ativação. Nota 1,00 somente por gates completos na revisão correspondente, não por declaração do autor.
