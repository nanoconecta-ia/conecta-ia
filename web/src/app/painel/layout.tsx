import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { Vazio } from "@/components/ui";
import { exigirLojista } from "@/lib/sessao";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const { loja } = await exigirLojista();
  return (
    <Shell
      area="Painel do lojista"
      subtitulo={loja?.nome}
      nav={[
        { href: "/painel", rotulo: "Visão geral" },
        { href: "/painel/publicar", rotulo: "Antes de publicar" },
        { href: "/painel/catalogo", rotulo: "Catálogo" },
        { href: "/painel/bling", rotulo: "Bling" },
        { href: "/painel/taxonomia", rotulo: "Categorias", emBreve: true },
        { href: "/painel/vendas", rotulo: "Regras de venda", emBreve: true },
        { href: "/painel/aparencia", rotulo: "Aparência do site", emBreve: true },
        { href: "/painel/integracoes", rotulo: "Google e redes", emBreve: true },
      ]}
    >
      {loja ? (
        children
      ) : (
        <Vazio titulo="Sua conta ainda não está vinculada a uma loja">
          Peça ao administrador da plataforma para vincular o seu acesso à sua loja.
        </Vazio>
      )}
    </Shell>
  );
}
