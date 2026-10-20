// Vistas explodidas por área da taxonomia. Cada ponto numerado leva a uma subcategoria (slug). Coordenadas no viewBox do desenho.
// O desenho em si fica em assets/vista-<arquivo>.svg; aqui só os dados, para a loja e o painel clicarem nos números.

export type Ponto = { n: number; x: number; y: number; rotulo: string; slug: string };
export type Vista = { area: string; arquivo: "motor" | "suspensao" | "freios" | "embreagem"; titulo: string; largura: number; altura: number; pontos: Ponto[] };

export const VISTAS: Vista[] = [
  { area: "motor", arquivo: "motor", titulo: "Motor", largura: 760, altura: 720, pontos: [
    { n: 1, x: 572, y: 111, rotulo: "Juntas e retentores", slug: "juntas-retentores" },
    { n: 2, x: 572, y: 223, rotulo: "Cabeçote e válvulas", slug: "cabecote-valvulas" },
    { n: 3, x: 572, y: 399, rotulo: "Pistões e anéis", slug: "pistoes-aneis" },
    { n: 4, x: 572, y: 455, rotulo: "Motor completo", slug: "motor" },
    { n: 5, x: 572, y: 628, rotulo: "Bomba de óleo", slug: "bomba-oleo" },
  ] },
  { area: "suspensao-direcao", arquivo: "suspensao", titulo: "Suspensão", largura: 200, altura: 360, pontos: [
    { n: 1, x: 20, y: 22, rotulo: "Coxim", slug: "buchas-batentes" },
    { n: 2, x: 20, y: 60, rotulo: "Rolamento do coxim", slug: "buchas-batentes" },
    { n: 3, x: 20, y: 118, rotulo: "Coifa e batente", slug: "buchas-batentes" },
    { n: 4, x: 20, y: 206, rotulo: "Mola", slug: "molas" },
    { n: 5, x: 20, y: 312, rotulo: "Amortecedor", slug: "amortecedores" },
  ] },
  { area: "freios", arquivo: "freios", titulo: "Freios", largura: 200, altura: 360, pontos: [
    { n: 1, x: 20, y: 36, rotulo: "Cubo", slug: "freios" },
    { n: 2, x: 20, y: 94, rotulo: "Disco", slug: "discos" },
    { n: 3, x: 20, y: 160, rotulo: "Pastilha interna", slug: "pastilhas" },
    { n: 4, x: 20, y: 224, rotulo: "Pinça", slug: "cilindros-flexiveis" },
    { n: 5, x: 20, y: 294, rotulo: "Pastilha externa", slug: "pastilhas" },
  ] },
  { area: "embreagem-transmissao", arquivo: "embreagem", titulo: "Embreagem", largura: 200, altura: 360, pontos: [
    { n: 1, x: 20, y: 44, rotulo: "Volante do motor", slug: "embreagem-transmissao" },
    { n: 2, x: 20, y: 126, rotulo: "Disco de embreagem", slug: "kits-embreagem" },
    { n: 3, x: 20, y: 202, rotulo: "Platô", slug: "kits-embreagem" },
    { n: 4, x: 20, y: 292, rotulo: "Rolamento", slug: "rolamentos" },
  ] },
];

/** Vista da área (slug raiz da taxonomia); undefined se a área ainda não tem desenho. */
export function vistaDaArea(slug: string | null | undefined): Vista | undefined {
  return VISTAS.find((v) => v.area === (slug ?? ""));
}

/** Posição do ponto em % do desenho, para sobrepor botões clicáveis sem depender do tamanho em pixels. */
export function posicaoPct(v: Vista, p: Ponto): { left: string; top: string } {
  const pct = (parte: number, total: number) => `${Math.round((parte / total) * 10000) / 100}%`;
  return { left: pct(p.x, v.largura), top: pct(p.y, v.altura) };
}
