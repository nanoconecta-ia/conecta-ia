# Aparência da loja, esfera do agente e voz

## Aparência por loja (só a loja pública; o painel mantém a identidade Conecta.IA)
- **Perfis prontos** (Azul Conecta, Grafite e laranja, Verde floresta, Vinho) ou **personalizado**. O servidor exige contraste **WCAG AA (4,5:1)**: texto branco sobre a cor primária e sobre o bloco de abertura; texto automático (branco ou grafite) sobre a cor de destaque. Cor fora de `#rrggbb` ou clara demais é recusada com mensagem.
- **Fonte**: Inter (vem junto do código), fonte do sistema ou serifada (Georgia). Nenhuma fonte é carregada de terceiros.
- **Logo e ícone**: PNG, WebP ou JPEG até 512 KB; o servidor confere o tipo pelos **primeiros bytes** (SVG é recusado: pode carregar script). Ficam no bucket público `lojas-marca/<loja_id>/`; escrita só pela função `loja-tema` (service_role). O logo vai no cabeçalho; o ícone vira favicon.
- A função `loja-publica` devolve o tema já calculado (variáveis CSS) e o navegador só aceita nomes `--x` e valores sem `; { } < >` nem `url(`.
- Tabela `loja_tema` (migração `20261018000007`), funções `tema_salvar` e `tema_definir_imagem` (só service_role), tela **Aparência da loja**. Tudo auditado.

## Esfera do agente (CSS puro)
Esfera com uma **nuvem** de três manchas desfocadas em órbita no núcleo. O estado vem do que acontece de verdade: *ouvindo* (microfone ativo: anel pulsante), *pensando* (pedido em andamento: nuvem acelera), *falando* (leitura em voz alta: pulso), *parado*. Usa os tokens de cor (`--marca`, `--verde`, `--grafite`) e respeita `prefers-reduced-motion`. Aparece no Assistente do painel e na página pública do produto.

## Voz
- **Microfone**: reconhecimento de fala do **navegador** (pt-BR); o texto aparece no campo e, ao terminar a fala, é enviado. Mensagens claras para permissão negada, sem microfone e sem internet.
- **Ler em voz alta**: síntese de voz do navegador (preferência salva por navegador).
- **Privacidade**: no Chrome o áudio é processado pelo serviço do Google; a tela avisa. O Conecta.IA não grava nem recebe áudio, só o texto.
- Sem suporte do navegador (ex.: alguns Firefox/iOS), o botão não aparece e o texto continua funcionando.

## Limitações
- Voz não foi testada com microfone real neste ambiente (não há áudio); testados: detecção de suporte, limpeza do texto lido e mensagens de erro.
- A esfera da página pública do produto usa as cores padrão (ainda não herda o tema da loja).
- Logo/ícone antigos continuam no armazenamento (só o vínculo é removido).
