// Aprovações e travas (só PESSOA autenticada e membro da loja). NÃO IMPLANTADA nesta fase. verify_jwt = true.
// Ações: decidir, revisar, travar, destravar, executar_simulado, executar, reconciliar. Chave MCP nunca chega aqui.
import { acaoAprovacoes } from "../_shared/conector/acoes.ts";
import { autenticar, blingLeitura, json } from "../_shared/conector/edge.ts";

Deno.serve(async (req) => {
  const c = await req.clone().json().catch(() => ({}));
  const s = await autenticar(req, c?.loja_id);
  if (s instanceof Response) return s;
  const r = await acaoAprovacoes(c, { userId: s.userId, lojaId: s.lojaId }, { rpc: (fn, args) => s.admin.rpc(fn, args), dados: s.admin, blingLeitura: await blingLeitura(s) });
  return json(r.corpo, r.status);
});
