<#
.SYNOPSIS
  Prepara a aplicação CONTROLADA de uma migração no SQL Editor do Supabase (projeto conecta-ia).
.DESCRIPTION
  NÃO executa SQL, NÃO usa token, NÃO se conecta ao banco. Ele só:
   1) confere que o arquivo está na lista permitida e traz o ref correto do projeto;
   2) mostra o resumo (tamanho, SHA-256, comandos perigosos) para você conferir;
   3) copia o conteúdo para a área de transferência;
   4) abre o SQL Editor do projeto certo no navegador.
  Você cola, lê e clica em "Run" por conta própria. Nada é aplicado sem esse clique.
.EXAMPLE
  .\Preparar-Aplicacao.ps1 -Etapa oauth
  .\Preparar-Aplicacao.ps1 -Etapa contexto
  .\Preparar-Aplicacao.ps1 -Etapa imagens
  .\Preparar-Aplicacao.ps1 -Etapa verificar
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('oauth', 'contexto', 'contexto-registrar', 'contexto-extensao', 'imagens', 'verificar', 'reverter-oauth', 'reverter-contexto', 'reverter-contexto-registrar', 'reverter-contexto-extensao', 'reverter-imagens')][string]$Etapa,
  [string]$Repositorio = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)
$ErrorActionPreference = 'Stop'
$RefEsperado = 'dsfzhsrudriqkumtlqwj'            # conecta-ia. O ref do NanoShell IA NUNCA deve aparecer aqui.
$RefProibido = 'ptilvkzuhjnqnfydjcly'
$Mapa = @{
  'oauth'             = 'docs\conector-ia\OAUTH_RECURSO_APLICAR_NO_EDITOR.sql'
  'contexto'          = 'docs\conector-ia\CONTEXTO_SESSOES_APLICAR_NO_EDITOR.sql'
  'contexto-extensao' = 'docs\conector-ia\CONTEXTO_EXTENSAO_APLICAR_NO_EDITOR.sql'
  'reverter-contexto-extensao' = 'docs\conector-ia\CONTEXTO_EXTENSAO_REVERSAO.sql'
  'contexto-registrar' = 'docs\conector-ia\CONTEXTO_REGISTRAR_APLICAR_NO_EDITOR.sql'
  'reverter-contexto-registrar' = 'docs\conector-ia\CONTEXTO_REGISTRAR_REVERSAO.sql'
  'imagens'           = 'docs\conector-ia\PRODUTO_IMAGENS_ARQUIVO_APLICAR_NO_EDITOR.sql'
  'verificar'         = 'docs\conector-ia\VERIFICAR_ESTADO_SOMENTE_LEITURA.sql'
  'reverter-oauth'    = 'docs\conector-ia\OAUTH_RECURSO_REVERSAO.sql'
  'reverter-contexto' = 'docs\conector-ia\CONTEXTO_SESSOES_REVERSAO.sql'
  'reverter-imagens'  = 'docs\conector-ia\PRODUTO_IMAGENS_ARQUIVO_REVERSAO.sql'
}
$Arquivo = Join-Path $Repositorio $Mapa[$Etapa]
if (-not (Test-Path -LiteralPath $Arquivo)) { throw "Arquivo não encontrado: $Arquivo. Atualize o repositório (git pull) na branch certa antes." }
$Texto = Get-Content -LiteralPath $Arquivo -Raw -Encoding UTF8
if ($Texto -match $RefProibido) { throw 'ABORTADO: o arquivo cita o ref de OUTRO projeto (NanoShell IA).' }
$Hash = (Get-FileHash -LiteralPath $Arquivo -Algorithm SHA256).Hash.ToLower()
Write-Host "Arquivo : $Arquivo"
Write-Host "Tamanho : $($Texto.Length) caracteres"
Write-Host "SHA-256 : $Hash"
$Perigosos = [regex]::Matches($Texto, '(?im)^\s*(drop\s+(table|schema|function|index|column)|truncate|delete\s+from)\b[^\r\n]*') | ForEach-Object { $_.Value.Trim() }
if ($Perigosos) { Write-Host "`nComandos que removem algo (confira se são os esperados):" -ForegroundColor Yellow; $Perigosos | ForEach-Object { Write-Host "  $_" } }
else { Write-Host "`nSem comandos de remoção." -ForegroundColor Green }
if ($Etapa -notlike 'verificar' -and $Etapa -notlike 'reverter-*' -and $Texto -notmatch '(?im)^\s*begin;') { throw 'ABORTADO: o script de aplicação não está dentro de uma transação (begin/commit).' }
Set-Clipboard -Value $Texto
Write-Host "`nConteúdo COPIADO. Abrindo o SQL Editor do projeto $RefEsperado ..." -ForegroundColor Cyan
Start-Process "https://supabase.com/dashboard/project/$RefEsperado/sql/new"
Write-Host @"

Próximos passos (manuais):
  1. Confira na barra do painel que o projeto é 'conecta-ia' (ref $RefEsperado).
  2. Cole (Ctrl+V), leia e clique em Run. Se o editor avisar de operação destrutiva, confira a lista acima.
  3. Esperado: uma linha com 'OK'. Se aparecer erro, NADA foi aplicado (transação). Copie a mensagem e me envie.
  4. Depois rode:  .\Preparar-Aplicacao.ps1 -Etapa verificar   e cole o resultado aqui.
"@
