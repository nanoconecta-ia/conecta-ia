# Teste da torre — CI000016 (piloto)

Formato de execução do teste piloto proposto na conversa com o proprietário (31/10/2026). Só plano: **nada aqui foi executado**.
Regra: nenhum dado entra como fato sem fonte; o que não está provado fica "a confirmar".

## Objetivo
Validar, com **um** produto, se o painel lateral (Nano Guardião) funciona como central de operação: ler o pedido, achar o produto,
montar a ficha comercial, reunir imagem real e preparar texto e cadastro para o atendimento. Tudo sob aprovação do lojista.

## Convenção de linguagem
- "8V" e "16V" significam **8 válvulas** e **16 válvulas** (motor a diesel; nada a ver com volts). Em texto para o cliente, escrever por extenso.
- Potência é em cv e só entra com fonte; sem fonte fica "não homologado".

## Estado real do CI000016 hoje (consulta só leitura ao espelho do Conecta.IA, 31/10/2026)
| Item | Estado |
|---|---|
| Nome / marca | "Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas" / TRIM GO AUTOPARTS |
| Descrição curta | presente no espelho |
| GTIN | **vazio** |
| Categoria no Bling | vinculada (texto "Arrefecimento > Bombas d'água" **não confirmado** no ERP; a API exige o ID) |
| Imagens | **0** |
| Aplicações veiculares (`produto_aplicacoes`) | **0** |
| Códigos OEM / fabricante | **0** |
| Enriquecimento | 0 aprovados, 2 "a confirmar" (origem: consulta ao Bling) |
| Busca de imagem na web | **desativada** (falta a chave do Google configurada na loja) |
| Publicado no site | não |

**Consequência:** os códigos de motor citados no plano (D4BH, D4BB, 4D56), a compatibilidade com Hyundai HR / Kia K2500 e a categoria
completa **não estão no espelho com fonte**. Entram como "a confirmar" até haver catálogo do fabricante ou distribuidor.

## Dados obrigatórios (sem eles o teste para)
1. SKU, nome, marca, categoria e preço: lidos do Bling. **Preço e custo são do ERP; custo e fornecedor nunca vão para arte nem texto público.**
2. Pelo menos uma imagem **com direito de uso confirmado** (foto do próprio lojista, do fabricante com autorização, ou licenciada).
3. Aplicação e referências (OEM/fabricante) **com fonte e data**.
4. Aprovação do lojista em cada item antes de qualquer saída.

## Etapas
| # | Etapa | Como | Situação hoje |
|---|---|---|---|
| 1 | Abrir o painel lateral no Chrome/Edge | extensão Guardião | **CÓDIGO + MOCK**; falta instalar e pareamento real |
| 2 | Ler o produto no Bling | espelho (`get_product`) e/ou API `getProduct`; tela reconhecida pelo mapa | mapa **v0 a confirmar**; falta captura real |
| 3 | Montar a ficha comercial | só dados do espelho/aprovados; lacunas listadas | possível; ficha com lacunas |
| 4 | Achar imagem real | busca na web pelo agente → **proposta na Fila** → lojista aprova direitos | **bloqueado:** busca desativada (chave) |
| 5 | Texto de atendimento (curto) | a partir da ficha aprovada; sem preço de custo; "preço e disponibilidade sob consulta" | possível após o passo 3 |
| 6 | Arte para WhatsApp | usar **só** imagem aprovada no passo 4 | **não existe gerador de arte configurado**; definir ferramenta antes |
| 7 | Ficha de cadastro para catálogo do WhatsApp Business | texto organizado para copiar | possível como documento; **não verificado** se há API oficial utilizável |
| 8 | Aprovação final e entrega | lojista revisa e envia à mão | sempre manual |

## Fora do escopo desta fase (precisam de decisão e verificação própria)
- **Ler a conversa do WhatsApp:** hoje a extensão só lê a aba do ERP. Ler o WhatsApp Web é outro site, outra permissão e outro risco;
  **os termos do WhatsApp/Meta sobre automação de interface não foram verificados**.
- **Preencher o catálogo do WhatsApp pela tela:** mesma ressalva. Levantar antes se existe API oficial de catálogo.
- **Campanhas** (Instagram, Facebook, TikTok): fase 3, reaproveitando o mesmo ativo aprovado.

## Critérios de aprovação
- [ ] Nenhum dado público veio de fonte sem URL/documento e data.
- [ ] Nenhuma imagem sem direito de uso confirmado aparece na arte.
- [ ] Nenhum custo, fornecedor ou dado fiscal aparece em texto ou arte.
- [ ] Compatibilidade e referências OEM só com fonte; o restante marcado "sujeito à confirmação".
- [ ] Preço **não** exposto, a menos que seja o preço de venda do ERP e o lojista aprove.
- [ ] Nada foi gravado no Bling; o que foi preenchido na tela foi conferido e salvo pelo lojista.

## Saída esperada
1. Ficha comercial do CI000016 (com lacunas marcadas).
2. Texto curto de atendimento.
3. Arte para WhatsApp **somente se** houver imagem aprovada e ferramenta de arte definida.
4. Ficha para o catálogo do WhatsApp, em formato copiável.
5. Estrutura de campos reaproveitável para outras redes.
6. Relatório do que ficou provado como MOCK, CÓDIGO, E2E-API, UI-REAL ou PERSISTIDO.

## Pendências para executar
- [ ] Configurar a busca de imagem da loja (chave do Google) **ou** o lojista fornecer a foto.
- [ ] Confirmar a fonte da aplicação e das referências (catálogo do fabricante ou distribuidor).
- [ ] Definir a ferramenta de geração da arte.
- [ ] Captura real do Bling com "Registrar esta tela".
- [ ] Publicar `conecta-gateway`, `assistente` e o painel com `VITE_PAIR_ATIVO=1` (autorização do proprietário).
- [ ] Verificar termos do WhatsApp/Meta antes de qualquer leitura ou preenchimento na interface deles.
