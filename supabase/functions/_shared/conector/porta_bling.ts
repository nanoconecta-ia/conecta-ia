// Porta do Bling usada pelo executor. Duas implementações: BlingMock (testes e simulação) e BlingLeituraReal (só GET).
// Escrita real NÃO existe aqui: ficará numa implementação própria, ligada só depois de testes, escopos e autorização.
import { blingFetch } from "../bling_api.ts";
import type { Armazem, Config } from "../bling_token.ts";

export interface RespostaBling { status: number; corpo?: unknown }
export class TimeoutBling extends Error { constructor(m = "timeout") { super(m); } }

export interface PortaBling {
  /** true = mock; o executor de ENSAIO só aceita portas simuladas. */
  readonly simulado: boolean;
  chamar(ferramenta: string, args: { id?: string; corpo: unknown }, idempotencyKey: string): Promise<RespostaBling>;
  ler(ferramenta: "bling.produtos.confirmar" | "bling.categorias.consultar" | "bling.produtos.consultar", args: { id?: string; sku?: string; busca?: string }): Promise<RespostaBling>;
}

/** Leitura real (GET) com o token da loja, pelo cliente único `blingFetch`. Qualquer escrita é recusada. */
export class BlingLeituraReal implements PortaBling {
  readonly simulado = false;
  private arm: Armazem; private lojaId: string; private cfg: Config;
  constructor(arm: Armazem, lojaId: string, cfg: Config) { this.arm = arm; this.lojaId = lojaId; this.cfg = cfg; }
  chamar(): Promise<RespostaBling> { throw new Error("escrita_real_desligada: esta porta só lê"); }
  async ler(ferramenta: string, args: { id?: string; sku?: string; busca?: string }): Promise<RespostaBling> {
    let caminho: string;
    if (ferramenta === "bling.produtos.confirmar" && args.id && /^\d+$/.test(args.id)) caminho = `/produtos/${args.id}`;
    else if (ferramenta === "bling.produtos.consultar" && args.sku) caminho = `/produtos?codigos[]=${encodeURIComponent(args.sku)}`;
    else if (ferramenta === "bling.categorias.consultar") caminho = `/categorias/produtos?pagina=1&limite=100`;
    else throw new Error("leitura_nao_suportada");
    const r = await blingFetch(this.arm, this.lojaId, caminho, this.cfg);
    return { status: r.status, corpo: await r.json().catch(() => null) };
  }
}
