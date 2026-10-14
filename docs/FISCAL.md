# NCM e dados fiscais por produto — desenho (migração 13 NÃO escrita; aguarda aprovação)

Requisito do dono (2026-10-14): produto cadastrado avulso não traz NCM; o agente deve propor os dados fiscais
conforme o regime e o estado da loja, deixar log, e não mexer no NCM que já vem na nota do fabricante.

## Regras
1. **NCM vindo da NF-e do fabricante é intocável**: origem `nota_fabricante`, bloqueado para o agente.
2. **Sem NCM na nota**: o agente propõe NCM (e CEST/regras quando houver) a partir de tabelas oficiais versionadas
   (NCM/TIPI, CEST do Confaz, regras de ST/antecipação da UF), com a **regra aplicada, a fonte e a versão da tabela**
   registradas num **log fiscal imutável**.
3. **Validação do contador**: o CLAUDE.md do projeto exige que NCM/CEST/CST/CFOP sejam validados pelo contador do
   cliente antes de produção. Então: proposta -> log -> **validação do contador** -> só então grava no Bling e publica
   no site/descrição longa. Não há regra única para todos os produtos nem todos os clientes.
4. **Gravar NCM no Bling não está autorizado** (não consta da lista de campos). Precisa de autorização própria.
5. **Regime e UF**: UF e dados cadastrais vêm do CNPJ (fonte pública); **o regime Lucro Presumido x Real não consta do
   cadastro público do CNPJ** (só a opção pelo Simples/MEI), então vem do lojista/contador e fica registrado com data.
6. **Tabelas completas e atualizadas**: NCM/TIPI, CEST, regras de ST por UF, com vigência (início/fim). Rotina de
   atualização periódica e alerta quando uma tabela muda. A reforma tributária (CBS/IBS, em transição a partir de 2026–2027,
   com mudança nos campos da NF-e) entra como nova versão de regras, sem apagar a anterior.

## Modelo proposto (migração 13)
- `loja_fiscal`: loja_id, cnpj, uf, regime (simples/presumido/real), cnae principal, fonte e data de cada dado, validado pelo contador (quem/quando).
- `ref_ncm`, `ref_cest`, `ref_regras_uf`: tabelas oficiais com `vigencia_ini/fim`, `fonte`, `versao`; só servidor escreve.
- `produto_fiscal`: produto, NCM, CEST, origem (`nota_fabricante`|`agente`|`manual`), regra aplicada, versão da tabela,
  status (`a_confirmar`|`validado`), validado_em/por; aprovado exige fonte e data.
- `fiscal_log`: apenas inserção (como a auditoria): quando, produto, campo, antes, depois, origem, regra, fonte.
- Publicação: NCM validado pode entrar na página e na descrição longa; sem validação, não publica.

## Dúvidas a esclarecer com o dono antes de escrever
- "Acordo de 2018": entendo como o Convênio ICMS 142/2018 (substituição tributária/antecipação, com CEST); **confirmar**.
- Data da mudança de modelo: **1º de janeiro de 2027** (confirmado pelo dono; o "2017" era 2027). Entendida como o início
  da nova fase da reforma tributária; o conteúdo exato (campos da NF-e, CBS/IBS) deve ser conferido nas notas técnicas
  e na legislação vigentes antes de ligar a regra, e o sistema mantém as duas versões de regras com vigência.
- "Goiás é de FAO": não identifiquei o que é "FAO"; explicar (programa/benefício estadual?).
- Quem é o contador que valida (nome e contato) e qual o regime atual declarado (Lucro Presumido).
