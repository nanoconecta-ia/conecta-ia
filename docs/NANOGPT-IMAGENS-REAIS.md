# NanoGPT: chat e imagens com aprovação

## Implementação para revisão

Rota autenticada `#/nanogpt`, disponível no menu e em nova janela. Reutiliza o chat persistente e o seletor de provedores reais. Nenhuma resposta, imagem ou estado de conexão é simulado. O nome NanoGPT identifica a janela; não afirma que a OpenAI está conectada.

O chat agora oferece as ferramentas de proposta de imagem, código, aplicação e enriquecimento já existentes. O endpoint `nanogpt-midia` oferece pesquisa com o adaptador configurado (SearXNG privado ou Google legado), proposta com URL e fonte, preparação e exportação humana. Exportar não é ferramenta do modelo.

A exportação exige lojista autenticado, imagem aprovada e direitos confirmados no banco, confirmação do SHA-256 atual e duas flags do servidor. Baixa o original com validação de rede, formato e limite de 5 MB; copia em `produtos-imagens`, verifica o hash, copia no Drive privado por multipart e adiciona a URL do Conecta ao Bling usando `midia.imagens.imagensURL` no PATCH. Preserva URLs externas existentes e recusa produtos com imagens internas para não apagar anexos. Confere o Bling depois do envio.

Lock por produto no bucket privado `agente-anexos` impede duas exportações concorrentes. Timeout ou falha parcial mantém o lock e o recibo, com ID reservado do Drive; não há repetição automática. Operações confirmadas ficam na auditoria; o lock é retirado após confirmação. Uma imagem já enviada não é exportada novamente. A reconciliação de falhas está descrita abaixo.

## Governança da escrita no Bling (revisão de 15/11/2026)

A gravação da galeria deixou de chamar o Bling diretamente. Agora ela é a ferramenta `bling.produtos.imagens_adicionar`, registrada em `_shared/bling_ferramentas.ts` e em `_shared/conector/registro.ts`, e só sai pela porta fechada `BlingEscritaReal`, que recusa qualquer corpo que não seja apenas `midia.imagens.imagensURL` com links https.

Antes de qualquer cópia, o endpoint consulta o Policy Engine (`decidir`), com a trava operacional do produto (`produto_travas`). Diretriz do dono em 15/11/2026: liberar as ferramentas de enriquecimento (imagem e taxonomia) para o trabalho real, com aprovação humana e preservando os dados fiscais. Por isso a ferramenta está `ativa` no registro (implementada e testada), mas **não grava sozinha**. Cada gravação exige, ao mesmo tempo: liberação registrada da loja em `agente_escrita_liberada` (RPC `agente_escrita_liberar`, com referência da autorização, auditada e revogável), as duas flags do servidor, lojista autenticado, imagem aprovada com direitos confirmados e confirmação do hash. Sem qualquer um, nada é copiado e a negativa fica na auditoria (`nanogpt.exportacao_negada`). Revogar a liberação da loja interrompe novas gravações sem novo deploy.

Dados fiscais: o corpo enviado só pode conter `midia.imagens.imagensURL`; qualquer outro campo (inclusive NCM, CEST, tributação, preço, estoque e SKU) é recusado antes da rede.

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
4. Homologar com uma imagem aprovada, direitos confirmados e um SKU escolhido pelo dono. Para permitir cópia: liberação da loja para `bling.produtos.imagens_adicionar` (`agente_escrita_liberar`, com referência), `NANOGPT_MIDIA_EXPORTAR=1` e o controle existente `BLING_ESCRITA_REAL=1`. Nenhuma flag foi alterada nesta tarefa.
5. Conferir isolamento entre lojas, recusa de editor, hash alterado, timeout parcial, recibos e leitura após escrita. Desligar `NANOGPT_MIDIA_EXPORTAR` interrompe novas exportações.

## Limites

Não implantado nesta tarefa; não foi executada uma cópia real em produto do cliente. Testes automatizados dos contratos usam respostas controladas e não equivalem a homologação dos três serviços. Não existe transferência automática das ferramentas desta sessão ChatGPT para o Nano, nem assinante de webhook do ChatGPT criado por este PR. A inteligência no chat usa a API configurada; agente externo usa o caminho de pareamento existente.

Fonte do contrato de imagens: https://developer.bling.com.br/build/assets/openapi-CR5QY_N1.json (ProdutosDadosPatchDTO / ProdutosImagensDTO; imagensURL é gravável, externas é somente leitura).
Fonte do upload: https://developers.google.com/workspace/drive/api/guides/manage-uploads

## Conector oficial GPT no Nano (piloto de 15/11/2026)

O painel oferece **GPT direto (OpenAI oficial)**, provedor `openai`, SEPARADO de `compativel_openai` (Groq/Cerebras). O backend envia pedidos autenticados exclusivamente a `https://api.openai.com/v1/chat/completions`; o navegador nunca vê o segredo. A chave API oficial fica cifrada por loja e pode ser testada na tela Integrações de IA. ChatGPT Plus/Pro não fornece uma chave API nem paga esses tokens.

- Modelos homologados no adaptador Chat Completions com ferramentas e raciocínio desativado: `gpt-6-luna` (padrão econômico), `gpt-6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`. Para GPT-6 Astra/6.1 Sol com ferramentas, será necessário adaptador novo da Responses API; **não alegar suporte** até implementá-lo.
- O modelo só executa ferramentas de **leitura e proposta** disponíveis no chat; a escrita externa segue fora das ferramentas do LLM, passa pelo Policy Engine, autorização por loja e aprovação humana.
- Configuração pendente do responsável: cadastrar chave de `platform.openai.com` em Integrações, definir limite mensal de tokens e tocar em **Testar chave**. Cadastrar não ativa escrita no Bling.
- A migração `20261115190000_openai_oficial_chat.sql` acrescenta o identificador `openai` aos RPCs de persistência e consumo, preservando permissões atuais. Não aplicar em produção sem revisão.

### Conector ChatGPT para o Conecta.IA (direção inversa)

O endpoint `conector-mcp` já existe, para uso como servidor MCP remoto autenticado pelo ChatGPT (se o usuário decidir instalar um plugin personalizado na sua conta). **Isso não implica que o ChatGPT da conversa corrente esteja pareado ou que a chave da conta ChatGPT seja reutilizada no Nano.** A conexão deve ser configurada e testada separadamente, com OAuth/escopos por loja, somente leitura/propostas, usando o gateway e não uma URL de Bling diretamente.

### Trava reforçada para o piloto de imagem

Antes de qualquer cópia ou PATCH, além das permissões anteriores, o servidor exige as variáveis `NANOGPT_PILOTO_LOJA_ID` (UUID da Mobis), `NANOGPT_PILOTO_SKU` (SKU exato) e `NANOGPT_PILOTO_IMAGEM_ID` (UUID da imagem aprovada). Se qualquer valor estiver ausente/incorreto, a exportação é negada; não há fallback para todos os SKUs. O usuário precisa escolher SKU e imagem antes de configurar as três variáveis. O endpoint de status indica que o piloto não foi delimitado, sem divulgar IDs sensíveis.

O servidor ainda requer `NANOGPT_MIDIA_EXPORTAR=1`, `BLING_ESCRITA_REAL=1` e liberação por ferramenta na loja. Após o primeiro recibo confirmado, desligar `NANOGPT_MIDIA_EXPORTAR` e revogar a liberação da loja. Testar e comparar antes/depois da ficha do Bling, sem tocar em NCM, preço, estoque, SKU, emissão fiscal ou transferência.
