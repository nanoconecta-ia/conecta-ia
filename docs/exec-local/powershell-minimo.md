# Menor implementação do runner PowerShell próprio (NÃO implementado; só desenho)
Contrato já existe (`capacidades.ts`, `executor.ts`): o runner só precisa implementar `executar("windows", argv, timeoutMs, sinal)`.
1. **Agente do dispositivo** (processo do usuário comum, nunca administrador): laço que PUXA tarefas da fila do seu dispositivo (`FilaLocal.puxarEExecutar` → versão com banco depois) e chama o runner. Sem porta de entrada.
2. **Runner**: `child_process.spawn(argv[0], argv.slice(1), { shell: false, windowsHide: true })`, `stdin` fechado, saída limitada (ex.: 64 KB), `sinal.abort` → `taskkill /T /F` do processo filho; timeout vem do despachante.
3. **Lista permitida**: só `CAPACIDADES_LOCAIS` de camada consulta (4 comandos, todos `Get-*`), parâmetros por regex; qualquer coisa fora disso é negada antes de chegar aqui.
4. **Endurecimento**: `-NoProfile -NonInteractive`; recomendado `Constrained Language Mode` por política do dispositivo; sem `Invoke-Expression`, sem `-EncodedCommand` (teste já proíbe nos modelos).
5. **Prova em duas etapas**: (a) runner contra um `powershell` falso/`pwsh` no Linux de teste, sem Windows; (b) UMA execução de `windows.sistema.inventario` num dispositivo de teste — só com autorização presencial do proprietário.
Estimativa: ~80 linhas + testes; o que falta é decisão de empacotamento/instalação (👤).
