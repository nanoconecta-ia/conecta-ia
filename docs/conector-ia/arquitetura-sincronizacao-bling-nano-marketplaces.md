# Conecta.IA — fronteira entre ERP Bling, canais de venda, conector, Nano.IA e loja

Decisão do proprietário, 13/11/2026. Esta especificação descreve comportamento desejado; não afirma que todas as conexões estejam ativas.

## Direção dos dados

Mercado Livre e demais marketplaces ⇄ integração nativa Bling ⇄ ERP Bling ⇄ Conector Conecta.IA ⇄ Nano.IA / catálogo técnico / loja Mobis.

O **Bling é a fonte operacional principal** para SKU físico, estoque, documentos fiscais, cadastros de clientes, dados de contato e pedidos. O fluxo Mercado Livre ↔ Bling é gerido pela integração autorizada do Bling, com reconciliação de status e identificadores de anúncios.

O **conector** pode ler os dados nativos já sincronizados no Bling (inclusive atributos recebidos por canais, se a API autorizada os disponibilizar), indexar o espelho de catálogo no Conecta.IA e oferecer ferramentas de cadastro ao agente Nano.IA. Importar um campo não garante autenticidade nem compatibilidade técnica: conservar origem, timestamp e evidência, separando afirmações do anúncio de homologação do produto.

A função **Indexar e enriquecer** opera sobre os IDs do Bling e as relações do Conecta.IA; identifica SKU/OEM/GTIN originais, aplica taxonomia, montadora, modelo, ano, motor, tecnologias, alternativas, restrições e evidências. **Uma peça física** pode ter **múltiplas aplicações verificadas** e **múltiplas representações de anúncio**, sem multiplicar saldo físico.

## Escrita e proteção

- Leitura/indexação: apenas APIs e permissões autorizadas; registrar origem, data, cursor e versão.
- Enriquecimento: rascunho/proposta no Conecta.IA, fila e comparação antes/depois, com evidências; nem texto do marketplace nem inferência do agente aprovam aplicação automaticamente.
- Escrita no Bling: exclusivamente ferramenta de cadastro autorizada, com aprovação, controle de versão/idempotência, leitura após gravação e log. Sem modificar NCM/CFOP, valores fiscais vindos de NF ou estoque sem autorização específica.
- Publicação em canal: confirmar produto/aplicação/imagens, situação legal e estado da loja; enviar atualização ao Bling ou integração oficial apropriada sem disputar sincronização com a própria integração do marketplace.
- Clientes: CPF/CNPJ, cadastro fiscal, endereço e dados necessários ao pedido no Bling por um fluxo seguro e autorizado, **não** no catálogo Conecta.IA. Só referência opaca/status mínimo no conector se necessário. Cartões e senhas não devem ser armazenados no Bling/Conecta por iniciativa do conector; dados de pagamento pertencem ao prestador autorizado.
- Vendas por UF e finalidade: usar triagem fiscal conservadora por produto, comprador, contribuinte ICMS, destino e vigência; não realizar cobrança/nota/pedido quando faltar validação do contador.

## Casos de reconciliação obrigatórios

1. SKU físico idêntico com anúncios distintos por veículo: vincular anúncios ao mesmo SKU, sem clonar.
2. Marketplace descreve aplicação não homologada: marcar como candidata, sem liberar.
3. Conflito de estoque/preço/tributação: não usar como dado autorizado sem reconciliação e fonte.
4. Evento repetido/sincronização fora de ordem: deduplicar por IDs de origem, versão e idempotência.
5. Canal desconectado, API sem escopo ou falha de leitura: avisar e manter último snapshot identificado como desatualizado, não fingir que foi sincronizado.

**Estado:** documento arquitetural de referência. Não ativa sincronização, não executa cadastro, não faz merge ou deploy.
