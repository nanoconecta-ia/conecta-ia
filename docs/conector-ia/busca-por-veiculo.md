# Busca por veículo (gratuita) e componentes compartilhados

## Fora deste plano: placa e chassi
Leitura por placa/chassi depende de base pública e órgãos de controle (Detran, Contran, Senatran), que o projeto não acessa, e não há fonte gratuita legítima. Decisão do dono (2026-10-19): fica **em outro plano**. O trabalho já feito está guardado, sem PR, no branch `plano/leitura-por-chassi` (decodificação offline do VIN + prefixos oficiais cadastrados).
Caminhos usados agora, todos gratuitos e locais:
1. **Minha garagem**: o cliente escolhe montadora → modelo → versão uma vez; a loja mostra só peças aprovadas para a versão (`pecas_da_loja_para_veiculo`).
2. **Código OEM**: `engenharia.oem.buscar`.

## Montadoras parceiras (ex.: Hyundai HR × Kia Bongo K2500, grupos como Stellantis)
Compartilham motor/câmbio, mas isso é **hipótese**, nunca prova. `candidatas_por_compartilhamento` parte das aplicações **aprovadas** de um código, lista outras versões com o mesmo motor e marca `situacao: hipotese`, `virar_anuncio: false`, com a aliança entre montadoras (se registrada e aprovada) como contexto. Suportes, flanges e chicotes mudam; vira aplicação só com prova para a versão, mercado BR e período.

## Ferramentas (somente leitura)
`engenharia.compartilhamento.sugerir`, `engenharia.loja.pecas_do_veiculo`.

## Estado
Roda em ambiente de desenvolvimento (Postgres local + testes). **Nada aplicado em produção**: migrações `…0009`–`…0013` e deploy de funções aguardam autorização explícita.
