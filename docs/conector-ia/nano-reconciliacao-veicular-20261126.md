# Reconciliação veicular — auditoria 26/11/2026
Base consultada somente leitura: projeto Conecta/Mobis, aplicações com status aprovado, pais ativos e publicados. 16 aplicações, 7 produtos, 12 páginas habilitadas, 2 vínculos existentes, 14 sem vínculo. 
| Modelo registrado | Total | Vinculado | Sem vínculo | Resultado do cotejo nominal |
|---|---:|---:|---:|---|
| HR | 7 | 1 | 6 | nó Hyundai HR localizado |
| Bongo K2500 | 7 | 1 | 6 | nó Kia Bongo K2500 localizado (distinto de Bongo) |
| L200 | 1 | 0 | 1 | nó Mitsubishi L200 localizado |
| Pajero Sport | 1 | 0 | 1 | nenhum nó com esse nome na consulta |
13 candidatos nominais; 1 sem nó exato encontrado. A consulta nominal não estabelece identidade definitiva, motor, versão, compatibilidade nem autoriza escrita. 
## Conflitos do cadastro legado
Quatro registros aprovados têm fonte declarando expressamente homologação pendente: dois HR/Bongo do motor parcial CI003696 (título e descrição Bling, a homologar) e dois L200/Pajero Sport (índice de fornecedor, NÃO homologada e referência a homologar). Os demais usam nome/descrição/NF do Bling e ficha do lojista; não há, nesses textos, evidência técnica estruturada independente. Todos os 16 têm OEM preenchido, 16 sem ano final e 4 sem ano inicial. Não tratar presença de código ou status como confirmação. 
## Implementação
reconciliacao_veicular.ts produz auditoria e propostas nominais somente leitura. Não cria, altera ou aprova nós ou aplicações, não altera status nem publicações. Sem inferência de motor compartilhado ou normalização de variantes. Ambiguidade, identidade divergente, fonte contraditória, período incompleto e fonte legada são pendências explícitas. Reusar regras_aplicacao.ts para avaliação técnica estruturada (fonte forte, versão, tipo de ano, código, período e ator). Este utilitário não substitui aquele validador e ainda não está integrado ao pipeline ou dashboard. 
## Aceite antes de produção
Revisar os 4 conflitos prioritariamente, confirmar identidade dos 13 candidatos por fonte e versão, pesquisar se Pajero Sport já existe com outro rótulo antes de propor nó, nunca criar duplicata. Verificar visibilidade das fichas conflitantes e tratar em revisão humana; impedir novas aprovações com evidência contraditória. Não publicar a expansão nem mudar registros existentes automaticamente; primeiro fechar validação e provar gates do catálogo. Sem alteração Supabase/Bling nesta etapa.

## Integração de interface (etapa seguinte)
Taxonomia > Veículos > Nano Quality Gate, leitura autenticada com RLS existente, sem novo grant/RPC/escrita. Consulta o universo aprovado da loja até 1000 registros; exige count exato e completude de aplicações, modelos, montadoras e pais, filtra pais ativos/publicados. Se a consulta exceder limite ou falhar, informa indisponibilidade, sem zeros falsos. Consultas separadas não são snapshot transacional. Reaproveita o mesmo validador de reconciliação sem duplicar regras; indicadores por recorte e filtros por estado/SKU/modelo/motor/OEM, detalhes da fonte legada e link à ficha existente. Não inclui ação de aprovar ou gravar. O indicador preexistente de todos os registros não afirma homologação. Confirmadas políticas SELECT autenticadas de loja para produtos/aplicações e matriz global para modelos/montadoras; políticas anônimas preexistentes exigem auditoria de exposição separada. Teste de interface real e escala/paginação ainda pendentes. Nenhuma alteração de dados ou deploy.
