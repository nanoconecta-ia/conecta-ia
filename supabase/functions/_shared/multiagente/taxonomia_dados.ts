// Árvore fechada (espelho de scripts/catalogo_ia/dados/taxonomia.json e da semente da migração; os testes conferem os dois).
export type Taxonomia = Record<string, Record<string, string[]>>;
const TAXONOMIA: Taxonomia = {
  "Motor": {
    "Componentes do Cabeçote": ["Cabeçote Completo", "Comando", "Válvulas", "Tuchos"],
    "Bloco e Parte Baixa": ["Bloco Completo", "Virabrequim", "Bielas", "Pistões com Anéis"],
    "Juntas e Vedação": ["Jogo de Juntas", "Junta de Cabeçote", "Junta Coletor", "Retentores"],
    "Distribuição e Sincronismo": ["Kit Corrente", "Correia Dentada", "Tensores", "Polias"],
  },
  "Injeção e Alimentação": { "Sistema Common Rail": ["Bico Injetor", "Bomba de Alta Pressão", "Flauta", "Válvula DRV"], "Turboalimentação": ["Turbina Completa", "Conjunto Rotativo", "Válvula Wastegate"] },
  "Arrefecimento": { "Circulação e Controle": ["Bomba d'Água", "Válvula Termostática", "Radiador", "Hélice Viscosa"] },
  "Suspensão e Freios": { "Articulações e Hidráulica": ["Bandeja", "Pivô", "Servo Freio", "Bomba de Vácuo", "Pinça"] },
};
export const carregarTaxonomia = (): Taxonomia => TAXONOMIA;
export const taxonomiaValida = (t: Taxonomia, s: string, sub: string, f: string): boolean => (t[s]?.[sub] ?? []).includes(f);
