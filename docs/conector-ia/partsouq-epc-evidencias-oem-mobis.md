# MOBIS / Conecta.IA / Nano — PartSouq EPC como fonte de evidências OEM

**Data da auditoria:** 16/11/2026. **Estado:** piloto não publicável, sem merge/deploy, sem autorização para escrita no Bling.

## 1. Origem e grau de prova
PartSouq: https://partsouq.com/catalogs/ — permite busca por número de peça, VIN/frame, montadora, modelo, mercado e diagramas EPC. É **plataforma terceirizada**, não autoridade legal da montadora nem fabricante da peça MOBIS. Termos: https://partsouq.com/en/terms-2.html (substituições e adequação são orientativas).

**Escada de evidências, sem inferir equivalência:**
1. Identificação de **código OEM** em catálogo EPC por modelo/região/diagrama;
2. Compatibilidade **OEM→veículo/chassi/ano/motor** mediante registro do catálogo e da configuração exata;
3. Referência **OEM→peça de fabricante aftermarket** comprovada em fonte independente da marca (MAHLE, Tecfil, MANN etc.), incluindo medidas e restrições;
4. Identidade da mercadoria real no Bling: **bling_id → sku (se houver) → GTIN/embalagem/NF/brand**;
5. Revisão humana + segunda fonte + documentação antes de marcar equivalência e página indexável.

**Proibição:** encontrar um OEM no PartSouq **não altera** `produto_aplicacoes.codigo_oem`, `produto_codigos`, preço, estoque, NF, SKU, marca nem marca genuína na vitrine.

## 2. Implementação real no projeto
Migrations:
- `20261116074000_mobis_fontes_epc_evidencia_oem.sql`: tabela `catalogo_evidencias_oem`, RLS habilitado, sem acesso direto para `anon`/ `authenticated`; bloqueios de homologação sem revisão, evidência independente, identificação do mercado e prova física específica.
- `20261116075000_mobis_privacidade_vin_epc.sql`: reforço para rejeitar URL/observações que tenham VIN ou chassi explicitamente identificável.
- `mobis_registrar_oem_partsouq`: RPC somente para administrador autenticado da loja, registra sempre **candidato**. Sem coleta de dados/diagramas do PartSouq.
- `mobis_evidencias_oem_admin`: consulta administrativa protegida de até 200 registros.
- `AuditoriaNanoMobis.tsx`: formulário para selecionar produto pelo ID do Bling/SKU, informar OEM, URL da consulta, diagrama, mercado e ressalvas; mostra evidências em revisão e links à fonte.
- `agente_prompts`: `nano_catalogo_mobis` v3 **proposto, não ativo**, com regras PartSouq, VIN, fontes independentes e bloqueio de equivalência inferida.

**Licença:** `fontes` contém registro PartSouq com `licenciada=false`; não houve permissão comprovada para extração em massa ou reprodução de figuras. Apenas referência/URL de pesquisa administrativa.

## 3. Piloto de filtro OC1224
Produto físico no Bling: `id=16275882008`, nome `OC1224 FILTRO OLEO BLINDADO`; `sku` vazio, marca vazia, GTIN 7894766669907, NCM 8421.23.00. Nenhuma foto ou medida real preenchida no Bling, saldo preservado.

### Evidência A — Fabricante aftermarket
**MAHLE Filter Catalog, edição impressa 2019/2020, página 114** (índice PDF 115), apesar de URL conter nome `...2017-web.pdf`:
https://www.mahle-aftermarket.com/media/local-media-latin-america/catalogs/brasil/pdf-catalogos/mahle-catalogo-de-filtros-2017-web.pdf

Registra filtros de óleo `OC1224` para:
- Hyundai HR 2.5L 8V TDI, 2006–2012;
- Hyundai HR 2.5L 16V Euro 5, 2014 em diante **sem ano final declarado**.

**Duas aplicações de revisão** criadas na Conecta.IA, com `status=a_confirmar`, `codigo_oem=null`, `pagina_indexavel=false`, produto não publicado. Não associar sem verificar versão/embalagem e documentar o OEM.

### Evidência B — EPC original, PartSouq
- https://partsouq.com/en/search/all?q=2630042040
- https://partsouq.com/en/catalog/genuine/parts?c=HYUNDAI&gid=127 (consulta ao grupo ENGINE / FRONT CASE & OIL FILTER; filtros disponíveis variam conforme o diagrama/mercado).
- Registro `catalogo_evidencias_oem.id=4738895d-beaa-401e-9b49-eaf6aeb3e47a`: `codigo_oem=2630042040`, `situacao_evidencia=candidato`, `relacao_sku=verificacao_pendente`, `aplicacao_id=null`.

**Ressalva crítica:** revendedores brasileiros listam OC1224 como substituto de 2630042040, porém o catálogo oficial MAHLE de intercâmbio para América do Norte FI-20-26 lista `2630042040 → OC 540`. Não inferir que OC1224 e OC 540 sejam iguais ou diferentes sem confirmar revisões, construção e especificações da marca. Uma correlação entre códigos OEM no EPC não prova intercambialidade com o SKU OC1224.

https://www.mahle-aftermarket.com/media/local-media-north-america/catalogs-and-lit-pictures/fi-20-26_web.pdf

## 4. Regras para o Nano
- Se o OEM existe no EPC mas **não** no catálogo do fabricante da peça: registrar candidato e mostrar conflito.
- Se OEM tem variações e substituições: registrar cada código e mercado, sem fundir versões.
- Se VIN foi consultado: usar apenas na pesquisa, nunca conservar o VIN completo, imagem do documento, dados de cliente ou token VIN em links.
- Se título comercial ou marketplace disser "original": não substituir documentação da marca verdadeira nem a nota fiscal.
- Se OEM/ano/motor não foi confirmado: manter `a_confirmar`, `noindex` e proibir publicação automática.
- O PDF de orçamento do Bling usa **fotos reais aprovadas do produto**, não desenhos EPC protegidos de terceiros.

## 5. Validação e bloqueios pendentes
- Confirmar marca MAHLE na embalagem real / nota fiscal do OC1224;
- Confirmar revisão atual de catálogo MAHLE e correspondências OEM;
- Confirmar medição, rosca, válvulas e junta contra o produto recebido;
- Verificar cada aplicação/versão com o código original do veículo e documentos atuais;
- Testar registro via formulário com sessão real de administrador e compilação do PR;
- Não automatizar acesso comercial ao PartSouq sem API/licença expressamente autorizada.

**Concluído:** fonte técnica registrada, esquema aplicado, candidato OEM documentado, aplicações de revisão criadas, permissão restrita ao administrador. **Não concluído:** equivalência, venda, publicação, aprovação humana e integração com a API de PartSouq.
