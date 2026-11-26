"""Recorte local MA Vision: somente arquivos autorizados; sem rede ou publicação.
Requer Python 3 e Pillow. Coordenadas em pixels da imagem após orientação EXIF.
Uso: python recortar_ma_vision.py origem.png destino --caixa 10 20 300 400
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000

def processar(origem, destino, caixa, fonte, referencia, finalidade):
    origem, destino = Path(origem), Path(destino)
    if origem.stat().st_size > 15 * 1024 * 1024:
        raise ValueError("Arquivo acima de 15 MB")
    with Image.open(origem) as arquivo:
        if arquivo.format not in {"JPEG", "PNG", "WEBP"} or getattr(arquivo, "n_frames", 1) != 1:
            raise ValueError("Formato ou número de quadros não suportado")
        if arquivo.width * arquivo.height > 40_000_000:
            raise ValueError("Resolução acima do limite")
        img = ImageOps.exif_transpose(arquivo).convert("RGBA")
    x0,y0,x1,y1 = caixa if caixa is not None else (0,0,img.width,img.height)
    if not (0 <= x0 < x1 <= img.width and 0 <= y0 < y1 <= img.height):
        raise ValueError("Recorte fora da imagem")
    parte = img.crop((x0,y0,x1,y1))
    destino.mkdir(parents=True, exist_ok=False)
    # Sem deformação, remoção de marca, preenchimento por IA ou ampliação.
    saidas = []
    for nome, limite, formato in [("mestre", None, "PNG"), ("icone", 256, "WEBP"), ("lista", 400, "WEBP"), ("detalhe", 1200, "WEBP")]:
        v = parte.copy()
        if limite:
            v.thumbnail((limite, limite), Image.Resampling.LANCZOS)
        caminho = destino / (nome + "." + formato.lower())
        v.save(caminho, format=formato, **({"lossless": True} if formato == "WEBP" else {}))
        saidas.append({"arquivo": caminho.name, "largura": v.width, "altura": v.height,
                       "sha256": hashlib.sha256(caminho.read_bytes()).hexdigest()})
    registro = {"fonte": fonte, "referencia": referencia, "finalidade": finalidade,
                "origem_sha256": hashlib.sha256(origem.read_bytes()).hexdigest(),
                "recorte_px": [x0,y0,x1,y1], "status": "pendente_revisao",
                "publicavel": False, "derivados": saidas}
    (destino / "manifesto.json").write_text(json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
    return registro

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("origem")
    p.add_argument("destino")
    p.add_argument("--caixa", nargs=4, type=int)
    p.add_argument("--fonte", required=True)
    p.add_argument("--referencia", required=True)
    p.add_argument("--finalidade", choices=["icone_categoria","referencia_epc","foto_produto"], required=True)
    a = p.parse_args()
    print(json.dumps(processar(a.origem, a.destino, a.caixa, a.fonte, a.referencia, a.finalidade), ensure_ascii=False))
