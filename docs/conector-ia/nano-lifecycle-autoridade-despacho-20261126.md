# Autoridade de despacho e integridade da fila — minuta

O despachante possui papel sem login, sem bypass de RLS, sem membership do serviço e distinto do consumidor. Reutiliza a mesma reconciliação de evento, snapshot, pausa, orçamento e idempotência. Cria a tarefa e seu histórico inicial na mesma transação. Nenhuma alteração de estado foi liberada.

A RPC legada e DML direto não podem usar a origem ou namespace Nano. A criação autorizada é a única capaz de inserir histórico Nano; as transições, histórico fabricado e exclusão de tarefa, inclusive cascata, são bloqueados. O histórico legado mantém sua regra existente. TRUNCATE do histórico é bloqueado. A fixture concorrente permanece no PostgreSQL descartável em vez de contornar triggers para limpeza.

Limites: minuta não aplicada a produção. A proteção não é contra superusuário capaz de alterar DDL. A criação de conflitos e demais caminhos legados precisam de revisão própria; o conteúdo semântico dos resultados Engineering continua candidato e a autorização por identidade de serviço específica ainda não está homologada. Retenção/expurgo administrativo exigirá contrato separado. Não ligar worker, cron, preços, compras ou publicação. Qualidade só após CI e auditoria independente.
