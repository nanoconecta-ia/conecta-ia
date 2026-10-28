#!/usr/bin/env python3
"""Monta o pacote PORTÁTIL de homologação (zip + SHA256SUMS). Sem testes, sem evidências antigas, sem segredos.
Uso: python3 empacotar.py <saida.zip>"""
import hashlib, sys, zipfile, pathlib
raiz = pathlib.Path(__file__).resolve().parents[3]
import re
def fecho(entradas):
    """Fecho transitivo dos imports relativos (.ts/.mjs) a partir das entradas: só entra o que o agente/gateway realmente usa."""
    vistos, fila = set(), [raiz / e for e in entradas]
    while fila:
        f = fila.pop()
        if f in vistos: continue
        if not f.exists(): raise SystemExit(f"import ausente: {f}")
        vistos.add(f)
        for m in re.finditer(r'(?:from|import)\s*\(?\s*["\'](\.[^"\']+)["\']', f.read_text(encoding="utf-8")):
            fila.append((f.parent / m.group(1)).resolve())
    return vistos
entradas = ["scripts/exec-local/agente/homologacao.mjs", "scripts/exec-local/agente/agente.mjs"]
extra = {raiz / "scripts/exec-local/agente/capacidades.windows.json"}
inc = sorted({str(f.relative_to(raiz)) for f in fecho(entradas) | extra})
sums = []
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:
    for rel in inc:
        b = (raiz / rel).read_bytes(); z.writestr(f"nano-agente-windows/{rel}", b); sums.append(f"{hashlib.sha256(b).hexdigest()}  {rel}")
    z.writestr("nano-agente-windows/SHA256SUMS.txt", "\n".join(sums) + "\n")
    z.writestr("nano-agente-windows/LEIAME.txt", (raiz / "docs/exec-local/homologacao-windows.md").read_text(encoding="utf-8"))
print(len(sums), "arquivos;", "zip sha256:", hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())
