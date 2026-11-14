# Desenho: sessão estendida, ferramentas extras e ponte desktop (PROPOSTA)

Status: **proposta para aprovação**. Nada aqui foi implementado, migrado ou publicado.
Data: 2026-11-14. Origem: pedido do dono (pareamento ao estilo WhatsApp Business, agente do lojista com Claude/GPT/outro).

## 1. Estado atual (verificado no código)
- Duração do pareamento: 5 a 480 min (`servico.ts` linha ~45; `check` na migração `20261018230657_conecta_pair.sql`).
- Escopos só de leitura e de **proposta**; sem aprovar, executar ou administrar. Escritas entram na Fila e o lojista aprova.
- Escrita direta no Bling: desligada (CLAUDE.md regra 7).
- Defeito conhecido: `montarUrlPareamento` produz `<path>/#/parear`; com `APP_URL` terminando em `.html` o link quebra. `PAINEL_CONECTA` aponta para o github.io (raiz), que abre a loja, não o painel.

## 2. Sessão estendida (24 h ou mais)
Proposta:
- Novo modo "estendido": `duracao_min` até 10080 (7 dias), **só** quando o lojista o escolhe na tela de aprovação (o agente não pode pedir mais do que o lojista concede, como hoje).
- Access token continua curto (~15 min) com rotação; o que se estende é a **autorização**, não o token.
- Renovação deslizante por atividade, com teto absoluto; revogação imediata pelo lojista; aviso na torre quando faltar menos de 1 h.
- Escopos sensíveis (ver §3 e §4) **não** entram na sessão estendida sem reconfirmação (6 dígitos) a cada 8 h.
- Mudança: constante no serviço, `check` da tabela (migração aditiva, sem apagar dados), testes, doc `API.md`.
Risco: sessão longa amplia o dano de um token vazado. Mitigação: rotação, revogação, limites por escopo, auditoria.

## 3. Ferramentas extras no gateway (todas somente leitura ou proposta)
| Ferramenta | Tipo | Observação |
|---|---|---|
| `conecta.propose_application` | proposta | aplicação por versão exige fonte de catálogo; "mesmo motor" não basta |
| `conecta.get_taxonomy` / `propose_taxonomy_node` | leitura / proposta | nós novos entram como `proposto` |
| `conecta.get_enrichment_queue` | leitura | fila de `enriquecimento_tarefas` |
| `conecta.bling_consultar` | leitura | só consulta, por loja, com cache e limite de taxa |
| `conecta.report_quality` | leitura | diagnóstico de cadastro (`sem_sku`, duplicados, marca suja) |
Todas passam pelo Policy Engine, com auditoria e `idempotency_key` nas propostas.

## 4. Ponte desktop (itens do Bling que a API não cobre, como etiquetas)
Rejeitado: dar shell livre (PowerShell/Desktop Commander) ao agente. O modelo ter treino de segurança não impede injeção de instrução vinda de dado de produto, página ou e-mail; com a conta do lojista logada o dano seria real.
Proposto:
1. **Ações nomeadas e estreitas** (ex.: `bling_ui.criar_etiqueta`), cada uma com esquema, limites e teste.
2. **Navegador do lojista**, não terminal: sem acesso a arquivos, senhas ou sessão fora do domínio do Bling.
3. **Aprovação por ação** na Central de Aprovações, com antes/depois; execução só após o OK.
4. **Fase 1 só leitura** (ver telas); escrita liberada **campo a campo**.
5. Auditoria completa e botão de revogar.
Pendência antes de qualquer código: verificar os termos de uso do Bling sobre automação de interface; preferir a API oficial onde ela cobrir. Telas do Bling mudam sem aviso (manutenção).

## 4-A. Atualização (2026-11-14): a "ferramenta especial" já tem base no repositório
A extensão **Nano.IA Guardião** (`extensao/`, Chrome/Edge, MV3) já faz o essencial da ponte desktop, no formato seguro do §4:
- lê a tela real do Bling por rótulos/acessibilidade (nunca por coordenada) e reconhece o cadastro de produto;
- pareia como `navegador` (escopos `produtos:ler` + `enriquecimento:propor`), com token só em `chrome.storage.session`;
- preenche **na tela**, com o clique do lojista, **só valores já aprovados** na Fila; confere depois de preencher e oferece Desfazer;
- **nunca salva nem envia o formulário**; nunca toca SKU, preço, estoque, NCM ou campo fiscal.
Lacunas reais (o que falta para chegar ao que o dono descreveu):
1. **Ações nomeadas novas** além de preencher campo (ex.: criar etiqueta/tag no Bling por tela). Cada uma precisa de mapa de tela confirmado com captura real, teste e aprovação por ação.
2. **Registro no servidor** do que foi preenchido/executado na tela (hoje só no painel, "C2" no README da extensão).
3. **Agente externo (Claude/GPT) acionando a extensão:** hoje o agente só propõe via gateway; a extensão executa só com o clique do lojista. Para o agente "dirigir" a tela, usar o tipo `agente_desktop` + `capacidades` já previstos no pareamento, com aprovação por ação na Central de Aprovações.
4. **Sem shell:** continua rejeitado dar PowerShell/terminal livre.
Ordem sugerida: (2) registro no servidor → (1) uma ação nomeada de teste, só leitura de etiquetas → só depois escrita, por ação, com OK do lojista. Pendente antes de qualquer automação de tela de escrita: confirmação por escrito do suporte do Bling (a busca pública não achou regra proibindo nem autorizando).

## 5. Correção do link de pareamento
- `montarUrlPareamento`: preservar `.html` (montar `<origem><path>#/parear?c=…` sem inserir `/` após arquivo); testes para raiz, subpasta e `.html`.
- `APP_URL` de produção = `https://www.mobisautopecas.com.br/conecta.html`. (O domínio `mobisautoparts` vs `mobisautopecas` segue inconsistente em docs: dono deve confirmar o oficial.)
- Exige redeploy da função `pair` (autorização separada).

## 6. Ordem sugerida
1. §5 (pequeno, resolve defeito real) → 2. §3 leitura → 3. §2 sessão estendida → 4. §3 propostas → 5. §4 fase 1 leitura.

## 7. Decisões que dependem do dono
- Teto da sessão estendida (7 dias?) e reconfirmação a cada 8 h?
- Domínio oficial do painel.
- Autoriza estudar os termos do Bling para a ponte desktop?
- Autoriza a migração aditiva do `check` de duração?

## 8. Fora de escopo / não autorizado por este documento
Merge, deploy, migração, escrita no Bling, mudança de DNS.
