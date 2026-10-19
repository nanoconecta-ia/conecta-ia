"""Classe da peça (genuína/OEM/aftermarket) e taxonomia. Sem evidência, 'a_confirmar' — a classe exige a evidência da sua classe."""
import csv
import json
from pathlib import Path

from .texto import chave

_DADOS = Path(__file__).parent / "dados"
MARCAS_MONTADORA = {"hyundai", "kia", "mobis", "hyundai mobis"}


def carregar_taxonomia() -> dict:
    t = json.loads((_DADOS / "taxonomia.json").read_text(encoding="utf-8"))
    return {k: v for k, v in t.items() if not k.startswith("_")}


def carregar_homologados(caminho: Path | None = None) -> dict[str, str]:
    """marca -> fonte. Arquivo vazio por padrão: nenhuma marca é 'OEM' sem fonte registrada."""
    caminho = caminho or _DADOS / "fornecedores_homologados.csv"
    with open(caminho, encoding="utf-8", newline="") as f:
        return {chave(r["marca"]): r["fonte"] for r in csv.DictReader(f) if r.get("marca") and r.get("fonte")}


def classe_da_peca(marca: str | None, texto: str, homologados: dict[str, str]) -> dict:
    m = chave(marca or "")
    if not m:
        return {"classe": "a_confirmar", "evidencia": None, "pendencia": "marca ausente"}
    declara_genuina = any(p in chave(texto) for p in ("genuina", "genuino", "original hyundai", "original kia"))
    if m in MARCAS_MONTADORA and declara_genuina:
        return {"classe": "genuina", "evidencia": f"marca '{marca}' e o texto declara peça genuína", "pendencia": "confirmar no catálogo da montadora"}
    if m in homologados:
        return {"classe": "oem", "evidencia": homologados[m], "pendencia": None}
    return {"classe": "a_confirmar", "evidencia": None, "pendencia": f"marca '{marca}' sem fonte que a classifique (OEM ou reposição)"}


def taxonomia_valida(sistema: str, subsistema: str, familia: str, taxonomia: dict | None = None) -> bool:
    t = taxonomia or carregar_taxonomia()
    return familia in t.get(sistema, {}).get(subsistema, [])
