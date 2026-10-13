import Link from "next/link";
import type { ReactNode } from "react";

export type ItemNav = { href: string; rotulo: string; emBreve?: boolean };

/** Estrutura das áreas logadas. Celular primeiro: menu em faixa rolável; em tela larga vira barra lateral. */
export function Shell({
  area,
  subtitulo,
  nav,
  children,
}: {
  area: string;
  subtitulo?: string;
  nav: ItemNav[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-borda bg-card lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:py-5">
          <Link href="/" className="font-semibold tracking-tight">
            Conecta<span className="text-marca">.IA</span>
          </Link>
          <p className="text-xs text-suave lg:mt-1">{area}{subtitulo ? ` · ${subtitulo}` : ""}</p>
        </div>
        <nav aria-label={area} className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3">
          {nav.map((i) =>
            i.emBreve ? (
              <span key={i.href} className="shrink-0 cursor-not-allowed whitespace-nowrap rounded-lg px-3 py-2 text-sm text-suave/60" title="Em breve">
                {i.rotulo}
              </span>
            ) : (
              <Link key={i.href} href={i.href} className="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-borda/60">
                {i.rotulo}
              </Link>
            ),
          )}
        </nav>
        <form action="/auth/sair" method="post" className="hidden px-3 py-4 lg:absolute lg:bottom-0 lg:block">
          <button className="text-sm text-suave hover:text-texto">Sair</button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
