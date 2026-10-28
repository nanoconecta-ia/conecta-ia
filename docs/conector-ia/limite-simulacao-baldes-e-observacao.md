# Limite de requisições (#112): simulação dos baldes de IP e modo "observar sem bloquear"

**Estado:** análise e proposta. Nada implantado, nenhuma mudança de código do limitador. Simulação **local** (sem rede, sem banco), reproduzível com
`node --experimental-strip-types scripts/simulacao/baldes-ip.ts` (usa o `chaveOpaca`/`baldeDe` reais; 120 mil IPs sintéticos, gerador fixo).

## 1. Resultado da simulação (2.048 baldes, teto de 60 pedidos/min por balde na rajada)
| Pergunta | Resultado | Leitura |
|---|---|---|
| Os baldes são uniformes? | qui² = 2.069 (esperado ≈ 2.047 ± 63); mín 35, máx 85 por balde | PASSOU: distribuição uniforme, sem balde "quente" |
| Navegação normal (5 pedidos/min por IP) | 0 % de pedidos negados até 5.000 IPs/min; 5,6 % negados e 30,8 % dos IPs em balde saturado em 20.000 IPs/min | PASSOU até ~5 mil IPs/min; falso positivo só em tráfego muito alto |
| Uso intenso (20 pedidos/min por IP) | 0,1 % negados com 1.000 IPs/min; 2,2 % com 2.048; 16,7 % com 5.000 | ATENÇÃO acima de ~1.000 IPs intensos por minuto |
| IPs que dividem balde com outro | 6 % (100 IPs/min), 34 % (1.000), 64 % (2.048), 92 % (5.000) | colisão é comum, mas só vira negação se a soma do balde passar de 60/min |
| Atacante com M IPs tentando saturar baldes para negar vítimas | sem teto de loja primeiro: 38,6 % (M=1.000) e 91,3 % (M=5.000) dos baldes saturados; **com** o teto da loja primeiro: ≤ ~1 % (só 1.200 pedidos/min chegam às chaves de IP, ou seja ≤ 20 IPs saturando) | PASSOU: a ordem "loja primeiro" limita esse ataque |
| NAT/operadora: 1 IP com 40 usuários × 5 pedidos/min | 70 % dos pedidos negados **sem colisão nenhuma** (limite é por IP) | RISCO REAL e independente dos baldes: celulares atrás do mesmo IP (CGNAT) |

### O que isso muda
1. Os 2.048 baldes são aceitáveis para o tráfego esperado de uma loja pequena. Para mais de ~1.000 IPs intensos por minuto, subir `baldesIp` (ex.: 8.192) custa só mais linhas possíveis (ver §2).
2. O risco principal não é a colisão, e sim **o limite por IP em redes compartilhadas** (CGNAT/operadora/empresa). Antes de ativar: medir pedidos por IP real no modo observação (§3) e decidir se a rajada de 60/min da `loja-publica` é baixa demais.
3. **Correção a um número que informei antes:** o tamanho máximo da tabela com retenção de 2 h **não** é "poucos MB". No pior caso (uma loja atacada nos dois endpoints, 1.200 pedidos aceitos/min), são ~300 mil linhas ≈ **51 MB** (170 B/linha). Isso ultrapassa o critério de parada de 20 MB. Ver §2.

## 2. Pendência de desenho (proposta, não implementada): retenção por tipo de chave
As linhas da rajada (janela de 60 s) não precisam ficar 2 h. Proposta de emenda à limpeza do #116, **a aprovar antes de escrever**:
- `janela < now() - interval '10 minutes'` para chaves `pub:%:ip:rajada:%` e `pub:%:semip:%`/`pub:%:loja:%` (janela de 60 s);
- `janela < now() - interval '2 hours'` para o restante.
Pior caso estimado: ~36,5 mil linhas ≈ **6 MB** (contra 51 MB). Alternativa: reduzir `baldesIp` (menos linhas, mais colisão).

## 3. Modo "observar sem bloquear" (proposta; nada implantado)
**Objetivo:** medir o tráfego real e o efeito dos limites antes de negar qualquer pedido.

**Como funcionaria**
- Variável de ambiente por função: `LIMITE_MODO` = `desligado` | `observar` | `bloquear` (padrão ao implantar: `observar`).
- Em `observar` o guarda **conta e decide como se fosse bloquear**, registra o que *teria* sido negado e **sempre deixa passar** (nunca devolve 429 nem 413).
- Registro estruturado, sem IP, sem identificador da loja em claro, sem corpo: `{ endpoint, camada: loja|ip_rajada|ip_sustentado|sem_ip, decisao: permitiria|negaria, latencia_ms, falha_limitador }`. Contagens agregadas por minuto.
- O corpo grande (413) continua recusando mesmo em `observar`, por ser proteção de memória, e vira métrica separada.

**Métricas a acompanhar (24 h, incluindo um dia de campanha, se houver)**
1. Pedidos/min por endpoint (média, p95, máximo) e IPs distintos/min (via contagem de linhas da janela).
2. Fração que *seria negada* por camada (loja, rajada, sustentado, sem-IP).
3. Fração de pedidos sem IP confiável (`cf-connecting-ip` ausente).
4. Latência p50/p95 de `loja-publica` com e sem a chamada ao limitador; falhas do limitador (RPC).
5. Linhas e tamanho de `private.limite_chamadas` (depende do #116).

**Critérios para ativar o bloqueio** (todos)
- Fração "negaria" < 0,5 % do tráfego legítimo estimado e nenhum pico legítimo acima de 1/5 do limite.
- Sem IP < 1 % dos pedidos (senão o limite por IP não protege e vale só o da loja).
- Teste individual dos cabeçalhos concluído (`cf-connecting-ip` não forjável) e registrado.
- #116 aplicado e job de limpeza comprovado; tabela < 20 MB.
- Aprovação específica do dono para trocar para `bloquear`.

**Critérios para abortar / voltar atrás (qualquer um)**
- Tabela > 20 MB, ou crescimento acima do estimado no §2.
- p95 de `loja-publica` > 1,5× o valor anterior.
- Falhas do limitador > 1 % dos pedidos.
- Qualquer queixa de cliente bloqueado depois de ativar `bloquear`.
Reversão: voltar `LIMITE_MODO=desligado` (variável de ambiente, sem novo código) ou reimplantar a versão anterior das funções; esvaziar a tabela se necessário.

**Segurança:** o modo `observar` não loga IP nem segredo; o segredo do HMAC continua derivado do segredo de serviço no runtime. Implementar o modo exige uma mudança pequena no guarda e testes; **não feita** sem aprovação.
