"""Validador da saída de um modelo de IA: tudo o que não está no texto de origem ou fora da lista fechada é descartado."""
import re

from .classificacao import carregar_taxonomia, taxonomia_valida
from .oem import candidatos_oem
from .texto import chave

CAMPOS = {"codigos_oem", "marca_fabricante", "taxonomia", "aplicacao", "nao_se_aplica", "pendencias"}


def validar_saida_llm(saida: dict, texto_fonte: str) -> tuple[dict, list[str]]:
    """Devolve (saída limpa, avisos). Nada vindo do modelo vale sem prova no texto."""
    avisos: list[str] = []
    limpa: dict = {}
    for k in saida:
        if k not in CAMPOS:
            avisos.append(f"campo '{k}' fora do esquema descartado")
    prova = {c.normalizado for c in candidatos_oem(texto_fonte)}
    cods = []
    for c in saida.get("codigos_oem", []) or []:
        alvo = next((x for x in candidatos_oem(str(c)) if x.normalizado in prova), None)
        if alvo:
            cods.append(alvo.normalizado)
        else:
            avisos.append(f"código '{c}' não aparece no texto de origem: descartado")
    limpa["codigos_oem"] = sorted(set(cods))
    tx = saida.get("taxonomia") or {}
    if tx and taxonomia_valida(tx.get("sistema", ""), tx.get("subsistema", ""), tx.get("familia", ""), carregar_taxonomia()):
        limpa["taxonomia"] = {k: tx[k] for k in ("sistema", "subsistema", "familia")}
    elif tx:
        avisos.append("taxonomia fora da lista fechada: descartada (precisa de proposta de categoria nova)")
    ap = saida.get("aplicacao") or {}
    t = chave(texto_fonte)
    anos = [a for a in ap.get("anos", []) or [] if re.search(rf"(?<!\d){re.escape(str(a))}(?!\d)", texto_fonte)]
    if len(anos) != len(ap.get("anos", []) or []):
        avisos.append("ano que não está no texto foi descartado (anos não são deduzidos nem expandidos)")
    motores = [m for m in ap.get("motores", []) or [] if chave(str(m)) in t]
    if len(motores) != len(ap.get("motores", []) or []):
        avisos.append("motor que não está no texto foi descartado")
    limpa["aplicacao"] = {"anos": anos, "motores": motores}
    nsa = saida.get("nao_se_aplica")
    if nsa and chave(str(nsa)) in t:
        limpa["nao_se_aplica"] = nsa
    elif nsa:
        avisos.append("bloco 'NÃO SE APLICA' inventado: descartado")
    return limpa, avisos
