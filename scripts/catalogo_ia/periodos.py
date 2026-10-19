"""Confere os anos escritos no cadastro contra os eventos do veículo NO BRASIL (importação, comercialização, fim).
O carro não é fabricado aqui: lançamento mundial ou ano-modelo de outro mercado não provam o período de venda no Brasil."""

INICIO_BR = ("inicio_importacao", "inicio_comercializacao_br", "inicio_montagem_nacional")
FIM_BR = ("fim_importacao", "fim_comercializacao_br", "fim_montagem_nacional")


def confere_anos(anos: list[dict], eventos: list[dict] | None) -> list[str]:
    """anos: itens de extracao.anos_informados. eventos: [{'tipo', 'ano', 'fonte'}]; só valem eventos com fonte.
    Devolve pendências; lista vazia só quando todo ano informado está dentro do período comprovado no Brasil."""
    if not anos:
        return []
    validos = [e for e in (eventos or []) if e.get("fonte") and e.get("ano")]
    inicios = [e["ano"] for e in validos if e["tipo"] in INICIO_BR]
    fins = [e["ano"] for e in validos if e["tipo"] in FIM_BR]
    if not inicios:
        return ["ano informado sem evidência do início da importação/comercialização no Brasil: ano a confirmar"]
    pend = []
    ini_br, fim_br = min(inicios), (max(fins) if fins else None)
    for a in anos:
        if a["inicio"] < ini_br:
            pend.append(f"ano {a['inicio']} anterior ao início no Brasil ({ini_br}): conferir ano de fabricação x ano-modelo")
        limite = a["fim"] if a["fim"] is not None else (None if a["em_aberto"] else a["inicio"])
        if fim_br is not None and (limite is None or limite > fim_br):
            pend.append(f"período informado passa do fim comprovado no Brasil ({fim_br})")
    return pend
