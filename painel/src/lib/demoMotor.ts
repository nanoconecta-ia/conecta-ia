// Exemplo FIXO (SIMULAÇÃO) do motor parcial HR 8 válvulas, a partir das 5 fotos do próprio lojista (14/11/2026).
// Só entra aqui o que as fotos mostram ou o lojista informou. SKU, código do motor e aplicação seguem "a confirmar".
import type { EstadoDado, NoTaxonomia } from "./demoCadastro.ts";

export const EXEMPLO_MOTOR = {
  sku: "a informar",
  nome: "Motor parcial (bloco com cabeçote) HR 8 válvulas",
  evidencias: [
    { dado: "4 cilindros", estado: "confirmado" as EstadoDado, fonte: "fotos 2 e 4" },
    { dado: "8 válvulas (8 molas visíveis)", estado: "confirmado" as EstadoDado, fonte: "fotos 2 e 5" },
    { dado: "sem coletores, bombas, tampa de válvulas e cárter", estado: "confirmado" as EstadoDado, fonte: "fotos" },
    { dado: "aplicação HR", estado: "a_confirmar" as EstadoDado, fonte: "informado pelo lojista" },
    { dado: "código do motor e cilindrada", estado: "ausente" as EstadoDado, fonte: "numeração do bloco ilegível nas fotos" },
    { dado: "SKU e cadastro no Bling", estado: "nao_consultado" as EstadoDado, fonte: "aguardando o código do lojista" },
  ],
  taxonomia: [
    { nivel: "Sistema", nome: "Motor", estado: "a_confirmar" },
    { nivel: "Conjunto", nome: "Motor parcial", estado: "a_confirmar" },
    { nivel: "Subconjunto", nome: "Bloco com cabeçote montado", estado: "a_confirmar" },
    { nivel: "Componente", nome: "Semi-motor", estado: "a_confirmar" },
  ] as NoTaxonomia[],
  direitosFotos: "fotos do próprio lojista (uso liberado)",
} as const;
