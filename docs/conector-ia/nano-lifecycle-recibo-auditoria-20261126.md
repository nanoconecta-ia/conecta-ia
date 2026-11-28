# Recuperação de recibo e leitura independente — minuta CI

Base a996b3a: 10/10 workflows aprovados. Recibo histórico de Engineering é recuperado pela tupla loja/item/execução/geração/versão, com verificação dos hashes armazenados, sem renovar lease, reexecutar, alterar fila ou declarar homologação. Serviço continua credencial ampla confiável apenas no protótipo; isolamento por identidade de serviço específico ainda pendente.

A leitura de evidência persistida é RPC interna sem acesso do produtor. Papel de auditoria não possui acesso direto às tabelas, e o leitor restrito é limitado por autorização administrativa do login DB real (session_user) e loja via RLS. O login postgres é usado unicamente na fixture descartável; não se provisionou login, senha, associação de papéis ou endpoint de auditoria em produção. Não usar conexão compartilhada PostgREST como identidade independente. Acesso de auditoria revogável; histórico não comprova atualidade ou compatibilidade. Ainda falta integrar documentos e atestações independentes, vincular a identidade real do produtor, atestar o escopo atual e validar o adaptador de procedência no ambiente operacional.

Nenhum gasto, ERP, preço, compra, publicação, deploy ou avanço de estado autorizado. Não aplicar a minuta no Supabase hospedado.
