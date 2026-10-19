"""Uso: python3 -m scripts.catalogo_ia.cli entrada.csv saida.jsonl   (colunas: sku,nome,descricao,marca,gtin)
Sem IA por padrão. Gera propostas em JSONL; nunca escreve no Bling."""
import csv
import json
import sys

from .classificacao import classe_da_peca, carregar_homologados
from .extracao import extrair


def processar(linhas: list[dict]) -> list[dict]:
    homolog = carregar_homologados()
    saidas = []
    for r in linhas:
        e = extrair(r.get("sku", ""), r.get("nome", ""), r.get("descricao", ""), r.get("marca", ""), r.get("gtin", ""))
        classe = classe_da_peca(e["marca_fabricante"], e["texto_fonte"], homolog)
        pend = [classe["pendencia"]] if classe["pendencia"] else []
        pend += [f"código {c['normalizado']}: sem separador nem rótulo, confirmar se é da montadora" for c in e["codigos_oem"] if c["confianca"] == "baixa"]
        if e["gtin"] and not e["gtin"]["valido"]:
            pend.append("GTIN com dígito verificador inválido")
        if not e["nao_se_aplica"]:
            pend.append("sem bloco NÃO SE APLICA")
        pend.append("taxonomia não atribuída (precisa de classificação aprovada)")
        e.pop("texto_fonte")
        saidas.append({**e, "classe_peca": classe, "referencias_cruzadas": [], "status": "a_confirmar", "pendencias": pend})
    return saidas


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    with open(argv[1], encoding="utf-8", newline="") as f:
        linhas = list(csv.DictReader(f))
    with open(argv[2], "w", encoding="utf-8") as f:
        for s in processar(linhas):
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"{len(linhas)} cadastro(s) processados: propostas em {argv[2]} (status a_confirmar)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
