"""Normalização de código OEM Hyundai/Kia (XXXXX-XXXXX) e validação de GTIN. Só mexe no FORMATO, nunca inventa valor."""
import re
from dataclasses import dataclass

_CAND = re.compile(r"(?<![0-9A-Za-z])([0-9]{5})([ .\-/_]?)([0-9][0-9A-Za-z]{4})(?![0-9A-Za-z])")


@dataclass(frozen=True)
class CandidatoOem:
    original: str
    normalizado: str
    separador_original: bool
    rotulado: bool
    confianca: str  # 'media' | 'baixa' — nunca 'alta': só o catálogo da montadora confirma


def _rotulado(texto: str, ini: int) -> bool:
    antes = texto[max(0, ini - 25):ini].casefold()
    return any(p in antes for p in ("oem", "original", "genuin", "hyundai", "kia", "mobis"))


def candidatos_oem(texto: str) -> list[CandidatoOem]:
    """Acha números no formato 5 dígitos + 5 alfanuméricos. A mesma forma serve a códigos de outras marcas
    (ex.: 15105605RS), por isso sem separador e sem rótulo a confiança é 'baixa'."""
    achados: dict[str, CandidatoOem] = {}
    for m in _CAND.finditer(texto or ""):
        norm = f"{m.group(1)}-{m.group(3).upper()}"
        sep = m.group(2) != ""
        rot = _rotulado(texto, m.start())
        c = CandidatoOem(m.group(0), norm, sep, rot, "media" if (sep or rot) else "baixa")
        if norm not in achados or achados[norm].confianca == "baixa":
            achados[norm] = c
    return list(achados.values())


def gtin_valido(g: str) -> bool:
    d = re.sub(r"\D", "", g or "")
    if len(d) not in (8, 12, 13, 14) or d != (g or "").strip():
        return False
    soma = sum(int(x) * (3 if i % 2 == 0 else 1) for i, x in enumerate(reversed(d[:-1])))
    return (10 - soma % 10) % 10 == int(d[-1])
