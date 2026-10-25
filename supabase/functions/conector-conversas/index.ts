// Conversas e anexos do Nano.ia. NÃO IMPLANTADA nesta fase. verify_jwt = true.
// Anexos: bucket privado 'agente-anexos'; o navegador só recebe URL assinada de upload/download emitida aqui.
import { acaoConversas } from "../_shared/conector/acoes.ts";
import { autenticar, json } from "../_shared/conector/edge.ts";

Deno.serve(async (req) => {
  const c = await req.clone().json().catch(() => ({}));
  const s = await autenticar(req, c?.loja_id);
  if (s instanceof Response) return s;
  const bucket = s.admin.storage.from("agente-anexos");
  const r = await acaoConversas(c, { userId: s.userId, lojaId: s.lojaId }, {
    rpc: (fn, args) => s.admin.rpc(fn, args), dados: s.admin,
    assinarUpload: async (path) => { const { data } = await bucket.createSignedUploadUrl(path); return data ? { path: data.path, token: data.token } : null; },
    assinarDownload: async (path, seg) => (await bucket.createSignedUrl(path, seg)).data?.signedUrl ?? null,
  });
  return json(r.corpo, r.status);
});
