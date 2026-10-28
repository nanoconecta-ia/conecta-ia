import unittest, json, tempfile
from pathlib import Path
import nfe_parser as N
F = Path(__file__).parent / "fixtures"
def lerx(n): return N.interpretar((F/n).read_bytes(), n)
class T(unittest.TestCase):
    def test_autorizada_campos(self):
        d = lerx("nfe_autorizada_101.xml"); self.assertEqual(d["situacao"], "autorizada"); self.assertTrue(d["chave_valida"])
        i = d["itens"][0]; self.assertEqual((i["ncm"], i["cest"], i["cfop"], i["codigo_fornecedor"], i["origem"], i["cst_csosn"]), ("84133090","0100100","5102","FIC0001","0","00"))
        self.assertEqual(d["itens"][1]["informacao_adicional_item"], "fabricante: MARCA FICTICIA")
        self.assertIsNone(d["itens"][0]["fabricante"])  # nunca inferido
    def test_sem_protocolo_nao_vale(self):
        d = lerx("nfe_sem_protocolo_103.xml"); self.assertEqual(d["situacao"], "sem_protocolo"); self.assertTrue(d["avisos"])
    def test_resumo_sem_itens(self):
        d = lerx("resumo_101.xml"); self.assertEqual(d["itens"], []); self.assertIn("SEM itens", d["avisos"][0])
    def test_cancelamento_invalida_nota(self):
        docs = N.reconciliar([lerx("nfe_cancelada_102.xml"), lerx("evento_cancelamento_102.xml"), lerx("nfe_autorizada_101.xml")])
        self.assertFalse(docs[0]["valida_para_uso"]); self.assertTrue(docs[2]["valida_para_uso"])
        self.assertEqual(docs[1]["evento"], "cancelamento")
    def test_dv_invalido_nao_vale(self):
        d = N.reconciliar([lerx("chave_dv_errado.xml")])[0]; self.assertFalse(d["chave_valida"]); self.assertFalse(d["valida_para_uso"])
    def test_xxe_rejeitado(self):
        with self.assertRaises(N.XmlInvalido): lerx("malicioso_xxe.xml")
    def test_malformado_e_tipo_desconhecido(self):
        with self.assertRaises(N.XmlInvalido): N.interpretar(b"<a><b></a>")
        with self.assertRaises(N.XmlInvalido): N.interpretar(b"<outro/>")
    def test_hash_estavel(self):
        raw = (F/"resumo_101.xml").read_bytes(); self.assertEqual(N.interpretar(raw)["sha256"], N.interpretar(raw)["sha256"])
    def test_proposta_diferenca_nao_aplica(self):
        i = lerx("nfe_autorizada_101.xml")["itens"][0]
        p = N.proposta_diferenca(i, {"sku": "CI000001", "ncm": "84139190", "cest": "0100100", "origem": "0", "cst_csosn": "00"})
        self.assertEqual(list(p["diferencas"]), ["ncm"]); self.assertEqual(p["estado"], "PROPOSTA"); self.assertFalse(p["aplicado"])
        self.assertIsNone(N.proposta_diferenca(i, {"sku": "X", "ncm": "84133090", "cest": "0100100", "origem": "0", "cst_csosn": "00"}))
    def test_exportacao(self):
        docs = N.reconciliar([lerx("nfe_autorizada_101.xml")]); 
        with tempfile.TemporaryDirectory() as t:
            N.exportar(docs, Path(t)); l = [json.loads(x) for x in (Path(t)/"itens.jsonl").read_text().splitlines()]
            self.assertEqual(len(l), 2); self.assertTrue((Path(t)/"itens.csv").exists())
if __name__ == "__main__": unittest.main()
