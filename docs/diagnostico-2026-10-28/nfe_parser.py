"""Parser LOCAL de NF-e/XML. Só lê arquivos que o dono entregar; os testes usam XML FICTÍCIO.
Não grava em ERP, não chama rede. Saída: registros por item + diferença fiscal como PROPOSTA (nunca aplica)."""
from __future__ import annotations
import hashlib, re, json, csv
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict, field
from pathlib import Path

NS = "{http://www.portalfiscal.inf.br/nfe}"
TIPOS = {"nfeProc": "nfe_autorizada", "NFe": "nfe_sem_protocolo", "resNFe": "resumo_distribuicao",
         "procEventoNFe": "evento", "resEvento": "resumo_evento"}
EVENTOS = {"110111": "cancelamento", "110110": "carta_correcao", "210200": "ciencia_manifestacao"}

class XmlInvalido(ValueError): pass

def dv_chave(c43: str) -> int:
    pesos, soma = 2, 0
    for d in reversed(c43):
        soma += int(d) * pesos; pesos = 2 if pesos == 9 else pesos + 1
    r = soma % 11
    return 0 if r in (0, 1) else 11 - r

def chave_valida(ch: str) -> bool:
    return bool(re.fullmatch(r"\d{44}", ch or "")) and dv_chave(ch[:43]) == int(ch[43])

def _t(el, path):
    x = el.find(path) if el is not None else None
    return (x.text or "").strip() if x is not None and x.text else None

def _carregar(raw: bytes) -> ET.Element:
    if len(raw) > 5_000_000: raise XmlInvalido("arquivo grande demais")
    cab = raw[:4096].decode("utf-8", "ignore").upper()
    if "<!DOCTYPE" in cab or "<!ENTITY" in raw.decode("utf-8", "ignore").upper():
        raise XmlInvalido("DOCTYPE/ENTITY proibidos (XXE)")
    try: return ET.fromstring(raw)
    except ET.ParseError as e: raise XmlInvalido(f"XML malformado: {e}")

def _item(det) -> dict:
    p = det.find(f"{NS}prod"); imp = det.find(f"{NS}imposto")
    icms = None
    if imp is not None:
        ic = imp.find(f"{NS}ICMS")
        if ic is not None and len(ic): icms = ic[0]
    return {"n_item": det.get("nItem"), "codigo_fornecedor": _t(p, f"{NS}cProd"), "gtin": (lambda g: g if g and g.isdigit() and len(g) in (8,12,13,14) else None)(_t(p, f"{NS}cEAN")),  # "SEM GTIN" não é GTIN
            "descricao": _t(p, f"{NS}xProd"), "ncm": _t(p, f"{NS}NCM"), "cest": _t(p, f"{NS}CEST"),
            "cfop": _t(p, f"{NS}CFOP"), "unidade": _t(p, f"{NS}uCom"), "quantidade": _t(p, f"{NS}qCom"),
            "valor_unitario": _t(p, f"{NS}vUnCom"), "origem": _t(icms, f"{NS}orig"),
            "cst_csosn": _t(icms, f"{NS}CST") or _t(icms, f"{NS}CSOSN"),
            "fabricante": _t(p, f"{NS}CNPJFab"),  # só quando o emitente documenta; senão None (nunca inferido)
            "informacao_adicional_item": _t(det, f"{NS}infAdProd")}

def interpretar(raw: bytes, nome: str = "") -> dict:
    sha = hashlib.sha256(raw).hexdigest()
    root = _carregar(raw)
    tag = root.tag.replace(NS, "")
    if tag not in TIPOS: raise XmlInvalido(f"tipo de documento não suportado: {tag}")
    out = {"arquivo": nome, "sha256": sha, "tipo": TIPOS[tag], "chave": None, "chave_valida": False,
           "situacao": None, "itens": [], "avisos": []}
    if tag in ("nfeProc", "NFe"):
        inf = root.find(f".//{NS}infNFe")
        if inf is None: raise XmlInvalido("infNFe ausente")
        ch = (inf.get("Id") or "").removeprefix("NFe")
        prot = root.find(f".//{NS}protNFe/{NS}infProt")
        cstat = _t(prot, f"{NS}cStat")
        out.update(chave=ch, chave_valida=chave_valida(ch), cstat=cstat, protocolo=_t(prot, f"{NS}nProt"),
                   emitente_cnpj=_t(inf, f"{NS}emit/{NS}CNPJ"), emitente_nome=_t(inf, f"{NS}emit/{NS}xNome"),
                   numero=_t(inf, f"{NS}ide/{NS}nNF"), emissao=_t(inf, f"{NS}ide/{NS}dhEmi"),
                   itens=[_item(d) for d in inf.findall(f"{NS}det")])
        out["situacao"] = "autorizada" if cstat in ("100", "150") else ("sem_protocolo" if tag == "NFe" else f"cStat_{cstat}")
        if tag == "NFe": out["avisos"].append("sem protocolo de autorização: não vale como NF-e autorizada")
        if not out["chave_valida"]: out["avisos"].append("chave de acesso com DV inválido")
    elif tag == "resNFe":
        ch = _t(root, f"{NS}chNFe") or ""
        out.update(chave=ch, chave_valida=chave_valida(ch), emitente_nome=_t(root, f"{NS}xNome"), situacao="resumo",
                   cstat=_t(root, f"{NS}cSitNFe"))
        out["avisos"].append("resumo de distribuição: SEM itens, NCM ou CFOP; baixar o XML completo antes de usar")
    else:  # evento
        ev = root.find(f".//{NS}infEvento") if tag == "procEventoNFe" else root
        ch = _t(ev, f"{NS}chNFe") or ""; cod = _t(ev, f"{NS}tpEvento")
        out.update(chave=ch, chave_valida=chave_valida(ch), evento=EVENTOS.get(cod, f"evento_{cod}"), situacao="evento")
        if cod == "110111": out["avisos"].append("CANCELAMENTO: a NF-e da mesma chave não vale; não usar seus itens")
    return out

def reconciliar(docs: list[dict]) -> list[dict]:
    """Uma NF-e só 'vale' se tem protocolo 100/150 E não há evento de cancelamento da mesma chave."""
    cancel = {d["chave"] for d in docs if d.get("evento") == "cancelamento" and d["chave_valida"]}
    for d in docs:
        d["valida_para_uso"] = (d["tipo"] == "nfe_autorizada" and d["situacao"] == "autorizada"
                                and d["chave_valida"] and d["chave"] not in cancel)
    return docs

CAMPOS_FISCAIS = ("ncm", "cest", "origem", "cst_csosn", "gtin")
def proposta_diferenca(item: dict, cadastro: dict) -> dict | None:
    """Compara com o cadastro do ERP e devolve PROPOSTA. Aplicar exige contador + aprovação humana."""
    dif = {c: {"erp": cadastro.get(c) or None, "nota": item.get(c) or None} for c in CAMPOS_FISCAIS
           if item.get(c) and (cadastro.get(c) or None) != item.get(c)}
    if not dif: return None
    return {"sku": cadastro.get("sku"), "codigo_fornecedor": item["codigo_fornecedor"], "diferencas": dif,
            "estado": "PROPOSTA", "exige": ["validação do contador", "aprovação humana"], "aplicado": False}

def exportar(docs: list[dict], pasta: Path):
    pasta.mkdir(parents=True, exist_ok=True)
    with (pasta / "itens.jsonl").open("w", encoding="utf-8") as f:
        for d in docs:
            for i in d["itens"]:
                f.write(json.dumps({"chave": d["chave"], "sha256": d["sha256"], "valida_para_uso": d.get("valida_para_uso"), **i}, ensure_ascii=False) + "\n")
    cols = ["chave", "valida_para_uso", "n_item", "codigo_fornecedor", "descricao", "ncm", "cest", "cfop", "gtin", "origem", "cst_csosn", "fabricante"]
    with (pasta / "itens.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, cols, extrasaction="ignore"); w.writeheader()
        for d in docs:
            for i in d["itens"]: w.writerow({"chave": d["chave"], "valida_para_uso": d.get("valida_para_uso"), **i})
    linhas = ["# Documentos fiscais lidos (FICTÍCIOS nos testes)", "", "| arquivo | tipo | situação | válido p/ uso | itens | sha256 |", "|---|---|---|---|---|---|"]
    for d in docs:
        linhas.append(f"| {d['arquivo']} | {d['tipo']} | {d['situacao']} | {d.get('valida_para_uso')} | {len(d['itens'])} | `{d['sha256'][:12]}` |")
    (pasta / "relatorio.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")
