// Exemplo FIXO (SIMULAÇÃO) do motor parcial HR 8 válvulas, a partir das 5 fotos do próprio lojista (14/11/2026).
// Só entra aqui o que as fotos mostram ou o lojista informou. SKU, código do motor e aplicação seguem "a confirmar".
import type { EstadoDado, NoTaxonomia } from "./demoCadastro.ts";

export type ItemKit = { nome: string; estado: EstadoDado; fonte: string; filhos?: ItemKit[] };
export type VersaoMotor = { sku: string; nome: string; bling: string; aplicacao: string; itens: ItemKit[] };

const CAT = "catálogo do fornecedor (enviado pelo lojista, 14/11/2026)";
const it = (nome: string, estado: EstadoDado = "a_confirmar", fonte = CAT, filhos?: ItemKit[]): ItemKit => ({ nome, estado, fonte, filhos });

/** Árvore do que acompanha cada motor, conforme o catálogo do fornecedor. O que o catálogo não lista fica "não consultado", nunca "ausente". */
export const VERSOES_MOTOR: Record<"8v" | "16v", VersaoMotor> = {
  "8v": {
    sku: "CI002916",
    nome: "Motor 4D56/D4BH novo parcial com cabeçote (8 válvulas)",
    bling: "existe no Bling com situação E (excluído): a confirmar se deve ser reativado",
    aplicacao: "HR/K2500 2.5 8V 05\\12 D4BH Euro III · L200 GL/GLS · L200 Sport 03/ · Pajero Sport 2006",
    itens: [
      it("Bloco"), it("Virabrequim forjado"), it("Bronzinas"), it("Bielas"), it("Pistões com anéis"), it("Jet cooler"),
      it("Cabeçote completo montado", "a_confirmar", CAT, [
        it("Molas de válvula", "confirmado", "fotos do lojista"), it("Balancins", "confirmado", "fotos do lojista"),
        it("Válvulas, pratos, eixo de comando", "nao_consultado", "o catálogo não detalha"),
      ]),
      it("Jogo de parafusos do cabeçote"), it("Junta do cabeçote (Ajusa)"),
    ],
  },
  "16v": {
    sku: "CI003000",
    nome: "Motor HR/K2500 2.5 16V 13/ D4CB Euro V novo parcial c/ cabeçote",
    bling: "existe no Bling, ativo, sem descrição e sem imagem",
    aplicacao: "HR/K2500 2.5 16V 13/ D4CB Euro V",
    itens: [
      it("Bloco"), it("Bielas"), it("Jogo de pistão"), it("Jogo de anéis de segmento"), it("Bronzinas"), it("Jet cooler"), it("Virabrequim forjado"),
      it("Jogo de parafusos do cabeçote"), it("Junta do cabeçote de metal"),
      it("Cabeçote completo", "a_confirmar", CAT, [
        it("Válvulas"), it("Molas"), it("Pratos"), it("Eixos de comando"), it("Tuchos"), it("Balancins"),
      ]),
    ],
  },
};

export const EXEMPLO_MOTOR = {
  sku: "CI002916",
  nome: "Motor 4D56/D4BH novo parcial com cabeçote (8 válvulas)",
  evidencias: [
    { dado: "4 cilindros", estado: "confirmado" as EstadoDado, fonte: "fotos 2 e 4" },
    { dado: "8 válvulas (8 molas visíveis)", estado: "confirmado" as EstadoDado, fonte: "fotos 2 e 5" },
    { dado: "sem coletores, bombas, tampa de válvulas e cárter", estado: "confirmado" as EstadoDado, fonte: "fotos" },
    { dado: "aplicação HR/K2500, L200, Pajero Sport", estado: "a_confirmar" as EstadoDado, fonte: "catálogo do fornecedor" },
    { dado: "foto = CI002916", estado: "a_confirmar" as EstadoDado, fonte: "parecido com a imagem do catálogo; o lojista confirma" },
    { dado: "número do bloco", estado: "nao_consultado" as EstadoDado, fonte: "só vem com a nota fiscal do fornecedor (intransferível)" },
  ],
  taxonomia: [
    { nivel: "Sistema", nome: "Motor", estado: "a_confirmar" },
    { nivel: "Conjunto", nome: "Motor parcial", estado: "a_confirmar" },
    { nivel: "Subconjunto", nome: "Bloco com cabeçote montado", estado: "a_confirmar" },
    { nivel: "Componente", nome: "Semi-motor", estado: "a_confirmar" },
  ] as NoTaxonomia[],
  direitosFotos: "fotos do próprio lojista (uso liberado)",
} as const;
