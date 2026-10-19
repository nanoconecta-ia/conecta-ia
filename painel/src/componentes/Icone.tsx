// Ícones de traço (24×24, currentColor): um por grupo do menu. Sem biblioteca externa nem cor solta.
const CAMINHOS: Record<string, string> = {
  comando: "M3 12l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  catalogo: "M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4",
  agentes: "M12 3a4 4 0 014 4v1h1a3 3 0 013 3v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4a3 3 0 013-3h1V7a4 4 0 014-4zM9.5 13v1.5M14.5 13v1.5",
  loja: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0M9 20v-6h6v6",
  erp: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  outros: "M5 12h.01M12 12h.01M19 12h.01",
  busca: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3",
  recolher: "M15 6l-6 6 6 6",
};

export function Icone({ nome, tamanho = 20 }: { nome: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={CAMINHOS[nome] ?? CAMINHOS.outros} />
    </svg>
  );
}
