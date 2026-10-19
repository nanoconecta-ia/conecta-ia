# Estúdio do agente — interface e fluxo operacional

Pedido do proprietário: agente deste chat pareado ao Conecta.IA; torre lateral **e** flutuante; navegação integrada **e** browser remoto; adaptação a PC, notebook e smartphone; trabalho com taxonomia, imagens, SEO e design do site.

## Entrega desta branch

Rota `/estudio`, dados do produto e fotos aprovadas lidos com JWT/RLS da loja, contexto por SKU, ambientes Conecta.IA/Bling/site, taxonomia real por perfil, prévia editorial de SEO, torre lateral e flutuante, rascunho local de tarefa e cópia para o chat. A Mobis inicia no SKU80692, conforme indicado pelo proprietário. A consulta mostra data e origem **espelho**, sem se apresentar como leitura ao vivo.

Animações curtas acompanham abertura e navegação; `prefers-reduced-motion` remove o movimento. Teclado e Escape abrem/recolhem a torre com devolução de foco. Não há animação de execução fictícia, QR falso, navegador controlado simulado, tarefa enviada ou gravação no Bling.

O modo browser tem seu espaço e informa que a sessão não está conectada. Não usa iframe para tentar contornar login, CSP ou proteção do Bling. O site real abre em outra aba por rota existente, com `noopener`; a área integrada continua acessível no próprio painel.

Nenhuma migração nova, dependência de produção ou chamada paga. Nenhuma publicação desta interface foi feita. Os fluxos de imagens/SEO atuais são reutilizados como domínio; esta tela não habilita executores que ainda não existem.

## Integração que falta para operação completa

1. **Pair e cliente MCP:** aplicar e validar separadamente a migração já existente do Pair, funções `pair`/`conecta-gateway` e escopos. Cadastrar o MCP no cliente que hospeda o agente; o QR autoriza uma sessão e não copia a conta ou conversa do ChatGPT. Confirmar a compatibilidade de autenticação desse cliente, inclusive se exigir OAuth do MCP além da sessão Pair.
2. **Browser real:** worker de navegador por sessão/loja, conexão visual autenticada e efêmera, domínios permitidos, controles visíveis de pausa/interrupção, encerramento por revogação e isolamento de cookies/credenciais. Não registrar senhas ou capturar campos sensíveis em logs. Um browser local requer agente instalado e autorizado; uma sessão cloud exige serviço e custos previamente definidos. JWT do lojista, sessão do dispositivo e OAuth Bling são credenciais distintas.
3. **Taxonomia por ERP:** reutilizar `taxonomia_nos`, perfil de ramo, categorias do Bling e seus mapeamentos. Distinguir categoria de origem, classificação proposta e classificação aprovada. Não inventar compatibilidade, NCM ou equivalência técnica. Cadastro no ERP só por ferramenta específica, aprovada, com leitura de confirmação.
4. **Imagens:** identificar produto por SKU + identidade do ERP; conferir correspondência da peça, origem, direitos, tipo real/sintético e hash. Preparar dois destinos independentes: armazenamento/publicação no site e imagem do produto no Bling. Aprovação do site não autoriza o ERP. Preservar foto técnica e versões anteriores. Timeout de escrita significa resultado incerto: consultar antes de repetir.
5. **SEO e frontend:** preparar título, descrição, alt, canonical, sitemap, robots, JSON-LD Product/Offer e estrutura semântica usando fatos aprovados; verificar renderização/indexação no site público. Mudança de CSS/layout passa por prévia desktop/mobile, revisão e publicação versionada. Preço/estoque continuam provenientes do ERP.
6. **Execução:** registrar executores específicos no catálogo, que hoje não publica alterações automaticamente. Toda ação mostra destino, antes/depois, risco, versão aprovada, resultado e auditoria. O agente não se autoaprova. Gravações no Bling permanecem desligadas até implementação, testes e aprovação por produto.

## Critério de aceite operacional

Lojista pareia o agente real pelo QR → autoriza Mobis e escopos → agente identifica SKU80692 → consulta Conecta.IA/Bling e abre o site → propõe taxonomia, imagem e SEO com evidência → lojista aprova cada destino → executor autorizado aplica → leitura confirma o resultado → auditoria permite rastrear e reverter o que for reversível. Interfaces e testes simulados não comprovam esse marco.

As tabelas e funções do Pair não estavam aplicadas no projeto durante a última verificação. O chat interno e suas chaves OpenAI são um caminho separado; cadastrar chave de IA na loja não pareia o agente externo.
