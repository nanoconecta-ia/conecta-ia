import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** QR Code em SVG, desenhado módulo a módulo (sem innerHTML). Sempre escuro sobre branco, em qualquer tema, para leitura confiável. */
export function QrCode({ texto, rotulo }: { texto: string; rotulo: string }) {
  const modulos = useMemo(() => {
    const qr = qrcode(0, "M"); // tamanho automático, correção de erro média
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    const escuros: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) escuros.push([r, c]);
    return { n, escuros };
  }, [texto]);
  const margem = 4;
  const tam = modulos.n + margem * 2;
  return (
    <svg className="qr" viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={rotulo} shapeRendering="crispEdges">
      <rect width={tam} height={tam} fill="#fff" />
      {modulos.escuros.map(([r, c]) => <rect key={`${r}-${c}`} x={c + margem} y={r + margem} width={1} height={1} fill="#000" />)}
    </svg>
  );
}
