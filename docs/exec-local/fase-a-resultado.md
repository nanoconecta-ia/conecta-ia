# Fase A — resultado da homologação no computador Mobis (28/10/2026)

## O que foi relatado pelo proprietário (mensagem direta na sessão Claude Code)
- PowerShell **real** executado no Windows da Mobis, pelo pacote `nano-agente-windows-0.1.0` (PR #122, `757db2a`).
- **10 de 10** passos aprovados: pareamento, descoberta, inventários de leitura, bloqueio de comando não autorizado, revogação da sessão e do dispositivo.
- Arquivo de evidência informado: `homologacao-powershell_real-2026-10-28T06-18-44-450Z.json`, na pasta `scripts\exec-local\agente\evidencias\` do pacote extraído em `…\Temp\nano-fase-a-20261028\`.

## O que esta documentação NÃO verifica
O arquivo `.json` **não foi entregue a esta sessão** (está no PC Mobis); portanto o conteúdo, o SHA-256, o identificador do dispositivo e os horários **não foram lidos nem conferidos por Claude**. Os números acima são o relato do proprietário.
**Pendência:** anexar o `.json` (ou colar o conteúdo) para registrar aqui o SHA-256, `device_id`, versões e horários. Conferir antes de anexar que não há dado sensível (o teste do pacote garante que o JSON não carrega tokens; ele pode listar o caminho do `node.exe`).

## Escopo do que foi validado (e do que não foi)
| Validado (relatado) | Não validado |
|---|---|
| Agente portátil + PowerShell real, só os 5 diagnósticos de leitura | Gateway MCP **real** do Conecta.IA (a Fase A usou um gateway de teste em 127.0.0.1) |
| Pareamento por código de uso único, identidade própria do dispositivo | Pareamento pelo **Conecta Pair** (aprovação do lojista no painel) |
| Bloqueio de comando fora da lista, revogação de sessão e de dispositivo | Fila persistente, isolamento por loja em banco, auditoria em `public.auditoria` |
| Resultado e cartão de origem no "chat" simulado | Chat real do Conecta.IA |

## Fontes da evidência (atualizado em 28/10)
| Fonte | O que é | Estado |
|---|---|---|
| **Primária** | JSON original no PC Mobis (`…\nano-fase-a-20261028\…\evidencias\homologacao-powershell_real-2026-10-28T06-18-44-450Z.json`) | **não lida por esta sessão** |
| Cópia resumida | `NanoIA-Fase-A-Evidencia-2026-10-28.json` (gerada no chat do ChatGPT) | **não é o original, não tem o mesmo hash, sem acesso desta sessão** — não citar como evidência primária |
| Registro verificável | hash SHA-256 e tamanho do original, informados pelo proprietário (`Get-FileHash … -Algorithm SHA256`) | **pendente** |
