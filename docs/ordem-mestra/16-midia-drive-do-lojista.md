# 16 — Mídia do lojista: Drive como acervo, Conecta como vitrine

Status: **PROPOSTA (rascunho)**. Sem código, sem migração, sem integração ativa. Nada aqui foi implementado.
Data: 2026-11-13. Origem: pedido do dono (José) na sessão de 13/11/2026.

## 1. Ideia do dono
- O lojista conecta o próprio Google Drive ao Conecta.IA (login com a conta Gmail dele).
- O Conecta cria uma pasta específica; o lojista pode jogar arquivos desorganizados dentro dela.
- O agente (Nano IA ou outro) organiza, com rastreabilidade.
- A mesma imagem é espelhada para o Bling e para o site.
- Lojista premium ganha mais ferramentas do Google (escopo a definir).

## 2. Decisão de arquitetura
**O Drive é o acervo (original e organização). Não é o servidor de entrega.**

Motivos: links públicos do Drive têm cotas e limites de acesso, podem bloquear arquivos muito acessados, e o streaming de vídeo do Drive não é feito para loja. O Bling precisa de um link que abra a imagem direto, sem login; se a pasta for pública, tudo nela fica público. (A aceitação de link do Drive pelo Bling está **não verificada**: testar com um produto antes.)

Fluxo:
1. Original no Drive do lojista (`_ORIGINAIS`, nunca alterado pelo agente).
2. O agente propõe a organização por SKU (cópias em pasta organizada).
3. Só o que está em `APROVADAS` é publicado: o Conecta gera uma cópia leve (WebP, alvo ≤ 200 KB) em armazenamento próprio (bucket `produtos-imagens`, já criado no projeto, vazio).
4. A loja e o Bling usam o link dessa cópia. As duas partes mostram a mesma foto.
5. Vídeo: o original fica no Drive; a loja incorpora por hospedagem de vídeo (YouTube não listado ou similar). Não guardar vídeo no Supabase gratuito.

## 3. Ponto técnico crítico (precisa de decisão)
Login com Google (identidade) e acesso ao Drive (autorização) são coisas diferentes.

O escopo `drive.file` (o mais seguro) dá ao aplicativo acesso **somente a arquivos que ele criou ou que o usuário escolheu**. Arquivos que o lojista solta dentro da pasta **não** ficam visíveis ao Conecta. Para "joga tudo bagunçado e o agente organiza" há três caminhos:

| Caminho | Vantagem | Custo / risco |
|---|---|---|
| A. Seletor do Google (Picker) a cada lote | escopo mínimo, sem verificação pesada | o lojista precisa clicar para liberar cada lote |
| B. Escopo amplo de Drive | zero atrito | escopo restrito: exige verificação de segurança do Google (processo longo e possivelmente pago) e dá acesso a todo o Drive do lojista |
| C. Pasta enviada por página do Conecta (upload) | controle total, sem escopo amplo | o lojista usa o Conecta, não o Drive, para soltar arquivos |

Recomendação: começar pelo **A** no piloto, medir o atrito e decidir por B ou C. Não adotar B sem decisão do dono.

## 4. Regras que continuam valendo (contrato do agente)
- Imagem não é associada a SKU **só pelo nome do arquivo nem pelo código do produto**. Já houve colisão real de códigos (5076/5077 em produtos excluídos do Bling são peças diferentes). Associação exige evidência (marca + código + aparência confirmada) ou confirmação humana.
- Sem evidência, o arquivo vai para `A_CLASSIFICAR`, não é inventado nem descartado.
- Toda imagem nasce **candidata**: fonte, direito de uso (padrão "a confirmar"), quem propôs (agente e modelo) e data. Nenhuma foto gerada por IA como se fosse da peça.
- Publicação só de imagem aprovada, pelo caminho `publicar_produto`. A existência da imagem não autoriza a publicação do produto.
- **O agente nunca apaga** nada no Drive do lojista. Organizar = copiar e registrar; mover só com autorização por lote.
- Gravar no Bling (imagem do cadastro) é escrita no ERP: segue a regra existente (ferramenta desligada até teste com mock, Policy Engine, auditoria, `idempotency_key`).

## 5. Rastreabilidade (registro por arquivo)
Cada imagem registra: `id_arquivo_drive`, hash do conteúdo (sha256), caminho original, SKU associado, tipo de evidência, status (candidata / aprovada / rejeitada), direito de uso, agente e modelo, data, link da cópia publicada, e onde foi usada (loja, Bling). Um índice legível (planilha no Drive do lojista) pode espelhar esse registro, mas a fonte de verdade é o banco do Conecta.

## 6. Segurança
- Token do Google do lojista: cifrado, só no servidor, isolado por loja, nunca no navegador, repositório ou log. Mesmo padrão das credenciais do Bling.
- Acesso mínimo ao Drive (ver seção 3). Revogável pelo lojista.
- Pasta do Drive privada; só a cópia aprovada vai a um endereço público.
- Isolamento total entre lojas no servidor e no banco (RLS).

## 7. Limites de plano (informativo, consultado em 13/11/2026; conferir antes de decidir)
- Supabase gratuito: 1 GB de arquivos, 50 MB por arquivo, 10 GB de banda por mês (5 GB direto + 5 GB em cache), projeto pausa após 1 semana sem uso. Pro: 100 GB de arquivos.
- GitHub gratuito: bloqueia arquivo > 100 MiB (avisa > 50 MiB); LFS com 10 GiB de armazenamento e de banda. Não usar o repositório como banco de imagens.
- Estimativa: fotos de 150–500 KB → de 2 mil a 6 mil fotos em 1 GB.

## 8. "Premium" (a definir)
"Lojista premium recebe todas as ferramentas do Google" é uma intenção, não um requisito fechado. Falta definir quais ferramentas, quais escopos, e se entram no plano ou são extras. Cada ferramenta adicional amplia o acesso à conta do lojista e a superfície de segurança.

## 9. Piloto proposto (nada executado)
- Uma loja (Mobis), uma pasta, uma foto: a junta Sabó do SKU `82892/`, como candidata (não aprovada).
- Critério de sucesso: a foto aparece no Drive, na cópia leve do Conecta e (se o Bling aceitar o link) no cadastro do Bling, com o registro da seção 5 completo.
- Antes de qualquer código: aprovação deste desenho, do caminho de escopo (seção 3) e da criação do aplicativo de autorização no Google.

## 10. A implementar (depende de aprovação)
- Tabelas: registro de mídia por arquivo; vínculo arquivo ↔ SKU ↔ oferta; vínculo de conta Google por loja.
- Função de servidor: autorizar Drive (token cifrado), listar/copiar arquivos, gerar cópia leve, registrar.
- Painel: conectar Drive, ver fila `A_CLASSIFICAR`, aprovar/rejeitar candidatas.
- Teste de aceitação do link pelo Bling com um produto antes de ligar o espelhamento.

## 11. Pendências abertas
- Escolha do caminho A, B ou C (seção 3).
- Aceitação de link do Drive/da cópia pelo Bling: não testada.
- Onde hospedar vídeo.
- Escopo do "premium".
- Foto da junta 82892/: ainda não está no Drive nem no Conecta; a pasta `82892_SABO_JUNTA_CABECOTE` e a planilha `INDICE_IMAGENS_PRODUTOS` foram criadas em `03_IMAGENS_PRODUTOS` (Drive do dono), vazias.

## 12. Duas pastas e imagem herdada pela genética (pedido do dono, 13/11/2026 22:12)

### 12.1 Duas áreas de mídia
- **Pasta A — gerida pelo Conecta:** o lojista só acessa pelo Conecta (envio/consulta pela página do Conecta). Corresponde ao caminho C da seção 3 e elimina o problema de escopo amplo. Quem é o dono do armazenamento (conta do Conecta, Supabase ou armazenamento externo) **ainda não foi decidido**: uma conta Google gratuita tem cota compartilhada (15 GB entre Drive e Gmail), então uma conta Google única para todos os lojistas não escala.
- **Pasta B — Drive do próprio lojista**, conectado por conta separada (caminho A ou B da seção 3, a decidir). Fonte de referência: o Conecta pode vasculhar imagens e catálogos PDF ali, com escopo concedido pelo lojista.
- Busca externa (web) é permitida só como **referência** (ver 12.3).

### 12.2 Formato padrão e rastreio
- Cada imagem tem registro: SKU, código OEM (da montadora correspondente à aplicação, quando provado), nome, descrição, origem, direito de uso, sha256 do original e da versão padronizada, agente e modelo, data.
- Formato padrão: WebP, fundo branco, proporção quadrada, alvo ≤ 200 KB. O original é preservado e nunca sobrescrito.
- A imagem pertence à **peça física** (SKU de referência) e é herdada pelas ofertas (pai, filhos, irmãos). Regra: só herda se a peça for a mesma (mesma marca + código + OEM comprovado). Oferta pode ter imagem própria quando a aparência muda por aplicação. Herança por parentesco de veículo, sem identidade da peça, **não** é permitida.

### 12.3 Imagens da web
- Entram sempre como **candidata, direito de uso "NÃO VERIFICADO"**. Editar (fundo branco, recorte, redimensionar) e reescrever a descrição **não** transfere direitos para o lojista.
- Proibido remover marca d'água, logotipo de terceiros ou crédito para disfarçar a origem. Se a imagem tiver marca de outro vendedor, ela só serve como referência interna.
- Publicação exige fonte autorizada (ex.: banco de imagens do fornecedor com permissão, foto própria) ou aprovação humana explícita do direito de uso.
- Respeitar termos de uso e robots do site de origem.

### 12.4 Edição por agente
- Ferramentas de edição mecânica para o Nano IA e outros agentes: remover fundo, recortar, centralizar, redimensionar, converter formato, aplicar fundo branco.
- **Proibido:** gerar ou alterar o aspecto da peça com IA (furos, textura, marcação, logotipo). Edição não pode mudar o que a peça é. Resultado sempre registrado como versão derivada do original, com hash.
- Toda edição passa por aprovação humana antes de publicar (candidata → aprovada).

### 12.5 Varredura de catálogos PDF
- O Nano pode ler PDFs do Drive do lojista e propor aplicações e códigos OEM **com fonte** (arquivo, página, data) e confiança. Resultado entra como `a_confirmar`; nunca publica sozinho.
- Compatibilidade só com relação técnica provada, nunca pelo nome do produto.

### 12.6 Pendências adicionais
- Quem possui e paga o armazenamento da Pasta A.
- Se o plano do Supabase foi ampliado (a premissa "Conecta tem espaço de sobra" não está confirmada; o plano ampliado conhecido é o do Bling).
- Política de direitos de imagem da web (aprovação humana obrigatória) a validar com o dono e, se necessário, com assessoria jurídica.
