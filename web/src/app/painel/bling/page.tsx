import { Cartao, Selo } from "@/components/ui";
import { exigirLojista } from "@/lib/sessao";

export const metadata = { title: "Bling" };

export default async function PaginaBling({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const q = await searchParams;
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
        {q.ok && <p className="mt-3 text-sm">Conexão concluída.</p>}
        {q.erro && <p className="mt-3 text-sm text-red-600">Não foi possível conectar ({q.erro}). Tente de novo.</p>}
        <a href="/api/bling/conectar" className="mt-4 inline-block rounded-lg bg-marca px-4 py-2.5 font-medium text-marca-texto">
          {c?.status === "conectada" ? "Reconectar ao Bling" : "Conectar ao Bling"}
        </a>
      </Cartao>
    </div>
  );
}
