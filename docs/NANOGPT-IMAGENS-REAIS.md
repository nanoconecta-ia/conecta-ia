# NanoGPT: chat e imagens com aprovação

## Implementação para revisão

Rota autenticada `#/nanogpt`, disponível no menu e em nova janela. Reutiliza o chat persistente e o seletor de provedores reais. Nenhuma resposta, imagem ou estado de conexão é simulado. O nome NanoGPT identifica a janela; não afirma que a OpenAI está conectada.

O chat agora oferece as ferramentas de proposta de imagem, código, aplicação e enriquecimento já existentes. O endpoint `nanogpt-midia` oferece pesquisa com o adaptador configurado (SearXNG privado ou Google legado), proposta com URL e fonte, preparação e exportação humana. Exportar não é ferramenta do modelo.

A exportação exige lojista autenticado, imagem aprovada e direitos confirmados no banco, confirmação do SHA-256 atual e duas flags do servidor. Baixa o original com validação de rede, formato e limite de 5 MB; copia em `produtos-imagens`, verifica o hash, copia no Drive privado por multipart e adiciona a URL do Conecta ao Bling usando `midia.imagens.imagensURL` no PATCH. Preserva URLs externas existentes e recusa produtos com imagens internas para não apagar anexos. Confere o Bling depois do envio.

Lock por produto no bucket privado `agente-anexos` impede duas exportações concorrentes. Timeout ou falha parcial mantém o lock e o recibo, com ID reservado do Drive; não há repetição automática. Operações confirmadas ficam na auditoria; o lock é retirado após confirmação. Uma imagem já enviada não é exportada novamente. A reconciliação de falhas está descrita abaixo.

## Governança da escrita no Bling (revisão de 15/11/2026)

A gravação da galeria deixou de chamar o Bling diretamente. Agora ela é a ferramenta `bling.produtos.imagens_adicionar`, registrada em `_shared/bling_ferramentas.ts` e em `_shared/conector/registro.ts`, e só sai pela porta fechada `BlingEscritaReal`, que recusa qualquer corpo que não seja apenas `midia.imagens.imagensURL` com links https.

Antes de qualquer cópia, o endpoint consulta o Policy Engine (`decidir`), com a trava operacional do produto (`produto_travas`). **A ferramenta nasce DESLIGADA**: imagem não está entre os campos que o dono liberou para escrita no Bling em 29/10/2026. Enquanto estiver desligada, a exportação é negada com as duas flags ligadas, nada é copiado e a negativa fica na auditoria (`nanogpt.exportacao_negada`). Ligar exige decisão registrada do dono para este campo e a troca do estado no registro, em PR próprio.

Cada operação leva uma chave de idempotência (`nanogpt-midia:<imagem>:<sha256>`) no recibo e na auditoria. Como nas outras escritas, a chave vale no Conecta.IA e não é enviada ao Bling.

## Reconciliação da trava

Uma falha parcial mantém a trava do produto. A ação `reconciliar` (só lojista; botão no recibo da tela) lê o produto no Bling e nunca reenvia nada:

- o Bling mostra a URL do Conecta: registra o vínculo local, audita e libera a trava;
- o Bling não mostra a URL e a operação tem mais de dois minutos: audita "nada gravado" e libera a trava para nova tentativa. A cópia no Storage é reaproveitada pelo hash; uma cópia no Drive pode ter ficado sem uso e o identificador aparece no recibo para conferência manual;
- operação com menos de dois minutos, Bling sem resposta ou recibo que não corresponde ao produto: a trava continua.

Com trava pendente, `preparar` e `exportar` devolvem o recibo guardado, para a tela oferecer a conferência mesmo depois de recarregar a página.

## Armazenamento

O bucket público `produtos-imagens` (5 MB, PNG/JPEG/WebP) já existia em produção, criado fora das migrações (conferido por leitura em 15/11/2026). A migração `20261115180000_produtos_imagens_bucket.sql` apenas o registra (`on conflict do nothing`); não foi aplicada.

## Estado observado em 15/11/2026

Bling e Drive constam conectados. OpenRouter e GPT-OSS via Groq ativos; Gemini inativo. Não há registro ativo de plugin nem credencial Google de busca de imagens. SearXNG depende dos segredos do servidor e sua disponibilidade deve ser conferida pelo endpoint de status após implantação. Não se deduz disponibilidade da rede a partir do cadastro.

## Implantação pendente

1. Revisar o PR, sem merge automático. Publicar `nanogpt-midia` com verificação JWT e atualizar `assistente` com seus módulos compartilhados.
2. Publicar o painel para disponibilizar a rota. Não criar tabela nem migrar o banco; usa estruturas existentes.
3. Configurar um buscador real, caso o status reporte ausência; não confundir OAuth do Drive com serviço de busca na web.
4. Homologar com uma imagem aprovada, direitos confirmados e um SKU escolhido pelo dono. Para permitir cópia: decisão do dono liberando o campo de imagens, ferramenta `bling.produtos.imagens_adicionar` ligada no registro, `NANOGPT_MIDIA_EXPORTAR=1` e o controle existente `BLING_ESCRITA_REAL=1`. Nenhuma flag foi alterada nesta tarefa.
5. Conferir isolamento entre lojas, recusa de editor, hash alterado, timeout parcial, recibos e leitura após escrita. Desligar `NANOGPT_MIDIA_EXPORTAR` interrompe novas exportações.

## Limites

Não implantado nesta tarefa; não foi executada uma cópia real em produto do cliente. Testes automatizados dos contratos usam respostas controladas e não equivalem a homologação dos três serviços. Não existe transferência automática das ferramentas desta sessão ChatGPT para o Nano, nem assinante de webhook do ChatGPT criado por este PR. A inteligência no chat usa a API configurada; agente externo usa o caminho de pareamento existente.

Fonte do contrato de imagens: https://developer.bling.com.br/build/assets/openapi-CR5QY_N1.json (ProdutosDadosPatchDTO / ProdutosImagensDTO; imagensURL é gravável, externas é somente leitura).
Fonte do upload: https://developers.google.com/workspace/drive/api/guides/manage-uploads
