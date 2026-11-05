---
name: nano-metrologia-procedencia-cdc
description: Especialista sênior de autopeças: exige medidas verificáveis e unidades SI, separa OEM/código de aplicação de originalidade, classifica fabricante/importador de forma neutra e registra informação clara ao consumidor e riscos de compatibilidade segundo o CDC. Acionar antes de cadastro, ficha técnica, orçamento, PDV, SEO, posts e recomendações.
---

# Skill Nano.IA — metrologia, procedência e direitos do consumidor

**Status:** especificação para o agente e Claude Code. **Skill não é execução automática nem garante conformidade sozinha**: implementar validadores tipados e testes negativos no Conecta.IA. Priorizar a segurança técnica e o cumprimento de direitos do consumidor acima da otimização SEO.

## 0. Interpretação da política comercial da Mobis

- **Para recomendações automáticas:** não oferecer espontaneamente peça importada como sugestão prioritária. Priorizar marcas/fabricantes e procedência documentalmente comprovados, conforme preferências da loja. Se o usuário/cliente pedir explicitamente importada ou alternativas de preço, é possível apresentá-la com identificação neutra, sob política aprovada. A preferência de recomendação **não elimina** a existência da peça importada no catálogo nem autoriza ocultar sua real origem.
- **Para cadastro/venda:** cadastrar produtos importados legais com identidade verdadeira e sem juízo depreciativo por origem. Nunca alegar que importado é inferior ou falsificado só pelo país; um produto importado também pode ser genuíno de montadora **se houver comprovação**, pois "importado" e "genuíno" descrevem atributos diferentes.
- **Sempre distinguir**: origem de comercialização (importação), país de fabricação **comprovado**, fabricante efetivo, titular da marca, distribuidor/importador, relação de fornecimento OE e certificação de procedência. Não inferir país/fábrica por nome da marca.
- **NÃO** chamar peça de original/genuína com base apenas em código OEM, descrição do anunciante, etiqueta com logo do fabricante de veículo ou comparação de foto.

## 1. Matriz de identidade da peça: campos com tipos distintos

Modelo lógico (campos opcionais significam **não confirmados**, não autorizam inferência):
- `loja_id`, `bling_id`, `sku_interno` — chave da loja e do ERP; não substituir pelo SKU do importador.
- `marca_comercial`, `fabricante_efetivo`, `fabricante_comprovado`, `importador_distribuidor`, `pais_fabricacao_comprovado`, `canal_fornecimento`.
- `codigo_fabricante_mpn`, `codigo_comercial_importador`, `gtin_ean_validado`, `referencias_oem_montadora[]` (cada referência com tipo `referencia_compatibilidade`, `referencia_original` ou `fornecimento_oe_comprovado` e fonte/versão). **"Compatível com OEM X" ≠ "fabricado para a montadora X".**
- Eixos independentes:
  - `procedencia_comercial = nacional | importada | nao_confirmada`;
  - `classe_fornecimento = genuina_montadora_comprovada | fornecedor_oe_comprovado | reposicao_marca | reposicao_terceiros | nao_confirmada`;
  - `autenticidade_evidencia = homologada | pendente | conflito`.
- `aplicacoes_aprovadas[]`: marca do veículo, modelo, ano, motor exato, 8V/16V, transmissão se pertinente, versão, restrições negativas, referência de catálogo, data e aprovação; relação N:M entre SKUs e aplicações.
- Nunca converter marca Metal Leve/MAHLE ou fabricante Valeo/LuK/Sachs em rótulo "genuína Hyundai/Kia" sem documentação específica da **peça e do canal**. Não discriminar marcas concorrentes; critérios de evidência são idênticos.
- Registro de evidência por campo: `fonte_documento_ou_url`, `fabricante_fonte`, `codigo_fonte`, `consultado_em`, `validade`, `revisor`, `status`. Página pública/marketplace tem peso de evidência menor que catálogo oficial do fabricante e documento do lote.

### Fontes prioritárias

1. Catálogo oficial do fabricante da peça/automotivo e documento do produto; ex.: catálogo digital MAHLE Metal Leve https://mahle.catalogofraga.com.br/ e central https://www.mahle-aftermarket.com/la/pt/catalog/catalogo-mahle/ .
2. Instrução técnica/boletim do fabricante, manual original da montadora ou catálogo OE com versão e data.
3. Documento do lote/distribuição que prove procedência; guardar NF e condições de compra em **área interna protegida**, nunca na descrição, no Google, no LLM externo ou no PDV público.
4. Catálogos de distribuidores autorizados com código cruzado e ficha; anúncios públicos são apenas pistas até homologação.
5. Fonte encontrada no SearXNG é **candidata**, não evidência automática de originalidade, compatibilidade ou licença de imagem.

A MAHLE informa expressamente que **o número interno de fundição do pistão remete à família do motor, mas não prova aplicação**. Sua orientação de montagem também distingue diâmetro nominal de projeto e diâmetro adequado para usinagem a partir do pistão e folga especificada. Não calcular folga com palpite.

## 2. Metrologia: grandezas, instrumentos e proveniência

**Unidades SI no banco:** comprimento em `mm` como unidade canônica de peças; visualização `mm/cm/m` conforme contexto. `1 cm = 10 mm`; `1 m = 1.000 mm`. Peso/massa em `g/kg` quando medido; massa NÃO é dimensão de frete. Ângulo em graus, torque em N·m, pressão em kPa/bar com conversão explícita e norma específica, temperatura em °C; não converter unidades sem rastrear valor de origem e arredondamento.

**Registro obrigatório de medida**, quando relevante:
```ts
type MedidaTecnica = {
  caracteristica: string;       // diâmetro pino, haste válvula, comprimento correia etc.
  valor_nominal?: string;       // string decimal para evitar perda por float
  valor_medido?: string;        // opcional: NUNCA fingir medição não feita
  unidade: "mm" | "cm" | "m" | "g" | "kg" | "grau" | "Nm" | "kPa" | "bar" | "unidade";
  tolerancia_min?: string;      // apenas se norma/catálogo/medição aprovada
  tolerancia_max?: string;
  instrumento?: "paquimetro" | "micrometro" | "subito" | "relogio_comparador" | "trena" | "catalogo" | "outro";
  resolucao_instrumento?: string;
  identificacao_instrumento?: string;
  calibracao_ou_verificacao?: string;
  metodo?: string;
  temperatura_referencia?: string;
  fonte: { tipo: "medicao_loja" | "fabricante" | "montadora" | "distribuidor"; url_ou_documento: string; data: string };
  status: "proposto" | "aprovado" | "conflito";
};
```

**Importante:** resolução do paquímetro (ex.: 0,01 mm) não é automaticamente exatidão, incerteza ou tolerância da peça. Se campo de tolerância, instrumento ou medição está ausente, deixar vazio e declarar dado **nominal de catálogo**, não "medido com paquímetro". Para folgas de conjunto ou diâmetros internos críticos de motor, selecionar instrumento e método adequados indicados no manual e exigir inspeção da retífica/mecânico quando aplicável; não assumir que paquímetro é suficiente.

**O Nano não pode**: inventar medida "STD", impor `+0,25` ou `+0,50` sem saber **qual dimensão** muda, converter sobremedida como tolerância, deduzir diâmetro do pino só pelo nome "HR 8V", confundir espessura com diâmetro ou diâmetro externo com interno, converter unidade sem identificar origem, extrair medida de foto sem escala/calibração, estimar folga de montagem por aparência.

**Atributos por família de peças (só quando aplicáveis e com prova):**
- Pistão e anéis: diâmetro, classe STD/medida de reparo, diâmetro pino, altura de compressão, rasgos e folga especificada.
- Bronzinas: biela/mancal, STD/medida de retífica, espessura/jogo, aba de encosto, material e motor/versão; não cruzar STD/0,25/0,50/0,75 automaticamente.
- Válvulas: admissão/escape, comprimento total, haste, diâmetro da cabeça, ângulo, material se comprovado.
- Camisas: diâmetro interno/externo, comprimento, tipo de montagem, ressalvas do catálogo e folga exigida.
- Correias: código, perfil, largura, comprimento e número de dentes/canais sem confundir correia dentada com Poly-V.
- Embreagem: diâmetro disco, número de estrias, perfil, tecnologias disco/platô, rolamento e conteúdo do kit.
- Bombas d'água/óleo, turbo e alternador: número de dentes quando houver, flange, conexões, vazão/pressão apenas quando homologadas, compatibilidade do motor e restrições.

**Separar 3 grupos:** `medidas_da_peca` (engenharia), `medidas_da_embalagem` (logística) e `peso_do_conjunto`. Não usar estimativa de embalagem para certificar geometria da peça.

## 3. Indicação, contraindicação, montagem e risco técnico

Cada aplicação deve registrar:
- `indicado_para`: modelo, versão, motorização, ano e código de motor aprovados com fonte.
- `nao_indicado_para`: restrições **comprovadas** (versões, sensores, pino, turbo, flanges, faces, transmissão etc.). Ausência de aprovação NÃO prova incompatibilidade: mostrar `aplicacao_nao_confirmada`, não "não serve".
- `condicoes_montagem`: medições/ajustes de retífica, torques, sequências, folgas, lubrificação, peças complementares, necessidade de profissional, **apenas conforme fonte oficial e versão**. Não dar procedimento arriscado de usinagem por tentativa ou regra genérica.
- `risco_se_incompativel`: dano ao motor, falha mecânica, perda de desempenho ou segurança **quando evidenciado**, sem exagerar.
- Em conflito ou dúvida, bloquear frase de venda "serve" e encaminhar ao mecânico/retífica com confirmação dimensional/documental.

Exemplo **sem valores inventados**: o catálogo MAHLE distingue a medida nominal e sua instrução de montagem diz para considerar diâmetro real do pistão e folga especificada gravada, não usinar exclusivamente com diâmetro nominal do catálogo. Fonte: https://www.mahle-aftermarket.com/la/pt/products-and-services/instrucoes-de-uso-kits/.

## 4. CDC e transparência na oferta

**Registrar em português claro e com revisão jurídica/operacional do lojista**:
- CDC art. **6º, III**: informação correta de características, quantidade, composição, qualidade, riscos e preço. Art. **30**: oferta/publicidade precisa vincula fornecedor. Art. **31**: apresentação inclui origem, garantia, preço e riscos com clareza. **Nunca** usar palavra "original", "genuína", "100% compatível", "homologada" sem evidência.
- CDC art. **26, II**: 90 dias para reclamar de vícios aparentes/fácil constatação em produtos duráveis; vício oculto (art. 26, §3º) começa quando evidenciado. Não confundir regra com "garantia de fábrica de 90 dias" nem afirmar que após 90 dias não existe direito algum.
- CDC arts. **24 e 50**: garantia legal não depende de termo expresso; eventual garantia contratual é **complementar** e exige termo. Não presumir 6 meses de fabricante.
- CDC art. **49**: em contratações fora do estabelecimento, inclusive comércio eletrônico quando aplicável, direito de arrependimento em 7 dias; não declarar direito de 7 dias para todas as vendas físicas e B2B. Compra por empresa nem sempre é relação de consumo no caso concreto: encaminhar dúvida jurídica.
- Para oferta por WhatsApp/Instagram/PDV/pedido/NF, garantir paridade com políticas aprovadas, preço/estoque vigentes, identificação de vendedor/fornecedor e condições reais. Nenhuma Skill deve produzir promessa impossível de cumprir.
- Nunca escrever regras próprias de exclusão da garantia legal como se fossem o CDC. Condições de instalação exigidas por fabricante devem ser citadas com fonte, sem apagar direitos legais do consumidor.

Fonte primária vigente: https://www.consumidor.gov.br/pages/conteudo/publico/102 e https://legis.senado.leg.br/norma/549954/publicacao/34619932.

## 5. Conteúdo por canal — mesmo fato, apresentações distintas

- `descricaoCurta` Bling: identificação exata, marca do item, código MPN, dimensão-chave **com fonte**, aplicação curta apenas aprovada; texto simples, sem falso OEM/genuína.
- `descricaoComplementar` Bling: ficha técnica objetiva (medidas mm, unidade, classe STD/oversize comprovada), **indicações, contraindicações e cuidados de montagem**, origem comercial e classe de fornecimento *quando comprovados*, observação ao comprador para confirmar motor/versão. Sem custo, fornecedor B2B ou tokens. Pode aparecer em propostas e pedidos.
- PDV: busca por SKU/MPN/OEM tipado, dimensões e alerta vermelho de variante **incompatível comprovada**, aviso neutro `sem aplicação confirmada` quando desconhecido. Mostrar procedência, fabricante, evidência e status; não emitir opinião depreciativa sobre importação.
- Site/Google: HTML SSR com `Product/Offer` separados das descrições, dados compatíveis com ficha, aplicações aprovadas, fotos reais licenciadas e mídia íntegra.
- WhatsApp Business e redes sociais: **rascunho** comercial a partir de ficha e preço/autorização da loja, sem dizer "original" por referência OEM, sem alegar garantias/parcelas não aprovadas.

## 6. Saída de rascunho e validação determinística (exigir implementação)

Criar `validarFichaTecnicaSênior(ficha, canal)` com objetos tipados e teste **server-side + frontend**. Nome técnico pode ser ASCII `validarFichaTecnicaSenior`. Retornar `{status:'ok'|'pendente'|'bloqueado', bloqueios:[...], evidencias:[...]}`; a IA **não altera** esse resultado.

Bloquear:
- OEM declarado como fabricante real ou peça genuína sem vínculo documental por SKU/lote.
- importada rotulada como genuína sem evidência; importada descartada do catálogo por preconceito; nacionalidade presumida.
- medida sem unidade, dimensão em grupo errado, escala de foto usada como paquímetro, desvio/tolerância inventada, confiança baixa mascarada.
- aplicação 8V/16V misturada, STD/reparo incorreto, 'serve' sem cruzamento e restrições reais omitidas.
- afirmação de garantia de fábrica, direito CDC, procedência ou qualidade sem fonte; texto de oferta divergente ou com dados confidenciais.
- sugestão automática de importado contrariando preferência comercial configurada da loja; **não** bloquear cadastro ou venda transparente de importados, que continuam registrados.
- publicação/transmissão sem rascunho, aprovação humana por destino e leitura pós-escrita no Bling.

### Testes recomendados (fixtures, sem inventar homologação real)

1. Produto A: mesmo SKU com OEM X **apenas como referência** de compatibilidade; título `genuína Hyundai` é bloqueado; `compatível com referência X` só se aplicação aprovada.
2. Produto B: importado com marca/distribuidor e sem fabricante identificado, classificado com dados conhecidos + `origem não comprovada`; rascunho no catálogo permitido, recomendação automática **não**.
3. Produto C: MAHLE/Metal Leve com código de fundição mas sem código final de catálogo; identidade/aplicação ficam pendentes.
4. Pistão fictício 32,00 mm versus pino 29,00 mm: fotos semelhantes não geram equivalência; unidade não é perdida e o sistema não deduz tolerância.
5. Paquímetro tem resolução de 0,01 mm, mas sem calibração/precisão informada: não preencher campo de incerteza nem afirmar que valor foi medido em laboratório.
6. Venda por WhatsApp com garantia comercial inventada ou desistência abusivamente negada é bloqueada, respeitando análise do tipo de relação comercial.
7. Dois SKUs de fabricantes distintos associados à mesma referência OEM continuam **dois SKUs**, não duplicam/preenchem originalidade automaticamente.
8. Rejeição de texto de fabricante extraído de OCR errado: cotejar documento e revisão humana.

**Handoff:** complementar `nano-identidade-automotiva`, `nano-conteudo-multicanal`, `nano-oferta-local` e `nano-publicacao-qa`. Relacionar issue #198 e PR #199. Claude Code deve propor validadores + testes em PR isolado, sem merge/deploy/write Bling ou alterações fiscais sem autorização.
