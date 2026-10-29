// Bling simulado: guarda produtos/categorias em memória, valida o que RECEBE (nada fiscal/custo/fornecedor/estoque/SKU)
// e injeta falhas de forma controlada — inclusive "deu timeout mas gravou" e "deu timeout e não gravou".
import { chaveProibida } from "./bling_campos.ts";
import { TimeoutBling, type PortaBling, type RespostaBling } from "./porta_bling.ts";

export type Falha = "timeout_gravou" | "timeout_nao_gravou" | "http_500_gravou" | "http_422" | "http_429" | "http_401" | "leitura_timeout" | "leitura_diverge";

export class BlingMock implements PortaBling {
  readonly simulado = true;
  produtos = new Map<string, Record<string, any>>();
  categorias: { id: number; descricao: string; idCategoriaPai?: number }[] = [];
  recebidos: { ferramenta: string; id?: string; corpo: unknown; idem: string }[] = [];
  rejeitados: { ferramenta: string; motivo: string }[] = [];
  leituras = 0;
  falhas: Falha[] = [];
  private proximoId = 9000;

  semear(id: string, produto: Record<string, unknown>) { this.produtos.set(id, structuredClone(produto)); return this; }

  async chamar(ferramenta: string, args: { id?: string; corpo: unknown }, idem: string): Promise<RespostaBling> {
    const proibida = chaveProibida(args.corpo);
    if (proibida || typeof args.corpo !== "object" || args.corpo === null) {
      this.rejeitados.push({ ferramenta, motivo: proibida ? `campo proibido: ${proibida}` : "corpo inválido" });
      return { status: 422, corpo: { erro: "campo não permitido" } };
    }
    this.recebidos.push({ ferramenta, id: args.id, corpo: args.corpo, idem });
    const falha = this.falhas[0]?.startsWith("leitura") ? undefined : this.falhas.shift(); // falhas de leitura ficam para ler()
    if (falha === "http_422") return { status: 422, corpo: { erro: "validação" } };
    if (falha === "http_429") return { status: 429 };
    if (falha === "http_401") return { status: 401 };
    if (falha === "timeout_nao_gravou") throw new TimeoutBling();
    const r = this.aplicar(ferramenta, args);
    if (falha === "timeout_gravou") throw new TimeoutBling();
    if (falha === "http_500_gravou") return { status: 500 };
    return r;
  }

  private aplicar(ferramenta: string, args: { id?: string; corpo: unknown }): RespostaBling {
    const corpo = args.corpo as Record<string, any>;
    if (ferramenta === "bling.produtos.alterar") {
      const atual = this.produtos.get(args.id ?? "");
      if (!atual) return { status: 404 };
      for (const [k, v] of Object.entries(corpo)) atual[k] = v && typeof v === "object" ? { ...(atual[k] ?? {}), ...v } : v;
      return { status: 200, corpo: { data: { id: args.id } } };
    }
    if (ferramenta === "bling.produtos.criar") {
      const id = String(this.proximoId++);
      this.produtos.set(id, structuredClone(corpo));
      return { status: 201, corpo: { data: { id: Number(id) } } };
    }
    if (ferramenta === "bling.categorias.criar") {
      const id = this.proximoId++;
      this.categorias.push({ id, descricao: String(corpo.descricao), idCategoriaPai: corpo.categoriaPai?.id });
      return { status: 201, corpo: { data: { id } } };
    }
    return { status: 400 };
  }

  async ler(ferramenta: string, args: { id?: string; sku?: string; gtin?: string; busca?: string }): Promise<RespostaBling> {
    this.leituras++;
    const falha = this.falhas[0];
    if (falha === "leitura_timeout") { this.falhas.shift(); throw new TimeoutBling(); }
    if (ferramenta === "bling.categorias.consultar") return { status: 200, corpo: { data: this.categorias.map((c) => ({ id: c.id, descricao: c.descricao, categoriaPai: { id: c.idCategoriaPai ?? 0 } })) } };
    if (ferramenta === "bling.produtos.consultar_ativos") {
      const achados = [...this.produtos.entries()].filter(([, p]) => (p.situacao ?? "A") === "A" && (args.sku ? p.codigo === args.sku : p.gtin === args.gtin)).map(([id, p]) => ({ id: Number(id), ...p }));
      return { status: 200, corpo: { data: achados } };
    }
    if (ferramenta === "bling.produtos.consultar") {
      const achados = [...this.produtos.entries()].filter(([, p]) => p.codigo === args.sku).map(([id, p]) => ({ id: Number(id), ...p }));
      return { status: 200, corpo: { data: achados } };
    }
    const p = this.produtos.get(args.id ?? "");
    if (!p) return { status: 404 };
    if (falha === "leitura_diverge") { this.falhas.shift(); return { status: 200, corpo: { data: { id: Number(args.id), ...structuredClone(p), marca: "OUTRA" } } }; }
    return { status: 200, corpo: { data: { id: Number(args.id), ...structuredClone(p) } } };
  }
}
