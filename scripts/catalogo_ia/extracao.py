"""Extração determinística do texto do cadastro. Cada valor devolvido aparece literalmente no texto de origem."""
import json
import re
from pathlib import Path

from .oem import candidatos_oem, gtin_valido
from .texto import chave, sem_html

_DADOS = Path(__file__).parent / "dados"
_MOTORES = json.loads((_DADOS / "motores.json").read_text(encoding="utf-8"))["codigos"]
_VEICULOS = ["Hyundai", "Kia", "HR", "Bongo", "K2500", "Sorento", "Starex", "H100", "H-1", "H350", "Porter"]


def anos_informados(texto: str) -> list[dict]:
    """Só anos que o texto diz. '2013+' vira início 2013 sem fim; nada é expandido."""
    saida, vistos = [], set()
    for m in re.finditer(r"(?<!\d)((?:19|20)\d{2})(\s*\+|\s*[-/a]\s*((?:19|20)\d{2}))?(?!\d)", texto):
        ini, fim = int(m.group(1)), (int(m.group(3)) if m.group(3) else None)
        chave_ = (ini, fim, "+" in (m.group(2) or ""))
        if chave_ in vistos:
            continue
        vistos.add(chave_)
        saida.append({"inicio": ini, "fim": fim, "em_aberto": "+" in (m.group(2) or ""), "trecho": m.group(0).strip()})
    return saida


def emissoes(texto: str) -> list[str]:
    romano = {"I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6"}
    achados = []
    for m in re.finditer(r"euro\s*([ivx]+|\d)", chave(texto)):
        v = m.group(1).upper()
        n = romano.get(v, v)
        if f"Euro {n}" not in achados:
            achados.append(f"Euro {n}")
    return achados


def motores(texto: str) -> list[str]:
    t = texto.upper()
    return [c for c in _MOTORES if re.search(rf"(?<![A-Z0-9]){re.escape(c)}(?![A-Z0-9])", t)]


def veiculos_citados(texto: str) -> list[str]:
    t = texto.upper()
    return [v for v in _VEICULOS if re.search(rf"(?<![A-Z0-9]){re.escape(v.upper())}(?![A-Z0-9])", t)]


def separar_nao_se_aplica(texto: str) -> tuple[str, str | None]:
    """Separa a cláusula 'NÃO SE APLICA: ...' do resto. O que ela cita é EXCLUSÃO, nunca aplicação."""
    m = re.search(r"n[aã]o se aplica\s*:?\s*(.+?)(?:\.\s|$)", re.sub(r"[ãÃ]", "a", texto), re.I)
    if not m:
        return texto, None
    return (texto[:m.start()] + " " + texto[m.end():]).strip(), texto[m.start(1):m.end(1)].strip()


def nao_se_aplica(texto: str) -> str | None:
    return separar_nao_se_aplica(texto)[1]


def extrair(sku: str, nome: str, descricao: str, marca: str = "", gtin: str = "") -> dict:
    """Une nome + descrição (sem HTML) e extrai o que dá para provar pelo texto.
    Motor, emissão e ano só contam como APLICAÇÃO fora da cláusula NÃO SE APLICA; dentro dela são exclusões."""
    desc = sem_html(descricao)
    texto = f"{nome}. {desc}".strip()
    texto_aplicacao, nsa = separar_nao_se_aplica(texto)
    return {
        "sku": sku,
        "codigos_oem": [c.__dict__ for c in candidatos_oem(texto_aplicacao)],
        "marca_fabricante": marca.strip() or None,
        "gtin": {"valor": gtin, "valido": gtin_valido(gtin)} if gtin else None,
        "aplicacao": {
            "veiculos_citados": veiculos_citados(texto_aplicacao),
            "motores": motores(texto_aplicacao),
            "emissoes": emissoes(texto_aplicacao),
            "anos_informados": anos_informados(texto_aplicacao),
        },
        "nao_se_aplica": nsa,
        "excluido": {"motores": motores(nsa or ""), "emissoes": emissoes(nsa or ""), "anos_informados": anos_informados(nsa or "")},
        "texto_fonte": texto,
    }
