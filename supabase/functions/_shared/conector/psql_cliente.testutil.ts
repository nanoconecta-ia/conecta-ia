// APENAS TESTES: cliente estilo supabase-js que executa SQL num Postgres LOCAL via psql. Serve para rodar o código de produção
// (dados.ts, handlers.ts, executor.ts) contra o esquema e as funções reais das migrações. Nunca usado fora de testes.
import { execFileSync } from "node:child_process";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const aspas = (s: string) => "'" + s.replaceAll("'", "''") + "'";
export function lit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return aspas(v);
  if (Array.isArray(v)) return v.length === 0 ? "'{}'" : `array[${v.map(lit).join(",")}]${v.every((x) => typeof x === "string" && UUID.test(x)) ? "::uuid[]" : v.every((x) => typeof x === "string") ? "::text[]" : ""}`;
  return aspas(JSON.stringify(v)) + "::jsonb";
}
const ident = (s: string) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error("identificador inválido: " + s); return s; };

export function criarPsql(banco: string) {
  const sql = (texto: string): string => {
    try { return execFileSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", banco, "-c", texto], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
    catch (e: any) { const m = String(e.stderr || e.message).match(/ERROR:\s+([^\n]+)/); throw new Error(m ? m[1] : String(e.stderr || e.message).slice(0, 300)); }
  };
  const json = (texto: string) => { const r = sql(texto); return r ? JSON.parse(r) : null; };

  const retset = new Map<string, boolean>();
  const devolveLinhas = (fn: string) => { if (!retset.has(fn)) retset.set(fn, sql(`select bool_or(p.proretset) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = ${aspas(fn)}`) === "t"); return retset.get(fn)!; };
  // Tipos dos parâmetros vêm do catálogo do Postgres (como o PostgREST faz): jsonb recebe JSON mesmo que o valor seja uma lista.
  const tipos = new Map<string, Record<string, string>>();
  const tiposDe = (fn: string): Record<string, string> => {
    if (!tipos.has(fn)) {
      const l = json(`select jsonb_agg(jsonb_build_object('n', n, 't', t)) from (select unnest(p.proargnames) n, unnest(string_to_array(p.proargtypes::text, ' ')::oid[]::regtype[]::text[]) t
        from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = ${aspas(fn)} limit 40) x`) as { n: string; t: string }[] | null;
      tipos.set(fn, Object.fromEntries((l ?? []).map((x) => [x.n, x.t])));
    }
    return tipos.get(fn)!;
  };
  const tipado = (v: unknown, tipo: string | undefined): string => {
    if (v === null || v === undefined) return "null";
    if (tipo === "jsonb") return aspas(JSON.stringify(v)) + "::jsonb";
    if (tipo?.endsWith("[]") && Array.isArray(v)) return v.length === 0 ? `'{}'::${tipo}` : `array[${v.map((x) => lit(x)).join(",")}]::${tipo}`;
    return lit(v);
  };
  const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
    try {
      const t = tiposDe(fn);
      const a = Object.entries(args).map(([k, v]) => `${ident(k)} => ${tipado(v, t[k])}`).join(", ");
      if (devolveLinhas(fn)) return { data: json(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.${ident(fn)}(${a}) t`), error: null };
      const r = sql(`select (public.${ident(fn)}(${a}))::text`);
      let data: unknown = r === "" ? null : r;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { /* texto/uuid */ } }
      return { data, error: null };
    } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
  };

  // Query builder mínimo, o suficiente para dados.ts / escrita.ts.
  class Q implements PromiseLike<any> {
    private cols = "*"; private ondes: string[] = []; private ord = ""; private lim = ""; private contar = false; private cabeca = false; private unico: "maybe" | "single" | null = null;
    private tabela: string;
    constructor(tabela: string) { this.tabela = tabela; }
    select(cols = "*", o?: { count?: string; head?: boolean }) { this.cols = cols.replace(/\s+/g, " "); this.contar = !!o?.count; this.cabeca = !!o?.head; return this; }
    private op(c: string, o: string, v: unknown) { this.ondes.push(`${ident(c)} ${o} ${lit(v)}`); return this; }
    eq(c: string, v: unknown) { return this.op(c, "=", v); } neq(c: string, v: unknown) { return this.op(c, "<>", v); }
    ilike(c: string, v: string) { return this.op(c, "ilike", v); }
    is(c: string, v: null) { this.ondes.push(`${ident(c)} is null`); return this; }
    in(c: string, v: unknown[]) { this.ondes.push(`${ident(c)} = any(${lit(v)})`); return this; }
    textSearch(c: string, q: string, o?: { config?: string }) { this.ondes.push(`${ident(c)} @@ websearch_to_tsquery(${aspas(o?.config ?? "portuguese")}, ${aspas(q)})`); return this; }
    or(expr: string) {
      const partes = expr.split(",").map((p) => {
        const m = p.match(/^([a-z_]+)\.(ilike|eq|is)\.(.*)$/); if (!m) throw new Error("or() não suportado: " + p);
        return m[2] === "is" ? `${ident(m[1])} is ${m[3]}` : `${ident(m[1])} ${m[2] === "ilike" ? "ilike" : "="} ${aspas(m[3])}`;
      });
      this.ondes.push(`(${partes.join(" or ")})`); return this;
    }
    order(c: string, o?: { ascending?: boolean }) { this.ord = ` order by ${ident(c)} ${o?.ascending === false ? "desc" : "asc"}`; return this; }
    limit(n: number) { this.lim = ` limit ${Number(n)}`; return this; }
    maybeSingle() { this.unico = "maybe"; return this; } single() { this.unico = "single"; return this; }
    then<T1, T2>(ok?: (v: any) => T1 | PromiseLike<T1>, err?: (e: any) => T2 | PromiseLike<T2>) { return this.executar().then(ok, err); }
    private async executar() {
      try {
        const w = this.ondes.length ? ` where ${this.ondes.join(" and ")}` : "";
        let count: number | null = null;
        if (this.contar) count = Number(sql(`select count(*) from public.${ident(this.tabela)}${w}`));
        if (this.cabeca) return { data: null, error: null, count };
        const dados = json(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (select ${this.cols} from public.${ident(this.tabela)}${w}${this.ord}${this.lim}) t`) as any[];
        if (this.unico) return { data: dados[0] ?? null, error: null, count };
        return { data: dados, error: null, count };
      } catch (e) { return { data: null, error: { message: (e as Error).message }, count: null }; }
    }
  }
  return { from: (t: string) => new Q(t), rpc, sql, json };
}
