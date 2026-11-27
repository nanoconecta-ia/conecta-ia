# Mobis Autopeças — entrega operacional 1.0 (candidata)
27/11/2026. Entrega antecipada autorizada para homologação, não para publicação.

## Base e fronteira
- Main de referência: b8d6b32338fa06da08c9f2d05859d9b4c22519db.
- PR #506 / 232c42eb99a3a20eca62ef499c8458925d126ca0: reaproveitar exclusivamente cinco arquivos de frontend MA Display. Os atalhos de veículos são ilustrativos, não prova técnica.
- PR #507 / 0b3ad483457a4ef9a7b147712d973915323a342c permanece independente: nenhum código experimental, migração, autoridade de decisão ou teste com falha é incorporado nesta candidata. Não substituir o trabalho daquela branch. Revisar conflitos de LojaMobisNova.tsx antes de integração futura.
- Não criar marcador de publicação, não executar deploy, não modificar main, Supabase, ERP, preços, estoque, DNS ou permissões. Não ligar automação nova. Os fluxos existentes da main permanecem como estavam; não afirmar que todas as permissões existentes são somente leitura.

## Escopo de aceite da entrega 1
| Gate | Evidência requerida | Estado inicial |
|---|---|---|
| OP-01 build e testes | CI painel, tipos, build, revisão SHA | pendente |
| OP-02 vitrine | busca SKU/OEM, filtro, produto publicado e ativo, ausência de exposição de preço não autorizado | pendente |
| OP-03 identidade | logo oficial, fundo branco, aço/película, contraste, desktop/mobile 360/390/412 | pendente |
| OP-04 painel | login e isolamento por loja, rotas catálogo, atendimento, permissões existentes sem regressão | pendente |
| OP-05 Bling | readback real autorizado em ambiente permitido, sem escrita nova; estoque somente se confirmado | pendente |
| OP-06 engenharia | aplicação homologada individual, consulta OEM, não inferir compatibilidade, sem nova autoridade de aprovação | pendente |
| OP-07 atendimento | link WhatsApp correto, sem disparo automático | pendente |
| OP-08 segurança e SEO | sem vazamento entre lojas, sem indexar não homologado, sem ativar automação experimental | pendente |
| OP-09 aceite | capturas do mesmo SHA, auditor distinto, aceite visual do lojista e plano de rollback | pendente |

## Evidências e acesso
Usar workflows existentes de PR: Painel, Interface aprovada e Cloudflare Free (validação somente). Os artefatos de interface e vitrine usam dados simulados e não comprovam integração real. A prévia estática conecta-homologacao-estatica é isolada, não é o painel completo e não deve conter referências operacionais. Não abrir acesso real antes de validar ambiente, credenciais e segregação; não usar credenciais de produção na prévia. Índice = gates obrigatórios aprovados / 9; não compensar falha crítica por média. Entrega operacional de produção exige autorização específica e rollback para o SHA anteriormente publicado, identificado antes de qualquer deploy.

## Sequência
1. CI e evidências de frontend da candidata.
2. Aceite visual humano e teste integrado isolado com catálogo representativo; readback real somente autorizado.
3. Revisão independente; proposta de publicação separada com escopo exato.
4. Evoluir PR #507 em paralelo sem misturar as duas entregas; integração seletiva posterior após homologação.

## Revisão visual da primeira candidata — 27/11/2026
SHA e30aee5906568b58389b92daf694105e1a1fab11: 8/8 workflows aprovados. Job interface 140721397167: 495 testes e capturas 360/390/412/1280. Artefatos 15230225263 (painel) e 15230065574 (vitrine); prévia estática 15229481966. Dados simulados. OP-01 aprovado nessa revisão; demais gates não automaticamente aprovados. Revisão das capturas de vitrine desktop e mobile encontrou título branco sobre fundo gelo, texto de cabeçalho/contato esbranquiçado e rótulo da busca exata pouco legível. Correção restrita ao Modelo 02 (técnico), preservando geometria e fotos; regressão verifica cor computada no navegador, não equivale a auditoria WCAG completa. Novo CI e novas capturas obrigatórios. Sem publicação. Readback isolado de CI003696: Bling ativo ID 16719530075, saldo físico/virtual 1, espelho 1, registro omitido inativo/excluído a investigar; aplicação 2014 sem evidência aprovada, sem OEM vinculado, imagem principal pendente. Não aprovar ou alterar cadastro.

## Bloqueio de aceite estrutural — revisão do lojista, 27/11/2026
O lojista rejeitou a persistência de ícones antigos e a entrega de HTML sem o sistema real estruturado pelo mapa. O CI verde de revisões anteriores é evidência técnica parcial, não aceite visual ou operacional. Não entregar a prévia estática como sistema completo.

Evidências de inspeção do SHA e46c10f49c3364a845cb1052a1e92a038a786abc: 
- `painel/src/componentes/AtivoAprovado.tsx` importa `assets/atlas-modelo-aprovado.jpg`, recorta posições fixas e usa catálogo como fallback de chave desconhecida. A troca do logo e a camada CSS Prismatic não substituíram este atlas. Inventariar consumidores, inclusive Design, Início, Catálogo, Nano, Acesso, painel e avatar; distinguir ícones técnicos e utilitários. Não atribuir significado técnico a fallback genérico.
- Matriz Mestra canônica no PR #507, SHA 0b3ad483457a4ef9a7b147712d973915323a342c: `docs/conector-ia/nano-matriz-mestra-20261126.md` e `supabase/functions/_shared/nano_lifecycle/matriz_mestra.ts`. Possui 12 raízes lógicas; não replicar o contrato em uma segunda autoridade. PR #508 não integra esse contrato. PR #507 ainda bloqueado por CAT-143.
- Referência do lojista: Dashboard MA Display – Ícones Automotivos (montadoras, veículos, sistemas; ativos técnicos coloridos/3D), MA Vision EPC e Prismatic Pro. Referência visual não comprova licença, identidade OEM, bytes, aplicação nem biblioteca homologada.

### Condições para retomar o aceite (não homologadas)
1. OP-03: inventário de todos os ícones legados e seus consumidores; biblioteca por identificador semântico estável, versão, fonte/direitos, vínculo ao nó, acessibilidade e variantes. Substituir efetivamente ativos antigos no escopo Mobis, preservando geometria MA e tipografia. Ausência de ativo aprovado deve ser explícita, não usar ícone antigo ou peça diferente como substituto. Capturas comparadas com referências e aceite visual humano.
2. OP-04/06/08: integrar seletivamente frontend e contrato canônico de 12 raízes após homologação do #507; mapa navegável baseado nos identificadores/relacionamentos existentes, estados e evidências do servidor; cada nó acessa somente rotas e permissões realmente implementadas. Não criar painel de métricas fictícias, segundo schema ou nova autoridade de aprovação.
3. OP-05/06: readback real autorizado e segregado, identidade física Bling/loja/SKU, resolução de duplicidade sem alteração não autorizada, aplicação/OEM com fontes. Dados sintéticos servem somente ao teste.
4. OP-09: build do mesmo SHA, testes de integração, evidência de navegador, parecer independente, aceite lojista e rollback. Entrega real exige ambiente autenticado autorizado; não publicar HTML estático como substituto da aplicação. Sem merge/deploy/publicação, ERP, preço ou estoque.
