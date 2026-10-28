#!/usr/bin/env python3
"""Gera indices_fichas.json: índices invertidos SKU/OEM/código de fábrica/motor/veículo/página -> nº da linha em produtos_familias.jsonl.
Determinístico, sem LLM, sem rede. Fichas = fatos do PDF (com página e hash); nada é inferido."""
import json, re, collections, pathlib
d = pathlib.Path(__file__).parent
fichas = [json.loads(l) for l in open(d/"produtos_familias.jsonl", encoding="utf-8")]
norm = lambda s: re.sub(r"[^A-Z0-9]", "", str(s).upper())
ix = {k: collections.defaultdict(list) for k in ("sku", "oem", "cod_fabrica", "motor", "veiculo", "pagina")}
for n, r in enumerate(fichas):
    ix["sku"][norm(r["sku_fornecedor"])].append(n)
    if r.get("oem"): ix["oem"][norm(r["oem"])].append(n)
    for c in re.split(r"[/;,]\s*", r.get("codigos_de_fabrica") or ""):
        if norm(c): ix["cod_fabrica"][norm(c)].append(n)
    for m in r.get("motor") or []: ix["motor"][norm(m)].append(n)
    for v in r.get("veiculo") or []: ix["veiculo"][norm(v)].append(n)
    ix["pagina"][f'{r["fonte_pdf"]}#{r["pagina"]}'].append(n)
json.dump({k: dict(v) for k, v in ix.items()} | {"total_fichas": len(fichas)}, open(d/"indices_fichas.json", "w"), ensure_ascii=False)
print({k: len(v) for k, v in ix.items()}, "fichas:", len(fichas))
