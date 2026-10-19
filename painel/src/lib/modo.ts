// Modo demonstração: SÓ em desenvolvimento (npm run dev) e com ?demo=1. No build de produção `import.meta.env.DEV` vira `false`,
// o ramo é eliminado e nenhum dado de exemplo entra no pacote nem aparece na tela.
export const DEMO: boolean = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
