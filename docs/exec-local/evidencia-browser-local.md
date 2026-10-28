# Evidência local — executor Browser (Chromium real, rede interceptada, página fictícia)

Gerada em 2026-10-28 por `node --experimental-strip-types scripts/exec-local/browser_real.test.mjs` (6/6) e pela execução abaixo. Não é produção: sem internet, sem dispositivo da Mobis.
(O mojibake no título abaixo vem de a página de exemplo não declarar charset; o teste commitado declara utf-8 e passa.)

```json
{
 "veredito": "CONCLUIDA",
 "evidencia": {
  "saida": {
   "url": "https://teste.exemplo.com/peca",
   "titulo": "PÃ¡gina fictÃ­cia",
   "texto": "PeÃ§a de teste SKU FIC0001 â€” dado fictÃ­cio",
   "cookiesAntes": 0,
   "origem": "browser.chromium.isolado"
  },
  "sha256": "41470cd892aa5e831df28415d53f8e50582966fec70f5389813b70b4b39630d5",
  "em": 1793165256924,
  "capacidade": "browser.pagina.ler",
  "em_iso": "2026-10-28T05:27:36.924Z"
 },
 "auditoria": [
  {
   "sessao_id": "s1",
   "loja_id": "l1",
   "dispositivo_id": "d-local-sandbox",
   "agente": "qualquer",
   "tarefa_id": "t1",
   "capacidade": "browser.pagina.ler",
   "resultado": "CONCLUIDA"
  }
 ]
}
```

## Local × produção
- Local provado: Chromium/Playwright reais, contexto isolado sem cookies, DOM com JS, allowlist, bloqueio de host interno e de redirecionamento para 169.254.169.254, abort/revogação, auditoria, hash e carimbo.
- Não provado: internet real (falta `rede` com fetch e redirect manual), execução em dispositivo, ligação ao Gateway/Pair, exibição no chat.
- Hashes: guarda_rede.mjs 85b3040b71cd · runner_browser.mjs 2437a6a6836c · browser_real.test.mjs 9ae801548d2e
