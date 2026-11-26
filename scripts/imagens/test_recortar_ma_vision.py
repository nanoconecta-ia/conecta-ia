"""Teste local: python -m unittest discover -s scripts/imagens -p 'test_recortar_ma_vision.py'"""
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from recortar_ma_vision import processar

class RecorteTest(unittest.TestCase):
    def test_recorte_sem_ampliacao(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t)
            src = p / "origem.png"
            Image.new("RGBA", (300,200), (10,20,30,255)).save(src)
            r = processar(src,p/"out",(20,10,120,60),"teste","TESTE","referencia_epc")
            self.assertFalse(r["publicavel"])
            self.assertEqual(r["recorte_px"],[20,10,120,60])
            for v in r["derivados"]:
                self.assertEqual((v["largura"],v["altura"]),(100,50))
                with Image.open(p/"out"/v["arquivo"]) as im:
                    self.assertEqual(im.convert("RGBA").getpixel((0,0)),(10,20,30,255))
            with self.assertRaises(ValueError):
                processar(src,p/"invalid",(0,0,400,200),"teste","TESTE","icone_categoria")
