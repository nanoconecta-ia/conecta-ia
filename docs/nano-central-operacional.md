# Central operacional (GPT + Nano.IA + MCP) — Fase A: auditoria e proposta

> Status: **somente análise e proposta**. Nenhum merge, deploy, publicação ou escrita no Bling.
> Data: 2026-11-02. Dados abaixo vêm do código atual (`origin/main`) e do registro real de ferramentas; o que não pôde ser verificado está marcado **não verificado**.

## 1. Princípio

Evoluir o **chat nativo existente** (`painel/src/paginas/Assistente.tsx`). Não criar segundo chat. Um único avatar Nano. Nenhuma indicação de conexão ou execução que não seja real: o painel mostra "não verificado" quando não há prova.

## 2. Mapa de arquivos e componentes (existente → papel na spec)

| Spec | Já existe (reaproveitar) | Lacuna |
|---|---|---|
| Chat operacional (centro) | `paginas/Assistente.tsx` (598 linhas), `DockAgente.tsx`, `lib/streamAssistente.ts`, `lib/recuperacaoSemIa.ts`, `componentes/conector/chat.ts` | Dividir em partes menores; ainda é arquivo grande |
| Painel esquerdo (agentes/histórico/ferramentas) | `paginas/CentralInteligencia.tsx`, `MeuAgente.tsx`, `EstudioAgente.tsx`, histórico no próprio Assistente | Sem painel retrátil unificado |
| Gaveta direita contextual | `componentes/conector/PainelContexto.tsx`, `CartaoProposta`, `PropostaCompacta`, `DecisaoProposta`, `Taxonomia.tsx`, `EvidenciaProduto` | Sem gaveta única que troque de aba (taxonomia/evidências/propostas/aprovação) |
| Ficha automotiva | `FichaProduto`, `paginas/Catalogo.tsx`, `_shared/busca_segura/ficha.ts` (saneada, sem custo/fornecedor/fiscal) | Renderização da ficha **dentro do chat** |
| Galeria (≤8) | `GaleriaProduto.tsx`, `lib/galeriaProduto.ts`, `busca_segura/galeria.ts`, trigger de limite 8 (migração aplicada) | Embutir no chat |
| Central de agentes | `CentralInteligencia.tsx`, registro `_shared/conector/registro.ts` | Estado real por agente/adaptador |
| Fila de aprovação | `paginas/Aprovacoes.tsx`, `Fila.tsx`, `conector-aprovacoes` | Atalho dentro do chat |
| Painel MCP | `paginas/GatewayMCP.tsx`, `conector-mcp`, `_shared/conector/gateway.ts` | Estado do gateway (ver risco R2) |
| Avatar único | `Esfera`, `RoboNano`, `PontosPensando`, `lib/nanoEstado.ts`, `lib/orbe.ts` | Nenhuma; manter um só |
| Tokens/tema | `shell.css`, `lib/perfilCor.ts` | Reusar; sem cor solta |

## 3. Arquitetura proposta

```
┌ Painel esquerdo (retrátil) ┐┌ Centro: chat nativo ┐┌ Gaveta direita (contextual) ┐
│ Agentes · Histórico ·      ││ mensagens, fichas,  ││ abas: Taxonomia · Evidências ·│
│ Ferramentas                ││ galeria, resultados ││ Propostas · Aprovação         │
└────────────────────────────┘└─────────────────────┘└───────────────────────────────┘
        Visão de arquitetura: sob demanda (modal), não fixa
```

- Mobile-first (regra 4 do design system): painéis viram gavetas; mesmo componente, classes responsivas.
- Orquestração: continua pelo Gênesis → Policy Engine → registro de ferramentas tipadas (`registro.ts`). A UI **não** chama ferramenta fora do registro.
- Cada ferramenta externa exige adaptador suportado, credencial própria e permissão explícita. Plugins internos do ChatGPT **não** são presumidos utilizáveis pelo Nano.
- Dados reais apenas; qualquer demonstração leva selo "DEMONSTRAÇÃO".

## 4. Matriz de permissões (números reais do registro)

60 ferramentas: 42 ativas · 16 planejadas · 2 desligadas. Risco: LOW 32 · MEDIUM 9 · HIGH 1 · CRITICAL 0.

| Classe | Total | Ativas | No chat | No MCP |
|---|---|---|---|---|
| leitura | 35 | 28 | 28 | 23 |
| propor | 18 | 10 | 10 | 7 |
| simular | 1 | 0 | — | — |
| executar | 6 | 4 | 0 | 0 |

- Escrita externa (`escreveExterno`): 4 ferramentas; **nenhuma exposta a chat/MCP**; escrita no Bling segue desligada (sem rota real, fora de `CAMPOS_ESCRITA_LIBERADOS`).
- MCP: leitura + propor apenas, chave por loja com escopo, 120 chamadas/min, rejeita header `Origin`, nunca expõe service_role nem token do Bling.
- Agente nunca aprova nem publica; aprovação é humana (Policy Engine MEDIUM+ exige aprovação e `idempotency_key`).

## 5. Lacunas frente à especificação

1. Layout de três áreas com gaveta contextual única (hoje espalhado em páginas).
2. Ficha técnica e galeria renderizadas no chat (hoje só no Catálogo).
3. Central de agentes com estado real por adaptador (hoje sem sonda).
4. Painel MCP: o navegador **não consegue sondar** `conector-mcp` (o gateway recusa requisições com `Origin`); estado deve vir de registro server-side (última chamada autenticada), senão exibir "não verificado".
5. `conector-mcp` **não está publicado** (deploy em fila aguardando aprovação do dono) — a UI não pode mostrar "conectado".
6. Capturas desktop+mobile do protótipo: existem só as de baseline (`evidencias-chat/`); protótipo novo não foi construído.

## 6. Riscos e pendências

- R1 Assistente.tsx grande: mudança de layout deve extrair subcomponentes antes.
- R2 Indicador falso de conexão MCP (acima) — bloquear por design.
- R3 Vazamento de provedor de IA na UI do lojista (regra 5): central de agentes só nomeia provedor em `/plataforma`.
- R4 Custo/preço de compra/fornecedor/fiscal nunca na ficha/chat/LLM (já garantido em `ficha.ts`; manter testes).
- R5 Compatibilidade veicular só com fonte+data; "APLICAÇÃO NÃO CONFIRMADA" quando faltar.
- Pendências do dono: aprovar/cancelar deploy do `conector-mcp`; criar chave MCP no painel; decisões abertas já listadas (domínios verificados, tabelas `fonte_dominios`/`produto_fonte_referencia`).

## 7. Fases e primeira fatia recomendada

- **A (este documento):** auditoria — concluída.
- **B:** protótipo navegável com dados reais/rotulado, capturas desktop+mobile.
- **C:** integração. **D:** homologação. **E:** produção — só com autorização explícita.

**Fatia 1 recomendada:** estrutura do chat (painel esquerdo retrátil + gaveta direita contextual) + ficha técnica no chat, reusando `PainelContexto`, `FichaProduto`, `GaleriaProduto`. Animação pesada fica para depois. Sem mudança de backend, sem migração.

## 8. Testes desta fase

Somente leitura do repositório e do registro; nenhum teste de produção executado. Critérios para a Fase B: `npm test`, `npx tsc --noEmit`, `npm run build` em `painel/`, teste visual Playwright desktop e 390 px, e teste de que nenhum texto de UI do lojista cita provedor de IA.
