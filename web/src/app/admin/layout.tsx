import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { exigirSuperAdmin } from "@/lib/sessao";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigirSuperAdmin();
  return (
    <Shell
      area="Administração da plataforma"
      nav={[
        { href: "/admin", rotulo: "Lojas" },
        { href: "/admin/agentes", rotulo: "Modelos de agentes", emBreve: true },
        { href: "/admin/uso", rotulo: "Uso e cobrança", emBreve: true },
        { href: "/admin/restricoes", rotulo: "Bloqueio por UF", emBreve: true },
      ]}
    >
      {children}
    </Shell>
  );
}
