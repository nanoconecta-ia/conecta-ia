# Nano Video Studio — Concat MCP + FFmpeg local (proposta implementada para teste)

**Escopo:** `nanoconecta-ia/conecta-ia`, sem contato com o projeto NanoShell IA e sem gravação no Bling. Nenhuma alteração de banco, deploy ou distribuição de instaladores nesta PR.

## Arquitetura integrada
- **Grid de início:** `VisaoGeral` inclui o atalho `Nano Video Studio`.
- **Menu lateral/paleta:** `/videos`, dentro de Catálogo Inteligente. A rota do Nano.IA `/assistente` permanece a única canônica.
- **Navegação pelo Nano:** comando local `abra o editor de vídeo` ou `abra o Nano Video Studio` resolve para `/videos`, sem enviar dados ao LLM. Isso é **navegação**, não edição autônoma por IA.
- **Editor de imagens:** `/imagens` e Konva permanecem intactos. A foto da peça não é reprocessada por IA.
- **Plano de vídeo:** tela `/videos` reúne 1–4 fotos reais em JPG/PNG/WebP, SKU informado por pessoa, título/brand validados, escolha 9:16, 1:1 ou 16:9, duração 2–5 s/foto. Gera JSON versão 1 com SHA-256 dos originais e estado `pendente`, sem salvar no backend.
- **Renderizador de MP4 local:** `scripts/video-local/render.mjs` checa nomes, assinatura, tamanho e SHA dos arquivos dentro de uma pasta autorizada; gera vídeo silencioso com H.264 via FFmpeg quando `--approve` for explicitamente informado. `--dry-run` só valida o plano; não executa FFmpeg.
- **Concat MCP:** `scripts/video-local/concat-probe.mjs` usa o protocolo stdio documentado pelo Concat para `initialize`, `tools/list` e `concat_version`, **somente leitura**. A edição avançada em Concat depende de instalar o binário oficial e homologar seus schemas reais. Nenhum prompt do cliente pode executar um comando arbitrário no Windows.

## Comandos de teste supervisionado (Windows / PowerShell)

O operador separa as fotos originais em `C:\teste\fotos` e cria `C:\teste\saida`. O JSON gerado pelo painel é salvo em `C:\teste\nano-video-CI000016.json`. Não há instalação automática.

```powershell
# Na raiz do repositório (branch desta PR), com Node instalado:
node --experimental-strip-types --test painel/src/lib/videoPlano.test.ts
node --experimental-strip-types --test scripts/video-local/*.test.mjs
node --experimental-strip-types scripts/video-local/render.mjs --manifest "C:\teste\nano-video-CI000016.json" --media "C:\teste\fotos" --output "C:\teste\saida" --dry-run

# SOMENTE com FFmpeg instalado, foto/SKU e saída conferidos, e aprovação humana:
node --experimental-strip-types scripts/video-local/render.mjs --manifest "C:\teste\nano-video-CI000016.json" --media "C:\teste\fotos" --output "C:\teste\saida" --approve

# Depois de verificar a origem e instalar o Concat oficial, leitura MCP:
node scripts/video-local/concat-probe.mjs
```

> FFmpeg deve ser instalado/verificado separadamente. Concat para Windows costuma ficar em `%LOCALAPPDATA%\Programs\Concat\concat.exe` ou `C:\Program Files\Concat\concat.exe`. Guia primário: https://github.com/jub0t/Concat/blob/main/docs/MCP.md. Concat ainda é beta e tem licença AGPL-3.0; avaliar implicações antes de distribuir binários, incorporar código ou ofertar serviço de edição.

## Critérios de homologação

1. Abrir `#/videos` pelo grid de início, menu, paleta e comando `abre o editor de vídeo`.
2. Selecionar fotos **reais autorizadas** da Mobis. Conferir tipo, dimensões e o SKU com fonte técnica; vídeo não determina aplicação.
3. Exportar JSON pendente; executar `--dry-run`; adulterar um pixel/arquivo e verificar bloqueio pelo SHA-256.
4. Testar no notebook 8 GB com FFmpeg compatível: gerar e inspecionar MP4 sem áudio, sem anúncios de dados inventados, sem escrever no ERP. Conferir que não sobrescreve saída anterior.
5. Testar o `concat-probe` com binário oficial, sem `project_create`, `media_import`, `export_start` neste estágio. Só depois avaliar edição via MCP com permissões e contrato da versão real.
6. Nenhum compartilhamento de preço de custo, fornecedor ou fiscal; nenhuma publicação no Instagram, WhatsApp, Facebook, TikTok ou loja sem aprovação separada.

## Status e limitações explícitas

- **Código pronto para revisão e teste automatizado**, não implica executável instalado, interface publicada ou produção homologada.
- No notebook `mobis` foi verificado no início desta etapa: **FFmpeg e Concat não encontrados no PATH e nos dois caminhos oficiais Windows**. Não instalar softwares sem verificar fonte e obter autorização.
- Não há servidor MCP remoto, Edge Function nova, login de Concat ou ponte de envio automático; tudo é local e com autorização explícita.
- O vídeo exportado monta fotografias em sequência com barras de enquadramento. Não há legendagem automática, efeitos, locução ou mídia sintética nesta PR.
- Próxima fase, após homologação do Concat: integrar `project_create`, `media_import`, `clip_add` e `export_start` pelo **schema real descoberto via `tools/list`**, com pasta restrita, política de ferramentas e aprovação por tarefa.
