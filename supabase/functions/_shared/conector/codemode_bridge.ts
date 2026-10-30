/**
 * Ponte segura para um futuro executor Code Mode: NÃO é endpoint público nem deploy.
 *
 * A sandbox recebe somente os nomes + saídas minimizadas; este host conserva RPC,
 * chaves e Policy Engine. Cada chamada atravessa despachar(), que valida esquema,
 * permissão e audita. A chave MCP é revalidada antes de TODA operação interna.
 *
 * Não usar esta ponte no Worker de fixtures sem uma integração autenticada real.
 */
import { despachar, type ContextoDespacho, type ResultadoDespacho } from "./despacho.ts";
import type { Permissao } from "./tipos.ts";

export interface IdentidadeCodeMode {
  chave_id: string;
  loja_id: string;
  escopos: readonly Permissao[];
}
export interface AdaptadorCodeModeOpcoes {
  /** Contexto montado pelo servidor para a chave autenticada. Não vem do código da IA. */
  contexto: ContextoDespacho;
  identidade: Pick<IdentidadeCodeMode, "chave_id" | "loja_id">;
  /** Valida expiração, revogação, loja ativa e escopos a cada chamada interna. */
  revalidarChave: () => Promise<IdentidadeCodeMode | null>;
  /** Injeção apenas para testes sem Postgres/Bling. */
  despacharFn?: typeof despachar;
  relogio?: () => number;
  limite?: number;
  prazoMs?: number;
}

type OperacaoCodeMode = "catalogo_resumo" | "catalogo_listar";
export const OPERACOES_CODEMODE_LEITURA: readonly OperacaoCodeMode[] = ["catalogo_resumo", "catalogo_listar"];
const FERRAMENTAS = {
  catalogo_resumo: "conecta.catalogo.resumo",
  catalogo_listar: "conecta.catalogo.listar",
} as const;

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
}
function inteiroPublico(v: unknown): number {
  // Valor desconhecido não pode ser apresentado como uma contagem válida.
  if (!Number.isSafeInteger(v) || (v as number) < 0) throw new Error("resposta_cadastro_invalida");
  return v as number;
}
function stringPublica(v: unknown, max = 180): string | null {
  return typeof v === "string" ? v.slice(0, max) : null;
}
/** Nunca transportar preço, custo, fornecedor, fiscal, saldo, token ou a estrutura original. */
function saidaMinima(op: OperacaoCodeMode, resultado: unknown): unknown {
  if (op === "catalogo_resumo") {
    const r = objeto(resultado);
    if (!r) throw new Error("resposta_cadastro_invalida");
    return {
      produtos: inteiroPublico(r.produtos),
      publicados: inteiroPublico(r.publicados),
      aguardando_aprovacao: inteiroPublico(r.aguardando_aprovacao),
      origem: "espelho_auditado",
    };
  }
  if (!Array.isArray(resultado) || resultado.length > 20) throw new Error("resposta_cadastro_invalida");
  return {
    itens: resultado.map((raw) => {
      const p = objeto(raw);
      if (!p) throw new Error("resposta_cadastro_invalida");
      return { sku: stringPublica(p.sku, 80), nome: stringPublica(p.nome, 180) };
    }),
    origem: "espelho_auditado",
    homologacao_tecnica: "nao_verificada",
  };
}

/** Contrato servidor-local, propositalmente impossível de escolher loja ou ferramenta arbitrária. */
export function criarAdaptadorCodeModeLeitura(o: AdaptadorCodeModeOpcoes) {
  const clock = o.relogio ?? Date.now;
  const max = o.limite ?? 12;
  const prazo = o.prazoMs ?? 12_000;
  if (!Number.isInteger(max) || max < 1 || max > 12) throw new Error("limite_invalido");
  if (!Number.isInteger(prazo) || prazo < 100 || prazo > 12_000) throw new Error("prazo_invalido");
  const t0 = clock();
  let chamadas = 0;
  return {
    operacoes: OPERACOES_CODEMODE_LEITURA,
    async executar(nome: string, entrada: unknown = {}): Promise<unknown> {
      if (++chamadas > max) throw new Error("limite_de_chamadas_internas_excedido");
      if (clock() - t0 >= prazo) throw new Error("tempo_total_esgotado");
      if (!Object.hasOwn(FERRAMENTAS, nome)) throw new Error("operacao_nao_autorizada");
      const operacao = nome as OperacaoCodeMode;
      if (!o.identidade.chave_id || !o.identidade.loja_id || !o.contexto.userId ||
          o.contexto.lojaId !== o.identidade.loja_id) throw new Error("identidade_invalida");
      let atual: IdentidadeCodeMode | null;
      try { atual = await o.revalidarChave(); }
      catch { throw new Error("chave_nao_confirmada"); } // Não expor erros do banco/credenciais à sandbox.
      if (!atual || atual.chave_id !== o.identidade.chave_id ||
          atual.loja_id !== o.identidade.loja_id || !atual.escopos.includes("leitura")) {
        throw new Error("chave_revogada_ou_sem_escopo");
      }
      if (clock() - t0 >= prazo) throw new Error("tempo_total_esgotado");
      const args = entrada ?? {};
      // Não permitir payload grande e não usar código de cliente como SQL/identidade.
      let bytes: number;
      try { bytes = new TextEncoder().encode(JSON.stringify(args)).length; }
      catch { throw new Error("argumento_invalido"); }
      if (bytes > 4_096 || !objeto(args)) throw new Error("argumento_invalido");
      const ctx: ContextoDespacho = {
        ...o.contexto,
        lojaId: o.identidade.loja_id,
        origem: "gateway_mcp",
        escopos: ["leitura"], // Nunca delegar 'propor', 'simular' ou 'executar' à sandbox.
        mcpChaveId: o.identidade.chave_id,
      };
      let r: ResultadoDespacho;
      try { r = await (o.despacharFn ?? despachar)(FERRAMENTAS[operacao], args, ctx); }
      catch { throw new Error("operacao_falhou"); }
      if (!r.ok || r.auditoria_falhou || r.decisao !== "permitida")
        throw new Error(r.auditoria_falhou ? "auditoria_nao_confirmada" : "operacao_nao_autorizada_ou_falhou");
      if (clock() - t0 >= prazo) throw new Error("tempo_total_esgotado");
      return saidaMinima(operacao, r.resultado);
    },
  };
}
