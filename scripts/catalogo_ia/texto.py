"""Utilidades de texto: limpeza de HTML e comparação sem acento/caixa."""
import html
import re
import unicodedata


def sem_html(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def chave(s: str) -> str:
    """Forma comparável: sem acento, minúscula, espaços únicos. Aceita texto com codificação quebrada ('NãO')."""
    d = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"\s+", " ", "".join(c for c in d if not unicodedata.combining(c)).casefold()).strip()
