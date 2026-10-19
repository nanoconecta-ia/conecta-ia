import Link from "next/link";
import type { Imagem, Produto } from "@/lib/tipos";
import { brl } from "@/lib/publicacao";

/** Cartão de produto, o mesmo na vitrine e na pré-visualização do painel. */
export function CartaoProduto({ produto, imagens, href }: { produto: Produto; imagens: Imagem[]; href: string | null }) {
  const img = imagens.find((i) => i.principal && i.aprovada) ?? imagens.find((i) => i.aprovada);
  const corpo = (
    <>
      <div className="aspect-square overflow-hidden rounded-lg bg-borda/50">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={produto.nome ?? ""} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-suave">Sem imagem</div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium">{produto.nome ?? "(sem nome)"}</p>
      <p className="font-mono text-xs text-suave">{produto.sku}</p>
      <p className="mt-1 font-semibold tabular-nums">{brl(produto.preco)}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-borda bg-card p-3 hover:border-marca">{corpo}</Link>
  ) : (
    <div className="rounded-xl border border-borda bg-card p-3">{corpo}</div>
  );
}
