# Conecta.IA e Nano.IA — substituição completa da apresentação

O proprietário informou que o painel e o ambiente operacional do Nano ainda mostravam o modelo anterior. A adaptação anterior de CatálogoAplicacao não substituía o shell e preservava o EstudioAgente antigo. Os PRs #318/#319 corrigiam a loja pública, não essas interfaces administrativas.

A matriz de referência é CONECTAIA_MODELO_APROVADO_MOBIS_COM_OLHO_NANO_E02.html, na versão lida em 13/11/2026. Seu snapshot interno não integra o repositório nem os arquivos servidos. Somente o atlas visual original foi extraído como arquivo JPEG; não contém registros do ERP. Os valores históricos da matriz não foram copiados para os componentes.

A apresentação anterior do shell foi retirada de App.tsx. PainelAprovado monta a navegação lateral, a identidade, o cabeçalho e a identificação de versão do modelo aprovado. Os seletores premium antigos não são montados.

Rotas:
- /: InicioAprovado, com os três níveis Origem / Inteligência / Experiência e contadores consultados por loja autenticada.
- /catalogo-aplicacao: catálogo de revisão do modelo aprovado, busca paginada no servidor e recorte técnico explicitamente identificado.
- /estudio e /assistente: NanoWorkspace, com trabalho, conversa ajustável e Torre; EstudioAgente antigo não é montado nessas rotas.
- Demais módulos: suas operações existentes continuam disponíveis em Todos os módulos, sob a mesma camada visual administrativa. Autenticação e isolamento por loja não são removidos.
- Entrada e recuperação: apresentação nova com as mesmas funções de autenticação.

O NanoWorkspace mantém o Assistente real: histórico, provedores, consentimentos, anexos, voz e propostas não são simulados no produto. Gráficos/tabelas usam até 100 produtos do recorte consultado e classificação registrada. Imagens requerem aprovação; Web exibe a rota pública da loja e não alega uma sessão remota do ERP. A Torre não habilita uma operação nem pareia um agente automaticamente.

O Olho E02 conserva seu arquivo e movimento originais. O avatar operacional usa o atlas original aprovado, sem o desenho vetorial anterior. Não há alterações de funções de servidor, permissões, migrações ou dados Bling. A vitrine pública permanece independente da camada visual administrativa.

Os testes novos verificam o App real com rede totalmente interceptada, sessão e dados sintéticos em 360/390/412/1280px. O teste após publicação usa os arquivos efetivamente servidos e também mantém a sessão e os dados simulados: suas capturas demonstram a interface publicada, não uma autenticação contra dados privados reais.

Balão flutuante, dock e apresentação imersiva antigos não são montados pelo App. Ctrl+J leva ao Estúdio. Os testes dessas composições aposentadas foram substituídos na execução do CI pela suíte de integração do novo modelo; testes de histórico, consentimento, anexos, streaming e comandos do Assistente continuam ativos. Comandos de catálogo, imagens e indicadores abrem as ferramentas dentro do Estúdio, preservando a conversa montada.

A chave da preferência de menu foi versionada para não iniciar o modelo aprovado no estado recolhido de uma interface anterior. O service worker recebe uma nova versão de casca usando o mecanismo existente de limpeza de cache e atualização das janelas. Nenhum dado do ERP ou do usuário é armazenado no cache do worker.
