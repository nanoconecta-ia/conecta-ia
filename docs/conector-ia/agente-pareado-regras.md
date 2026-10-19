# Agente pareado por QR: ferramentas e regras do sistema

Qualquer agente que fale MCP (Claude, ChatGPT, Gemini, outro) pode ser pareado pelo QR no painel (Dispositivos). O agente usa as **próprias ferramentas** da sua plataforma (pesquisa, leitura de catálogo, visão) para achar a fonte; o Conecta.IA entrega o cadastro, as regras e as ferramentas de **proposta**. O lojista fala com o agente como numa conversa: informa SKU, EAN, código OEM da montadora ou uma descrição, e o agente consulta a peça ou monta o cadastro.

## Arquitetura (diagrama do dono, 2026-10-19)
```
CONECTA.IA (central de agentes)
  └─ Vinculação autorizada: QR Code / OAuth / Conector
       ├─ ChatGPT   (quando suportado)
       ├─ Claude    (quando suportado)
       └─ Gemini    (quando suportado)
            └─ Gateway seguro de operações: identidade · permissões · auditoria
                 ├─ Bling ERP      (fonte do cadastro; só leitura)
                 ├─ Catálogo IA    (camada de propostas e aprovação)
                 └─ Site / Loja    (só o que o lojista aprova e mostra)
```
| Caixa | Estado hoje |
|---|---|
| Vinculação por QR | em produção (`pair`, painel Dispositivos) |
| Vinculação por OAuth | em produção (`oauth_agente`, consentimento por empresa com PKCE) |
| Vinculação por Conector (MCP remoto) | gateway `conecta-gateway` em produção; o gateway do Conector IA (`conector-mcp`) está só no repositório |
| ChatGPT, Claude, Gemini | "quando suportado": o suporte a conector MCP remoto depende de cada plataforma e **não foi testado com nenhuma delas** |
| Gateway: identidade, permissões, auditoria | em produção (sessão por token, escopo por ferramenta, auditoria de toda chamada) |
| Bling ERP / Catálogo IA / Site | Bling só leitura; Catálogo IA recebe propostas; o site mostra só o aprovado e visível |

## Ferramentas do gateway (`conecta-gateway`)
| Ferramenta | Escopo | Faz |
|---|---|---|
| `conecta.list_products`, `conecta.get_product` | `produtos:ler` | lista e detalha produtos; `get_product` mostra o que falta para publicar (as mesmas exigências do banco) e se a automação está parada |
| `conecta.get_part_by_code` (**nova**) | `produtos:ler` | consulta por SKU, EAN/GTIN, código OEM/fabricante ou texto; traz produtos da loja e o cadastro técnico **aprovado** |
| `conecta.bling_consultar_produto` | `bling:consultar` | consulta o SKU na API do Bling, só leitura |
| `conecta.propose_enrichment` | `enriquecimento:propor` | marca, descrições, peso, dimensões, categoria e NCM sugeridos |
| `conecta.propose_code` (**nova**) | `enriquecimento:propor` | código OEM, fabricante, EAN, similar, substituto ou antigo, com fonte |
| `conecta.propose_application` (**nova**) | `enriquecimento:propor` | aplicação por veículo (modelo, motor, anos), com fonte |
| `conecta.propose_image` (**nova**) | `enriquecimento:propor` | imagem por https; direitos de uso o lojista confirma depois |
| `conecta.propose_bula` (**nova**) | `enriquecimento:propor` | medidas (valor + unidade) e contraindicações, com fonte; entra em **rascunho** |
| `conecta.propose_banner`, `conecta.get_pending_approvals`, `conecta.get_task_status` | vários | como antes |

Todas as propostas entram como "a confirmar" na Fila; **o agente nunca aprova, publica nem executa**. Escopos novos não foram criados: as ferramentas novas usam `enriquecimento:propor`.

## Regras do sistema (também entregues ao agente na conexão)
1. **Nunca apaga nota fiscal nem o cadastro espelhado do Bling.** Não existe ferramenta nem escopo para isso (testes recusam qualquer ferramenta com delete/excluir/apagar/nfe), e usuários logados só têm `SELECT` em `produtos`. Só o sincronizador escreve no espelho, e ele só faz `upsert`.
2. **O Bling é a fonte.** O agente só melhora a camada do Conecta.IA (código, aplicação, imagem, bula, marca, descrição) para a consulta do PDV e do site. Escrita no Bling continua desligada.
3. **Sincronia a cada 15 minutos** com a API do Bling (agendamento `*/15 * * * *`, ativo em produção).
4. **Sem fonte, sem proposta.** Nada de código, medida ou compatibilidade inventada.
5. **Aplicação por versão do veículo no Brasil.** Mesmo motor ou marca parceira não prova compatibilidade.
6. **Cadastro automático pode ser parado pelo lojista**, por produto ou por lote (ver abaixo).

## Parar o cadastro automático (um produto ou um lote)
- No **Catálogo**, o lojista marca os produtos (seleção visual, "selecionar todos" incluso) e clica **Parar cadastro automático** ou **Retomar**. Máximo de 500 por vez. Quem administra a loja; editor não.
- Efeito: o gateway recusa propostas naquele produto com a mensagem "o lojista pausou" e o **banco também recusa** (gatilho nas tabelas de enriquecimento, códigos, aplicações, imagens e bula), então vale mesmo para o agente de chat interno e para qualquer ferramenta que esqueça de checar.
- Tudo fica na auditoria.

## Bula técnica
`propose_bula` grava rascunho com fonte; medida sem valor numérico ou unidade é recusada; bula já aprovada não é alterada por agente. O lojista aprova pela função `bula_aprovar` (tela de aprovação da bula ainda não existe: próxima etapa).

## Estado
Código, migração `…0018` e testes prontos em desenvolvimento. **Nada foi aplicado em produção**: a migração e a publicação do `conecta-gateway` e do painel dependem de autorização.
