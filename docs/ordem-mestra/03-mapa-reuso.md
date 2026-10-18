# 3. Mapa de tabelas e funções existentes a reutilizar

Contagem em 2026-10-18 (produção, somente leitura). "Linhas" = estado atual; ~0 indica estrutura pronta sem uso real.

## 3.1 Tabelas (69, todas com RLS)

| Grupo | Tabelas (linhas) | Uso na Ordem Mestra |
|---|---|---|
| Tenant e acesso | `lojas`(1) `loja_dominios`(0) `usuarios_loja`(1) `restricoes_plataforma_uf`(0) `restricoes_loja`(0) `loja_politicas`(1) `loja_tema`(1) | Multiempresa, domínio, identidade visual, controle de venda. **Reusar.** |
| Bling | `bling_conexoes`(1) `sync_eventos`(0) `sync_erros`(0) `bling_categorias`(14) `bling_categoria_taxonomia`(1) + `private.bling_apps/credenciais/oauth_estados/limite_chamadas` | Conector ERP. **Reusar**; `sync_eventos` pronto para webhook. |
| Espelho | `produtos`(4) `produto_imagens`(0) | Catálogo. **Reusar**; ajustar grant `anon` (A1). |
| Enriquecimento | `produto_enriquecimento`(0) `produto_codigos`(0) `produto_aplicacoes`(0) `produto_revisoes`(0) `produto_bula`(0) `produto_pecas_ref`(0) `enriquecimento_tarefas`(0) `enriquecimento_execucoes`(0) | Fluxo de 16 passos (doc 7). **Reusar.** |
| Memória técnica | `receitas`(3) `receita_execucoes` `receita_correcoes` `familias_tecnicas` `produto_equivalencias` `modelos_cadastro` `entradas_cadastro` `codigo_supersessoes` | Perfis/receitas por ramo. **Reusar.** |
| Taxonomia e módulo automotivo | `perfis_ramo`(1) `taxonomia_nos`(49) `marcas` `fontes`(16) `montadoras`(10) `plataformas` `modelos`(10) `geracoes`(3) `versoes` `eventos_veiculo`(3) `homologacoes` `familias_motor`(6) `motores`(10) `versao_motor` `relacoes_tecnicas`(1) `fabricantes_peca`(2) `fornecedores_oem` `pecas_ref`(9) `pecas_aplicacoes_tecnicas`(4) `ref_cruzada`(2) | Módulo automotivo (montadora→modelo→geração→ano→versão→motor→sistema→componente→OEM→cruzado→evidência). **Já cobre quase toda a lista da seção 4.** Lacuna: "mercado/país" e "sistema/subsistema/componente" como níveis explícitos (conferir `taxonomia_nos` + `eventos_veiculo`). |
| IA e agentes | `loja_chaves_ia`(0) `loja_mcp_chaves`(0) `loja_plugins`(0) `loja_busca_imagem`(0) | BYOK, plugins, chave do agente de fila. **Reusar.** |
| Fiscal | `loja_fiscal` `produto_fiscal` `fiscal_log` `ref_versoes` `ref_ncm` `ref_cest` `ref_regras_uf` `loja_contador` `validacoes_contador` `documentos_referencia` `notificacoes` | Dado fiscal nunca sobrescrito; contador valida. **Reusar.** |
| Plataforma | `recursos_plataforma`(10) `loja_recursos`(0) `ajuda_topicos`(4) `auditoria`(7) | Base para planos (Fase 5) e auditoria. **Estender.** |

## 3.2 Edge Functions (11 no repositório + 1 fora)

| Função | JWT | Reuso |
|---|---|---|
| `assistente` | sim | Núcleo do Conector IA admin: laço de ferramentas, decisão da Fila, uso de tokens. **Estender**: persistência, streaming, seletor de modelo. |
| `vitrine-assistente` | não | Agente público determinístico. **Estender** para LLM só depois de contrato `publico.*`. |
| `loja-publica` | não | API de dados da vitrine/SSR. **Reusar** como fonte do renderizador. |
| `bling-conectar` / `-callback` / `-renovar` / `-app` | misto | OAuth. **Reusar sem mudanças.** |
| `bling-sync` | não (segredo/cron) | Espelho. **Reusar**; resolver deriva autocontido × modular (A3). |
| `agente` | sim | Executa receita (passos 1–3, 9–10). **Reusar** no enriquecimento. |
| `ia-config` | sim | Chaves por loja, plugins, busca de imagem. **Reusar.** |
| `loja-tema` | sim | Identidade visual. **Reusar.** |
| `diag-ambiente` | sim | **Implantada, sem código no repo** (A2). |

## 3.3 Módulos `_shared` relevantes
`bling_api.ts` (único cliente da API v3: `enable-jwt`, 401 renova uma vez, GET repete, escrita nunca) · `bling_token.ts` · `bling_ferramentas.ts` (Tool Registry do Bling) · `bling_sync.ts` · `cripto.ts` (AES-256-GCM com chaveiro) · `ia/{claude,adaptadores,ferramentas,escrita,plugin,google}.ts` · `loja/{publica,tema}.ts` · `intencoes.ts` · `agente/{extrair,plano}.ts` · **novo:** `conector/{contratos,matriz_bling}.ts`.

## 3.4 Painel (`painel/src/paginas`)
Real: Acesso, VisaoGeral, Catalogo, Fila, Taxonomia, Assistente, Aparencia, Integracoes, Bling, Contador, Loja, ProdutoPublico, Design. **Demonstração (declarar como tal):** CentralAgentes, Imagens, VitrineDemo.
