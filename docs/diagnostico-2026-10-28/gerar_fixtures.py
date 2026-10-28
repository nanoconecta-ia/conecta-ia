"""Gera XML 100% fictício (CNPJ/chaves inventados, DV calculado)."""
from pathlib import Path
from nfe_parser import dv_chave
P = Path(__file__).parent / "fixtures"; P.mkdir(exist_ok=True)
def chave(n):
    base = f"35261099999999000199550010000{n:05d}1{n:08d}"[:43]; return base + str(dv_chave(base))
K1, K2, K3 = chave(101), chave(102), chave(103)
def det(i, cod, desc, ncm, cest, cfop, ean="SEM GTIN", extra=""):
    return f'<det nItem="{i}"><prod><cProd>{cod}</cProd><cEAN>{ean}</cEAN><xProd>{desc}</xProd><NCM>{ncm}</NCM>{f"<CEST>{cest}</CEST>" if cest else ""}<CFOP>{cfop}</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>45.90</vUnCom></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS></imposto>{extra}</det>'
def nfe(k, itens, proc=True, cstat="100"):
    n = f'<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe{k}" versao="4.00"><ide><nNF>{int(k[25:34])}</nNF><dhEmi>2026-10-01T10:00:00-03:00</dhEmi></ide><emit><CNPJ>99999999000199</CNPJ><xNome>FORNECEDOR FICTICIO LTDA</xNome></emit>{itens}</infNFe></NFe>'
    if not proc: return n
    return f'<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">{n.replace(" xmlns=\"http://www.portalfiscal.inf.br/nfe\"","")}<protNFe><infProt><cStat>{cstat}</cStat><nProt>135260000000001</nProt></infProt></protNFe></nfeProc>'
itens = (det(1, "FIC0001", "BOMBA DE OLEO FICTICIA", "84133090", "0100100", "5102") +
         det(2, "FIC0002", "CABECOTE FICTICIO 16V", "84099199", "0100200", "5102", extra="<infAdProd>fabricante: MARCA FICTICIA</infAdProd>"))
(P/"nfe_autorizada_101.xml").write_text(nfe(K1, itens), encoding="utf-8")
(P/"nfe_cancelada_102.xml").write_text(nfe(K2, det(1, "FIC0003", "JUNTA FICTICIA", "84841000", "", "5102")), encoding="utf-8")
(P/"evento_cancelamento_102.xml").write_text(f'<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento><chNFe>{K2}</chNFe><tpEvento>110111</tpEvento></infEvento></evento></procEventoNFe>', encoding="utf-8")
(P/"nfe_sem_protocolo_103.xml").write_text(nfe(K3, det(1, "FIC0004", "FILTRO FICTICIO", "84212300", "", "5102"), proc=False), encoding="utf-8")
(P/"resumo_101.xml").write_text(f'<resNFe xmlns="http://www.portalfiscal.inf.br/nfe"><chNFe>{K1}</chNFe><xNome>FORNECEDOR FICTICIO LTDA</xNome><cSitNFe>1</cSitNFe></resNFe>', encoding="utf-8")
(P/"malicioso_xxe.xml").write_text('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">&a;</nfeProc>', encoding="utf-8")
(P/"chave_dv_errado.xml").write_text(nfe(K1[:43] + str((int(K1[43]) + 1) % 10), det(1, "FIC0001", "X", "84133090", "", "5102")), encoding="utf-8")
print(K1, K2, K3)
