#!/usr/bin/env python3
"""Consulta local por campo, devolve no máx. N fichas CURTAS (sem carregar PDF nem texto inteiro).
Uso: consultar_fichas.py sku CI000009 | motor D4BH | veiculo L200 | oem 1132A123 | cod_fabrica ... | pagina MOTOR.pdf#8   [--max 5]"""
import json, re, sys, pathlib
d = pathlib.Path(__file__).parent
av = sys.argv[1:]; mx = 5
if "--max" in av: i = av.index("--max"); mx = int(av[i+1]); del av[i:i+2]
a = av
if len(a) != 2 or a[0] not in ("sku", "oem", "cod_fabrica", "motor", "veiculo", "pagina"): sys.exit(__doc__)
ix = json.load(open(d/"indices_fichas.json")); chave = a[1] if a[0] == "pagina" else re.sub(r"[^A-Z0-9]", "", a[1].upper())
alvo = ix[a[0]].get(chave, [])
fichas = [json.loads(l) for l in open(d/"produtos_familias.jsonl", encoding="utf-8")]
for n in alvo[:mx]:
    r = fichas[n]; print(f'{r["sku_fornecedor"]} | {r["descricao"][:90]} | fábrica {r["codigos_de_fabrica"]} | {r["fonte_pdf"]} p.{r["pagina"]} | conf. {r["confianca"]}')
print(f"-- {len(alvo)} ficha(s) para {a[0]}={a[1]}; mostradas {min(len(alvo), mx)}" + ("" if alvo else " (ausência no índice NÃO prova ausência no catálogo)"))
