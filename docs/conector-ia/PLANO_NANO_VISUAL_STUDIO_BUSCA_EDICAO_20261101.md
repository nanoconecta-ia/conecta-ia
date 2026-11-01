# Nano Visual Studio: busca de fotos e editor de banners (PLANO, não implantado)

**Solicitação do lojista:** Claude Code deve integrar ao **chat Nano.IA existente** uma capacidade gratuita de busca de imagens públicas via SearXNG e um editor real, gratuito, de banners por camadas via Konva/React Konva. As fotos da peça devem ser reais e preservadas, e cada loja pode conectar seu próprio Google Drive. Documentos de coordenação: [issue #191](https://github.com/nanoconecta-ia/conecta-ia/issues/191) (busca), [issue #194](https://github.com/nanoconecta-ia/conecta-ia/issues/194) (cofre de mídia), [issue #195](https://github.com/nanoconecta-ia/conecta-ia/issues/195) (editor).

**Escopo de segurança:** documentação e PRs de desenvolvimento. NÃO alterar banco, publicar no Bling/site/Meta, ativar cobrança, implantar SearXNG, Google Drive ou R2, ou fazer merge/deploy sem autorização específica.

## 1. Estado do código atual: reaproveitar

| Local real | Estado lido em 01/11/2026 | Ação |
|---|---|---|
| `supabase/functions/_shared/ia/busca.ts` | `ProvedorBusca.imagens(consulta, limite)` e `Candidata {titulo,url,miniatura,pagina}` | Implementar adaptador **sem alterar interface pública** |
| `supabase/functions/_shared/conector/handlers.ts` | `conecta.imagem.buscar_web` chama adaptador legado Google | Injetar provedor configurado da loja ou SearXNG autorizado |
| `supabase/functions/_shared/conector/registro.ts` | `conecta.imagem.propor` ativa; `conecta.banners.gerenciar` **planejada** | Preparar contrato seguro de proposta de layout; jamais expor `executar` ao LLM |
| `painel/src/paginas/Imagens.tsx` e `painel/src/lib/fidelidade.ts` | Demonstração CSS, seleção local e checagem humana | Incorporar painel de candidatas, fotografia técnica, botão **Editar banner** |
| `painel/src/paginas/EstudioAgente.tsx` e `painel/src/paginas/Studio.tsx` | Contexto por SKU, prévias CSS e torre do Nano | Adicionar **aba Estúdio Visual** no mesmo fluxo, sem segunda experiência de chat |
| `painel/src/paginas/Banners.tsx`, `painel/src/lib/banners.ts` | Campanhas de oferta, rascunhos e ação que grava `ativo:true` diretamente | **Não** conectar ação de publicar ao agente; propor rascunhos e revisar permissões |
| `painel/src/lib/flags.ts` | Banners ainda desativados por padrão (`VITE_BANNERS_ATIVO`) | Nova flag independente `VITE_VISUAL_EDITOR_ATIVO`; default `false` |
| `supabase/functions/_shared/imagens/`, `docs/conector-ia/imagens-seo.md` | Pipeline direitos/variantes desenhado, processador de pixels mock | Reusar regras de uso/publicação e preservar originário |
| `painel/package.json` | React e React DOM `^19.3.0`; Vite 6 | `react-konva` + `konva` na versão compatível React 19.3; conferir lock e bundle |

### Repositórios upstream: verificar antes do PR de dependências

- SearXNG: <https://github.com/searxng/searxng> — **AGPL-3.0**, auto-hospedado. Documentação API: <https://docs.searxng.org/dev/search_api>.
- Konva: <https://github.com/konvajs/konva> — **MIT**, motor canvas.
- React Konva: <https://github.com/konvajs/react-konva> — **MIT**, compatível com React 19.3 segundo upstream.
- Alternativa caso precise de filtros e edição de bitmap: Fabric.js, <https://github.com/fabricjs/fabric.js> — MIT, avaliar separadamente (não adicionar **duas** bibliotecas canvas sem necessidade).
- **Não confundir** React Konva com Polotno, que é SDK comercial. **Não usar TOAST UI Image Editor como base nova:** repositório arquivado desde setembro de 2026.

## 2. Fase A — SearXNG como mecanismo de busca (sem custos de licença)

Instância própria, fechada, com HTTPS, chave entre backend e serviço, rate-limit, egress controlado, cache, limite por loja e observabilidade. O deploy do SearXNG exige máquina/container **sempre ligado**; NÃO cabe supor que a Cloudflare Worker hospede o projeto Python, nem contar com o notebook ligado no cliente. Custo de hospedagem e compliance AGPL devem ser analisados.

API de exemplo, rodando **apenas na rede autorizada do ambiente de homologação**:

```text
GET /search?q=TRIM%20GO%20bomba%20oleo%2026%20dentes&categories=images&format=json&language=pt-BR
```

**Crítico:** `format=json` tem que estar permitido em `settings.yml`; instâncias públicas podem responder 403. O contrato não deve afirmar que a API funciona antes de um teste HTTP real.

Pseudocódigo de normalização (ajustar com fixture de resposta real):

```ts
type Candidata = { titulo: string; url: string; miniatura: string | null; pagina: string };
function normalizar(resultado: {
  title?: string; img_src?: string; thumbnail_src?: string; url?: string;
}): Candidata | null {
  if (!resultado.img_src || !resultado.url) return null;
  // Implementação real deve validar HTTPS e URLs seguras.
  return { titulo: resultado.title ?? "", url: resultado.img_src,
    miniatura: resultado.thumbnail_src ?? null, pagina: resultado.url };
}
```

**Importante:** `img_src` é o endereço da imagem; `url` no resultado SearXNG é a **página de origem**, não inverter esses campos. Consulta deve usar somente SKU/código público e aplicação, **jamais** custo, fornecedor confidencial, dados pessoais/fiscais ou tokens. Páginas de origem precisam conferir marca/código: imagem semelhante não comprova identidade.

Arquivos propostos para implementação: `supabase/functions/_shared/ia/searxng.ts`, `supabase/functions/_shared/ia/searxng.test.ts`, modificações minimais em `.../conector/handlers.ts` e configuração **criptografada** do provedor de busca por loja/instância. Respeitar ambiente e implementação de segredos existentes; não criar nova base de tokens.

Critérios A: mock 200/sem resultados/403 JSON desabilitado/429/timeout/HTML inválido/URLs inseguras; isolamento por loja e cota; sem novas ferramentas duplicadas; nenhum deploy.

## 3. Fase B — editor canvas verdadeiro (no navegador, dados de teste)

**Dependências a avaliar no branch de implementação:** `npm install react-konva konva`; testar a versão realmente publicada e compatível com `react@^19.3.0`. Se `use-image` for necessário, usar licença MIT, mas NÃO carregar fotos externas diretamente sem CORS/licença.

Componentes propostos:
- `painel/src/componentes/editor-visual/EditorBanner.tsx`
- `painel/src/componentes/editor-visual/CanvasBanner.tsx`
- `painel/src/componentes/editor-visual/PropriedadesCamada.tsx`
- `painel/src/lib/editor-visual/modelo.ts` (modelagem **pura**, testável sem DOM)
- `painel/src/lib/editor-visual/templates.ts`
- `painel/src/lib/editor-visual/exportar.ts`
- `painel/src/lib/editor-visual/*.test.ts`

**Fonte de verdade do documento editável:** JSON versionado definido pelo aplicativo, **não** `stage.toJSON()`. Konva recomenda persistir o estado da aplicação, e não serializar listeners/imagens. Cada camada deve guardar `type`, `asset_id`, `x/y/w/h`, `opacity`, `rotation`, `text`, `font`, `align`, `locked` e `zIndex` dentro de lista validada. `loja_id`, `sku`, `taxonomia_no_id`, `template_id`, `rights_ref` e `version` no documento. Texto (preço/garantia) tem de derivar de valores expressamente aprovados, nunca sugeridos como fatos.

**Camadas obrigatórias:** fundo, imagem técnica real licenciada, logomarca da loja autorizada, título/descrição fiel, CTA e decoração que **não recubra** a peça. Suportar selecionar/mover/redimensionar/alinha/ordem/bloquear/desfazer-refazer, salvar JSON editável, reabrir/duplicar documento, exportar PNG/JPEG por `Stage.toBlob()`/opção equivalente com dimensões exatas, verificar erros e arquivo exportado real. Não confundir filtro CSS de demonstração com edição de bitmap.

**Formatos editoriais iniciais** (não declarar conformidade de todos os canais sem verificar regras do destino): quadrado 1200×1200, feed vertical 1080×1350, story/capa 1080×1920, hero da loja 1600×600 e OG 1200×630. UI adaptável para PC e smartphone, com zoom interno, sem produzir tela gigantesca num notebook de RAM limitada; import dinâmico do editor.

**Templates:** (1) Peça real + identificação, sem preço; (2) Oferta com preço/condição apenas quando confirmados; (3) Linha/fabricante, sem logo externo sem licença. Nada de marca-d'água, mudança de geometria, número de dentes, inscrições da peça, ou fotografia gerada em lugar da real.

**Canvas e CORS:** imagens baixadas de Google/Drive/SearXNG não são automaticamente exportáveis no canvas (risco de `tainted canvas`). Primeiro importar fonte licenciada para armazenamento privado autorizado, validar hash, extensão e MIME, e servir URL assinada com CORS apropriado; nunca criar proxy genérico SSRF/aberto. <https://konvajs.org/docs/posts/Tainted_Canvas.html>.

**Primeiro PR:** UI local com foto fixture autorizada e logo fictício/da loja autorizado; sem Supabase migrations, sem escrita no Drive/Bling. Mostrar selo **rascunho não publicado**; exportar e reabrir arquivo de projeto.

## 4. Fase C — Nano agentic workflow e mídia por loja

Pedido de teste: “Nano, ache quatro imagens reais da bomba óleo TRIM GO 26 dentes, confira fabricante/aplicação e prepare um banner para Mobis sem preço”.

Pipeline: `conecta.catalogo.ver` -> biblioteca da loja (Drive próprio + HD autorizado, #194) -> `conecta.imagem.buscar_web` via SearXNG (#191) -> usuário valida **identidade E licença** -> Nano propõe `DesignSpec` estruturado com referências de mídia (sem bytes e sem URL privada no prompt) -> render determinístico Konva -> usuário altera camadas -> rascunho de banner e destinos -> aprovação via fila -> exportação de variantes.

`conecta.banners.gerenciar` no registro está `planejada`; PR da fase C pode ativá-la SOMENTE como `propor` e sem publicar. Isolar permissões do agente (propor) das do dono (aprovar). Nenhum modelo decide sozinho se uma foto tem licença. Não usar a inserção atual `loja_banners.ativo=true` no backend do Nano; publicação da loja, Bling, Meta, WhatsApp e site são **aprovações e operações separadas**.

Persistir os originais no Drive de **cada cliente** ou no HD local autorizado e índice canônico no Supabase, com cópia/sincronização resiliente; variantes públicas somente no CDN próprio autorizado (R2, após aprovação), jamais links Drive como mídia pública. Em queda do Drive: editor usa apenas mídia já sincronizada; pendência explícita; não alucinar imagem.

## 5. Fase D — aceite, segurança e rollout

Testes mínimos:
1. Regressão nas telas `/imagens`, `/estudio`, `/banners`; recursos antigos não desaparecem, e nenhum segundo chat é criado.
2. Busca retorna 4 candidatas com `url` da imagem + `pagina` da fonte; foto incompleta é rejeitada. Acessar fonte sem burlas.
3. Loja A/B e usuário U/V segregados: nenhum arquivo, licença, rascunho ou token é visto em outra loja; perfil editor não publica.
4. SEM direito confirmado: não exportar como peça publicável nem enviar a canais; pode haver uma **prévia interna** claramente marcada, conforme política e uso permitido.
5. LLM pode somente gerar proposta `DesignSpec`, nunca aprovar ou executar; teste negativo contra chamada direta `conecta.banners.gerenciar`.
6. Rascunho abre novamente preservando todas as camadas; export PNG/JPEG verificado para 1200×1200 e 1080×1920, sem corte indevido, preços/cores/logos reais e aprovados.
7. Falha offline/Drive 401/403/429/SearXNG 429/instância caída/CORS e imagem corrompida; mensagens de estado úteis, sem registrar credenciais.
8. `cd painel && npm ci && npm run build && npm run test` + Playwright desktop/mobile com imagens e documentos de fixture; logs sem segredos; nenhuma escrita externa de teste.
9. Antes de qualquer deploy: review de dependências MIT/AGPL; custos de infra; rollback; migrações e proteções da vitrine (`loja-publica` ainda consulta imagens aprovadas em vez de somente licenciadas segundo documento do pipeline).
10. PRs separados por fase com screenshots de teste e limitação claramente descrita. **Não alterar produção/ativar flags/mergear sem aprovação do dono.**

## Entregáveis do Claude Code

- **PR A:** Busca SearXNG, contratos de provedor, testes, documentação, sem deploy.
- **PR B:** Editor Konva funcional no navegador, templates e exportação real com imagens de teste, UI mobile, sem upload.
- **PR C:** Proposta segura no chat existente + armazenamento por loja/Drive/HD e RLS, condicionada a #194.
- **PR D:** Aprovação humana, direitos, CDN/variantes e publicação por destino condicionada a testes, autorizações e orçamento.

**Definição de pronto:** o operador fala com o Nano.IA num único chat, vê resultados reais da busca com origem, abre editor por camadas, altera o banner, salva rascunho e exporta um arquivo real com foto autorizada; nenhuma publicação automática e nenhuma cobrança. Não confundir rota ou botão de demonstração com capacidade implementada.
