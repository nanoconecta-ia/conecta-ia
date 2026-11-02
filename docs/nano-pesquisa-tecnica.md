# Nano IA — pesquisa técnica automotiva (implementação)

Implementa, sobre o que já existe, a especificação "Inteligência de pesquisa automotiva, fabricantes, imagens e validação de aplicações" (02/11/2026). **Sem deploy.** Escrita no Bling, estoque e fiscal continuam desligados. Princípio: a IA formula hipóteses e conduz a investigação; **código, compatibilidade, fabricante e fotografia só valem com evidência**.

## O que foi implementado (módulos puros em `supabase/functions/_shared/busca_segura/`)
| Seção da especificação | Módulo | Resumo |
|---|---|---|
| 2. Base de fabricantes | `fabricantes.ts` | 10 categorias e ~75 marcas da lista inicial, **todas "não verificado"**, sem domínio, catálogo ou grupo escrito de memória. Um domínio só vira fonte oficial depois que uma pessoa o cadastra e verifica. |
| 3. Pesquisa autônoma | `plano_pesquisa.ts`, `investigacao.ts` | Seis etapas de consulta (código/SKU, OEM, GTIN, descrição+motor+veículo, catálogos alternativos, imagens) + reformulação por sinônimos (dado fornecido). **Orçamento** (total e por etapa), deduplicação, **cache**, **timeout por consulta** e **falha fechada** (429 interrompe; 5xx isolado segue; resposta inesperada não vira dado). Custo, fornecedor, fiscal e dados pessoais nunca entram na consulta. |
| 4. Raciocínio de aplicação | `entidades.ts`, `intercambio.ts`, `piques.ts` (já no #242) | Ano ≠ motor; D4BH/D4CB/4D56 só como termos candidatos; OEM igual com medidas diferentes é rejeitado; piques só com tabela técnica. |
| 5. Hierarquia de evidência | `evidencia.ts` | 5 níveis: fabricante oficial, montadora oficial, distribuidor autorizado, referência cruzada, marketplace. Só os 3 primeiros (de domínio verificado) provam; os demais são pista. **Sem porcentagem de confiança**: o campo é opcional e nunca decide. Conflito/ausência = **APLICAÇÃO NÃO CONFIRMADA**. |
| 6. Galeria de imagens | `galeria.ts`, `painel/.../GaleriaProduto.tsx` (já no #242) | Até 8, com origem, resolução, licença e estado; nada aprovado nem publicável sem decisão do lojista; marca d'água não é removida. |
| 7. Modelo de dados | `RelatorioPesquisa` (TS) | O relatório carrega SKU, códigos com procedência, fontes, evidências, galeria, pendências e status de compatibilidade. **Não há tabela nova**: persistir o histórico de evidências exige desenho de migração (pendência). |
| 8. Segurança | `autorizacao.test.ts` | A ferramenta é só leitura e não vai ao MCP externo; os módulos novos são puros (sem rede, banco ou Bling). |

**Ferramenta no chat:** `engenharia.pesquisa.investigar` (leitura; entrada `sku`, opcional `motor`, `veiculo`, `ano`). Usa o provedor de busca que já existe (`ia/provedor_busca.ts`). Sem provedor configurado devolve `nao_testada`, sem inventar.

## Seção 9: teste real obrigatório (CI000016)
Relatório: **`docs/evidencias/pesquisa-CI000016-2026-11-02.md`**. Foi executado por **Claude Code**, nesta sessão, com ferramentas de busca na web e leitura do Bling (somente leitura): **6 consultas e 1 página lida**, com o cadastro do Bling, as fontes achadas, 8 imagens candidatas e a separação confirmado / inferido / não encontrado / não testado.

Principais achados:
- O código **CI000016 aparece escrito** na página do distribuidor da marca, em varejistas e em anúncios, para bomba d'água HR/K2500 8V.
- A página do distribuidor chama CI000016 de **"Código Interno"**: é código do distribuidor, **não** código de fabricante nem OEM. O SKU do Bling coincide com ele.
- A aplicação "HR/K2500 2.5 8V Euro III, até 2012" é **declaração do próprio distribuidor**: **APLICAÇÃO NÃO CONFIRMADA** por catálogo de fabricante ou de montadora.
- **Não encontrado:** fabricante efetivo da TRIM GO, OEM confirmado, GTIN, dimensões, foto com licença.
- Indícios de que 8V e 16V são peças diferentes (OEMs distintos em lojas) e de que fabricantes independentes usam códigos diferentes para gerações diferentes do 4D56.
- Há **2 registros excluídos/inativos do mesmo SKU** no Bling: investigar duplicidade antes de recadastrar.

**Esta demonstração NÃO foi feita pelo Nano em produção.** O Nano ainda não tem provedor de busca configurado, então hoje ele responderia `nao_testada`. Os testes automatizados usam como fixtures os resultados reais dessa investigação.

## Critério de conclusão (seção 10): estado honesto
**Ainda NÃO está "funcional" pelo critério da especificação**, porque o Nano ainda não executa pesquisa real em produção. Falta:
1. **Provedor de busca** (SearXNG em servidor próprio com JSON habilitado; o Google Custom Search está fechado a novos clientes) configurado no servidor.
2. **Cadastro e verificação de domínios** de fabricantes, montadoras e distribuidores autorizados (hoje nenhuma fonte sai "forte").
3. **Crawl4AI** (extração de páginas públicas permitidas): não implementado; hoje só se usa o resumo que o provedor devolve.
4. **Histórico de evidências no banco** (tabela e desenho de migração a aprovar).
5. **Extração automática de códigos cruzados/OEM** das páginas e detecção de **conflito entre fontes** (hoje só se registra o que aparece escrito).
6. **Publicação** do `assistente` e do painel, depois de homologar.
