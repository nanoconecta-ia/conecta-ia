# Camada de conhecimento automotivo (briefing do dono, 2026-10-19)

Esta camada ensina o agente a raciocinar como engenheiro sênior de aplicações, sem inventar dado. O conteúdo abaixo é a **metodologia** (estrutura e regras). Nenhum fato de marca, ano ou medida foi gravado: tudo entra depois, com fonte, e passa pela aprovação do lojista.

## 1. Atores (quem é quem)
| Ator | Onde fica | Exemplos citados pelo dono (a cadastrar com fonte) |
|---|---|---|
| Montadora de veículo | `montadoras` | Stellantis, Hyundai, Kia, BYD, GWM |
| Fabricante de motor independente (atende pesados, agrícola, linha amarela, industrial; **não** é montadora) | `fabricantes_peca.papel = fabricante_motor` + `segmentos` | Cummins, MWM |
| Sistemista / fabricante de autopeça | `papel = sistemista_autopeca` | Cofap, Magneti Marelli, Bosch, Sabó, Jusa, Elring, Fremax, Hiperfreios, TRW, Grupo Vargas, INA, SKF |
| Marca de lubrificante/filtro | `papel = marca_lubrificante_filtro` | (a cadastrar) |
Classificar exige `papel_fonte_id` (CHECK no banco).

## 2. Brasil: CKD, importação e versão local
O Brasil recebe veículos de montadoras estrangeiras, em geral homologados com versão própria e, em parte, montados em CKD/SKD. Segundo o dono, o governo permite um percentual de componentes locais (pneus, suspensão, parte da eletrônica) como incentivo (IPI). **Esse percentual e a regra são informação do dono, a confirmar com a legislação vigente e o contador; não estão no banco.**
Consequência prática: a versão BR pode diferir da original. Por isso `versoes` ganhou `regime_montagem` (importado_pronto, ckd, skd, nacional), `propulsao`, `diferencas_da_original` e `regime_fonte_id` (obrigatório quando preenchido). Ano inicial e final continuam vindo de `eventos_veiculo` (homologação, importação, comercialização no BR), nunca do lançamento mundial.

## 3. Componentes compartilhados e intercâmbio
Pastilhas, discos, buchas, bandejas, velas, relés, juntas e filtros circulam entre montadoras, entre grupos e até entre combustão e elétricos. Regras:
- relação **direta** (sem transitividade), com tipo de evidência (referência cruzada < equivalência validada < substituto homologado);
- a mesma peça por várias marcas aparece em `intercambio_da_peca` (ferramenta `engenharia.intercambio.listar`);
- compartilhar motor/plataforma gera só **hipótese** (`engenharia.compartilhamento.sugerir`).
Filtros e lubrificantes têm as melhores tabelas de motor/ano inicial/final, mas entram como fonte registrada, nunca como verdade automática.

## 4. Bula técnica e contraindicação
Peça só é "pronta" quando a família tem as **medidas exigidas** aprovadas (mm, espessura de junta, altura, diâmetro...). Tabelas novas: `especificacoes_exigidas` (por categoria; nasce `proposta`), `peca_especificacoes` (medida com fonte, valor e data; aprovada sem fonte é recusada pelo banco) e `peca_contraindicacoes`. `engenharia.bula.verificar` aponta o que falta. O agente nunca estima medida.

## 5. As três camadas
- **Bling (ERP)**: fonte do cadastro. Nada é escrito nele sem autorização por campo.
- **Conecta.IA**: camada de enriquecimento, auditável, onde o agente propõe e o lojista aprova.
- **Site**: publica só o aprovado: filtros (`filtros_da_vitrine`: categorias com ícone, montadoras, fabricantes), bloco de aplicações por versão e ficha técnica na página do produto.

## 6. O que NÃO está feito
Cadastro dos fatos (marcas, regimes, medidas): depende de fontes. Tela da vitrine com os filtros: os dados já saem em `loja-publica` (`filtros`), a interface é outra etapa. Nada aplicado em produção.
