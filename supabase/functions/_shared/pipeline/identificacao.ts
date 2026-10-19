// Identificação determinística: marca da peça × montadora do veículo, e classe da peça (genuína/OEM/a confirmar) SEMPRE com evidência.
export const MONTADORAS = ["Hyundai", "Kia", "Toyota", "Mitsubishi", "Nissan", "Ford", "Fiat", "Volkswagen", "Chevrolet", "Mercedes-Benz"];
const semAcento = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function classeDaPeca(marca: string | null, texto: string, homologados: Record<string, string>) {
  const m = semAcento(marca ?? "").replace(/^marca\s*:\s*/, "");
  if (!m) return { classe: "a_confirmar", evidencia: null, pendencia: "marca ausente" };
  const declara = ["genuina", "genuino", "original hyundai", "original kia"].some((p) => semAcento(texto).includes(p));
  if (["hyundai", "kia", "mobis", "hyundai mobis"].includes(m) && declara) return { classe: "genuina", evidencia: `marca '${marca}' e o texto declara peça genuína`, pendencia: "confirmar no catálogo da montadora" };
  if (homologados[m]) return { classe: "oem", evidencia: homologados[m], pendencia: null };
  return { classe: "a_confirmar", evidencia: null, pendencia: `marca '${marca}' sem fonte que a classifique (OEM ou reposição)` };
}


export const montadorasCitadas = (texto: string): string[] => MONTADORAS.filter((m) => new RegExp(`(?<![A-Za-z])${m}(?![A-Za-z])`, "i").test(texto));
