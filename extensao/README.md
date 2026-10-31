# Nano.IA Guardião (fase 3: preenche na tela, com o seu clique, só o que já foi aprovado)

Extensão para **Chrome e Edge** (Manifest V3) que abre o Nano.IA num **painel lateral** ao lado do ERP em que o lojista
já está logado. Direção definida pelo proprietário na issue #166: o Nano.IA trabalha **sobre a tela real do ERP**, sem
redesenhar as telas do ERP dentro do painel.

## O que o piloto faz
1. O lojista abre o cadastro de produto do ERP e clica no ícone da extensão. O painel lateral abre.
2. **Ler esta tela**: o navegador pede permissão **só para aquele site**. A extensão lê os campos da página pelos
   rótulos e pela acessibilidade (nunca por coordenada de tela) e reconhece o cadastro de produto pelo mapa.
3. Mostra os campos lidos, as pendências e as sugestões. No piloto, a única sugestão é **tags de busca**, montadas a
   partir de nome, marca e código já cadastrados.
4. **Registrar esta tela**: exporta só a estrutura da tela (rótulos, tipos, id/name, preenchido sim/não, **sem
   valores**). Serve para confirmar o mapa com a tela real.

## Fase 2: conectado à loja (Conecta Pair)
5. **Conectar à loja**: a extensão pede um pareamento do tipo `navegador` com os escopos mínimos `produtos:ler` e
   `enriquecimento:propor`. Não existe escopo de aprovar, executar ou gravar no ERP.
   - O lojista abre a aprovação no painel do Conecta.IA e confere o código de verificação.
   - O token nasce na extensão: o servidor recebe só o SHA-256 dele. Ele fica em `chrome.storage.session`, que é
     apagado quando o navegador fecha.
6. **Espelho**: com a tela lida, a extensão busca o mesmo SKU no espelho do Conecta.IA (`conecta.get_product`).
   - Aponta divergências entre a tela e o espelho em nome, marca, GTIN e descrição curta.
   - Mostra o que falta para publicar.
7. **Propor com fonte**: para cada pendência aceita pelo servidor, o lojista informa o valor e a fonte, e a proposta
   vai para a **Fila de aprovação** como "a confirmar".
   - Campos aceitos: marca, descrição curta e complementar, peso líquido, categoria e GTIN (como código EAN).
   - Sem fonte, nada é enviado. Nada é gravado no ERP.

Os dois serviços (`pair` e `conecta-gateway`) **já estão implantados**. A aprovação no painel depende de um build com
`VITE_PAIR_ATIVO=1`; no build de produção atual, a tela de aprovação fica oculta.

## Fase 3: preencher na tela, valores já aprovados
8. Conectado e com a tela lida, a extensão busca os valores **já aprovados na Fila** para o SKU
   (`conecta.get_validated_fields`): marca, descrições, peso líquido, categoria sugerida e EAN.
9. Cada valor aparece com fonte e data:
   - **Já está na tela**: nada a fazer.
   - **Preencher na tela**: um clique preenche **um** campo.
   - **Substituir**: quando já existe outro valor, o lojista precisa marcar "Substituir o valor que está na tela".
10. Depois de preencher, a extensão **lê a tela de novo e confere** o valor. Ela dispara o evento `input`, para telas
    em React ou Vue perceberem a mudança, e oferece **Desfazer**.
11. **Nunca salva nem envia o formulário.** O lojista revisa e clica em salvar no ERP.
    - Opção de lista que não existe no ERP, campo sensível, desabilitado ou de tipo não suportado: o Nano não mexe e explica por quê.
    - NCM e outros campos fiscais, preço e SKU nunca são preenchidos.
12. **Registro:** o histórico "Nesta sessão" fica só no painel. O gateway audita cada consulta, mas o fato de ter
    preenchido na tela **não vai para a auditoria do servidor**. A regra de segurança do gateway só permite ferramentas
    de leitura e de proposta, e um registro de preenchimento fica para quando houver contrato para isso no registro (C2).

A ferramenta `conecta.get_validated_fields` está no código, mas **só funciona depois de publicar o `conecta-gateway`
atualizado**. Antes disso, o painel avisa que o servidor ainda não tem a fase 3 e não preenche nada.

## Loja virtual: tags, SEO, especificações técnicas e imagens (site ligado ao Bling)
- **Mapa:** reconhece **Título SEO**, **Descrição SEO**, **URL da imagem** e **Tags**. Os rótulos são hipóteses, a confirmar com a captura real.
- **Campos customizados do ERP** viram **especificações técnicas** pelo nome do campo. Por exemplo,
  "Diâmetro externo (mm)" vira `espec:diametro_externo_mm`. Funciona sem conhecer os nomes antes. Campo sensível nunca entra.
- **Sugestões só com dados da tela:** tags e SEO (título até 70 caracteres, descrição de 50 a 160) a partir de
  nome, marca e código. O botão "Propor para a Fila" abre o formulário já preenchido, para o lojista revisar.
- **Imagens:** o agente Nano.IA (chat) busca imagens na web e as propõe à Fila. As que o lojista **aprova**
  aparecem para preencher o campo **URL da imagem** na tela, com um clique.
- **Servidor:** `propose_enrichment` aceita `tags`, `seo_titulo`, `seo_descricao` e `espec:<campo>`, com limite por
  campo. `get_validated_fields` devolve esses valores e as imagens aprovadas. Não precisa de migração.

## O que o Guardião NÃO faz
- Não clica em salvar e não envia formulário. Só preenche, um campo por clique, valores já aprovados na Fila.
- Sem conexão com a loja, não envia nada para fora. Conectado, só consulta o espelho e envia propostas. Nunca usa IA nem manda dado sensível.
- Nunca lê senha nem campo oculto. **Mascara** custo, preço de compra, fornecedor, dados fiscais (NCM, CEST, CFOP,
  CST, ICMS, IPI, PIS, COFINS), CPF/CNPJ, token e chave. Campo sensível nunca casa com campo do mapa.
- Não sugere GTIN, peso, medidas nem compatibilidade. Esses viram pendência que exige fonte verificável.

## Mapa da tela
`src/mapa-produto.ts`, versão 0, **`conferido: false`**. Os rótulos são hipóteses e **não foram conferidos na tela real
do Bling**. A confirmação depende de uma captura feita com "Registrar esta tela" no ERP real. Tela com menos de 3
campos essenciais reconhecidos fica "não reconhecida", e aí o Nano não sugere nada.

## Instalar para testar (sem loja de extensões)
```bash
node extensao/construir.mjs        # gera extensao/dist
```
Chrome: `chrome://extensions` · Edge: `edge://extensions`. Depois: Modo do desenvolvedor → **Carregar sem compactação**
→ escolher `extensao/dist`.

## Testes
```bash
node --experimental-strip-types --test extensao/testes/*.test.ts         # leitura, mapa, sugestões, registro, pareamento, espelho, propostas, preenchimento, loja virtual
painel/node_modules/.bin/tsc -p extensao/tsconfig.json                     # tipos
node extensao/testes/visual.mjs                                            # extensão carrega no Chromium + painel 360/420px
node extensao/testes/visual-fase2.mjs                                      # pareamento, espelho e proposta com rede simulada
node extensao/testes/visual-fase3.mjs                                      # preencher aprovados, conferir, desfazer; servidor antigo
```
O teste visual usa uma página **sintética** (`testes/fixture-produto.html`) que imita um formulário de produto. Ela não
é cópia do Bling.

## Pendências antes de evoluir
- Confirmar nos **termos de uso do Bling** se a leitura e a automação na interface são permitidas.
- Confirmar o mapa com a captura da tela real.
- Publicar o `conecta-gateway` atualizado (fase 3) e o painel com `VITE_PAIR_ATIVO=1`, para a aprovação do pareamento. Os dois exigem autorização.
