import { Selo, Vazio } from "@/components/ui";
import { produtosComImagens } from "@/lib/dados";
import { avaliarPublicacao, brl, prontoParaPublicar } from "@/lib/publicacao";
import { exigirLojista } from "@/lib/sessao";

export const metadata = { title: "Catálogo" };

export default async function Catalogo() {
  const { supabase, loja } = await exigirLojista();
  if (!loja) return null;
  const produtos = await produtosComImagens(supabase, loja.id, { limite: 200 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">Catálogo</h1>
      <p className="text-sm text-suave">Espelho do Bling. Para alterar um cadastro, altere no Bling: aqui ninguém edita produto.</p>
      {produtos.length === 0 ? (
        <Vazio titulo="Nenhum produto sincronizado ainda">Conecte o Bling para trazer o catálogo automaticamente.</Vazio>
      ) : (
        <ul className="divide-y divide-borda rounded-xl border border-borda bg-card">
          {produtos.map((p) => {
            const ex = avaliarPublicacao(p, p.imagens);
            const pronto = prontoParaPublicar(ex);
            return (
              <li key={p.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nome ?? "(sem nome)"}</p>
                  <p className="font-mono text-xs text-suave">{p.sku ?? "sem SKU"}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="tabular-nums">{brl(p.preco)}</span>
                  {p.publicado ? <Selo tom="ok">Publicado</Selo> : pronto ? <Selo tom="atencao">Pronto para publicar</Selo> : <Selo tom="erro">Incompleto</Selo>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
