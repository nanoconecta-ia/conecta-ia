// Chaves do gateway MCP (criar/revogar; só lojista). NÃO IMPLANTADA nesta fase. verify_jwt = true.
import { acaoChaves } from "../_shared/conector/acoes.ts";
import { autenticar, json } from "../_shared/conector/edge.ts";

Deno.serve(async (req) => {
  const c = await req.clone().json().catch(() => ({}));
  const s = await autenticar(req, c?.loja_id);
  if (s instanceof Response) return s;
  const r = await acaoChaves(c, { userId: s.userId, lojaId: s.lojaId }, { rpc: (fn, args) => s.admin.rpc(fn, args), dados: s.admin });
  return json(r.corpo, r.status);
});
