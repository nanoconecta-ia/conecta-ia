# Busca por veículo (gratuita) e componentes compartilhados

## Por que não há busca por placa
Não existe fonte gratuita e legítima de placa → veículo. Raspar sites ou burlar bloqueios é proibido, e o serviço pago foi recusado.
Substituto, 100% gratuito e local:
1. **Chassi (VIN)**: estrutura decodificada offline (`supabase/functions/_shared/pipeline/vin.ts`) e candidatos só entre **prefixos oficiais cadastrados e aprovados** (`identificadores_oficiais`: `vin_wmi`, `vin_wmi_vds`, `prefixo_chassi`). Nenhuma tabela de montadoras embutida. O ano-modelo (10º caractere) é informativo.
2. **Minha garagem**: o cliente escolhe montadora → modelo → versão uma vez; a loja mostra só peças aprovadas para aquela versão (`pecas_da_loja_para_veiculo`).
3. **Código OEM**: `engenharia.oem.buscar`.

## Montadoras parceiras (ex.: Hyundai HR × Kia Bongo K2500, grupos como Stellantis)
Compartilham motor/câmbio, mas isso é **hipótese**, nunca prova. `candidatas_por_compartilhamento` parte das aplicações **aprovadas** de um código, lista outras versões com o mesmo motor e marca `situacao: hipotese`, `virar_anuncio: false`, com a aliança entre montadoras (se registrada e aprovada) como contexto. Suportes, flanges e chicotes mudam; vira aplicação só com prova para a versão, mercado BR e período.

## Ferramentas (somente leitura)
`engenharia.compartilhamento.sugerir`, `engenharia.veiculo.por_chassi`, `engenharia.loja.pecas_do_veiculo`.

## Estado
Roda em ambiente de desenvolvimento (Postgres local + testes). **Nada aplicado em produção**: migrações `…0009`–`…0013` e deploy de funções aguardam autorização explícita.
