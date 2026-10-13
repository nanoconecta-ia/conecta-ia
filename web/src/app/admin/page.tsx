import { Selo, Vazio } from "@/components/ui";
import { exigirSuperAdmin } from "@/lib/sessao";

export const metadata = { title: "Lojas" };

export default async function AdminLojas() {
  const { supabase } = await exigirSuperAdmin();
  const { data: lojas } = await supabase.from("lojas").select("id, nome, slug, modo_venda, ativa").order("nome");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">Lojas</h1>
      {!lojas?.length ? (
        <Vazio titulo="Nenhuma loja cadastrada">O cadastro de lojas pelo painel é o próximo passo desta área.</Vazio>
      ) : (
        <ul className="divide-y divide-borda rounded-xl border border-borda bg-card">
          {lojas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.nome}</p>
                <p className="font-mono text-xs text-suave">{l.slug} · {l.modo_venda}</p>
              </div>
              <Selo tom={l.ativa ? "ok" : "neutro"}>{l.ativa ? "Ativa" : "Inativa"}</Selo>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
