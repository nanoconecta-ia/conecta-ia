# Piloto de enriquecimento: 3 famílias (pistão, filtro de óleo, jogo de juntas)

**Status: PARA REVISÃO. Nada foi gravado no banco nem no Bling.** Cada dado traz fonte e confiança; o que não tem fonte fica **a confirmar**. Nada foi inventado.

Como ler a confiança: **alta** = catálogo oficial do fabricante ou da montadora; **média** = revendedor/catálogo de terceiros com referência cruzada; **baixa** = fórum ou anúncio; **sem fonte** = não encontrado.
Método: busca aberta na web em 26/10/2026 (resultados nas fontes abaixo) mais o cadastro do Bling. A busca aberta é fraca para catálogos B2B brasileiros; os catálogos oficiais (Mahle Metal Leve, Wega) e um distribuidor B2B são a fonte necessária para fechar o que está pendente.

## Família 1: Pistão com anéis (SKU PA9903050, inativo no Bling)
Cadastro Bling: "PISTAO C/ANEL (AA8812) - PA9903050 - METAL LEVE", marca Mahle Metal Leve, 2 kg. Sem descrição, sem GTIN, sem aplicação.

| Campo | Valor | Fonte | Confiança |
|---|---|---|---|
| Código do fabricante | PA9903050 / AA8812 | cadastro do Bling | informado no cadastro, **não confirmado** |
| Aplicação (veículo/motor) | **a confirmar**: nenhuma fonte liga PA9903050 ou AA8812 ao 4D56 | busca sem resultado | sem fonte |
| Metal Leve para o 2.5 D/TD (outra referência) | **PA9653**, diâmetro 91,1 mm, equivalente de Kolbenschmidt 40059600, OE **MD304859**, pino 29 mm, altura do pino 48,7 mm | [piecesauto.fr](https://www.piecesauto.fr/kolbenschmidt-8212459.html) | média |
| Outros códigos Mitsubishi com 91,1 mm | MD984128, MD984130 (ET Engineteam), pino 32 mm, altura de compressão 48,7 mm; ref. OE MD377962 | [recambioscoches.es](https://www.recambioscoches.es/oen/md984128) | média |
| Segmentos STD 4D56 16V | diâmetro 91,1 mm | [motordoctor.es](https://www.motordoctor.es/segmentos-de-piston-juego-de-segmentos-de-piston/mitsubishi/l-200/l200-kj/111095-2-5-di-d-4wd) | média |

**Alerta de dado conflitante:** as fontes divergem no diâmetro do pino (29 mm contra 32 mm). Se o código OEM estiver errado, o cliente compra o pistão errado e devolve. Por isso este item **não pode ser publicado** até confirmar PA9903050 no catálogo da Mahle Metal Leve (diâmetro, pino, altura, aplicação e se é o mesmo item de PA9653). Medidas obrigatórias para peça de motor: diâmetro, medida do pino, altura de compressão, sobremedida (STD ou +0,25...).

## Família 2: Filtro de óleo (SKU 4625 WEGA JFO0505P, inativo; e ENG-1645-08 Mahle, provisório)
Cadastro Bling (4625): "Filtro Lubrificante Hyundai Hr 05/... / Mitsubishi L200 / Kia K2500 08/... - JFO0505P - WEGA", GTIN 7894625000001, 0,6 kg.

| Campo | Valor | Fonte | Confiança |
|---|---|---|---|
| Código do fabricante | JFO0505P (Wega) | cadastro do Bling | informado, **não confirmado** |
| Aplicação | Hyundai HR 05/..., Kia K2500 08/..., Mitsubishi L200 (sem ano nem motor) | só o texto do cadastro | **não confirmada** |
| Código OEM e equivalentes (Mann, Tecfil, Fram...) | **a confirmar** | busca sem resultado para JFO0505P | sem fonte |
| ENG-1645-08 (Mahle, HR 8V) | "confirmar referência" (o próprio cadastro) | cadastro provisório do Bling | **não usar como referência** |
| GTIN do 4625 | 7894625000001 parece sequencial e não um código de barras real | — | **suspeito**, conferir |

## Família 3: Jogo de juntas com retentores, sem junta de cabeçote (ENG-1645-11, provisório)
Cadastro Bling: "Jogo juntas com retentores sem junta cabecote HR 8V - MAHLE METAL LEVE", aplicação pretendida HR 2.5 diesel 8V 4D56. "Confirmar referência do kit."

| Campo | Valor | Fonte | Confiança |
|---|---|---|---|
| Referência Mahle do kit | **a confirmar**: nenhuma fonte encontrada | busca sem resultado | sem fonte |
| Aplicação | HR 2.5 diesel 8V, 4D56 (intenção do cadastro) | cadastro provisório | **não confirmada** |
| Observação técnica útil | juntas de cabeçote do L200 2.5 variam de 1,40 a 1,70 mm conforme retífica e altura dos pistões | [fórum 4x4 Brasil](https://www.4x4brasil.com.br/forum/archive/index.php/t-140785.html) | baixa (opinião de usuário) |

Este kit **não inclui a junta de cabeçote**: a ficha pública precisa dizer isso, para o cliente não comprar achando que o jogo é completo.

## O que o piloto mostrou
1. **Dados fortes só existem nos catálogos oficiais.** A busca aberta deu um dado médio útil (pistão para o 2.5) e nada para o filtro e para as juntas.
2. **Os três cadastros do Bling não trazem aplicação confirmada nem código da montadora.** Sem isso, os três ficam fora do site, como a regra manda.
3. **Um dos códigos do Bling pode estar errado ou ser de outro motor** (PA9903050 contra PA9653). Isso só se resolve no catálogo da Mahle.

## O que preciso para fechar as três fichas
- Acesso ao **catálogo de aplicação da Mahle Metal Leve** e ao da **Wega** (por exportação ou planilha; se for portal com login, você decide como eu uso).
- A **nota fiscal de entrada** ou o **código impresso na caixa/peça** dos itens provisórios ENG-1645.
- Confirmar se **"look" e "sax"** são LuK e Sachs (kits de embreagem), para incluir esses fabricantes nas referências cruzadas.

## Depois de aprovar a ficha
1. Cada dado confirmado entra na **fila de aprovação** com fonte, data e confiança (códigos, equivalentes, aplicações, medidas e contraindicações).
2. Aprovado, vira filtro no Conecta.IA e no site (marca, montadora, modelo, motor, cilindrada, medidas).
3. Só então a categoria, a marca e a descrição podem ser escritas de volta no Bling, com o "antes e depois" para você aprovar.
