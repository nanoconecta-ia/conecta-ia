# NCM e dados fiscais por produto — migração 13 APLICADA em 2026-10-14

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
- "Acordo de 2018": **Convênio ICMS 142/2018** (substituição tributária/antecipação, com CEST por segmento; autopeças =
  segmento 01, Anexo II). Confirmado por levantamento informativo de projeto anterior do dono (sem copiar código nem dados).
- Data da mudança de modelo: **1º de janeiro de 2027** (confirmado pelo dono; o "2017" era 2027). Entendida como o início
  da nova fase da reforma tributária; o conteúdo exato (campos da NF-e, CBS/IBS) deve ser conferido nas notas técnicas
  e na legislação vigentes antes de ligar a regra, e o sistema mantém as duas versões de regras com vigência.
- "Goiás é de FAO": não identifiquei o que é "FAO"; explicar (programa/benefício estadual?).
- Quem é o contador que valida (nome e contato) e qual o regime atual declarado (Lucro Presumido).

## Aprendizados do levantamento informativo (projeto anterior do dono; nada foi copiado)
- **CEST nunca é adivinhado por IA**: resolve-se de forma determinística por tabela oficial (NCM -> CEST), extraída item a
  item do PDF oficial do Convênio ICMS 142/2018, com a referência do item de origem em cada linha. Pares ambíguos
  (mesmo NCM para CEST diferente) ficam de fora e vão para revisão humana. Vamos refazer essa extração aqui, do PDF oficial,
  com conferência própria.
- CST/CSOSN depende do **regime da loja**, não do produto; CEST e NCM dependem do **produto**.
- Default usado antes: Simples -> CSOSN 500; Normal/Presumido/Real -> CST 060 (ICMS-ST já retido). Isso só vale para produto
  sujeito a ST (com CEST); para o resto não há default. **Aqui nenhum default fiscal é aplicado sem validação do contador.**
- Campos fiscais mínimos do produto: NCM, CEST, CST, origem. Logística mínima: peso bruto, altura, largura, comprimento.
- Pendência: o PDF do Convênio ICMS 142/2018 que o dono forneceu antes **não está no Drive consultado**; reenviar ou
  baixar do site oficial do Confaz e conferir a versão vigente (o convênio é alterado com frequência).

## Estado das fontes (2026-10-14)
- Fonte oficial localizada: página do Confaz do Convênio ICMS 142/18 (`confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18`),
  com o Anexo II (autopeças, segmento 01) e redações com vigência (ex.: item 63.0 reescrito pelo Conv. ICMS 66/22, desde 02.05.22).
- **O ambiente de execução bloqueou o acesso a `confaz.fazenda.gov.br`** (política de rede). Para carregar as tabelas é preciso
  liberar esse domínio (e os de Siscomex/Sefaz-GO que forem usados) ou enviar os PDFs. Não há dado carregado nem inventado.

## Goiás: regime que teria substituído a ST (a identificar)
O dono diz que a loja está num regime que substituiu a substituição tributária em Goiás ("default", nome exato não
identificado). Fontes públicas localizadas na busca (a estudar, ainda NÃO aplicadas como regra): Anexo 08 do RCTE-GO
(substituição tributária), Decreto 9.918/2021 (antecipação por TARE, termo de acordo de regime especial), Decreto 9.667,
Lei 13.453 (autopeças, redução de base para optantes do Simples), Parecer Normativo 13/2018 e o Anexo V-B (CEST).
Nenhuma dessas fontes, nos trechos vistos, confirma o fim da ST para autopeças em Goiás. **Nenhuma regra será aplicada
sem norma, número, vigência e trecho exato** (`ref_regras_uf`). Pedido ao dono: número/nome da norma ou do termo de
regime especial que vale para a Mobis (o contador sabe).

## Fluxo com o lojista e o contador (a desenhar na migração 15; não escrita)
- **Notificação no cadastro do produto**: quando falta uma tabela (ex.: Confaz), o sistema mostra ao lojista o que falta,
  a fonte oficial e o botão para baixar/anexar. O agente estuda o anexo e propõe a regra; o que ainda faltar é listado.
- **Especialista fiscal (memória do agente)**: regras estudadas viram memória com norma, vigência e trecho exato.
- **Contador por WhatsApp**: link com mensagem pronta (produto, NCM proposto, regra, fonte); a validação fica
  **em espera** até o contador responder; só então o dado pode ir ao Bling/site.
