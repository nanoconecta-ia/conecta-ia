# Atualidade da evidência — minuta CI

Base d798a87: teste ponta a ponta aprovado (45895649722). Conferência somente leitura por papel NOLOGIN sem bypass de RLS, escopo de loja, autorização de sessão e identidade de autoria, hashes e tupla completos, checkpoint exatamente igual, flags habilitadas, ausência de sync ativo, estado e geração atuais da fila, pausa, identidade Bling/SKU e projeção técnica igual ao snapshot. Política conservadora: até um checkpoint novo sem alteração relevante retém o candidato. A API histórica permanece disponível e separada. A nova API retorna conferida_no_instante, não homologação; sem locks de transição, não é prova atômica de atualidade para uma escrita posterior. Necessário gate transacional final e revalidar autorização/fontes no momento da transição. E2E testa pausa, flag e alteração de cadastro, com dados sintéticos. Nenhuma migração hospedada, deploy, custo, ERP, preço ou publicação.

## Correção de homologação

O CI 45896102036 comprovou que a tentativa de UPDATE direto no produto sintético foi recusada pela proteção do espelho. O cenário agora verifica explicitamente essa recusa e usa as RPCs de reserva, gravação autorizada e encerramento para simular nova sincronização. Testa retenção com sync ativo e, após encerramento sem finalização de checkpoint, por divergência real do espelho. Nenhuma trava removida. CI da correção pendente.
