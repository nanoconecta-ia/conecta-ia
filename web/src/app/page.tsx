import Link from "next/link";

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Conecta<span className="text-marca">.IA</span>
      </h1>
      <p className="text-suave">
        Cadastre no ERP uma vez. O Conecta.IA espelha o catálogo, melhora o cadastro com evidência e mostra a loja
        antes de publicar.
      </p>
      <Link href="/entrar" className="w-fit rounded-lg bg-marca px-4 py-2.5 font-medium text-marca-texto">
        Entrar
      </Link>
    </main>
  );
}
