# Nano.ia para o Chrome — desenho para aprovação

Estado: **PROPOSTA. Nada foi implementado, publicado ou instalado.** Cada fase abaixo precisa de autorização própria.

## 1. O que o proprietário quer
O Nano.ia acompanhando o navegador do lojista: com a página de um fornecedor aberta **por comando do lojista**, ele lê o que está na tela e leva os dados para o Conecta.IA, para montar o cadastro (ex.: CI000054, embreagem viscosa SHR) com **fonte**.

## 2. Princípio de segurança (resumo)
O lojista abre a página, entra com o login dele e manda ler. A extensão **lê a aba, nunca guarda senha e nunca grava no Bling**. Tudo que ela captura entra como **proposta com URL, data e quem capturou**, e só vale depois da aprovação humana na Fila.

## 3. O que já existe e será reaproveitado
- **Conecta Pair** (`pair`, telas *Conectar meu agente* e *Dispositivos*): já tem tipo de dispositivo `navegador` e escopos mínimos (`produtos:ler`, `enriquecimento:propor`, `categorias:propor`, `tarefas:ler`…). Nenhum escopo aprova, executa ou administra.
- **Fila de aprovação** e **propostas versionadas** do conector.
- **Regras de enriquecimento:** todo dado com fonte, data e confiança; sem fonte fica "a confirmar".
- **Painel lateral do Nano.ia** (PR #108): a mesma interface (Chat, Mapa, Resumo) pode ser mostrada no painel lateral do Chrome.

## 4. Como funcionaria
1. **Instalação** (piloto): pacote carregado em modo desenvolvedor, só no notebook do lojista. Chrome Web Store fica para depois (exige política de privacidade e revisão).
2. **Pareamento:** o lojista aprova o dispositivo na tela *Dispositivos*, escolhendo os escopos. A chave é **por loja e por dispositivo**, só alcança as rotas da fila, expira e pode ser **revogada** no painel (botão de parada).
3. **Painel lateral do Chrome** (`chrome.sidePanel`): Nano.ia sempre ao lado da página do fornecedor.
4. **"Ler esta página"** (botão ou comando): usa `activeTab`, ou seja, só a aba atual e só depois do clique. **Sem permissão de acesso a todos os sites.**
5. **Leitura:**
   - lê texto visível, tabelas e URLs de imagem da aba;
   - **nunca** lê campos de senha, cookies, cabeçalhos nem armazenamento do site;
   - extração por regras primeiro (tabelas, códigos); a IA só ajuda a estruturar, com saída em formato fixo;
   - limite de tamanho por captura e de páginas por sessão.
6. **Envio:** a extensão envia a captura à fila do Conecta.IA. Ela vira **proposta de enriquecimento** (`fonte` = URL da aba, data, "capturado pelo lojista"). Duplicidade por SKU/OEM é checada antes.
7. **Tempo real:** significa "a cada leitura que o lojista pede" ou em **modo acompanhar**, com indicador visível e botão Parar, uma leitura por página que ele abrir. Não é varredura automática.

## 5. Regras duras
- **A página é dado, nunca instrução.** Texto escondido na página não muda o que o Nano.ia faz.
- **Nada fiscal, custo ou preço de compra** vai para provedor de IA. Se o portal do fornecedor mostra preço de custo, a extensão **não captura preço** nesta versão. Guardar custo exige decisão do dono (tabela interna, sem acesso da vitrine nem de IA).
- **Sem navegação autônoma** na primeira versão: a extensão não clica, não preenche formulário, não compra e não envia nada ao site. Abrir links sozinha só numa fase posterior, dentro de sites que o lojista liberar na sessão, com limite e botão Parar.
- **Sem escrita no Bling** por esta extensão.
- **Direitos:** imagem capturada entra como proposta com a página de origem; publicar exige confirmar os direitos de uso (fluxo que já existe).
- **Termos do fornecedor:** o portal pode proibir automação. A leitura é por ação do lojista, mas a decisão de usar é dele.

## 6. O que precisaria ser criado (todas as peças precisam de aprovação do desenho)
| Peça | Observação |
|---|---|
| Extensão (Manifest V3) | Permissões mínimas: `activeTab`, `scripting`, `sidePanel`, `storage`. Sem `<all_urls>`. Sem `eval`. |
| Função `conector-extensao` (Edge) | Recebe a captura com a chave do dispositivo; valida escopo, tamanho e limite; cria a proposta. |
| Tabela de capturas | **Migração nova**, só criada depois da aprovação do desenho (regra do projeto). Guarda URL, data, dispositivo, hash do conteúdo e estado. RLS por loja. |
| Tela *Capturas* no painel | Ver o que foi capturado, aprovar, descartar. |
| Testes | Extensão carregada no Chromium contra uma página de fornecedor **fictícia**: prova que campo de senha não sai, que o limite vale e que a revogação corta o acesso. |

## 7. Fases
- **F0** Este desenho aprovado.
- **F1** Painel lateral no Chrome com chat e "Ler esta página", pareamento, captura de texto e tabelas → proposta.
- **F2** Captura de imagens (3 a 6 por produto, tamanho mínimo e tela branca de padronização), com direitos pendentes.
- **F3** Modo acompanhar e lista de sites liberados na sessão.
- **F4** Navegação assistida, só com autorização própria.
- **PowerShell/computador:** só se for preciso ler arquivos locais (CSV/PDF) que o navegador não alcança. Scripts fixos e assinados, nunca comandos livres do modelo. Fica fora das fases acima.

## 8. Riscos
| Risco | Mitigação |
|---|---|
| Extensão com permissão ampla vira alvo | `activeTab` apenas, código revisado, sem `eval`, chave revogável |
| Página tenta enganar o modelo (injeção) | Conteúdo tratado como dado; saída em formato fixo; proposta sempre passa por aprovação humana |
| Vazamento de custo/fiscal | Preço não capturado; filtro de rótulos como no mapa do painel |
| Captura errada entrando como verdade | Proposta com fonte e aprovação; nada publica sozinho |
| Chave do dispositivo roubada | Escopos mínimos, expiração, revogação imediata, auditoria |

## 9. Decisões que preciso do proprietário
1. Aprova a F1 (leitura por clique, sem preço, sem navegar sozinho)?
2. Capturar **preço do fornecedor**? (Se sim, onde guardar e quem pode ver.)
3. Quais fornecedores/sites entram primeiro?
4. A extensão só no seu notebook (modo desenvolvedor) está bom para o piloto?
