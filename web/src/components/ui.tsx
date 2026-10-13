import type { ReactNode } from "react";

export function Cartao({ titulo, children, className = "" }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borda bg-card p-4 sm:p-5 ${className}`}>
      {titulo && <h2 className="mb-3 text-sm font-semibold text-suave">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-borda p-6 text-center sm:p-10">
      <p className="font-medium">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-prose text-sm text-suave">{children}</div>}
    </div>
  );
}

const cores = { ok: "bg-ok", atencao: "bg-atencao", erro: "bg-erro", neutro: "bg-suave" } as const;

export function Selo({ tom, children }: { tom: keyof typeof cores; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`size-2 rounded-full ${cores[tom]}`} aria-hidden />
      {children}
    </span>
  );
}

export function Numero({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="rounded-xl border border-borda bg-card p-4">
      <p className="text-xs text-suave">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
