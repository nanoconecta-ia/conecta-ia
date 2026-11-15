# NanoGPT: chat e imagens com aprovação

## Implementação para revisão

Rota autenticada `#/nanogpt`, disponível no menu e em nova janela. Reutiliza o chat persistente e o seletor de provedores reais. Nenhuma resposta, imagem ou estado de conexão é simulado. O nome NanoGPT identifica a janela; não afirma que a OpenAI está conectada.

O chat agora oferece as ferramentas de proposta de imagem, código, aplicação e enriquecimento já existentes. O endpoint `nanogpt-midia` oferece pesquisa com o adaptador configurado (SearXNG privado ou Google legado), proposta com URL e fonte, preparação e exportação humana. Exportar não é ferramenta do modelo.

A exportação exige lojista autenticado, imagem aprovada e direitos confirmados no banco, confirmação do SHA-256 atual e duas flags do servidor. Baixa o original com validação de rede, formato e limite de 5 MB; copia em `produtos-imagens`, verifica o hash, copia no Drive privado por multipart e adiciona a URL do Conecta ao Bling usando `midia.imagens.imagensURL` no PATCH. Preserva URLs externas existentes e recusa produtos com imagens internas para não apagar anexos. Confere o Bling depois do envio.

Lock por produto no bucket privado `agente-anexos` impede duas exportações concorrentes. Timeout ou falha parcial mantém o lock e o recibo, com ID reservado do Drive; não há repetição automática. Operações confirmadas ficam na auditoria; o lock é retirado após confirmação. Uma imagem já enviada não é exportada novamente. Reconciliação de falhas exige conferência do recibo, do arquivo no Drive e do produto no Bling antes de liberar o lock. A interface ainda não oferece essa reconciliação.

## Estado observado em 15/11/2026

Bling e Drive constam conectados. OpenRouter e GPT-OSS via Groq ativos; Gemini inativo. Não há registro ativo de plugin nem credencial Google de busca de imagens. SearXNG depende dos segredos do servidor e sua disponibilidade deve ser conferida pelo endpoint de status após implantação. Não se deduz disponibilidade da rede a partir do cadastro.

## Implantação pendente

1. Revisar o PR, sem merge automático. Publicar `nanogpt-midia` com verificação JWT e atualizar `assistente` com seus módulos compartilhados.
2. Publicar o painel para disponibilizar a rota. Não criar tabela nem migrar o banco; usa estruturas existentes.
3. Configurar um buscador real, caso o status reporte ausência; não confundir OAuth do Drive com serviço de busca na web.
4. Homologar com uma imagem aprovada, direitos confirmados e um SKU escolhido pelo dono. Para permitir cópia, configurar `NANOGPT_MIDIA_EXPORTAR=1` e manter o controle existente `BLING_ESCRITA_REAL=1`. Nenhuma flag foi alterada nesta tarefa.
5. Conferir isolamento entre lojas, recusa de editor, hash alterado, timeout parcial, recibos e leitura após escrita. Desligar `NANOGPT_MIDIA_EXPORTAR` interrompe novas exportações.

## Limites

Não implantado nesta tarefa; não foi executada uma cópia real em produto do cliente. Testes automatizados dos contratos usam respostas controladas e não equivalem a homologação dos três serviços. Não existe transferência automática das ferramentas desta sessão ChatGPT para o Nano, nem assinante de webhook do ChatGPT criado por este PR. A inteligência no chat usa a API configurada; agente externo usa o caminho de pareamento existente.

Fonte do contrato de imagens: https://developer.bling.com.br/build/assets/openapi-CR5QY_N1.json (ProdutosDadosPatchDTO / ProdutosImagensDTO; imagensURL é gravável, externas é somente leitura).
Fonte do upload: https://developers.google.com/workspace/drive/api/guides/manage-uploads
