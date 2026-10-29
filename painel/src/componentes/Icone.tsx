// Ícones de traço (24×24, currentColor): um por grupo do menu. Sem biblioteca externa nem cor solta.
const CAMINHOS: Record<string, string> = {
  inicio: "M3 10.5 12 3l9 7.5V21H3V10.5M9 21v-7h6v7",
  conversa: "M4 5h16v12H9l-5 4zM8 10h8M8 14h5",
  escudo: "M12 2l8 4v6c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-4zM9 12l2 2 4-4",
  grafico: "M4 20V4M4 20h16M8 16v-5M13 16V7M18 16v-9",
  caixas: "M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4",
  ajustes: "M4 7h16M4 17h16M8 4v6M16 14v6",
  fila: "M4 5h16M4 10h16M4 15h10M4 20h7",
  arvore: "M12 3v4M5 12h14M5 12v5M12 7v5M19 12v5M3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z",
  paleta: "M12 3a9 9 0 109 9h-4a2 2 0 01-2-2 2 2 0 012-2h2A9 9 0 0012 3zM7.5 11h.01M11 7.5h.01M14.5 8h.01",
  cartao: "M3 6h18v12H3zM3 11h18M7 15h4",
  conexoes: "M7 7h5M12 7l-2-2M12 7l-2 2M17 17h-5M12 17l2-2M12 17l2 2M4 4h16v16H4z",
  rede: "M12 3v6M6 12l6-3 6 3M6 12v7M18 12v7M3 19h6M15 19h6",
  imagem: "M3 4h18v16H3zM7 9h.01M3 17l6-6 4 4 3-3 5 5",
  arquivo: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  monitor: "M3 4h18v14H3zM8 22h8M12 18v4",
  menu: "M4 6h16M4 12h16M4 18h16",
  fechar: "M5 5l14 14M19 5 5 19",
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
