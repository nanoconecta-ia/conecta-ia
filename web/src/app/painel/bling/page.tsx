import { Cartao, Selo } from "@/components/ui";
import { exigirLojista } from "@/lib/sessao";

export const metadata = { title: "Bling" };

export default async function PaginaBling() {
  const { supabase, loja } = await exigirLojista();
  if (!loja) return null;
  const { data: c } = await supabase.from("bling_conexoes").select("status").eq("loja_id", loja.id).maybeSingle();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">Conexão com o Bling</h1>
      <Cartao>
        <Selo tom={c?.status === "conectada" ? "ok" : "atencao"}>{c?.status === "conectada" ? "Conectada" : "Não conectada"}</Selo>
        <p className="mt-3 text-sm text-suave">
          A conexão será feita com um clique em “Conectar ao Bling”, sem copiar chave. A sincronização é automática e o catálogo aparece aqui e no site.
        </p>
        <button disabled className="mt-4 cursor-not-allowed rounded-lg bg-marca/50 px-4 py-2.5 font-medium text-marca-texto" title="Depende da documentação do Bling (OAuth)">
          Conectar ao Bling (em breve)
        </button>
      </Cartao>
    </div>
  );
}
