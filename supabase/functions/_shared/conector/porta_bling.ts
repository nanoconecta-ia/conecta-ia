// Porta do Bling usada pelo executor. Três implementações: BlingMock (testes e simulação), BlingLeituraReal (só GET)
// e BlingEscritaReal (POST/PATCH de uma lista FECHADA de ferramentas, DESLIGADA por padrão: precisa do segredo BLING_ESCRITA_REAL=1).
import { blingFetch } from "../bling_api.ts";
import { chaveProibida } from "./bling_campos.ts";
import type { Armazem, Config } from "../bling_token.ts";

export interface RespostaBling { status: number; corpo?: unknown }
export class TimeoutBling extends Error { constructor(m = "timeout") { super(m); } }

export interface PortaBling {
  /** true = mock; o executor de ENSAIO só aceita portas simuladas. */
  readonly simulado: boolean;
  /** false = esta porta NÃO escreve (leitura só, ou escrita real desligada). undefined = mock. O executor recusa ANTES de marcar "enviada". */
  readonly escritaLigada?: boolean;
  chamar(ferramenta: string, args: { id?: string; corpo: unknown }, idempotencyKey: string): Promise<RespostaBling>;
  ler(ferramenta: "bling.produtos.confirmar" | "bling.categorias.consultar" | "bling.produtos.consultar" | "bling.produtos.consultar_ativos", args: { id?: string; sku?: string; gtin?: string; busca?: string }): Promise<RespostaBling>;
}

/** Leitura real (GET) com o token da loja, pelo cliente único `blingFetch`. Qualquer escrita é recusada. */
export class BlingLeituraReal implements PortaBling {
  readonly simulado = false;
  readonly escritaLigada = false;
  private arm: Armazem; private lojaId: string; private cfg: Config;
  constructor(arm: Armazem, lojaId: string, cfg: Config) { this.arm = arm; this.lojaId = lojaId; this.cfg = cfg; }
  chamar(): Promise<RespostaBling> { throw new Error("escrita_real_desligada: esta porta só lê"); }
  async ler(ferramenta: string, args: { id?: string; sku?: string; gtin?: string; busca?: string }): Promise<RespostaBling> {
    let caminho: string;
    if (ferramenta === "bling.produtos.confirmar" && args.id && /^\d+$/.test(args.id)) caminho = `/produtos/${args.id}`;
    else if (ferramenta === "bling.produtos.consultar" && args.sku) caminho = `/produtos?codigos[]=${encodeURIComponent(args.sku)}`;
    else if (ferramenta === "bling.categorias.consultar") caminho = `/categorias/produtos?pagina=1&limite=100`;
    // criterio=2 = só ATIVOS (filtro documentado no OpenAPI do Bling: 1 últimos, 2 ativos, 3 inativos, 4 excluídos, 5 todos)
    else if (ferramenta === "bling.produtos.consultar_ativos" && args.sku) caminho = `/produtos?codigos[]=${encodeURIComponent(args.sku)}&criterio=2&limite=100`;
    else if (ferramenta === "bling.produtos.consultar_ativos" && args.gtin && /^\d{8,14}$/.test(args.gtin)) caminho = `/produtos?gtins[]=${args.gtin}&criterio=2&limite=100`;
    else throw new Error("leitura_nao_suportada");
    const r = await blingFetch(this.arm, this.lojaId, caminho, this.cfg);
    return { status: r.status, corpo: await r.json().catch(() => null) };
  }
}

/** Ferramentas que a porta de escrita real sabe enviar. Lista FECHADA: o que não está aqui é recusado antes de qualquer chamada. */
const ROTAS_ESCRITA: Readonly<Record<string, { metodo: "POST" | "PATCH"; caminho: (id?: string) => string | null }>> = {
  "bling.produtos.alterar": { metodo: "PATCH", caminho: (id) => (id && /^\d{1,20}$/.test(id) ? `/produtos/${id}` : null) },
  "bling.categorias.criar": { metodo: "POST", caminho: () => "/categorias/produtos" },
};
export const FERRAMENTAS_ESCRITA_REAL = Object.keys(ROTAS_ESCRITA);
export const INTERVALO_ESCRITA_MS = 350; // no máximo ~3 escritas por segundo (desenho: escrita-categoria-no-bling.md, seção 5)

/** Escrita real no Bling. Só envia: ferramenta da lista fechada, corpo objeto sem campo proibido, id numérico. Nunca repete (a repetição às cegas pode duplicar):
 *  timeout/erro de rede sobe como exceção e o executor marca DESCONHECIDO. A chave de idempotência NÃO vai ao Bling (a API v3 não a documenta): ela vale no Conecta.IA
 *  (uma tentativa aberta por item; só reconciliação libera outra). A leitura de confirmação usa a mesma conexão. */
export class BlingEscritaReal implements PortaBling {
  readonly simulado = false;
  readonly escritaLigada: boolean;
  private leitor: BlingLeituraReal;
  private arm: Armazem; private lojaId: string; private cfg: Config;
  private ultimaEm = 0;
  constructor(arm: Armazem, lojaId: string, cfg: Config, ligada: boolean) {
    this.arm = arm; this.lojaId = lojaId; this.cfg = cfg; this.escritaLigada = ligada;
    this.leitor = new BlingLeituraReal(arm, lojaId, cfg);
  }
  ler(ferramenta: "bling.produtos.confirmar" | "bling.categorias.consultar" | "bling.produtos.consultar" | "bling.produtos.consultar_ativos", args: { id?: string; sku?: string; gtin?: string; busca?: string }): Promise<RespostaBling> {
    return this.leitor.ler(ferramenta, args);
  }
  async chamar(ferramenta: string, args: { id?: string; corpo: unknown }, _idempotencyKey: string): Promise<RespostaBling> {
    if (!this.escritaLigada) throw new Error("escrita_real_desligada: o segredo BLING_ESCRITA_REAL não está ligado");
    const rota = ROTAS_ESCRITA[ferramenta];
    if (!rota) throw new Error(`escrita_nao_suportada: ${ferramenta}`);
    const caminho = rota.caminho(args.id);
    if (!caminho) throw new Error("alvo_invalido: id do produto ausente ou não numérico");
    if (!args.corpo || typeof args.corpo !== "object" || Array.isArray(args.corpo)) throw new Error("corpo_invalido");
    const proibida = chaveProibida(args.corpo);
    if (proibida) throw new Error(`campo_proibido: ${proibida}`);
    const espera = this.cfg.espera ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const agora = Date.now(), falta = this.ultimaEm + INTERVALO_ESCRITA_MS - agora;
    if (falta > 0) await espera(falta);
    this.ultimaEm = Date.now();
    const r = await blingFetch(this.arm, this.lojaId, caminho, this.cfg, { metodo: rota.metodo, corpo: args.corpo, timeoutMs: 30_000 });
    return { status: r.status, corpo: await r.json().catch(() => null) };
  }
}
