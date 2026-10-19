import json
import re
import unittest
from pathlib import Path

from scripts.catalogo_ia.classificacao import carregar_taxonomia, classe_da_peca, taxonomia_valida
from scripts.catalogo_ia.cli import processar
from scripts.catalogo_ia.extracao import anos_informados, extrair
from scripts.catalogo_ia.periodos import confere_anos
from scripts.catalogo_ia.llm import extrair_com_llm
from scripts.catalogo_ia.oem import candidatos_oem, gtin_valido

# Descrição REAL do SKU 80692 lido do Bling (somente leitura) em 2026-10-19.
DESC_80692 = ("<p>APLICAçãO: Hyundai HR 2.5 16V Turbo Diesel D4CB Euro V (2013+) e Kia Bongo K2500 2.5 16V Turbo Diesel D4CB Euro V (2013+). "
              "Jogo completo de juntas e vedação do motor com retentores e junta de cabeçote. Códigos OEM/Cruzados: SABó 80692, 20910-4AU07, 15105605RS. "
              "Procedência Nacional (Garantidor: SABó). NãO SE APLICA: Motores 2.5 8V Euro III D4BH/4D56 até 2012.</p>")
NOME_80692 = "Jogo de Juntas Completo do Motor HR / K2500 2.5 16V D4CB Euro 5 c/ Retentores SABó"


class Oem(unittest.TestCase):
    def test_normaliza_formatos_sujos(self):
        for bruto in ("31922 4H001", "31922.4H001", "319224h001", "31922-4h001"):
            self.assertEqual([c.normalizado for c in candidatos_oem(f"codigo {bruto}")], ["31922-4H001"], bruto)

    def test_mesma_forma_sem_separador_nem_rotulo_tem_confianca_baixa(self):
        c = {x.normalizado: x for x in candidatos_oem("Códigos: 20910-4AU07, 15105605RS")}
        self.assertEqual(c["20910-4AU07"].confianca, "media")  # tem separador
        self.assertEqual(c["15105-605RS"].confianca, "baixa")  # mesma forma, sem separador nem rótulo

    def test_rotulo_ou_separador(self):
        self.assertEqual(candidatos_oem("OEM 20910-4AU07")[0].confianca, "media")
        self.assertEqual(candidatos_oem("cod 411004h000")[0].confianca, "baixa")

    def test_gtin(self):
        self.assertTrue(gtin_valido("7891252806921"))   # GTIN real do SKU 80692
        self.assertFalse(gtin_valido("7891252806922"))
        self.assertFalse(gtin_valido("78912"))

    def test_gtin_nao_vira_codigo_oem(self):
        self.assertEqual(candidatos_oem("GTIN 7891252806921 NCM 8484.90.00"), [])


class Extracao(unittest.TestCase):
    def setUp(self):
        self.e = extrair("80692", NOME_80692, DESC_80692, "SABó", "7891252806921")

    def test_anos_nao_sao_expandidos(self):
        anos = self.e["aplicacao"]["anos_informados"]
        self.assertIn({"inicio": 2013, "fim": None, "em_aberto": True, "trecho": "2013+"}, anos)
        self.assertTrue(all(a["inicio"] in (2012, 2013) for a in anos))
        self.assertEqual(anos_informados("ano 2014"), [{"inicio": 2014, "fim": None, "em_aberto": False, "trecho": "2014"}])

    def test_motor_emissao_veiculos_como_escritos(self):
        ap = self.e["aplicacao"]
        self.assertEqual(ap["motores"], ["D4CB", "D4BH", "4D56"])
        self.assertEqual(ap["emissoes"], ["Euro 5", "Euro 3"])
        for v in ("Hyundai", "Kia", "HR", "K2500", "Bongo"):
            self.assertIn(v, ap["veiculos_citados"])
        self.assertNotIn("Sorento", ap["veiculos_citados"])

    def test_nao_se_aplica_literal(self):
        self.assertTrue(self.e["nao_se_aplica"].startswith("Motores 2.5 8V Euro III D4BH/4D56"))

    def test_codigos_do_cadastro(self):
        cods = {c["normalizado"]: c["confianca"] for c in self.e["codigos_oem"]}
        self.assertIn("20910-4AU07", cods)
        self.assertEqual(cods.get("15105-605RS"), "baixa")  # código Sabó com a mesma forma: não é confirmado como Hyundai


class Periodos(unittest.TestCase):
    ANO = [{"inicio": 2013, "fim": None, "em_aberto": True, "trecho": "2013+"}]

    def test_sem_evento_o_ano_fica_a_confirmar(self):
        self.assertTrue(any("sem evidência" in p for p in confere_anos(self.ANO, None)))
        self.assertTrue(any("sem evidência" in p for p in confere_anos(self.ANO, [{"tipo": "lancamento_mundial", "ano": 2011, "fonte": "x"}])))

    def test_evento_sem_fonte_nao_conta(self):
        self.assertTrue(confere_anos(self.ANO, [{"tipo": "inicio_importacao", "ano": 2012}]))

    def test_ano_anterior_ao_inicio_no_brasil(self):
        p = confere_anos(self.ANO, [{"tipo": "inicio_comercializacao_br", "ano": 2014, "fonte": "doc"}])
        self.assertTrue(any("anterior ao início no Brasil (2014)" in x for x in p))

    def test_dentro_do_periodo_comprovado(self):
        ev = [{"tipo": "inicio_importacao", "ano": 2012, "fonte": "doc"}]
        self.assertEqual(confere_anos(self.ANO, ev), [])

    def test_aberto_passa_do_fim(self):
        ev = [{"tipo": "inicio_importacao", "ano": 2012, "fonte": "d"}, {"tipo": "fim_importacao", "ano": 2020, "fonte": "d"}]
        self.assertTrue(any("passa do fim" in x for x in confere_anos(self.ANO, ev)))

    def test_pipeline_marca_pendencia_de_ano(self):
        s = processar([{"sku": "80692", "nome": "x", "descricao": "Hyundai HR D4CB (2013+)", "marca": "SABó"}])[0]
        self.assertTrue(any("sem evidência do início" in p for p in s["pendencias"]))


class Classe(unittest.TestCase):
    def test_sem_fonte_nao_classifica(self):
        r = classe_da_peca("Valeo", "kit embreagem valeo original do carro", {})
        self.assertEqual(r["classe"], "a_confirmar")
        self.assertEqual(classe_da_peca("Sabó", "x", {})["classe"], "a_confirmar")

    def test_oem_so_com_marca_homologada_com_fonte(self):
        self.assertEqual(classe_da_peca("Valeo", "x", {"valeo": "lista X, doc Y"})["classe"], "oem")

    def test_genuina_exige_marca_da_montadora_e_declaracao(self):
        self.assertEqual(classe_da_peca("Hyundai", "peça original Hyundai", {})["classe"], "genuina")
        self.assertEqual(classe_da_peca("Fremax", "peça original Hyundai", {})["classe"], "a_confirmar")


class Taxonomia(unittest.TestCase):
    def test_lista_fechada_espelha_a_migracao(self):
        sql = Path("supabase/migrations/20261019000002_sistemas_e_documentacao_tecnica.sql").read_text(encoding="utf-8")
        for s, subs in carregar_taxonomia().items():
            self.assertIn(f"'{s}'", sql)
            for sub, fams in subs.items():
                self.assertIn(f"'{sub}'", sql)
                for f in fams:
                    self.assertIn(f.replace("'", "''"), sql)

    def test_validacao(self):
        self.assertTrue(taxonomia_valida("Motor", "Juntas e Vedação", "Jogo de Juntas"))
        self.assertFalse(taxonomia_valida("Hyundai", "HR", "Motor"))


class Pipeline(unittest.TestCase):
    def test_proposta_do_80692(self):
        s = processar([{"sku": "80692", "nome": NOME_80692, "descricao": DESC_80692, "marca": "SABó", "gtin": "7891252806921"}])[0]
        self.assertEqual(s["status"], "a_confirmar")
        self.assertEqual(s["classe_peca"]["classe"], "a_confirmar")
        self.assertEqual(s["referencias_cruzadas"], [])
        self.assertTrue(any("taxonomia não atribuída" in p for p in s["pendencias"]))
        self.assertNotIn("texto_fonte", s)

    def test_sem_descricao_nao_inventa(self):
        s = processar([{"sku": "CI001086", "nome": "BOMBA OLEO HR/K2500 2.5 16V 13/ D4CB EURO V", "descricao": "", "marca": " MARCA: TRIM GO"}])[0]
        self.assertEqual(s["codigos_oem"], [])
        self.assertIsNone(s["nao_se_aplica"])
        self.assertIn("sem bloco NÃO SE APLICA", s["pendencias"])


class Llm(unittest.TestCase):
    def test_saida_inventada_e_descartada(self):
        fonte = f"{NOME_80692}. D4CB Euro V (2013+) 20910-4AU07. NÃO SE APLICA: Motores 2.5 8V D4BH."
        falso = json.dumps({"codigos_oem": ["20910-4AU07", "33800-4A500"], "taxonomia": {"sistema": "Hyundai", "subsistema": "HR", "familia": "Motor"},
                            "aplicacao": {"anos": [2013, 2014, 2021], "motores": ["D4CB", "D4BB"]}, "nao_se_aplica": "serve em tudo", "extra": 1})
        limpa, avisos = extrair_com_llm(fonte, lambda s, u: f"```json\n{falso}\n```")
        self.assertEqual(limpa["codigos_oem"], ["20910-4AU07"])
        self.assertNotIn("taxonomia", limpa)
        self.assertEqual(limpa["aplicacao"], {"anos": [2013], "motores": ["D4CB"]})
        self.assertNotIn("nao_se_aplica", limpa)
        self.assertTrue(len(avisos) >= 5)

    def test_resposta_que_nao_e_json(self):
        limpa, avisos = extrair_com_llm("x", lambda s, u: "não sei")
        self.assertEqual(limpa, {})
        self.assertTrue(avisos)

    def test_taxonomia_valida_passa(self):
        fonte = "Jogo de juntas do motor"
        ok = json.dumps({"taxonomia": {"sistema": "Motor", "subsistema": "Juntas e Vedação", "familia": "Jogo de Juntas"}})
        limpa, _ = extrair_com_llm(fonte, lambda s, u: ok)
        self.assertEqual(limpa["taxonomia"]["familia"], "Jogo de Juntas")


if __name__ == "__main__":
    unittest.main()
