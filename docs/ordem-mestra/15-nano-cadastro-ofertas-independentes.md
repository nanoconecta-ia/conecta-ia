# 15 — Nano IA e cadastro por ofertas independentes (RASCUNHO)

Status: **rascunho para aprovação do dono**. Nada aqui está implementado. Decisões do dono em 13/11/2026.

## 1. Quem é o Nano IA
O **Nano IA** é o agente sênior **integrado ao Conecta.IA**: um auxiliar que faz o trabalho pesado de pesquisa e cadastro de autopeças para o lojista, que só confere e publica no próprio site. O **NanoShell é outro projeto, parado**, e não faz parte deste fluxo (ver seção 7).

## 2. Modelo: peça física única, oferta independente por aplicação
- **Bling (fonte e rastreabilidade):** um cadastro de referência por peça (marca + código), com GTIN, nota de entrada, fornecedores (aba de fornecedores), saldo e dados fiscais. Duplicados ficam excluídos e entram no de-para. Nunca clonar a peça no Bling por aplicação (limite do plano, saldo não compartilhado, clone perde a origem da nota).
- **Conecta.IA:** uma **oferta independente por aplicação** (ex.: HR D4CB, Bongo K2500 D4CB, L200). Cada oferta tem título, descrição, taxonomia, OEM da montadora daquela aplicação, bloco "não se aplica", bula, garantia, imagens e URL **próprios**. O GTIN é **herdado** da peça física (nunca gerado). Os cruzados (OEM de outras montadoras, SKUs de outros fabricantes) aparecem na aba da oferta.
- **Estoque:** uma fonte só, o SKU físico. Toda oferta lê o mesmo saldo; venda em qualquer canal baixa no Bling e todas as ofertas refletem. Sem sincronizar clones.
- **Busca:** "motor Kia Bongo" retorna só ofertas do Bongo (ano, modelo, versão), cada uma com página dedicada.
- **Sem prova, sem oferta publicada.** Aplicação "a confirmar" não gera página nem entra na busca.

## 3. Rastreabilidade das entradas (de-para)
A nota fiscal não muda de cadastro e nunca é alterada. O Conecta mantém a tabela de-para: cadastro antigo → cadastro de referência, com número da nota, data real de entrada, fornecedor e código do fornecedor. No Bling, o cadastro de referência recebe na aba de fornecedores o código de cada fornecedor e, na descrição interna, as notas. Escrita no Bling só com autorização, por planilha de importação, testando com um produto antes.

## 4. Contrato rígido para qualquer agente
As regras valem **no servidor**, não no prompt. Qualquer agente que cadastre (o Nano IA, ou outro agente, inclusive de modelo superior) passa pelas mesmas portas:
1. Só propõe: tudo entra como `a_confirmar` (RPCs de proposta); aprovação é humana.
2. Cada dado leva fonte, data e nível de confiança, separado do dado do Bling. Sem evidência: vazio ou "a confirmar". Nunca inventar OEM, GTIN, NCM, aplicação, imagem, preço ou estoque.
3. Compatibilidade nunca vem do nome do produto; exige relação técnica registrada.
4. Publicação só pelo portão `publicar_produto` (perfil autopeças) e para ofertas com aplicação aprovada e imagem aprovada.
5. Escrita no Bling: padrão NÃO escrever; só com autorização por campo, passando pela política e auditoria; dado fiscal do XML nunca é alterado.
6. Toda ação registra **qual agente e qual modelo** a fez (auditoria), e o uso de IA é medido e limitado por loja.
7. Credencial por loja, que só alcança a própria loja.

**Consequência:** o Nano IA pode usar um modelo simples, e qualquer outro agente pode assumir o cadastro com o mesmo contrato. O cadastro só melhora, porque o rigor está no sistema e não no modelo.

## 5. Roteiro do Nano (passo a passo)
1. Ler o espelho do Bling e achar o cadastro de referência (GTIN, código do fornecedor, OEM).
2. Pesquisar catálogos públicos de fabricante e montadora: aplicações, OEM, medidas, imagens permitidas.
3. Montar uma oferta independente por aplicação provada.
4. Registrar fonte, data e confiança; deixar o resto "a confirmar".
5. Entregar ao lojista com antes/depois; o lojista aprova e publica.

## 6. Caso de teste: OC1224
Referência proposta: Bling id 15953412836. Cadastros ligados a tratar no de-para: 7240211589, 16731620797, 16275882008. O 7087416645 (código 4851, "OC274") divide o GTIN e fica **fora** até conferir embalagem e catálogo. Os 14 OEM estão quase todos "a confirmar".

## 7. NanoShell (correção)
O NanoShell está parado e é independente. Enquanto isso, a preferência de enriquecimento por loja usa só `integrado`; `nanoshell` e `automático` ficam marcados como pausados no desenho (nada apagado).

## 8. A implementar (após aprovação, em PRs separados)
Tabelas de oferta e de-para; página de oferta por aplicação; verificação de pareamento Bling × Conecta × loja; registro de agente/modelo na auditoria.
