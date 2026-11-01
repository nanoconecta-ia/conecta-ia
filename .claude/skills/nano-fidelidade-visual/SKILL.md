---
name: nano-fidelidade-visual
description: Protege a fidelidade visual e técnica das autopeças nos rascunhos do Nano.IA. Usar ao pesquisar, selecionar, editar, enquadrar, exportar ou propor imagens e banners por SKU, OEM e aplicação; impede alterações da geometria da peça, invenção de características e publicação sem aprovação.
---

# Nano.IA — Skill de fidelidade visual e técnica (rascunhos)

> **Modo padrão: SOMENTE RASCUNHO.** Esta Skill orienta o agente; **não substitui** verificações determinísticas no editor, políticas de autorização, direitos de uso nem testes de imagem. Claude Code deverá implementar as travas indicadas antes de liberar a função em produção.

## 1. Objetivo e precedência

Preservar a identidade física e técnica da peça em fotos, banners e vídeos de catálogo, mesmo quando o usuário pede "melhorar", "adaptar", "deixar bonito" ou "fazer banner". A peça real permanece intacta. Separar **composição visual do banner** da **fotografia de referência do produto**. Uma imagem gerada de uma peça não é foto da peça, não pode substituir foto técnica principal nem provar aplicação.

Se faltar prova de identidade, autorização da imagem, autorização do preço/condição ou metadados confiáveis, **não completar por suposição**. Mostrar pendência no rascunho; bloquear uso público.

A Skill aplica-se ao chat Nano, Estúdio, edição Konva, conectores de busca web, Google Drive da loja, HD local e geração de variantes. Reutilizar `conecta.imagem.propor`, `painel/src/lib/fidelidade.ts`, `supabase/functions/_shared/imagens/regras.ts` e o fluxo de aprovação do Conecta.IA. Não criar um segundo agente/chat.

## 2. Invariantes rígidos: peça e original

1. **Imutabilidade:** preservar os bytes do arquivo original em armazenamento privado; calcular SHA-256 antes da operação e registrar original/versão. Nenhuma operação destrutiva sobrescreve o original.
2. **Geometria:** é proibido IA/inpainting/outpainting/reconstrução, redesenho, alterar número de dentes/furos/vias, encaixes, roscas, flange, diâmetros, proporções, textura/inscrição técnica, fabricante gravado, etiqueta, embalagem apresentada como outra ou detalhes funcionais. **Nunca criar componentes invisíveis**.
3. **Transformação 2D:** a foto da peça pode ser **transladada** e redimensionada somente com escala uniforme (`scaleX === scaleY > 0`, dentro de tolerância de arredondamento). Proibido esticar nos eixos, deformar, skew, warp, perspectiva ou espelhar. Se houver necessidade de rotação da foto, exigir que não sugira geometria ou aplicação diferente e registrar no rascunho; padrão é sem rotação. Proibir crop que retire qualquer parte da peça, borda funcional, inscrição ou etiqueta técnica; adaptar **o fundo do banner**, não a peça. Quando a peça não couber inteira, usar `contain` e margens.
4. **Aprimoramento:** permitido somente no **derivado de apresentação**, com ajustes globais e não destrutivos de exposição, contraste, balanço de branco e cor em limites conservadores; não alterar aspecto de materiais, marcas e inscrições. Remoção de fundo/correção local com IA **bloqueada por padrão**, requer implementação própria, validação de máscara/contorno, inspeção humana e cópia preservada — não habilitar por texto de prompt.
5. **Texto e camadas:** título, preço, selo, logotipo e CTA ficam em camadas independentes **fora da região visível da peça**. Não colocar arte sobre furos, conectores, marcações ou linhas do contorno. Se não houver espaço, reduzir/reorganizar o texto e **não** cortar a peça.
6. **Foco e câmera:** não trocar ângulo, perspectiva, modelo ou foto-fonte sem seleção explícita; preservar região do objeto e nitidez legível. Caso o objeto já esteja fora de foco no original, não inventar nitidez ou novos caracteres; sinalizar `imagem_insuficiente`.

## 3. Invariantes técnicos de autopeças

- Origem canônica: SKU da **loja** + identificador Bling lido, classificação, código **OEM da montadora**, código **do fabricante**, importador, GTIN/EAN, motor/aplicação/ano e evidência são campos distintos. Nunca tratar fabricante, montadora ou similar como OEM intercambiáveis.
- Foto semelhante NÃO prova compatibilidade. Confirmar código escrito no produto/embalagem e fonte fabricante/catálogo com URL/documento + data; sem cruzamento válido, classificar **candidata ilustrativa/não verificada**, nunca produto homologado.
- Sem confirmação, **não gerar/inserir**: número de dentes, medidas em mm, STD/0,25/0,50, potência/cv, motor, anos, aplicação veicular, OEM, GTIN, tecnologia, origem, marca, prazo, garantia, preço, estoque ou desconto. Campo ausente = `nao_confirmado`; pedir prova, não preencher.
- Exemplos de risco: motor D4BH/4D56 compartilha família, mas **não** garante que toda peça seja intercambiável; variantes 8V/16V, biela/pino, sensor e bronzinas precisam da referência exata.
- Texto no banner vem de **dados aprovados da loja**; para preço, condição e garantia, verificar confirmação expressa e atualização do ERP conforme política. Sem isso, preferir banner sem preço. Não expor custo, fornecedor B2B privado, NCM, documentos fiscais ou credenciais em serviços públicos de busca.

## 4. Direitos, proveniência e isolamento

- Cada imagem precisa de `origem`, `pagina_fonte` quando externa, `titular`/tipo de licença e **evidência de uso**; resultado SearXNG/Google apenas localiza candidata, não concede direitos. Não remover marcas d'água, logotipos de terceiros nem atribuir licença inexistente.
- Google Drive é **por cliente/loja com OAuth autorizado**; HD local da loja é cópia/cache, não garantia de disponibilidade remota; nenhuma foto sem permissão vai para CDN, Bling, Meta ou site.
- Nunca compartilhar ativos entre lojas sem autorização e cadeia de licença. Sem correspondência entre mídia e loja/SKU, bloquear proposta de uso público.

## 5. Fluxo obrigatório do Nano antes de criar banner

1. **Ler** produto pelo SKU/loja e taxonomia real; coletar somente fontes existentes, classificar fatos `confirmado / pendente / conflitante`.
2. **Pesquisar** na biblioteca local/Drive daquela loja; depois busca pública SearXNG configurada, sem dados comerciais sigilosos. Retornar candidatas com fonte e status, sem afirmar que foto é correta.
3. **Selecionar e verificar** uma foto original e a identidade da peça, cruzando fabricante/OEM com evidências; o usuário escolhe/autoriza a fonte. Se dúvida, nenhuma imagem é "aprovada".
4. **Montar rascunho**: fotografia real preservada em camada `produto` **bloqueada** contra transformações proibidas, com render usando `contain`; fundo/texto/logo/CTA em outras camadas. O agente sugere layout, NÃO substitui pixels da peça.
5. **Validar rascunho** por código (item 6). Se bloqueado, retornar lista de riscos e opções sem alteração técnica; não tentar corrigir peça com geração de imagem.
6. **Prévia antes/depois** no mesmo zoom: original ao lado da peça no banner. Exibir diferença de proporção e alertas de crop; exigir três checagens humanas já existentes: furos/bordas/proporções; conectores/encaixes; inscrições/marcas/gravações.
7. **Salvar estado editável** e manifesto de fontes/transformações com status `rascunho` ou `aguardando_revisao`, jamais `publicado`; não executar escrita no Bling/site/Meta/Drive sem autorização específica. Aprovação de identidade e direito de uso são **duas decisões distintas**.
8. **Após aprovação específica e executor autorizado**, exportar variantes validadas por destino; foto principal técnica nunca substituída por banner, e nenhum arquivo original sobrescrito.

## 6. Validador obrigatório a implementar (não confiar só no prompt)

Claude Code deve criar `validarFidelidadeVisual(documento, ativo, produto, autorizacoes)` como função pura e testável **chamada pelo editor e pelo backend ao salvar/autorizar/exportar**.

Bloquear, no mínimo:
- ativo não é da mesma `loja_id` / ausência de `asset_id` e SHA do original;
- falta de evidência de identidade / cruzamento código fabricante/OEM quando se declara foto real da peça;
- falta de licença ou direito confirmado no fluxo de publicar;
- uso público de foto sintética como foto real/principal;
- imagem da peça com escala não uniforme, escala `<= 0`, `flipX`/`flipY`, `skewX`/`skewY`, perspectiva, máscara/inpainting ou crop não autorizado;
- objeto/foto ocupa região fora da área segura ou é encoberto por texto/CTA;
- conteúdo técnico não confirmado na lista de fatos, dados que não pertencem ao SKU, preço ou garantia inventados;
- tentativa de usar a ferramenta de proposta do agente como autorização para publicar ou salvar no Bling;
- URLs públicas de Drive como destino de Bling; links de terceiros como URL definitiva de catálogo;
- discrepância entre versão/hash aprovado e versão/export que se quer publicar.

**Importante:** checagens de escala, crop, camadas e SHA são necessárias, mas **não detectam sozinhas alterações de pixels, alucinação visual ou compatibilidade**. Proibir por contrato chamadas a modelos de edição generativa para o produto; comparar original/derivado com sobreposição em viewport e revisão humana. Um relatório automático "passou" **não é prova** de fidelidade geométrica pixel a pixel.

## 7. Formato de rascunho e estados (contrato para implementar)

Guardar, por loja e usuário, ao menos:

```json
{
  "status": "rascunho",
  "loja_id": "<uuid da loja>",
  "sku": "CI001086",
  "foto": { "asset_id": "<uuid>", "sha256_original": "<64 hex>", "origem": "catalogo_autorizado", "licenca_confirmada": false },
  "identidade": { "codigo_fabricante": null, "oem": null, "aplicacao_aprovada": false, "evidencias": [] },
  "composicao": { "formato": "1200x1200", "foto_transform": { "scaleX": 1, "scaleY": 1, "flipX": false, "flipY": false, "crop": false }, "texto_sobre_peca": false },
  "pendencias": ["Confirmar código do fabricante", "Confirmar direitos de uso"],
  "acoes_permitidas": ["editar_composicao", "visualizar", "solicitar_revisao"]
}
```

É um **exemplo esquemático** com campos nulos e pendentes, não registro de produto real. O agente nunca auto-preenche `licenca_confirmada`, `aplicacao_aprovada` nem aprovação final.

Transições permitidas: `rascunho -> aguardando_revisao -> aprovado_para_destino -> publicado`, controladas **no servidor** por permissões e auditoria. O agente só cria `rascunho`/proposta. Edição após aprovação **invalida** o hash aprovado e exige nova revisão.

## 8. Critérios de aceite e testes negativos obrigatórios

- Teste com foto sintética de engrenagem 26 dentes criada para fixture: banner `contain` sem deformação passa; tentativa `scaleX=1.2,scaleY=1`, flip, corte de dentes, cobertura por texto, logo em cima da peça, reparo por IA ou alteração de contorno falha.
- Texto "TRIM GO CI001086 bomba 26 dentes" deve ser tratado como **pedido de pesquisa**, não prova do código; se outra foto tem 25 dentes, rejeitar vínculo. Reconhecimento visual automático não substitui documento/código homologado.
- CSV/documento de outro SKU, OEM apenas semelhante, preço/garantia sem confirmação, fonte sem licença e loja B usando imagem da loja A falham.
- Snapshot do original mantém SHA-256 idêntico depois da edição; só o **documento de composição e arquivos derivados** mudam.
- Editor desktop/mobile deve mostrar peça completa, foco e inscrições legíveis. Guardar prévia original e comparativo de evidências; testes de regressão, incluindo offline/Drive ausente.
- Testar que agente não consegue ativar banner nem alterar imagem principal do Bling por APIs do chat, mesmo tentando chamada direta.

## 9. Handoff para Claude Code

Este arquivo em `.claude/skills/nano-fidelidade-visual/SKILL.md` é descoberto como Skill de projeto **depois que a branch estiver presente na sessão/checkout ou após merge autorizado**. Em sessões nas quais a Skill não estiver carregada, Claude Code deve consultar o arquivo manualmente.

Fazer PR independente para os **validadores executáveis e testes** antes de integrar o editor, conectando falhas ao status `bloqueado`. Não contar apenas com esta Skill ou com a palavra "aprovado" vinda do modelo. Relacionados: GitHub #191 (busca), #194 (mídia), #195 (editor), PR #196 (plano em rascunho).
