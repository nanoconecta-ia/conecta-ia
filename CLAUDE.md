# Conecta.IA — instruções para sessões do Claude Code

Site inteligente que conecta ERPs (piloto: Bling) a uma loja online, de forma autônoma.
Este arquivo é lido em toda sessão. Se algo aqui conflitar com um pedido no chat, pergunte.

## CRONOLOGIA DE FÁBRICA, SKUs E PEÇAS AVULSAS — contrato do porteiro
Ler ANTES de propor aplicação, troca, homologação de fabricante ou referência cruzada: [cronologia por geração, janela de fabricação/ano-modelo/VIN, conjunto importado e composição avulsa](docs/conector-ia/porteiro-cronologia-geracoes-sku-composicao-20261121.md). Um SKU pode atender múltiplas gerações **apenas com prova para cada combinação de veículo/versão/período**; fases coexistentes no mesmo ano não herdam aplicação. Cruzar outro SKU importado com o CI003696 exige identidade de **nível do conjunto** e confronto documental direto da composição/medidas, além das aplicações correspondentes. Cabeçotes, comandos, válvulas e peças avulsas com SKU e NF próprios são **produtos separados**: vínculo `componente` não significa equivalência ao motor parcial nem baixa de estoque. Classificar OEM genuíno/OES e aftermarket por documento e período. Enquanto CI003696 estiver pausado, pesquisar/relatar em somente leitura. Não produzir códigos OEM, anos de início/fim, fornecimento homologado ou equivalência presumidos. Protocolo documentado em PR; controle ainda não implantado ponta a ponta.

## EPC OEM dos componentes de conjunto importado
Antes de enriquecer motores parciais, cabeçotes montados e kits, seguir [protocolo EPC de componentes, vínculo com a composição SKU e não-transitividade de OEM](docs/conector-ia/porteiro-epc-oem-por-componente-20261121.md). Não inferir o conteúdo de um motor importado a partir de um EPC de veículo; registrar fonte, versão, diagrama, código e status por peça. A referência OEM de um componente jamais vira OEM do conjunto. Validador puro está em revisão; não afirmar implantação do gate até passar por gateway/SQL, homologação e autorização.

## CONTRATO UNIVERSAL — porteiro de produto com múltiplas aplicações
Obrigatório ler [contrato de entrada, identidade física e N aplicações independentes](docs/conector-ia/porteiro-contrato-universal-multiaplicacao-20261121.md) **antes de pesquisar qualquer SKU**. Usar `loja_id + bling_id` como identidade; SKU exato pode ter histórico excluído. Validar a composição física e o motor/Euro/ano de cada versão, não inferir por aparência; OEM separado por montadora e estado `a_confirmar`; uma peça física, várias páginas sem clone de estoque. Documento e testes para revisão, ainda sem implantação do portão adicional.

## REGRA MESTRE: ERP Bling como fonte e páginas independentes com OEM e SEO
Ler [regra de 1 produto físico/N páginas por veículo e OEM por montadora](docs/conector-ia/porteiro-master-ofertas-por-aplicacao-oem-seo-bling-20261119.md). Cada cadastro editorial por aplicação contém título e descrição únicos, tags de busca legítimas, OEM EPC validado por montadora ou pendente, ano/versão/motor/ECU/injeção comprovados, referências cruzadas, SEO e banner independente, ligados ao mesmo SKU e NF do Bling. Atribuir `oem_compartilhado` só se o mesmo conjunto OEM for comprovado. Códigos de juntas/filtros não se tornam código OEM de motor parcial. Aplicações pendentes ficam privadas/noindex; não duplicar estoque ou escrever no ERP sem aprovação de campo.

## REGRA MESTRE — catálogo enriquecido informativo
Obrigatório ler [norma para exibir ficha pública sem foto e SEM preço](docs/conector-ia/regra-mestra-catalogo-enriquecido-sem-preco-sem-foto-20261119.md). Distinguir `catalogo_informativo` e `oferta_comercial`. O preço do Bling não é preço autorizado para mostrar em catálogo informativo; retornar `preco_publico=null`, `estoque_publico=null` e nenhum `offers`/checkout. O lojista informa ou aprova a exposição de preço e imagem posteriormente. A imagem é opcional, mas compatibilidade incerta nunca pode ser anunciada. O CI003696 possui `exibicao_teste=true` e uma prévia sem preço, não publicação comercial; automação pausada impede gravação por agente.

## Contrato de entrega de cadastro (qualquer agente e qualquer SKU)
Seguir **[porteiro: entrada por SKU ou descrição → pesquisa curta → ficha → aplicações → imagem Firecrawl → entrega verificada](docs/conector-ia/porteiro-entrega-cadastro-por-sku-ou-descricao-20261119.md)**. Registrar separadamente `proposta_preparada`, `rascunho_real_gravado` e `publicado_e_verificado`: só declarar os dois últimos após leitura no banco/URL. Foto ausente não bloqueia ficha; `produto_automacao.pausado` impede gravações. Não dissecar toda a história das montadoras, usar jogo de juntas Ajusa/SABÓ/Taranto/Vedamec, filtros e código do motor. Meta global 15s ainda não comprovada em executor.

## Ferramenta de imagens Firecrawl antes de pesquisa manual
Ler [roteiro do buscador Conecta.IA/Firecrawl e disponibilidade no chat ou MCP](docs/conector-ia/porteiro-ferramentas-firecrawl-imagens-20261119.md). Priorizar `conecta.imagem.buscar_web` e alias `buscar_imagem_web` quando expostos, com consulta SKU+marca+composição; propor via `conecta.imagem.propor` apenas candidatura segura. API Firecrawl da loja não é chave do agente. **No MCP de terceiros a busca não está exposta nem recebe configuração do provedor**; reconhecer limitação e manter pendência. O prazo global de 15s ainda não está implementado no adaptador.

## Catálogo MOBIS sem foto — todos os veículos e produtos
Ler [regra de pesquisa de imagens, foto opcional e conclusão posterior pelo lojista](docs/conector-ia/mobis-cadastro-sem-foto-todos-skus-20261119.md). O agente não deve suspender a pesquisa/cadastro em lote por falta de imagem; marcar `foto_pendente` e usar placeholder. Exceção de foto opcional no banco é exclusiva à loja MOBIS, não se aplica a outros tenants. Publicação exige outros campos e aprovação humana; sem evidência de aplicação/OEM, não anunciar compatibilidade. `produto_automacao.pausado` continua bloqueando propostas/escritas.

## Entrada por descrição, sem SKU (roteiro comum a qualquer agente)
Ler [genealogia de veículos brasileiros: descrição → pai/filho/primos → motor/cilindros → documento e anos locais → SKU](docs/conector-ia/roteiro-descricao-genealogia-veicular-br-20261119.md). Consultas `motor para HR 2013` e `motor Gol 2003` são válidas sem SKU; não adivinhar ano final ou transferir OEM entre «primos». Aplicar a mesma trava do porteiro/Policy Engine.

## Como pesquisar peças MOBIS (atalho obrigatório)
Antes de pesquisar ou propor SKU/OEM/GTIN/NCM, ler:
- [Norma do porteiro e cadastro em lotes](docs/conector-ia/mobis-porteiro-cadastro-em-lotes-20261119.md)
- [Mapa de fontes rápidas (GS1 Brasil, PartSouq/EPC, CAOA/Hyundai, Kia KMB/Grupo Gandini, fabricantes OE, importadores/B2B e marketplaces)](docs/conector-ia/fontes-pesquisa-rapida-sku-ncm-gs1-20261119.md)

O serviço deve ter **deadline global de 15s por SKU**, não 15s por fonte; consultar primeiro Bling e cache. Sem GTIN, **não inventar EAN**; NCM é pista de classificação e nunca identifica equivalência. O gateway/servidor, não este prompt, deve impor as restrições; a regra e o timeout ainda não estão implantados em produção. Sem alterar SKU, NCM, nota, estoque ou homologar códigos automaticamente.

## Isolamento (regra 0)
- Projeto **isolado** dos demais projetos e repositórios.
- Nunca escreva em outros repositórios nem use o projeto Supabase **NanoShell IA**: ele é de outro produto e não pode ser tocado, pausado ou alterado.
- Supabase deste projeto: `conecta-ia`, ref `dsfzhsrudriqkumtlqwj` (sa-east-1, plano gratuito). Confirme que o ref bate antes de qualquer operação. O ref `ptilvkzuhjnqnfydjcly` (NanoShell IA) NUNCA deve ser usado aqui.

## Modelo
1. O ERP (Bling) é a **fonte** de cadastro, preço e estoque. Ninguém cadastra o mesmo produto duas vezes.
2. **Fluxo principal: o Conecta.IA se conecta direto ao Bling de cada cliente** (credencial por cliente) e mantém um **espelho somente leitura** do catálogo, como um PDV. Se qualquer dado muda no cadastro do Bling, muda no site: atualização por **webhook em tempo real** (se confirmado na documentação) mais **varredura periódica de segurança**. **Ninguém edita produto no site.**
3. **Enriquecimento com dois caminhos, para o cliente nunca ficar na mão:**
   - **Agente integrado do site:** roda dentro do Conecta.IA.
   - **(PAUSADO em 13/11/2026 — projeto parado, fora do fluxo; usar só `integrado`; ver docs/ordem-mestra/15)** **Agente NanoShell:** roda no navegador e trabalha por **fila de tarefas** (ele busca a tarefa e devolve o resultado; o navegador não recebe chamadas de fora).
   - Cada loja escolhe o preferido: `integrado`, `nanoshell` ou `automático` (prefere o NanoShell e, se ele não responder a tempo, **cai para o integrado**).
   - Os dois escrevem na **mesma camada de enriquecimento**, separada do dado do Bling. O enriquecimento é acionado automaticamente quando o cadastro é insuficiente, ou sob demanda.
4. O Conecta.IA é a frente de venda (como um PDV do site). O ERP é a retaguarda.
5. O lojista edita só o que é do site: banners, páginas, SEO, tema e regras de venda. O cadastro do produto vem do ERP.
6. **Enriquecimento nunca inventa.** Cada dado enriquecido guarda fonte, data e nível de confiança, separado do dado original do ERP. Sem evidência, fica "a confirmar" ou vazio. Nunca inventar preço, estoque, GTIN, NCM, compatibilidade ou especificação.
7. **Escrita de volta no Bling: padrão é NÃO escrever.** O que o enriquecimento melhora fica na camada do Conecta.IA. Gravar no Bling só com autorização explícita do cliente, por campo (decisão em aberto).
   Decisão do dono (2026-10-17): o app do Bling pode ter escopos de cadastro (produtos, clientes/contatos, lojas virtuais, marketplace); nota fiscal só consulta (emitir/enviar proibido). Escopo no app NÃO liga a escrita: cada ferramenta de escrita fica desligada até teste com mock, passar pelo Policy Engine (MEDIUM+ exige aprovação humana e `idempotency_key`) e registro em auditoria (`supabase/functions/_shared/bling_ferramentas.ts`).
8. Produto incompleto não é publicado.
9. **Cada cliente tem o próprio domínio** (o piloto usa `www.mobisautopecas.com.br`, domínio oficial da Mobis confirmado pelo dono em 18/11/2026). A loja é resolvida pelo domínio, no servidor. Um domínio só entra em produção depois de verificar DNS e SSL. **Nunca alterar DNS, domínio ou hospedagem de um cliente sem autorização explícita**, e sempre com plano de volta (o site atual continua no ar até o novo ser validado).

## Controle de venda (dois níveis)
- **Super admin** (pessoa com login próprio e verificação em duas etapas) bloqueia vendas por **UF**, em qualquer loja.
- **Lojista**, dentro do que o super admin permite: limita campanha por UF, vende só para pessoa física ou só jurídica, ou opera só como catálogo.
- Permissão efetiva = o que o super admin permite **∩** o que o lojista escolheu. O lojista nunca libera o que foi bloqueado.
- UF vem do **CEP de entrega** no checkout (não do IP). Pessoa física/jurídica vem do CPF/CNPJ do checkout. Tudo validado **no servidor**.
- Cliente de UF bloqueada ainda vê o catálogo e vai para o WhatsApp, exceto em loja só catálogo.
- Toda mudança de regra gera registro de auditoria.

## Checkout
- Modo de venda por loja: `checkout`, `whatsapp` ou `hibrido` (no híbrido, escolha por produto).
- Modo WhatsApp não simula checkout. Link de WhatsApp com nome, referência, código interno e URL.
- Antes de cobrar, revalidar preço e estoque **consultando o Bling na hora**. Se o Bling não responder e o último dado sincronizado for mais velho que a idade máxima (padrão sugerido: 15 min), bloquear a compra e levar ao WhatsApp. Preço mudou: avisar o cliente com o valor atual.
- Se o Bling ficar fora do ar, o site continua mostrando o último catálogo válido.

## Segurança
- Nenhum segredo (super admin, chaves de loja, tokens, service role do Supabase) no frontend, no repositório ou em log.
- Isolamento total entre lojas no servidor e no banco (RLS quando suportado).
- Não fazer deploy, migração destrutiva nem mudança de DNS/domínio sem autorização explícita.
- Super admin e serviços usam credenciais **separadas**: login com MFA para pessoas; o agente NanoShell usa chave por loja que só alcança as rotas da fila de tarefas (nunca a mesma de pessoa).
- **Credenciais do Bling por cliente**: guardadas cifradas, só no servidor, isoladas por loja, nunca em log nem no navegador. O JWT do Bling tem ~1.500 a 3.000 caracteres: não truncar. Header `enable-jwt: 1` na obtenção, na renovação e em todas as requisições.

## Como trabalhar aqui
- Antes de escolher stack, banco ou estrutura: **leia o site pronto** neste repositório e mostre o que encontrou. Reaproveite o que existe.
- Antes de criar tabelas ou migrações: mostre o desenho e espere aprovação.
- Comece pelo **piloto de leitura de 20 a 50 produtos** (Marco 1 em `docs/ARQUITETURA.md`): só leitura do Bling, modo WhatsApp, sem escrever no ERP.
- Entregue por etapas, com testes e evidências. Não declare concluído só porque compila.
- Informe sempre: arquivos alterados, decisões, testes rodados, limitações reais.

## Cuidados com o enriquecimento
- Regras fiscais (NCM, CEST, CST, CFOP) e logísticas aplicadas pelo enriquecimento devem ser validadas pelo contador do cliente antes de entrar em produção. Não fixar uma regra única para todos os produtos nem para todos os clientes.
- Compatibilidade de peça só com relação técnica, fonte e data registradas.
- Custo de IA é por cliente: medir e limitar o uso do enriquecimento de cada loja.

Detalhes e decisões em aberto: `docs/ARQUITETURA.md`.
