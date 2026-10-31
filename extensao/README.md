# Nano.IA Guardião (piloto, só leitura)

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

## O que o piloto NÃO faz
- Não preenche, não clica em salvar e não altera a página.
- Não envia nada para servidor nem para IA. Não há pareamento com a loja nesta versão.
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
node --experimental-strip-types --test extensao/testes/guardiao.test.ts   # leitura, máscara, mapa, sugestões, registro
painel/node_modules/.bin/tsc -p extensao/tsconfig.json                     # tipos
node extensao/testes/visual.mjs                                            # extensão carrega no Chromium + painel 360/420px
```
O teste visual usa uma página **sintética** (`testes/fixture-produto.html`) que imita um formulário de produto. Ela não
é cópia do Bling.

## Pendências antes de evoluir
- Confirmar nos **termos de uso do Bling** se a leitura e a automação na interface são permitidas.
- Confirmar o mapa com a captura da tela real.
- Próximas fases, cada uma com aprovação: pareamento com a loja (Pair), propostas com fonte pelo Policy Engine, e
  preenchimento **campo a campo com OK do lojista**. O salvar continua sempre com o lojista.
