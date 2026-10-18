import { Cartao, Numero, Selo } from "@/components/ui";
import { contar } from "@/lib/dados";
import { exigirLojista } from "@/lib/sessao";

export const metadata = { title: "Visão geral" };

export default async function VisaoGeral() {
  const { supabase, loja } = await exigirLojista();
  if (!loja) return null;
  const [total, publicados, { data: conexao }] = await Promise.all([
    contar(supabase, loja.id),
    contar(supabase, loja.id, true),
    supabase.from("bling_conexoes").select("status, ultimo_sync_ok_em, ultimo_erro").eq("loja_id", loja.id).maybeSingle(),
  ]);
  const status = conexao?.status ?? "pendente";
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold sm:text-2xl">Visão geral</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Numero rotulo="Produtos espelhados do Bling" valor={total} />
        <Numero rotulo="Publicados no site" valor={publicados} />
        <Numero rotulo="Aguardando publicação" valor={total - publicados} />
      </div>
      <Cartao titulo="Conexão com o Bling">
        <Selo tom={status === "conectada" ? "ok" : status === "erro" || status === "expirada" ? "erro" : "atencao"}>
          {status === "conectada" ? "Conectada" : status === "pendente" ? "Ainda não conectada" : status}
        </Selo>
        <p className="mt-2 text-sm text-suave">
          {conexao?.ultimo_sync_ok_em
            ? `Última sincronização bem-sucedida: ${new Date(conexao.ultimo_sync_ok_em).toLocaleString("pt-BR")}`
            : "Nenhuma sincronização feita ainda."}
        </p>
        {conexao?.ultimo_erro && <p className="mt-2 text-sm text-erro">{conexao.ultimo_erro}</p>}
      </Cartao>
    </div>
  );
}
