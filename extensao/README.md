# Nano.IA Guardião (fase 2: conectado à loja, só propõe)

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

## O que o Guardião NÃO faz
- Não preenche, não clica em salvar e não altera a página.
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
node --experimental-strip-types --test extensao/testes/*.test.ts         # leitura, mapa, sugestões, registro, pareamento, espelho, propostas
painel/node_modules/.bin/tsc -p extensao/tsconfig.json                     # tipos
node extensao/testes/visual.mjs                                            # extensão carrega no Chromium + painel 360/420px
node extensao/testes/visual-fase2.mjs                                      # pareamento, espelho e proposta com rede simulada
```
O teste visual usa uma página **sintética** (`testes/fixture-produto.html`) que imita um formulário de produto. Ela não
é cópia do Bling.

## Pendências antes de evoluir
- Confirmar nos **termos de uso do Bling** se a leitura e a automação na interface são permitidas.
- Confirmar o mapa com a captura da tela real.
- Fase 3, com aprovação: preenchimento **campo a campo com OK do lojista**, só de valores já aprovados na Fila. O
  salvar continua sempre com o lojista.
