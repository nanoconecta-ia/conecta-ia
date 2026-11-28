// Biblioteca universal MA Display — registro puro, versionado e testável.
// Contrato documental da Matriz Mestra (anexo 27/11/2026): identidade semântica estável
// (icon_id, tipo de nó, versão) separada da apresentação (geometria, variante, acabamento).
// O ícone ORIENTA a navegação; nunca autoriza ação, prova aplicação, OEM, SKU ou compatibilidade.
// Logos e lettering oficiais de montadoras NÃO são redesenhados: montadora usa selo textual.
// Estado "candidato": geometria entregue para revisão do lojista; não é ativo homologado
// até aprovação registrada fora deste módulo.
import { RAIZES, type Raiz } from "../../../supabase/functions/_shared/nano_lifecycle/matriz_mestra.ts";

export const VERSAO_BIBLIOTECA_MA = "1.0.0";

/** Paleta MA Display (tokens Mobis M-STYLE V3 + azul tecnológico). */
export const PALETA_MA = {
  grafite: "#1F2327",
  vermelho: "#E2181A",
  cinza: "#BFC3C7",
  aco: "#A6A6A6",
  branco: "#FFFFFF",
  gelo: "#EAF2F6",
  azul: "#1C8DF2",
} as const;

export const VARIANTES_MA = ["grafite", "vermelho", "aco", "azul", "branco", "gelo"] as const;
export type VarianteMA = (typeof VARIANTES_MA)[number];

/** Tipos de nó aceitos (TipoVisualNo de projecoes.ts + raízes, módulos e identidades). */
export const TIPOS_NO_MA = [
  "raiz", "modulo", "montadora", "modelo", "geracao", "carroceria", "motor", "tracao", "combustivel", "propulsao",
  "sistema", "componente", "categoria", "ano", "mercado", "oem", "sku", "aplicacao", "epc", "veiculo",
] as const;
export type TipoNoMA = (typeof TIPOS_NO_MA)[number];

export interface IconeMA {
  /** Chave única e estável. Nunca reutilizar para outro conceito. */
  id: string;
  rotulo: string;
  conceito: string;
  versao: string;
  /** Tipos de nó aos quais o ícone pode ser vinculado. */
  vinculos: readonly TipoNoMA[];
  /** Traço técnico principal, grade 24×24, contorno uniforme. */
  d: string;
  /** Detalhe de acento vermelho MA (opcional). Mesma grade. */
  acento?: string;
  estado: "candidato" | "homologado" | "revogado";
}

const c = (id: string, rotulo: string, conceito: string, vinculos: readonly TipoNoMA[], d: string, acento?: string): IconeMA =>
  ({ id, rotulo, conceito, versao: VERSAO_BIBLIOTECA_MA, vinculos, d, acento, estado: "candidato" });

// ——— Geometria (grade 24, traço 1.75, cantos arredondados) ———
export const ICONES_MA: readonly IconeMA[] = [
  // 12 raízes da Matriz Mestra
  c("raiz.erp", "Identidade ERP", "Cadastro físico de origem (Bling)", ["raiz"],
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3", "M9 18v-2M12 18v-3M15 18v-2"),
  c("raiz.lifecycle", "Nano Lifecycle", "Eventos, versões e tarefas", ["raiz"],
    "M20 12a8 8 0 01-14.3 4.9M4 12a8 8 0 0114.3-4.9M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2", "M12 9v3l2 1.5"),
  c("raiz.engineering", "Nano Engineering", "Relações técnicas com evidência", ["raiz"],
    "M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8", "M12 11v2"),
  c("raiz.taxonomy", "Nano Taxonomy", "Nós, arestas e versões", ["raiz"],
    "M10 3h4v4h-4zM3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4zM12 7v5M5 17v-3h14v3M12 12v5", "M12 12h.01"),
  c("raiz.visual", "Nano Visual Studio", "Mídia, licença e vínculo", ["raiz"],
    "M3 8h4l2-3h6l2 3h4v12H3zM12 10.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z", "M18 11h.01"),
  c("raiz.commercial", "Nano Commercial", "Consulta, cotação e minuta", ["raiz"],
    "M3 12l4-4h4l2 2-3 3 2 2 3-3 4 4-3 3H9l-6-6zM14 8l2-2h5", "M17 15l2 2"),
  c("raiz.supplier", "Nano Supplier", "Ofertas de fornecedor autorizadas", ["raiz"],
    "M2 7h11v9H2zM13 10h4l3 3v3h-7M6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z", "M5 10h5"),
  c("raiz.radar", "Nano Radar", "Observação de mudanças", ["raiz"],
    "M12 3a9 9 0 109 9M12 7a5 5 0 105 5M12 12l6-6", "M12 12h.01M17 8.5h.01"),
  c("raiz.seo", "Nano SEO", "Página de aplicação indexável", ["raiz"],
    "M10.5 3.5a7 7 0 110 14 7 7 0 010-14zM20.5 20.5l-5-5M4 10.5h13M10.5 3.5c-2 2-2 12 0 14M10.5 3.5c2 2 2 12 0 14", undefined),
  c("raiz.vitrine", "Vitrine Mobis", "Projeção pública SKU × aplicação", ["raiz"],
    "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M9 20v-6h6v6", "M3 9h18"),
  c("raiz.analytics", "Nano Analytics", "Métrica com fonte e janela", ["raiz"],
    "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6", "M7 9l4-3 4 2 4-4"),
  c("raiz.auditor", "Nano Auditor", "Verificação independente de gates", ["raiz"],
    "M12 2l8 4v6c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-4z", "M8.5 12l2.5 2.5 4.5-5"),

  // Módulos do painel (substituem o atlas histórico)
  c("modulo.inicio", "Início", "Painel inicial", ["modulo"], "M3 10.5 12 3l9 7.5V21H3V10.5M9 21v-7h6v7", "M12 3l9 7.5"),
  c("modulo.nano", "Nano.IA", "Estúdio e agente", ["modulo"],
    "M12 3a4 4 0 014 4v1h1a3 3 0 013 3v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4a3 3 0 013-3h1V7a4 4 0 014-4z", "M9.5 13v1.5M14.5 13v1.5"),
  c("modulo.robo", "Assistente", "Agente operacional", ["modulo"],
    "M6 8h12v10H6zM12 4v4M9 21v-3M15 21v-3M3 12v3M21 12v3", "M9.5 12h.01M14.5 12h.01"),
  c("modulo.olho", "Observação", "Visão do agente", ["modulo"], "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 110 6 3 3 0 010-6z", "M12 12h.01"),
  c("modulo.catalogo", "Catálogo", "Catálogo inteligente", ["modulo"], "M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4", "M12 11v10"),
  c("modulo.matriz", "Matriz", "Matriz e taxonomia", ["modulo"], "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z", "M10 6.5h4M6.5 10v4"),
  c("modulo.taxonomia", "Taxonomia", "Árvore de categorias", ["modulo"], "M12 3v4M5 12h14M5 12v5M12 7v5M19 12v5M3 17h4v4H3zM10 17h4v4h-4zM17 17h4v4h-4z", "M10 3h4"),
  c("modulo.revisao", "Revisão", "Fila de revisão humana", ["modulo"], "M4 5h16M4 10h16M4 15h9M4 20h6", "M15 18l2 2 4-4"),
  c("modulo.historico", "Histórico", "Registro auditável", ["modulo"], "M12 4a8 8 0 11-8 8M4 4v5h5M12 8v4l3 2", undefined),
  c("modulo.ajustes", "Ajustes", "Preferências", ["modulo"], "M4 7h16M4 17h16M8 4v6M16 14v6", "M8 7h.01M16 17h.01"),
  c("modulo.grafico", "Indicadores", "Dashboards medidos", ["modulo"], "M4 20V4M4 20h16M8 16v-5M13 16V7M18 16v-9", undefined),
  c("modulo.imagens", "Imagens", "Mídia e SEO", ["modulo"], "M3 4h18v16H3zM3 17l6-6 4 4 3-3 5 5", "M8 9h.01"),
  c("modulo.web", "Web", "Pesquisa autorizada", ["modulo"], "M12 3a9 9 0 110 18 9 9 0 010-18zM3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18", undefined),
  c("modulo.contexto", "Espelho do ERP", "Espelho somente leitura", ["modulo"], "M4 4h7v16H4zM13 4h7v16h-7z", "M7.5 8h.01M16.5 8h.01"),

  // Identidades semânticas (dimensões distintas — nunca inferidas pelo ícone)
  c("tipo.montadora", "Montadora", "Fabricante do veículo", ["montadora"], "M3 21V10l5 3V10l5 3V6l8-3v18zM3 21h18", "M16 10h2M16 14h2"),
  c("tipo.modelo", "Modelo", "Modelo de veículo", ["modelo"], "M3 15l2-5h10l4 5v3H3zM7 18a2 2 0 100 4 2 2 0 000-4zM16 18a2 2 0 100 4 2 2 0 000-4z", "M5 10h10"),
  c("tipo.geracao", "Geração", "Geração / fase do modelo", ["geracao"], "M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5", "M12 12v9"),
  c("tipo.carroceria", "Carroceria", "Carroceria / baú (não identifica motor)", ["carroceria"], "M2 6h12v10H2zM14 10h4l3 3v3h-7", "M2 11h12"),
  c("tipo.motor", "Motor", "Código de motor", ["motor"], "M5 9h3V6h6v3h3l2 2v6h-2v2H8l-3-3zM2 11v4M5 12H2", "M10 6V4h3"),
  c("tipo.tracao", "Tração", "Configuração de tração (4x2 ≠ eixo motriz implícito)", ["tracao"], "M4 6a2 2 0 100 4 2 2 0 000-4zM20 6a2 2 0 100 4 2 2 0 000-4zM4 14a2 2 0 100 4 2 2 0 000-4zM20 14a2 2 0 100 4 2 2 0 000-4zM6 8h12M6 16h12M12 8v8", "M12 12h.01"),
  c("tipo.combustivel", "Combustível", "Combustível declarado", ["combustivel"], "M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h2.5a1.5 1.5 0 011.5 1.5V17a1.5 1.5 0 003 0V8l-3-3", "M6 7h6"),
  c("tipo.propulsao", "Propulsão", "Propulsão (elétrica, híbrida, combustão)", ["propulsao"], "M13 2L4 14h7l-1 8 9-12h-7z", undefined),
  c("tipo.sistema", "Sistema", "Sistema do veículo", ["sistema"], "M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5zM10 7.5h4M7.5 10v4M16.5 10v4M10 16.5h4", undefined),
  c("tipo.componente", "Componente", "Componente técnico", ["componente"], "M12 2l8.7 5v10L12 22l-8.7-5V7zM12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z", undefined),
  c("tipo.categoria", "Categoria", "Categoria da taxonomia", ["categoria"], "M3 6h7l2 2h9v11H3z", "M3 10h18"),
  c("tipo.ano", "Ano", "Ano / período de aplicação", ["ano"], "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4", "M8 13h3M8 16h6"),
  c("tipo.mercado", "Mercado", "Mercado (BR e outros)", ["mercado"], "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z", "M12 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"),
  c("tipo.oem", "OEM", "Código original por aplicação", ["oem"], "M3 5v14M6 5v14M9 5v14M12 5v14M15 5v14M18 5v14M21 5v14", "M3 21h18"),
  c("tipo.sku", "SKU", "Identidade física do ERP", ["sku"], "M3 3h8l10 10-8 8L3 11zM7.5 6a1.5 1.5 0 110 3 1.5 1.5 0 010-3z", "M11 13l3 3"),
  c("tipo.aplicacao", "Aplicação", "Aplicação homologada peça × veículo", ["aplicacao"], "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1", undefined),
  c("tipo.epc", "EPC", "Catálogo eletrônico por figura", ["epc"], "M4 4h6v6H4zM14 14h6v6h-6zM10 7h4v7M7 10v7h7", "M14 4h6M4 20h6"),

  // Sistemas / categorias técnicas (vinculados pelo slug real da taxonomia)
  c("sistema.motor", "Motor", "Sistema motor", ["sistema", "categoria"], "M5 9h3V6h6v3h3l2 2v6h-2v2H8l-3-3zM2 11v4M5 12H2", "M10 6V4h3"),
  c("sistema.suspensao", "Suspensão e direção", "Sistema de suspensão", ["sistema", "categoria"], "M12 2v3M12 19v3M8 5h8M8 19h8M9 8l6 2-6 2 6 2-6 2", undefined),
  c("sistema.freios", "Freios", "Sistema de freio", ["sistema", "categoria"], "M12 3a9 9 0 110 18 9 9 0 010-18zM12 8a4 4 0 110 8 4 4 0 010-8z", "M19 7l2-1.5M19.5 12H22"),
  c("sistema.filtros", "Filtros", "Filtragem", ["sistema", "categoria"], "M6 3h12v4H6zM7 7h10v12a2 2 0 01-2 2H9a2 2 0 01-2-2zM10 10v8M14 10v8", undefined),
  c("sistema.eletrica", "Elétrica e ignição", "Sistema elétrico", ["sistema", "categoria"], "M3 8h18v12H3zM7 8V5h3v3M14 8V5h3v3", "M7 14h3M15.5 12.5v3M14 14h3"),
  c("sistema.arrefecimento", "Arrefecimento", "Sistema de arrefecimento", ["sistema", "categoria"], "M4 4h16v16H4zM8 4v16M12 4v16M16 4v16", "M4 12h16"),
  c("sistema.escapamento", "Escapamento", "Sistema de escape", ["sistema", "categoria"], "M2 10h4l2-2h8a3 3 0 010 6H8l-2-2H2zM19 11h3", undefined),
  c("sistema.transmissao", "Embreagem e transmissão", "Transmissão", ["sistema", "categoria"], "M12 6a6 6 0 110 12 6 6 0 010-12zM12 2v4M12 18v4M2 12h4M18 12h4", "M12 10a2 2 0 110 4 2 2 0 010-4z"),
  c("sistema.iluminacao", "Iluminação", "Iluminação", ["sistema", "categoria"], "M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5V16h8v-2.5A6 6 0 0012 3z", undefined),
  c("sistema.lubrificantes", "Lubrificantes e fluidos", "Fluidos", ["sistema", "categoria"], "M12 3s6 6.7 6 11a6 6 0 01-12 0c0-4.3 6-11 6-11z", "M9.5 15a2.5 2.5 0 002.5 2.5"),
  c("sistema.carroceria", "Carroceria e acabamento", "Carroceria", ["sistema", "categoria"], "M3 15l2-5h10l4 5v3H3zM5 10l2-4h7l1 4", "M7 18a2 2 0 100 4 2 2 0 000-4z"),
  c("sistema.alimentacao", "Alimentação e injeção", "Injeção", ["sistema", "categoria"], "M10 2h4v4h-4zM9 6h6v8l-3 4-3-4zM12 18v4", "M7 9h2M15 9h2"),
  c("sistema.vela", "Velas", "Ignição por vela", ["sistema", "categoria", "componente"], "M10 2h4v3h-4zM9 5h6v5H9zM10 10h4v6h-4zM12 16v3M10 21l2-2 2 2", undefined),
  c("sistema.todas", "Todas as peças", "Agrupador de categorias", ["sistema", "categoria"], "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z", undefined),
  c("componente.cabecote", "Cabeçote", "Componente do sistema motor", ["componente"], "M3 9h18v6H3zM6 9V6M10 9V6M14 9V6M18 9V6M6 15v3M18 15v3", "M8 12h8"),

  // Tipos de veículo (silhuetas por carroceria — não identificam motor)
  c("veiculo.passeio", "Passeio", "Automóvel de passeio", ["veiculo", "modelo", "carroceria"], "M2 15l3-5h8l4 3h4v3H2zM6 16a2 2 0 100 4 2 2 0 000-4zM17 16a2 2 0 100 4 2 2 0 000-4z", undefined),
  c("veiculo.suv", "Utilitário / SUV", "Utilitário esportivo", ["veiculo", "modelo", "carroceria"], "M2 15V9h13l4 3h3v4H2zM6 16a2 2 0 100 4 2 2 0 000-4zM17 16a2 2 0 100 4 2 2 0 000-4z", "M5 9V7h8v2"),
  c("veiculo.furgao", "Furgão / van", "Furgão fechado", ["veiculo", "modelo", "carroceria"], "M2 16V6h13l5 5v5H2zM6 16a2 2 0 100 4 2 2 0 000-4zM17 16a2 2 0 100 4 2 2 0 000-4z", "M15 6v5h5"),
  c("veiculo.picape", "Picape", "Picape", ["veiculo", "modelo", "carroceria"], "M2 16v-4h8V8h6l3 4h3v4H2zM6 16a2 2 0 100 4 2 2 0 000-4zM17 16a2 2 0 100 4 2 2 0 000-4z", undefined),
  c("veiculo.caminhao", "Caminhão leve", "Caminhão / chassi-cabine", ["veiculo", "modelo", "carroceria"], "M2 5h11v11H2zM13 9h5l3 4v3h-8M6 16a2 2 0 100 4 2 2 0 000-4zM17 16a2 2 0 100 4 2 2 0 000-4z", "M15 9v4h6"),
  c("veiculo.moto", "Moto", "Motocicleta", ["veiculo", "modelo"], "M5 13a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM19 13a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM5 16.5l4-6h5l5 6M13 10.5l-2-4h-3", undefined),

  // Combustível / propulsão (distintos; híbrido só subdivide com documento)
  c("combustivel.diesel", "Diesel", "Combustível diesel", ["combustivel"], "M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h2.5a1.5 1.5 0 011.5 1.5V17a1.5 1.5 0 003 0V8l-3-3", "M7 9h2.5a2 2 0 010 4H7z"),
  c("combustivel.gasolina", "Gasolina", "Combustível gasolina", ["combustivel"], "M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h2.5a1.5 1.5 0 011.5 1.5V17a1.5 1.5 0 003 0V8l-3-3", "M11 9H8v4h3v-2H9.5"),
  c("combustivel.etanol", "Etanol", "Combustível etanol", ["combustivel"], "M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h2.5a1.5 1.5 0 011.5 1.5V17a1.5 1.5 0 003 0V8l-3-3", "M9 8c2 1.5 2 4 0 5.5C7 12 7 9.5 9 8z"),
  c("combustivel.flex", "Flex", "Bicombustível flex", ["combustivel"], "M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 21h12M14 9h2.5a1.5 1.5 0 011.5 1.5V17a1.5 1.5 0 003 0V8l-3-3", "M7 13l2.5-4 2.5 4"),
  c("combustivel.eletrico", "Elétrico", "Propulsão elétrica a bateria", ["combustivel", "propulsao"], "M4 6h14v12H4zM18 10h2v4h-2", "M12 8l-3 4h4l-3 4"),
  c("combustivel.hibrido", "Híbrido", "Propulsão híbrida (subtipo exige documento)", ["combustivel", "propulsao"], "M12 3s6 6.7 6 11a6 6 0 01-12 0c0-4.3 6-11 6-11z", "M13 10l-3 4h4l-3 4"),
];

const PORT_ID = new Map(ICONES_MA.map((i) => [i.id, i]));
export function iconeMA(id: string): IconeMA | undefined { return PORT_ID.get(id); }

/** Inventário obrigatório (denominador do aceite). Não reduzir para aprovar. */
export const INVENTARIO_OBRIGATORIO_MA: readonly string[] = [
  ...RAIZES.map((r) => "raiz." + r),
  ...["inicio", "nano", "robo", "olho", "catalogo", "matriz", "taxonomia", "revisao", "historico", "ajustes", "grafico", "imagens", "web", "contexto"].map((m) => "modulo." + m),
  ...["montadora", "modelo", "geracao", "carroceria", "motor", "tracao", "combustivel", "propulsao", "sistema", "componente", "categoria", "ano", "mercado", "oem", "sku", "aplicacao", "epc"].map((t) => "tipo." + t),
  ...["motor", "suspensao", "freios", "filtros", "eletrica", "arrefecimento", "escapamento", "transmissao", "iluminacao", "lubrificantes", "carroceria", "alimentacao", "vela", "todas"].map((s) => "sistema." + s),
  "componente.cabecote",
  ...["passeio", "suv", "furgao", "picape", "caminhao", "moto"].map((v) => "veiculo." + v),
  ...["diesel", "gasolina", "etanol", "flex", "eletrico", "hibrido"].map((f) => "combustivel." + f),
];

/** Só comandos de path SVG; sem script, url(), entidades ou atributos. */
const PATH_SEGURO = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/;
const ID_VALIDO = /^[a-z]+\.[a-z0-9-]+$/;

export function validarBibliotecaMA(icones: readonly IconeMA[] = ICONES_MA, inventario: readonly string[] = INVENTARIO_OBRIGATORIO_MA) {
  const erros: string[] = [];
  const ids = new Set<string>();
  if (!inventario.length || new Set(inventario).size !== inventario.length) erros.push("inventario_vazio_ou_duplicado");
  for (const i of icones) {
    if (ids.has(i.id)) erros.push("colisao:" + i.id);
    ids.add(i.id);
    if (!ID_VALIDO.test(i.id)) erros.push("id_invalido:" + i.id);
    if (!i.rotulo.trim() || !i.conceito.trim()) erros.push("sem_rotulo:" + i.id);
    if (!/^\d+\.\d+\.\d+$/.test(i.versao)) erros.push("versao_invalida:" + i.id);
    if (!i.vinculos.length || i.vinculos.some((v) => !TIPOS_NO_MA.includes(v))) erros.push("vinculo_invalido:" + i.id);
    if (!i.d.trim() || !PATH_SEGURO.test(i.d) || (i.acento !== undefined && !PATH_SEGURO.test(i.acento))) erros.push("geometria_insegura:" + i.id);
  }
  const ausentes = inventario.filter((k) => !ids.has(k));
  for (const a of ausentes) erros.push("ausente:" + a);
  const cobertos = inventario.length - ausentes.length;
  return { erros, total: inventario.length, cobertos, cobertura: inventario.length ? cobertos / inventario.length : 0 };
}

// ——— Vínculo com nós semânticos existentes ———
const SISTEMA_POR_PECA: Record<string, string> = Object.fromEntries(
  ["motor", "suspensao", "freios", "filtros", "eletrica", "arrefecimento", "escapamento", "transmissao", "iluminacao", "lubrificantes", "carroceria", "alimentacao", "vela", "todas"].map((p) => [p, "sistema." + p]),
);
/** Peça (iconeDaCategoria) → ícone MA. Desconhecida → agrupador, nunca ícone de outra peça. */
export function iconeMAParaPeca(peca: string): string { return SISTEMA_POR_PECA[peca] ?? "sistema.todas"; }

/** Chave do atlas histórico → ícone MA equivalente (mesmo conceito, sem herdar o raster). */
export function iconeMAParaAtivo(nome: string): string | null {
  if (PORT_ID.has("modulo." + nome)) return "modulo." + nome;
  if (SISTEMA_POR_PECA[nome]) return SISTEMA_POR_PECA[nome];
  return null;
}

export interface NoSemanticoMA { id: string; tipo: TipoNoMA; rotulo: string; chave?: string | null }
export interface ResolucaoMA { no_id: string; tipo: TipoNoMA; rotulo: string; icon_id: string | null; estado: "especifico" | "tipo" | "texto" }
/**
 * Resolve o ícone de um nó existente: chave específica permitida para o tipo → glifo do tipo → texto.
 * Nunca procura por rótulo semelhante; nunca usa ícone de tipo diferente do nó.
 */
export function resolverIconeNoMA(no: NoSemanticoMA): ResolucaoMA {
  const base = { no_id: no.id, tipo: no.tipo, rotulo: no.rotulo };
  if (!no.id?.trim() || !TIPOS_NO_MA.includes(no.tipo)) return { ...base, icon_id: null, estado: "texto" };
  const especifico = no.chave ? PORT_ID.get(no.chave) : undefined;
  if (especifico && especifico.estado !== "revogado" && especifico.vinculos.includes(no.tipo)) return { ...base, icon_id: especifico.id, estado: "especifico" };
  const generico = PORT_ID.get(no.tipo === "raiz" ? "raiz." + no.id : no.tipo === "veiculo" ? "tipo.modelo" : "tipo." + no.tipo);
  if (generico && generico.estado !== "revogado" && generico.vinculos.includes(no.tipo === "veiculo" ? "modelo" : no.tipo)) return { ...base, icon_id: generico.id, estado: "tipo" };
  return { ...base, icon_id: null, estado: "texto" };
}

export function iconeDaRaiz(r: Raiz): string { return "raiz." + r; }
