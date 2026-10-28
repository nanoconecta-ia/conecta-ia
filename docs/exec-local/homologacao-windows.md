# Homologação do executor Windows próprio — pacote, permissões e remoção
Autorizado pelo proprietário em 28/10/2026 (mensagem direta na sessão), com a condição de **confirmar o pacote exato antes de instalar**. Nada deste documento foi executado no PC Mobis.

## 1. O que é o agente
`agente.mjs`: programa Node **portátil**, sem instalador, sem serviço, sem tarefa agendada, sem alteração de registro, de PATH ou de firewall. Roda em primeiro plano, com o usuário comum (nunca administrador). Fecha a janela ou Ctrl+C e acabou.
- Só faz conexões de **saída** para o gateway informado; **não abre porta**.
- O token do dispositivo fica **só na memória** (nunca em disco, nunca no log).
- Executa **somente** os 5 diagnósticos de leitura da lista fixa (`capacidades.windows.json`), cada um com modelo de comando fixo e parâmetros validados: `windows.sistema.inventario`, `windows.ambiente.versoes` (Windows, PowerShell e Node — só lê, não executa o Node), `windows.disco.livre`, `windows.processo.existe`, `windows.servico.estado`.
- **Defesa em profundidade:** o agente revalida cada comando contra a própria lista; se o servidor for comprometido e mandar outra coisa, o agente recusa e registra.
- Sem leitura de arquivos do usuário, certificados, documentos fiscais, senhas ou arquivos comerciais. Os comandos não listam pastas.

## 2. Fases (cada uma exige confirmação sua antes de rodar)
- **A — homologação local no PC Mobis (sem internet, sem Edge Function):** `node --experimental-strip-types homologacao.mjs --real` sobe um gateway de teste em `127.0.0.1` (porta temporária, só loopback), pareia o agente, roda os dois inventários, o bloqueio de comando não autorizado, a revogação da sessão e do dispositivo, e grava a evidência em `agente/evidencias/`. Usa o `powershell.exe` real, só com os comandos de leitura. **Pré-requisito:** Node ≥ 22.6 (`node --version`, leitura). Se for menor, paro e proponho alternativa.
- **B — contra o Gateway MCP real do Conecta.IA:** exige publicar uma rota nova de dispositivo + fila persistente (migração) na Edge Function `conecta-gateway`. **Isso é publicar Edge Function e migrar banco: apresento plano, diff e rollback e peço aprovação separada.** Não faz parte do pacote A.

## 3. Pacote da fase A (zip portátil, `python3 scripts/exec-local/agente/empacotar.py`)
Arquivos de código: `scripts/exec-local/{runner_windows.mjs, agente/{agente,permitidos,servidor_local,homologacao}.mjs, agente/capacidades.windows.json}` + `supabase/functions/_shared/exec_local/*.ts` + `supabase/functions/_shared/conector/*.ts` (sem testes). Mais `SHA256SUMS.txt` e este `LEIAME`. Sem dependências npm, sem `node_modules`, sem binários.

## 4. Permissões necessárias
| Item | Permissão |
|---|---|
| Pasta do pacote | leitura e escrita só dentro dela (`logs/`, `agente/evidencias/`) |
| Processo | usuário comum; sem elevação |
| Rede (fase A) | só loopback 127.0.0.1 (o Windows pode perguntar sobre o firewall para o `node.exe`; responda **Cancelar/Bloquear redes públicas**, loopback não precisa) |
| PowerShell | `powershell.exe -NoProfile -NonInteractive -NoLogo -Command <um dos 5 modelos>` |
| Instalação | nenhuma: não instala Node, Git nem nada; usa o que já existe |

## 5. Como remover (nada fica fora da pasta)
1. Feche a janela do agente (ou Ctrl+C).
2. Apague a pasta `nano-agente-windows` (inclui `logs/` e `evidencias/`; guarde as evidências antes, se quiser).
3. Não há serviço, tarefa agendada, entrada de registro, regra de firewall nem variável de ambiente para desfazer. Para conferir: `Get-Service *nano*` e `Get-ScheduledTask *nano*` devem voltar vazios.
Revogação remota: no gateway, `revogarDispositivo` faz o agente encerrar sozinho no próximo ciclo (testado).

## 6. Provado até agora (sem PC Mobis)
`homologacao.test.mjs` + `homologacao.mjs` com PowerShell **falso**: pareamento por código de uso único (expira, bloqueia após 5 erros), identidade própria do dispositivo, descoberta, 2 inventários concluídos com auditoria, injeção bloqueada no servidor, agente recusa comando fora da lista, sessão revogada, dispositivo revogado (agente encerra), nenhuma ferramenta anunciada sem dispositivo, nenhum token nos logs. 53 testes locais passando.

## 7. Limitações
- O PowerShell real **não** foi exercitado por este código; o teste do ChatGPT (somente leitura, 28/10) validou outro caminho de transporte.
- A fase A usa um gateway de teste local, **não** a Edge Function do Conecta.IA.
- Fila em memória; o laço do servidor local não substitui fila persistente.
- Sem assinatura de código no pacote (os hashes em `SHA256SUMS.txt` permitem conferir a integridade).
