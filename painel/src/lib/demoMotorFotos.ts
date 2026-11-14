// Fotos do exemplo (separadas para os testes de dados não importarem imagens).
// Exemplo FIXO (SIMULAÇÃO) do motor parcial HR 8 válvulas, a partir das 5 fotos do próprio lojista (14/11/2026).
// Só entra aqui o que as fotos mostram ou o lojista informou. SKU, código do motor e aplicação seguem "a confirmar".
import f1g from "../assets/demo/motor-hr-8v/foto1-640.webp";
import f2g from "../assets/demo/motor-hr-8v/foto2-640.webp";
import f3g from "../assets/demo/motor-hr-8v/foto3-640.webp";
import f4g from "../assets/demo/motor-hr-8v/foto4-640.webp";
import f5g from "../assets/demo/motor-hr-8v/foto5-640.webp";
import f1p from "../assets/demo/motor-hr-8v/foto1-96.webp";
import f2p from "../assets/demo/motor-hr-8v/foto2-96.webp";
import f3p from "../assets/demo/motor-hr-8v/foto3-96.webp";
import f4p from "../assets/demo/motor-hr-8v/foto4-96.webp";
import f5p from "../assets/demo/motor-hr-8v/foto5-96.webp";

export type FotoDemo = { grande: string; mini: string; legenda: string };
export const FOTOS_MOTOR: readonly FotoDemo[] = [
  { grande: f1g, mini: f1p, legenda: "vista frontal" },
  { grande: f2g, mini: f2p, legenda: "lado 1" },
  { grande: f3g, mini: f3p, legenda: "lado 2 (virabrequim)" },
  { grande: f4g, mini: f4p, legenda: "face do cabeçote" },
  { grande: f5g, mini: f5p, legenda: "cabeçote visto de cima" },
];

